export const SITE_MONITOR_TARGET_ERROR =
  "You can only add a site for one of your client organizations";

export type SiteMonitorTarget = {
  parentOrgId: string | null;
  type: string | null;
};

export type SiteMonitorAccessInput = {
  role: string;
  actorOrganizationId: string | null;
  actorOrganizationType: string | null;
  target: SiteMonitorTarget | null;
};

export function isPlatformSiteMonitorManager(role: string): boolean {
  return role === "super_admin" || role === "staff" || role === "admin";
}

export function isPartnerSiteMonitorCreator(role: string): boolean {
  return role === "partner" || role === "partner_staff";
}

/** Staff and super admins keep the existing unrestricted create path. */
export function canOfferSiteMonitorForm(role: string): boolean {
  return isPlatformSiteMonitorManager(role) || isPartnerSiteMonitorCreator(role);
}

/**
 * Partner users add monitors for child client organizations.
 * Platform staff are not limited to that set.
 */
export function siteMonitorFormListsChildClientsOnly(role: string): boolean {
  return isPartnerSiteMonitorCreator(role);
}

export function partnerCanAttachSiteMonitor(input: {
  actorOrganizationId: string | null;
  actorOrganizationType: string | null;
  target: SiteMonitorTarget | null;
}): boolean {
  if (!input.actorOrganizationId || input.actorOrganizationType !== "partner" || !input.target) {
    return false;
  }

  return input.target.type === "client" && input.target.parentOrgId === input.actorOrganizationId;
}

export function canCreateSiteMonitor(input: SiteMonitorAccessInput): boolean {
  if (isPlatformSiteMonitorManager(input.role)) return true;
  if (!isPartnerSiteMonitorCreator(input.role)) return false;
  return partnerCanAttachSiteMonitor(input);
}
