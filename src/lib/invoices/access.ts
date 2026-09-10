import { normalizeDashboardRole } from "@/lib/require-role";

export type InvoiceAccessViewer = {
  id: string;
  organization_id: string | null;
  role: string;
};

export type InvoiceAccessRecord = {
  organization_id: string;
  client_id: string | null;
  billed_organization_id?: string | null;
};

/** Invoice rows live on the issuer org. Billed clients (and others in the billed client org) may still view them. */
export function canAccessInvoiceDetail(
  viewer: InvoiceAccessViewer,
  invoice: InvoiceAccessRecord,
): boolean {
  const role = normalizeDashboardRole(viewer.role);

  if (role === "super_admin" || role === "staff") {
    return true;
  }

  if (viewer.organization_id && viewer.organization_id === invoice.organization_id) {
    return true;
  }

  if (invoice.client_id && invoice.client_id === viewer.id) {
    return true;
  }

  if (
    viewer.organization_id &&
    invoice.billed_organization_id &&
    viewer.organization_id === invoice.billed_organization_id
  ) {
    return true;
  }

  return false;
}

type BilledClientRow = {
  email?: string | null;
  organization_id?: string | null;
  profiles?: { name?: string | null } | { name?: string | null }[] | null;
  organizations?: { name?: string | null } | { name?: string | null }[] | null;
};

function unwrapClient(
  client: BilledClientRow | BilledClientRow[] | null | undefined,
): BilledClientRow | null {
  if (!client) return null;
  return Array.isArray(client) ? client[0] ?? null : client;
}

export function billedClientDisplayName(
  client: BilledClientRow | BilledClientRow[] | null | undefined,
): string | null {
  const row = unwrapClient(client);
  if (!row) return null;
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const name = profile?.name?.trim();
  if (name) return name;
  return row.email?.trim() || null;
}

export function billedClientOrganizationName(
  client: BilledClientRow | BilledClientRow[] | null | undefined,
): string | null {
  const row = unwrapClient(client);
  if (!row) return null;
  const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  const name = org?.name?.trim();
  return name || null;
}

export function billedClientOrganizationId(
  client: BilledClientRow | BilledClientRow[] | null | undefined,
): string | null {
  return unwrapClient(client)?.organization_id ?? null;
}
