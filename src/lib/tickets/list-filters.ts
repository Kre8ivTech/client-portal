const STATUS_FILTERS = new Set([
  "all",
  "new",
  "open",
  "in_progress",
  "pending_client",
  "resolved",
  "closed",
  "cancelled",
]);

const PRIORITY_FILTERS = new Set(["all", "critical", "high", "medium", "low", "critical,high"]);

const SLA_FILTERS = new Set(["all", "breach", "critical", "warning", "on-track"]);

const SLA_ALIASES: Record<string, string> = {
  breached: "breach",
  "at-risk": "warning",
  at_risk: "warning",
  "on_track": "on-track",
};

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeTicketStatusFilter(value: string | null | undefined): string {
  const token = normalizeToken(value);
  return STATUS_FILTERS.has(token) ? token : "all";
}

export function normalizeTicketPriorityFilter(value: string | null | undefined): string {
  const token = normalizeToken(value);
  if (PRIORITY_FILTERS.has(token)) return token;
  const parts = token
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .sort();
  if (parts.length > 0 && parts.every((part) => part === "critical" || part === "high")) {
    return "critical,high";
  }
  return "all";
}

export function normalizeTicketSlaFilter(value: string | null | undefined): string {
  const token = normalizeToken(value);
  const mapped = SLA_ALIASES[token] ?? token;
  return SLA_FILTERS.has(mapped) ? mapped : "all";
}

export function ticketMatchesPriority(ticketPriority: string | null | undefined, filter: string): boolean {
  if (filter === "all") return true;
  const allowed = filter.split(",").map((part) => part.trim());
  return allowed.includes(ticketPriority ?? "");
}

export function ticketMatchesSlaStatus(slaStatus: string, filter: string): boolean {
  if (filter === "all") return true;
  return slaStatus === filter;
}
