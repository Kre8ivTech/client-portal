import { normalizeDashboardRole } from "@/lib/require-role";
import { resolveBillableOrgIds } from "@/lib/invoices/billable-clients";

export const CONTRACT_RECIPIENT_ROLES = ["client", "partner", "partner_staff"] as const;
export const CONTRACT_RECIPIENT_STATUSES = ["active", "invited"] as const;

/**
 * Columns that exist on public.users. `full_name` is not a users column;
 * the display name comes from profiles.name.
 */
export const CONTRACT_RECIPIENT_SELECT =
  "id, email, role, status, organization_id, profiles(name), organizations(name)";

export type ContractRecipient = {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
};

export type ContractRecipientRow = {
  id: string;
  email: string;
  role?: string | null;
  status?: string | null;
  organization_id: string | null;
  profiles?: { name?: string | null } | { name?: string | null }[] | null;
  organizations?: { name?: string | null } | { name?: string | null }[] | null;
};

type QueryError = { message: string } | null;

export type ContractRecipientsClient = {
  from: (table: string) => {
    select: (columns: string) => Record<string, unknown>;
  };
};

export type ContractRecipientLoaderProfile = {
  organization_id: string | null;
  role: string;
};

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

function relationName(
  value: { name?: string | null } | { name?: string | null }[] | null | undefined,
): string | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  const name = row?.name?.trim();
  return name || null;
}

export function canLoadContractRecipients(role: string): boolean {
  const normalized = normalizeDashboardRole(role);
  return normalized === "super_admin" || normalized === "staff";
}

export function mapContractRecipientRows(
  rows: ContractRecipientRow[],
  currentUserId: string,
): ContractRecipient[] {
  return rows
    .filter((row) => {
      if (row.id === currentUserId || !row.organization_id || !row.email) return false;
      const role = row.role ?? "";
      const status = row.status ?? "active";
      return (
        (CONTRACT_RECIPIENT_ROLES as readonly string[]).includes(role) &&
        (CONTRACT_RECIPIENT_STATUSES as readonly string[]).includes(status)
      );
    })
    .map((row) => {
      const organizationName = relationName(row.organizations) || "Organization";
      const personName = relationName(row.profiles) || row.email;
      return {
        id: row.id,
        email: row.email,
        organizationId: row.organization_id as string,
        organizationName,
        name: `${personName} (${organizationName})`,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function awaitQuery<T>(query: unknown): Promise<{ data: T | null; error: QueryError }> {
  return query as Promise<{ data: T | null; error: QueryError }>;
}

export async function loadContractRecipients(
  supabase: ContractRecipientsClient,
  profile: ContractRecipientLoaderProfile,
  currentUserId: string,
): Promise<ContractRecipient[]> {
  if (!canLoadContractRecipients(profile.role)) {
    return [];
  }

  const role = normalizeDashboardRole(profile.role);
  let orgIds: string[] = [];

  if (role === "super_admin") {
    const orgsQuery = supabase.from("organizations").select("id") as {
      in: (column: string, values: readonly string[]) => unknown;
    };
    const { data, error } = await awaitQuery<{ id: string }[]>(
      orgsQuery.in("status", ["active", "inactive"]),
    );
    if (error) throw new Error(error.message);
    orgIds = uniqueIds((data ?? []).map((row) => row.id));
  } else if (!profile.organization_id) {
    return [];
  } else {
    const orgsQuery = supabase.from("organizations").select("id") as {
      eq: (column: string, value: string) => {
        in: (column: string, values: readonly string[]) => unknown;
      };
    };
    const { data, error } = await awaitQuery<{ id: string }[]>(
      orgsQuery.eq("parent_org_id", profile.organization_id).in("status", ["active", "inactive"]),
    );
    if (error) throw new Error(error.message);
    orgIds = resolveBillableOrgIds({
      role: profile.role,
      organizationId: profile.organization_id,
      allOrgIds: [],
      childOrgIds: (data ?? []).map((row) => row.id),
    });
  }

  if (orgIds.length === 0) {
    return [];
  }

  const usersQuery = supabase.from("users").select(CONTRACT_RECIPIENT_SELECT) as {
    in: (column: string, values: readonly string[]) => {
      in: (column: string, values: readonly string[]) => {
        in: (column: string, values: readonly string[]) => {
          order: (column: string, options: { ascending: boolean }) => unknown;
        };
      };
    };
  };

  const { data, error } = await awaitQuery<ContractRecipientRow[]>(
    usersQuery
      .in("organization_id", orgIds)
      .in("role", CONTRACT_RECIPIENT_ROLES)
      .in("status", CONTRACT_RECIPIENT_STATUSES)
      .order("email", { ascending: true }),
  );

  if (error) throw new Error(error.message);
  return mapContractRecipientRows(data ?? [], currentUserId);
}
