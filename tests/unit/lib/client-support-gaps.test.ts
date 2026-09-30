import { describe, expect, it } from "vitest";
import {
  emailCommentBody,
  intakeExternalId,
  intakeSecretMatches,
  normalizeEmailBody,
  ticketNumberFromSubject,
  websiteIntakeSchema,
  websiteTicketDraft,
} from "@/lib/intake/payload";
import { overagePeriodKey, overageToBill } from "@/lib/billing/plan-overage";
import { chatTicketDraft } from "@/lib/support/chat-transcript";

describe("website intake", () => {
  it("builds a project ticket from a website request", () => {
    const input = websiteIntakeSchema.parse({
      name: "Ada Lovelace",
      email: "ada@example.com",
      company: "Analytical Engines",
      message: "We need a donor portal that replaces our spreadsheet.",
      source: "project-request",
      service: "Custom software",
    });
    const draft = websiteTicketDraft(input);
    expect(draft.subject).toBe("Project request from Ada Lovelace");
    expect(draft.category).toBe("feature_request");
    expect(draft.description).toContain("ada@example.com");
    expect(draft.tags).toContain("website");
  });

  it("accepts a matching intake secret and rejects a different one", () => {
    expect(intakeSecretMatches("abc123", "abc123")).toBe(true);
    expect(intakeSecretMatches("abc123", "abc124")).toBe(false);
    expect(intakeSecretMatches(null, "abc123")).toBe(false);
  });

  it("normalizes a Resend inbound event and finds a ticket number", () => {
    const normalized = normalizeEmailBody({
      type: "email.received",
      data: {
        from: "Ada <ada@example.com>",
        subject: "Re: Help #42",
        text: "Following up on the ticket.",
        email_id: "email_123",
      },
    }) as { from: string; messageId: string };
    expect(normalized.from).toBe("ada@example.com");
    expect(normalized.messageId).toBe("email_123");
    expect(ticketNumberFromSubject("Re: Help #42")).toBe(42);
    expect(ticketNumberFromSubject("KT-17 is down")).toBe(17);
    expect(emailCommentBody({ from: "ada@example.com", subject: "Hi", text: "Hello there" })).toContain("Hello there");
    expect(intakeExternalId(["a", "b"])).toHaveLength(64);
  });
});

describe("plan overage", () => {
  it("bills only the hours that were not already invoiced", () => {
    expect(overageToBill({ usedHours: 12, includedHours: 10, billedHours: 0, hourlyRateCents: 15000 })).toEqual({
      hours: 2,
      amountCents: 30000,
    });
    expect(overageToBill({ usedHours: 12.5, includedHours: 10, billedHours: 2, hourlyRateCents: 10000 })).toEqual({
      hours: 0.5,
      amountCents: 5000,
    });
    expect(overageToBill({ usedHours: 8, includedHours: 10, billedHours: 0, hourlyRateCents: 10000 })).toEqual({
      hours: 0,
      amountCents: 0,
    });
    expect(overagePeriodKey(new Date("2026-09-30T23:30:00.000Z"))).toBe("2026-09");
  });
});

describe("chat to ticket", () => {
  it("keeps visitor messages and skips internal notes", () => {
    const draft = chatTicketDraft({
      visitorName: "Grace",
      visitorEmail: "grace@example.com",
      messages: [
        { sender_type: "visitor", content: "The homepage is down." },
        { sender_type: "agent", content: "Internal: check the host.", is_internal: true },
        { sender_type: "agent", content: "I am looking at it now." },
      ],
    });
    expect(draft.subject).toBe("Live chat with Grace");
    expect(draft.description).toContain("The homepage is down.");
    expect(draft.description).toContain("I am looking at it now.");
    expect(draft.description).not.toContain("check the host");
  });
});
