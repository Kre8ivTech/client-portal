export const PLATFORM_STAFF_ROLES = ["super_admin", "admin", "staff"] as const;

export interface MessageableUser {
  id: string;
  email: string;
  role: string;
  organization_id: string;
  profiles: {
    name: string | null;
    avatar_url: string | null;
    presence_status: string | null;
  } | null;
  organization: {
    name: string;
  } | null;
}

type ProfileRelation = {
  name?: string | null;
  avatar_url?: string | null;
  presence_status?: string | null;
};

type OrganizationRelation = {
  name?: string | null;
};

export type MessageableCandidate = {
  id: string;
  email: string;
  role: string;
  organization_id: string | null;
  status?: string | null;
  profiles?: ProfileRelation | ProfileRelation[] | null;
  organization?: OrganizationRelation | OrganizationRelation[] | null;
};

export type MessageableScope = {
  role: string;
  organizationId: string | null;
  parentOrgId: string | null;
  childOrgIds: string[];
};

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function isPlatformStaffRole(role: string): boolean {
  return (PLATFORM_STAFF_ROLES as readonly string[]).includes(role);
}

export function isPartnerDirectoryRole(role: string): boolean {
  return role === "partner" || role === "partner_staff";
}

/**
 * Organizations whose users may appear in the new-message picker.
 * Staff see every organization the query returns. Partners see their own org,
 * child client orgs, and the parent platform org. Clients stay in their own org.
 */
export function messageableOrganizationIds(scope: MessageableScope): string[] | "all" {
  if (scope.role === "super_admin" || scope.role === "admin" || scope.role === "staff") {
    return "all";
  }

  if (isPartnerDirectoryRole(scope.role)) {
    return uniqueIds([scope.organizationId, scope.parentOrgId, ...scope.childOrgIds]);
  }

  return uniqueIds([scope.organizationId]);
}

function matchesSearch(user: MessageableCandidate, search: string): boolean {
  if (!search) return true;
  const name = firstRelation(user.profiles)?.name ?? "";
  return user.email.toLowerCase().includes(search) || name.toLowerCase().includes(search);
}

export function filterMessageableUsers(
  scope: MessageableScope & { currentUserId: string },
  users: MessageableCandidate[],
  searchQuery: string,
): MessageableUser[] {
  const allowed = messageableOrganizationIds(scope);
  const allowedIds = allowed === "all" ? null : new Set(allowed);
  const search = searchQuery.trim().toLowerCase();
  const partner = isPartnerDirectoryRole(scope.role);

  const results = users.filter((user) => {
    if ((user.status ?? "active") !== "active" || !user.organization_id) return false;
    if (allowedIds && !allowedIds.has(user.organization_id)) return false;

    const parentOrgOnly =
      partner &&
      scope.parentOrgId != null &&
      user.organization_id === scope.parentOrgId &&
      user.organization_id !== scope.organizationId;
    if (parentOrgOnly && !isPlatformStaffRole(user.role)) return false;

    return matchesSearch(user, search);
  });

  return results
    .map((user) => {
      const profile = firstRelation(user.profiles);
      const organization = firstRelation(user.organization);
      const organizationName = organization?.name?.trim();
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id as string,
        profiles: profile
          ? {
              name: profile.name ?? null,
              avatar_url: profile.avatar_url ?? null,
              presence_status: profile.presence_status ?? null,
            }
          : null,
        organization: organizationName ? { name: organizationName } : null,
      };
    })
    .sort((a, b) => {
      const aName = a.profiles?.name || a.email;
      const bName = b.profiles?.name || b.email;
      return aName.localeCompare(bName);
    });
}
