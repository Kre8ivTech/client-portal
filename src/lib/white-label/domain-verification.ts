import dns from "node:dns/promises";

function normalizeHostname(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/\.$/, "");
}

export function getExpectedCnameTargets(): string[] {
  const targets = new Set<string>();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const host = new URL(appUrl).hostname;
      const normalized = normalizeHostname(host);
      if (normalized) targets.add(normalized);
    } catch {
      const normalized = normalizeHostname(appUrl);
      if (normalized) targets.add(normalized);
    }
  }

  const extraTargets = (process.env.WHITE_LABEL_CNAME_TARGETS || "")
    .split(",")
    .map((item) => normalizeHostname(item))
    .filter((item): item is string => Boolean(item));

  extraTargets.forEach((item) => targets.add(item));

  return Array.from(targets);
}

function matchesExpectedTarget(record: string, expectedTargets: string[]): boolean {
  const normalizedRecord = normalizeHostname(record);
  if (!normalizedRecord) return false;

  return expectedTargets.some((target) => {
    return normalizedRecord === target || normalizedRecord.endsWith(`.${target}`);
  });
}

export async function verifyDomainCname(domain: string): Promise<{
  verified: boolean;
  records: string[];
  expectedTargets: string[];
  reason?: string;
}> {
  const normalizedDomain = normalizeHostname(domain);
  if (!normalizedDomain) {
    return {
      verified: false,
      records: [],
      expectedTargets: getExpectedCnameTargets(),
      reason: "Invalid domain format",
    };
  }

  const expectedTargets = getExpectedCnameTargets();
  if (expectedTargets.length === 0) {
    return {
      verified: false,
      records: [],
      expectedTargets,
      reason: "No CNAME verification targets configured",
    };
  }

  try {
    const records = (await dns.resolveCname(normalizedDomain)).map((record) => record.toLowerCase());
    const verified = records.some((record) => matchesExpectedTarget(record, expectedTargets));

    return {
      verified,
      records,
      expectedTargets,
      reason: verified ? undefined : "CNAME target does not match expected value",
    };
  } catch {
    return {
      verified: false,
      records: [],
      expectedTargets,
      reason: "CNAME record not found or DNS lookup failed",
    };
  }
}
