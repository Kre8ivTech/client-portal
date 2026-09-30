import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emailCommentBody,
  emailTicketDraft,
  intakeExternalId,
  ticketNumberFromSubject,
  websiteTicketDraft,
  type EmailIntake,
  type WebsiteIntake,
} from "@/lib/intake/payload";

type Admin = SupabaseClient;

export type IntakeResult =
  | { ok: true; ticketId: string; ticketNumber: number; created: boolean; duplicate: boolean }
  | { ok: false; status: number; error: string };

type Target = { organizationId: string; createdBy: string; matchedUser: boolean };

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function resolveTarget(admin: Admin, email: string): Promise<Target | { error: string }> {
  const { data: matched } = await admin
    .from("users")
    .select("id, organization_id")
    .ilike("email", email)
    .not("organization_id", "is", null)
    .limit(1)
    .maybeSingle();

  const person = matched as { id: string; organization_id: string } | null;
  if (person?.organization_id) {
    return { organizationId: person.organization_id, createdBy: person.id, matchedUser: true };
  }

  const envOrg = process.env.INTAKE_ORGANIZATION_ID?.trim();
  if (envOrg) {
    const { data: staff } = await admin
      .from("users")
      .select("id")
      .eq("organization_id", envOrg)
      .in("role", ["super_admin", "staff", "admin"])
      .limit(1)
      .maybeSingle();
    const owner = staff as { id: string } | null;
    if (!owner) return { error: "INTAKE_ORGANIZATION_ID has no staff user to own the ticket" };
    return { organizationId: envOrg, createdBy: owner.id, matchedUser: false };
  }

  const { data: adminUser } = await admin
    .from("users")
    .select("id, organization_id")
    .in("role", ["super_admin", "admin"])
    .not("organization_id", "is", null)
    .limit(1)
    .maybeSingle();
  const fallback = adminUser as { id: string; organization_id: string } | null;
  if (!fallback?.organization_id) return { error: "No organization is configured to receive website requests" };
  return { organizationId: fallback.organization_id, createdBy: fallback.id, matchedUser: false };
}

async function tooManyRecent(admin: Admin, email: string): Promise<boolean> {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("inbound_requests")
    .select("id", { count: "exact", head: true })
    .ilike("email", email)
    .gte("created_at", since);
  return (count ?? 0) >= 5;
}

async function existingRequest(admin: Admin, externalId: string): Promise<IntakeResult | null> {
  const { data } = await admin
    .from("inbound_requests")
    .select("ticket_id, tickets(id, ticket_number)")
    .eq("external_id", externalId)
    .maybeSingle();
  const row = data as { ticket_id: string | null; tickets?: { id: string; ticket_number: number } | { id: string; ticket_number: number }[] | null } | null;
  const ticket = one(row?.tickets);
  if (!row?.ticket_id || !ticket) return null;
  return { ok: true, ticketId: ticket.id, ticketNumber: ticket.ticket_number, created: false, duplicate: true };
}

async function insertTicket(
  admin: Admin,
  target: Target,
  draft: { subject: string; description: string; category: string; tags: string[] },
): Promise<{ id: string; ticket_number: number } | { error: string }> {
  const { data, error } = await admin
    .from("tickets")
    .insert({
      organization_id: target.organizationId,
      created_by: target.createdBy,
      subject: draft.subject,
      description: draft.description,
      priority: "medium",
      category: draft.category,
      status: "new",
      tags: draft.tags,
    })
    .select("id, ticket_number")
    .single();
  if (error || !data) return { error: error?.message || "Could not create the ticket" };
  return data as { id: string; ticket_number: number };
}

export async function receiveWebsiteRequest(admin: Admin, input: WebsiteIntake): Promise<IntakeResult> {
  if (await tooManyRecent(admin, input.email)) {
    return { ok: false, status: 429, error: "Too many requests from this email. Try again shortly." };
  }

  const externalId = input.idempotencyKey || intakeExternalId(["website", input.email, input.source, input.message]);
  const duplicate = await existingRequest(admin, externalId);
  if (duplicate) return duplicate;

  const target = await resolveTarget(admin, input.email);
  if ("error" in target) return { ok: false, status: 422, error: target.error };

  const draft = websiteTicketDraft(input);
  const ticket = await insertTicket(admin, target, draft);
  if ("error" in ticket) return { ok: false, status: 500, error: ticket.error };

  const { error } = await admin.from("inbound_requests").insert({
    source: "website",
    external_id: externalId,
    email: input.email,
    name: input.name,
    subject: draft.subject,
    ticket_id: ticket.id,
    payload: input,
  });
  if (error && !/duplicate key/i.test(error.message)) {
    return { ok: false, status: 500, error: error.message };
  }

  return { ok: true, ticketId: ticket.id, ticketNumber: ticket.ticket_number, created: true, duplicate: false };
}

export async function receiveEmailRequest(admin: Admin, input: EmailIntake): Promise<IntakeResult> {
  if (await tooManyRecent(admin, input.from)) {
    return { ok: false, status: 429, error: "Too many emails from this address. Try again shortly." };
  }

  const externalId = input.messageId || intakeExternalId(["email", input.from, input.subject, input.text]);
  const duplicate = await existingRequest(admin, externalId);
  if (duplicate) return duplicate;

  const target = await resolveTarget(admin, input.from);
  if ("error" in target) return { ok: false, status: 422, error: target.error };

  const ticketNumber = ticketNumberFromSubject(input.subject);
  if (ticketNumber) {
    const { data: existing } = await admin
      .from("tickets")
      .select("id, ticket_number, organization_id")
      .eq("ticket_number", ticketNumber)
      .maybeSingle();
    const ticket = existing as { id: string; ticket_number: number; organization_id: string } | null;
    if (ticket && target.matchedUser && ticket.organization_id === target.organizationId) {
      const { error: commentError } = await admin.from("ticket_comments").insert({
        ticket_id: ticket.id,
        author_id: target.createdBy,
        content: emailCommentBody(input),
        is_internal: false,
        is_intel: false,
      });
      if (commentError) return { ok: false, status: 500, error: commentError.message };
      await admin.from("inbound_requests").insert({
        source: "email",
        external_id: externalId,
        email: input.from,
        name: input.fromName || null,
        subject: input.subject,
        ticket_id: ticket.id,
        payload: input,
      });
      return { ok: true, ticketId: ticket.id, ticketNumber: ticket.ticket_number, created: false, duplicate: false };
    }
  }

  const draft = emailTicketDraft(input);
  if (ticketNumber) {
    draft.description = `Referenced ticket #${ticketNumber}. A new ticket was opened because this sender is not a user on that account.\n\n${draft.description}`;
  }
  const ticket = await insertTicket(admin, target, draft);
  if ("error" in ticket) return { ok: false, status: 500, error: ticket.error };

  const { error } = await admin.from("inbound_requests").insert({
    source: "email",
    external_id: externalId,
    email: input.from,
    name: input.fromName || null,
    subject: draft.subject,
    ticket_id: ticket.id,
    payload: input,
  });
  if (error && !/duplicate key/i.test(error.message)) {
    return { ok: false, status: 500, error: error.message };
  }

  return { ok: true, ticketId: ticket.id, ticketNumber: ticket.ticket_number, created: true, duplicate: false };
}
