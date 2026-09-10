import { billedCustomerName, getConnectedQuickBooksClient } from "@/lib/quickbooks/connection";
import type { QuickBooksInvoice } from "@/lib/quickbooks/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

type InvoiceForSync = {
  id: string;
  organization_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  notes: string | null;
  tax_amount: number | null;
  client_id: string | null;
  quickbooks_invoice_id: string | null;
  metadata: {
    billed_organization_name?: string;
    billed_organization_id?: string;
    client_id?: string;
  } | null;
  organization: { id: string; name: string } | null;
  client: {
    id: string;
    email: string | null;
    organization_id: string | null;
    profiles?: { name?: string | null } | { name?: string | null }[] | null;
  } | null;
  line_items: LineItem[];
};

export async function syncInvoiceToQuickBooks(
  invoiceId: string,
  issuerOrganizationId: string,
) {
  const supabase = await createServerSupabaseClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      `
        id, organization_id, invoice_number, issue_date, due_date, notes, tax_amount,
        client_id, quickbooks_invoice_id, metadata,
        organization:organizations(id, name),
        client:users!invoices_client_id_fkey(id, email, organization_id, profiles(name)),
        line_items:invoice_line_items(description, quantity, unit_price, amount)
      `
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) throw new Error("Invoice not found");

  const row = invoice as unknown as InvoiceForSync;
  if (row.organization_id !== issuerOrganizationId) {
    throw new Error("Access denied");
  }

  const { client } = await getConnectedQuickBooksClient(supabase, issuerOrganizationId);
  const customerName = billedCustomerName(row);
  const customerResult = await client.findOrCreateCustomer(customerName, row.client?.email);
  const customerId = customerResult.Customer.Id;

  const qbInvoice: QuickBooksInvoice = {
    DocNumber: row.invoice_number,
    TxnDate: row.issue_date,
    DueDate: row.due_date,
    CustomerRef: {
      value: customerId,
      name: customerName,
    },
    Line: (row.line_items ?? []).map((item) => ({
      DetailType: "SalesItemLineDetail",
      Amount: item.amount / 100,
      Description: item.description,
      SalesItemLineDetail: {
        Qty: Number(item.quantity),
        UnitPrice: item.unit_price / 100,
      },
    })),
  };

  if ((row.tax_amount ?? 0) > 0) {
    qbInvoice.TxnTaxDetail = { TotalTax: (row.tax_amount ?? 0) / 100 };
  }
  if (row.notes) {
    qbInvoice.CustomerMemo = { value: row.notes };
  }

  if (row.quickbooks_invoice_id) {
    const existing = await client.getInvoice(row.quickbooks_invoice_id);
    qbInvoice.Id = row.quickbooks_invoice_id;
    qbInvoice.SyncToken = existing.Invoice.SyncToken;
  }

  const result = await client.createInvoice(qbInvoice);
  const qbInvoiceId = result.Invoice.Id;

  await supabase
    .from("invoices")
    .update({
      quickbooks_invoice_id: qbInvoiceId,
      quickbooks_customer_id: customerId,
      quickbooks_synced_at: new Date().toISOString(),
      quickbooks_sync_status: "synced",
    })
    .eq("id", invoiceId);

  await supabase.from("quickbooks_customers").upsert(
    {
      organization_id: issuerOrganizationId,
      portal_user_id: row.client_id,
      portal_organization_id: row.client?.organization_id ?? row.metadata?.billed_organization_id ?? null,
      qb_customer_id: customerId,
      display_name: customerName,
      email: row.client?.email ?? null,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,qb_customer_id" },
  );

  await supabase
    .from("quickbooks_integrations")
    .update({
      last_sync_at: new Date().toISOString(),
      sync_status: "idle",
      sync_error: null,
    })
    .eq("organization_id", issuerOrganizationId);

  return {
    quickbooks_invoice_id: qbInvoiceId,
    quickbooks_customer_id: customerId,
  };
}

export async function maybeAutoSyncInvoiceToQuickBooks(invoiceId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, organization_id")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice?.organization_id) return;

  const { data: integration } = await supabase
    .from("quickbooks_integrations")
    .select("auto_sync_enabled")
    .eq("organization_id", invoice.organization_id)
    .maybeSingle();

  if (!integration?.auto_sync_enabled) return;

  try {
    await syncInvoiceToQuickBooks(invoiceId, invoice.organization_id);
  } catch (error) {
    console.error("Automatic QuickBooks invoice sync failed:", error);
    await supabase
      .from("invoices")
      .update({ quickbooks_sync_status: "error" })
      .eq("id", invoiceId);
  }
}
