import { describe, expect, it } from "vitest";
import {
  normalizeTicketPriorityFilter,
  normalizeTicketSlaFilter,
  normalizeTicketStatusFilter,
  ticketMatchesPriority,
  ticketMatchesSlaStatus,
} from "@/lib/tickets/list-filters";

describe("ticket list filters", () => {
  it("maps dashboard SLA links onto the filter values the list understands", () => {
    expect(normalizeTicketSlaFilter("breached")).toBe("breach");
    expect(normalizeTicketSlaFilter("at-risk")).toBe("warning");
    expect(normalizeTicketSlaFilter("warning")).toBe("warning");
    expect(normalizeTicketSlaFilter("nope")).toBe("all");
  });

  it("accepts the critical-and-high deep link", () => {
    expect(normalizeTicketPriorityFilter("critical,high")).toBe("critical,high");
    expect(normalizeTicketPriorityFilter("high,critical")).toBe("critical,high");
    expect(ticketMatchesPriority("critical", "critical,high")).toBe(true);
    expect(ticketMatchesPriority("medium", "critical,high")).toBe(false);
  });

  it("ignores unknown status values", () => {
    expect(normalizeTicketStatusFilter("open")).toBe("open");
    expect(normalizeTicketStatusFilter("archived")).toBe("all");
  });

  it("matches a single SLA status", () => {
    expect(ticketMatchesSlaStatus("breach", "breach")).toBe(true);
    expect(ticketMatchesSlaStatus("on-track", "breach")).toBe(false);
    expect(ticketMatchesSlaStatus("warning", "all")).toBe(true);
  });
});
