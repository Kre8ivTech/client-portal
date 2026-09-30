import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";

export const WEBSITE_SOURCES = ["book-a-call", "project-request", "contact"] as const;
export type WebsiteSource = (typeof WEBSITE_SOURCES)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined);

export const websiteIntakeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: optionalText(40),
  company: optionalText(160),
  message: z.string().trim().min(10).max(5000),
  source: z.enum(WEBSITE_SOURCES),
  service: optionalText(160),
  website: optionalText(300),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

export type WebsiteIntake = z.infer<typeof websiteIntakeSchema>;

export const emailIntakeSchema = z.object({
  from: z.string().trim().email().max(200),
  fromName: optionalText(120),
  subject: z.string().trim().min(1).max(300),
  text: z.string().trim().min(1).max(20000),
  messageId: z.string().trim().max(300).optional(),
});

export type EmailIntake = z.infer<typeof emailIntakeSchema>;

export type TicketDraft = {
  subject: string;
  description: string;
  category: string;
  tags: string[];
};

const SOURCE_TITLES: Record<WebsiteSource, string> = {
  "book-a-call": "Call request",
  "project-request": "Project request",
  contact: "Website message",
};

export function intakeSecretMatches(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function readIntakeSecret(header: string | null, authorization: string | null): string | null {
  if (header?.trim()) return header.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return null;
}

export function intakeExternalId(parts: string[]): string {
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

export function ticketNumberFromSubject(subject: string): number | null {
  const match = subject.match(/(?:^|\s)#(\d{1,8})\b|(?:KT-|ticket\s*#?)(\d{1,8})\b/i);
  if (!match) return null;
  const value = Number(match[1] || match[2]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function websiteTicketDraft(input: WebsiteIntake): TicketDraft {
  const lines = [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    input.phone ? `Phone: ${input.phone}` : "",
    input.company ? `Company: ${input.company}` : "",
    input.service ? `Service: ${input.service}` : "",
    input.website ? `Website: ${input.website}` : "",
    `Source: ${input.source}`,
    "",
    input.message,
  ].filter((line) => line !== "");

  return {
    subject: `${SOURCE_TITLES[input.source]} from ${input.name}`.slice(0, 200),
    description: lines.join("\n"),
    category: input.source === "project-request" ? "feature_request" : "technical_support",
    tags: ["intake", "website", input.source],
  };
}

export function emailTicketDraft(input: EmailIntake): TicketDraft {
  const who = input.fromName ? `${input.fromName} <${input.from}>` : input.from;
  return {
    subject: input.subject.slice(0, 200),
    description: `Email from ${who}\n\n${input.text}`,
    category: "technical_support",
    tags: ["intake", "email"],
  };
}

export function emailCommentBody(input: EmailIntake): string {
  const who = input.fromName ? `${input.fromName} <${input.from}>` : input.from;
  return `Email from ${who}\n\n${input.text}`;
}

export function normalizeEmailBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const record = body as Record<string, unknown>;
  if (record.type !== "email.received" || !record.data || typeof record.data !== "object") return body;
  const data = record.data as Record<string, unknown>;
  const from = String(data.from || "");
  const emailMatch = from.match(/<([^>]+)>/);
  const text = typeof data.text === "string" ? data.text : typeof data.html === "string" ? data.html : "";
  return {
    from: (emailMatch?.[1] || from).trim(),
    fromName: emailMatch ? from.replace(emailMatch[0], "").replace(/"/g, "").trim() : undefined,
    subject: data.subject,
    text,
    messageId: data.message_id || data.email_id,
  };
}
