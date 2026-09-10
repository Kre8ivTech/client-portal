import { canCreateInvoices, normalizeDashboardRole } from "@/lib/require-role";

export const BILLABLE_ORG_STATUSES = ["active", "inactive"] as const;
export const BILLABLE_USER_ROLES = ["client", "partner", "partner_staff"] as const;
export const BILLABLE_USER_STATUSES = ["active", "invited"] as const;

export type BillableClient = {
  id: string;
  full_name: string;
  email: string;
  organization_id: string;
  organization_name: string;
};

export type InvoiceCreatorProfile = {
  id: string;
  organization_id: string | null;
  role: string;
  is_account_manager: boolean;
};

export type BillableClientRow = {
  id: string;
  email: string;
  role?: string | null;
  status?: string | null;
  organization_id: string | null;
  profiles?: { name?: string | null } | { name?: string | null }[] | null;
  organizations?: { name?: string | null } | { name?: string | null }[] | null;
};

type QueryError = { message: string } | null;

export type BillableClientsClient = {
  from: (table: string) => {
    select: (columns: string) => Record<string, unknown>;
  };
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

export function isInvoiceCreator(profile: InvoiceCreatorProfile): boolean {
  return canCreateInvoices(
    normalizeDashboardRole(profile.role),
    profile.is_account_manager,
  );
}

export function resolveBillableOrgIds(args: {
  role: string;
  organizationId: string | null;
  allOrgIds: string[];
  childOrgIds: string[];
}): string[] {
  const role = normalizeDashboardRole(args.role);
  if (role === "super_admin") {
    return uniqueIds(args.allOrgIds);
  }

  return uniqueIds([args.organizationId, ...args.childOrgIds]);
}

export function mapBillableClientRows(
  rows: BillableClientRow[],
  currentUserId: string,
): BillableClient[] {
  return rows
    .filter((row) => {
      if (row.id === currentUserId || !row.organization_id) return false;
      const role = row.role ?? "client";
      return (BILLABLE_USER_ROLES as readonly string[]).includes(role);
    })
    .map((row) => ({
      id: row.id,
      email: row.email,
      organization_id: row.organization_id as string,
      full_name: relationName(row.profiles) || row.email,
      organization_name: relationName(row.organizations) || "Unknown Organization",
    }))
    .sort((a, b) => {
      const org = a.organization_name.localeCompare(b.organization_name);
      if (org !== 0) return org;
      return a.full_name.localeCompare(b.full_name);
    });
}

async function awaitQuery<T>(query: unknown): Promise<{ data: T | null; error: QueryError }> {
  return query as Promise<{ data: T | null; error: QueryError }>;
}

export async function loadBillableClients(
  supabase: BillableClientsClient,
  profile: InvoiceCreatorProfile,
  currentUserId: string,
): Promise<BillableClient[]> {
  if (!isInvoiceCreator(profile)) {
    return [];
  }

  const role = normalizeDashboardRole(profile.role);
  let orgIds: string[] = [];

  if (role === "super_admin") {
    const orgsQuery = supabase.from("organizations").select("id") as {
      in: (column: string, values: readonly string[]) => unknown;
    };
    const { data, error } = await awaitQuery<{ id: string }[]>(
      orgsQuery.in("status", BILLABLE_ORG_STATUSES),
    );
    if (error) throw new Error(error.message);
    orgIds = (data ?? []).map((row) => row.id);
  } else if (!profile.organization_id) {
    return [];
  } else {
    const orgsQuery = supabase.from("organizations").select("id") as {
      eq: (column: string, value: string) => {
        in: (column: string, values: readonly string[]) => unknown;
      };
    };
    const { data, error } = await awaitQuery<{ id: string }[]>(
      orgsQuery.eq("parent_org_id", profile.organization_id).in("status", BILLABLE_ORG_STATUSES),
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

  const usersQuery = supabase.from("users").select(
    "id, email, role, status, organization_id, profiles(name), organizations(name)",
  ) as {
    in: (column: string, values: readonly string[]) => {
      in: (column: string, values: readonly string[]) => {
        in: (column: string, values: readonly string[]) => {
          order: (column: string, options: { ascending: boolean }) => unknown;
        };
      };
    };
  };

  const { data, error } = await awaitQuery<BillableClientRow[]>(
    usersQuery
      .in("organization_id", orgIds)
      .in("role", BILLABLE_USER_ROLES)
      .in("status", BILLABLE_USER_STATUSES)
      .order("email", { ascending: true }),
  );

  if (error) throw new Error(error.message);
  return mapBillableClientRows(data ?? [], currentUserId);
}
