import { NextResponse } from "next/server";
import { z } from "zod";
import { requireQuickBooksManager } from "@/lib/quickbooks/access";
import { getConnectedQuickBooksClient } from "@/lib/quickbooks/connection";
import { loadBillableClients } from "@/lib/invoices/billable-clients";

const syncSchema = z.object({
  max_results: z.number().int().min(1).max(1000).optional(),
});

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * List mapped QuickBooks customers for the current organization.
 * GET /api/quickbooks/customers
 */
export async function GET() {
  try {
    const access = await requireQuickBooksManager();
    if (!access.ok) return access.response;

    const { data, error } = await access.supabase
      .from("quickbooks_customers")
      .select(
        "id, organization_id, portal_user_id, portal_organization_id, qb_customer_id, display_name, email, synced_at",
      )
      .eq("organization_id", access.actor.organizationId)
      .order("display_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    console.error("Error listing QuickBooks customers:", error);
    return NextResponse.json({ error: "Failed to list QuickBooks customers" }, { status: 500 });
  }
}

/**
 * Pull QuickBooks customers and map them to portal clients in scope.
 * POST /api/quickbooks/customers
 */
export async function POST(request: Request) {
  try {
    const access = await requireQuickBooksManager();
    if (!access.ok) return access.response;

    const body = await request.json().catch(() => ({}));
    const parsed = syncSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { client } = await getConnectedQuickBooksClient(
      access.supabase,
      access.actor.organizationId,
    );
    const qbCustomers = await client.listCustomers(parsed.data.max_results ?? 100);
    const portalClients = await loadBillableClients(
      access.supabase,
      {
        id: access.actor.userId,
        organization_id: access.actor.organizationId,
        role: access.actor.role,
        is_account_manager: access.actor.isAccountManager,
      },
      access.actor.userId,
    );

    const now = new Date().toISOString();
    const rows = qbCustomers.map((customer) => {
      const display = customer.DisplayName?.trim() || "Unnamed customer";
      const email = customer.PrimaryEmailAddr?.Address?.trim().toLowerCase() ?? null;
      const match =
        portalClients.find((portal) => email && portal.email.toLowerCase() === email) ||
        portalClients.find(
          (portal) => normalizeName(portal.organization_name) === normalizeName(display),
        ) ||
        portalClients.find((portal) => normalizeName(portal.full_name) === normalizeName(display));

      return {
        organization_id: access.actor.organizationId,
        portal_user_id: match?.id ?? null,
        portal_organization_id: match?.organization_id ?? null,
        qb_customer_id: customer.Id,
        display_name: display,
        email: customer.PrimaryEmailAddr?.Address ?? null,
        synced_at: now,
      };
    });

    if (rows.length > 0) {
      const { error } = await access.supabase
        .from("quickbooks_customers")
        .upsert(rows, { onConflict: "organization_id,qb_customer_id" });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    await access.supabase
      .from("quickbooks_integrations")
      .update({ last_sync_at: now, sync_status: "idle", sync_error: null })
      .eq("organization_id", access.actor.organizationId);

    return NextResponse.json({
      success: true,
      synced: rows.length,
      mapped: rows.filter((row) => row.portal_user_id).length,
      data: rows,
    });
  } catch (error) {
    console.error("Error syncing QuickBooks customers:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to sync QuickBooks customers",
      },
      { status: 500 },
    );
  }
}
