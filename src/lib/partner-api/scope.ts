export const PARTNER_SITE_TARGET_ERROR =
  "You can only add a site for one of your client organizations";

export type PartnerOrgRecord = {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  status: string | null;
  parent_org_id: string | null;
  custom_domain: string | null;
};

export type PartnerKeyRecord = {
  id: string;
  organization_id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  revoked_at: string | null;
};

export function partnerKeyIsUsable(key: PartnerKeyRecord | null): key is PartnerKeyRecord {
  return Boolean(key && key.is_active && !key.revoked_at);
}

export function isChildClientOf(
  organization: Pick<PartnerOrgRecord, "parent_org_id" | "type"> | null,
  partnerOrganizationId: string,
): boolean {
  return Boolean(
    organization &&
      organization.type === "client" &&
      organization.parent_org_id === partnerOrganizationId,
  );
}

/**
 * Partner keys follow the dashboard rule: a child client of the key's org.
 * A platform (kre8ivtech) key uses the same child-client boundary so it
 * cannot read another partner's clients.
 */
export function apiKeyCanAttachSiteMonitor(input: {
  actorOrganizationId: string;
  actorOrganizationType: string | null;
  target: { parentOrgId: string | null; type: string | null } | null;
}): boolean {
  if (!input.target || input.target.type !== "client") return false;
  if (input.target.parentOrgId !== input.actorOrganizationId) return false;
  return input.actorOrganizationType === "partner" || input.actorOrganizationType === "kre8ivtech";
}

export function canManagePartnerApiKeys(input: {
  role: string;
  organizationType: string | null;
}): boolean {
  if (input.role === "partner" || input.role === "partner_staff") {
    return input.organizationType === "partner";
  }
  if (input.role === "staff" || input.role === "super_admin" || input.role === "admin") {
    return input.organizationType === "kre8ivtech" || input.organizationType === "partner";
  }
  return false;
}

export function normalizeSiteUrl(value: string): string {
  const parsed = new URL(value);
  parsed.hash = "";
  parsed.search = "";
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.protocol}//${parsed.host}${path}`;
}
