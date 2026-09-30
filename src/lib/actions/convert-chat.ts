"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { chatTicketDraft } from "@/lib/support/chat-transcript";

export async function convertChatToTicket(sessionId: string) {
  const { user } = await requireRole(["super_admin", "staff", "partner", "partner_staff"]);
  const parsed = z.string().uuid().safeParse(sessionId);
  if (!parsed.success) return { success: false as const, error: "Choose a chat" };

  const admin = getSupabaseAdmin();
  const { data: session, error } = await admin
    .from("chat_sessions")
    .select("id, organization_id, visitor_name, visitor_email, converted_ticket_id, status")
    .eq("id", parsed.data)
    .maybeSingle();
  if (error || !session) return { success: false as const, error: "Chat not found" };

  const row = session as {
    id: string;
    organization_id: string | null;
    visitor_name: string | null;
    visitor_email: string | null;
    converted_ticket_id: string | null;
  };
  if (row.converted_ticket_id) {
    return { success: true as const, ticketId: row.converted_ticket_id, created: false };
  }
  if (!row.organization_id) return { success: false as const, error: "This chat has no organization" };

  const { data: messages } = await admin
    .from("chat_messages")
    .select("sender_type, content, is_internal, created_at")
    .eq("session_id", row.id)
    .order("created_at", { ascending: true });

  const draft = chatTicketDraft({
    visitorName: row.visitor_name || "Website visitor",
    visitorEmail: row.visitor_email,
    messages: (messages ?? []) as { sender_type: string; content: string; is_internal: boolean | null }[],
  });

  const { data: ticket, error: ticketError } = await admin
    .from("tickets")
    .insert({
      organization_id: row.organization_id,
      created_by: user.id,
      subject: draft.subject,
      description: draft.description,
      priority: "medium",
      category: "technical_support",
      status: "new",
      tags: ["intake", "live-chat"],
    })
    .select("id")
    .single();
  if (ticketError || !ticket) return { success: false as const, error: ticketError?.message || "Could not create the ticket" };

  const ticketId = (ticket as { id: string }).id;
  const { error: linkError } = await admin.from("chat_sessions").update({ converted_ticket_id: ticketId }).eq("id", row.id);
  if (linkError) return { success: false as const, error: linkError.message };

  revalidatePath("/dashboard/support/chats");
  return { success: true as const, ticketId, created: true };
}
