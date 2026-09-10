import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireQuickBooksManager } from "@/lib/quickbooks/access";
import { syncInvoiceToQuickBooks } from "@/lib/quickbooks/sync-invoice";

/**
 * Sync a single invoice to QuickBooks
 * POST /api/quickbooks/sync/invoice/[id]
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const invoiceId = z.string().uuid().safeParse(id);
  if (!invoiceId.success) {
    return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
  }

  try {
    const access = await requireQuickBooksManager();
    if (!access.ok) return access.response;

    const result = await syncInvoiceToQuickBooks(
      invoiceId.data,
      access.actor.organizationId,
    );

    return NextResponse.json({
      success: true,
      ...result,
      message: "Invoice synced to QuickBooks successfully",
    });
  } catch (error) {
    console.error("Error syncing invoice to QuickBooks:", error);
    try {
      const access = await requireQuickBooksManager();
      if (access.ok) {
        await access.supabase
          .from("invoices")
          .update({ quickbooks_sync_status: "error" })
          .eq("id", invoiceId.data);
      }
    } catch {
      // ignore secondary update failures
    }

    const message = error instanceof Error ? error.message : "Failed to sync invoice to QuickBooks";
    const status =
      message === "Invoice not found"
        ? 404
        : message === "Access denied" || message.startsWith("QuickBooks not connected")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
