import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getQuickBooksConfig,
  QuickBooksClient,
  QuickBooksInvoice,
} from "@/lib/quickbooks/client";

/**
 * Sync a single invoice to QuickBooks
 * POST /api/quickbooks/sync/invoice/[id]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user role and org
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, is_account_manager, organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Check authorization
    if (
      profile.role !== "super_admin" &&
      !(profile.role === "staff" && profile.is_account_manager)
    ) {
      return NextResponse.json(
        { error: "Only account managers can sync to QuickBooks" },
        { status: 403 }
      );
    }

    // Fetch the invoice with line items and organization
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        `
        *,
        organization:organizations(id, name),
        line_items:invoice_line_items(*)
      `
      )
      .eq("id", id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Verify user has access to this invoice
    if (
      profile.role !== "super_admin" &&
      profile.organization_id !== invoice.organization_id
    ) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get QuickBooks integration for this organization
    const { data: integration, error: integrationError } = await supabase
      .from("quickbooks_integrations")
      .select("*")
      .eq("organization_id", invoice.organization_id)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: "QuickBooks not connected for this organization" },
        { status: 400 }
      );
    }

    // Check if token needs refresh
    const tokenExpiresAt = new Date(integration.token_expires_at);
    const now = new Date();
    let accessToken = integration.access_token;

    if (tokenExpiresAt <= now) {
      // Token expired, refresh it
      const config = await getQuickBooksConfig(supabase, invoice.organization_id);
      const newTokens = await QuickBooksClient.refreshToken(
        config,
        integration.refresh_token
      );

      // Update tokens in database
      await supabase
        .from("quickbooks_integrations")
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          token_expires_at: new Date(
            Date.now() + newTokens.expires_in * 1000
          ).toISOString(),
        })
        .eq("id", integration.id);

      accessToken = newTokens.access_token;
    }

    // Initialize QuickBooks client
    const config = await getQuickBooksConfig(supabase, invoice.organization_id);
    const qbClient = new QuickBooksClient(
      config,
      integration.realm_id,
      accessToken
    );

    // Get or create customer in QuickBooks
    const customerResult = await qbClient.findOrCreateCustomer(
      invoice.organization.name
    );
    const customerId = customerResult.Customer.Id;

    // Convert invoice to QuickBooks format
    const qbInvoice: QuickBooksInvoice = {
      DocNumber: invoice.invoice_number,
      TxnDate: invoice.issue_date,
      DueDate: invoice.due_date,
      CustomerRef: {
        value: customerId,
        name: invoice.organization.name,
      },
      Line: invoice.line_items.map((item: any) => ({
        DetailType: "SalesItemLineDetail",
        Amount: item.amount / 100, // Convert cents to dollars
        Description: item.description,
        SalesItemLineDetail: {
          Qty: item.quantity,
          UnitPrice: item.unit_price / 100, // Convert cents to dollars
        },
      })),
    };

    // Add tax if present
    if (invoice.tax_amount > 0) {
      qbInvoice.TxnTaxDetail = {
        TotalTax: invoice.tax_amount / 100,
      };
    }

    // Add notes if present
    if (invoice.notes) {
      qbInvoice.CustomerMemo = {
        value: invoice.notes,
      };
    }

    // If invoice already synced, update it
    if (invoice.quickbooks_invoice_id) {
      // Fetch existing invoice to get SyncToken
      const existingInvoice = await qbClient.getInvoice(
        invoice.quickbooks_invoice_id
      );
      qbInvoice.Id = invoice.quickbooks_invoice_id;
      qbInvoice.SyncToken = existingInvoice.Invoice.SyncToken;
    }

    // Create or update invoice in QuickBooks
    const result = await qbClient.createInvoice(qbInvoice);
    const qbInvoiceId = result.Invoice.Id;

    // Update invoice in our database
    await supabase
      .from("invoices")
      .update({
        quickbooks_invoice_id: qbInvoiceId,
        quickbooks_customer_id: customerId,
        quickbooks_synced_at: new Date().toISOString(),
        quickbooks_sync_status: "synced",
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      quickbooks_invoice_id: qbInvoiceId,
      quickbooks_customer_id: customerId,
      message: "Invoice synced to QuickBooks successfully",
    });
  } catch (error) {
    console.error("Error syncing invoice to QuickBooks:", error);

    // Update sync status to error
    const supabase = await createServerSupabaseClient();
    await supabase
      .from("invoices")
      .update({
        quickbooks_sync_status: "error",
      })
      .eq("id", id);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync invoice to QuickBooks",
      },
      { status: 500 }
    );
  }
}
