import dns from "node:dns/promises";

export function normalizeCustomDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const withoutProtocol = trimmed.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const host = withoutProtocol.split("/")[0]?.split(":")[0] ?? "";
  if (!host || host === "localhost" || host.includes("..")) return null;

  const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
  if (!domainPattern.test(host)) return null;
  return host;
}

export type CustomDomainVerificationPatch = {
  custom_domain_verified?: boolean;
  custom_domain_verified_at?: string | null;
};

function canonicalCustomDomain(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeCustomDomain(trimmed) ?? trimmed.toLowerCase();
}

/**
 * Decide which verification columns a branding save may write.
 *
 * Partner forms disable the verification checkbox, and disabled checkboxes are
 * omitted from FormData. Treating that omission as "unverified" clears a
 * verified domain on every save and drops the public login back to platform
 * branding. Non-staff saves therefore leave both columns untouched when the
 * domain string did not change. A changed domain always resets verification.
 * Staff may still set or clear the checkbox while the domain stays the same.
 */
export function resolveCustomDomainVerificationUpdate(input: {
  previousDomain: string | null | undefined;
  nextDomain: string | null;
  isStaffAdmin: boolean;
  verificationChecked: boolean;
  now: string;
}): CustomDomainVerificationPatch {
  const domainChanged = canonicalCustomDomain(input.previousDomain) !== canonicalCustomDomain(input.nextDomain);

  if (domainChanged) {
    return {
      custom_domain_verified: false,
      custom_domain_verified_at: null,
    };
  }

  if (!input.isStaffAdmin) {
    return {};
  }

  if (input.verificationChecked && input.nextDomain) {
    return {
      custom_domain_verified: true,
      custom_domain_verified_at: input.now,
    };
  }

  if (!input.verificationChecked) {
    return {
      custom_domain_verified: false,
      custom_domain_verified_at: null,
    };
  }

  return {};
}

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
