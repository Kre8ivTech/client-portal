import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { QuickBooksPayment } from "@/lib/quickbooks/client";
import { getConnectedQuickBooksClient } from "@/lib/quickbooks/connection";

/**
 * Sync a payment to QuickBooks
 * POST /api/quickbooks/sync/payment/[id]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Fetch the payment with invoice details
    const { data: payment, error: paymentError } = await supabase
      .from("invoice_payments")
      .select(
        `
        *,
        invoice:invoices(
          id,
          organization_id,
          invoice_number,
          quickbooks_invoice_id,
          quickbooks_customer_id
        )
      `
      )
      .eq("id", id)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Check if payment already synced
    if (payment.quickbooks_payment_id) {
      return NextResponse.json({
        success: true,
        quickbooks_payment_id: payment.quickbooks_payment_id,
        message: "Payment already synced to QuickBooks",
      });
    }

    // Verify user has access
    if (
      profile.role !== "super_admin" &&
      profile.organization_id !== payment.invoice.organization_id
    ) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Check if invoice is synced to QuickBooks
    if (!payment.invoice.quickbooks_invoice_id) {
      return NextResponse.json(
        {
          error:
            "Invoice must be synced to QuickBooks before syncing payment",
        },
        { status: 400 }
      );
    }

    if (profile.organization_id !== payment.invoice.organization_id && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { client: qbClient } = await getConnectedQuickBooksClient(
      supabase,
      profile.role === "super_admin" ? payment.invoice.organization_id : profile.organization_id,
    );

    // Convert payment to QuickBooks format
    const qbPayment: QuickBooksPayment = {
      TotalAmt: payment.amount / 100, // Convert cents to dollars
      CustomerRef: {
        value: payment.invoice.quickbooks_customer_id,
      },
      TxnDate: payment.payment_date,
      Line: [
        {
          Amount: payment.amount / 100,
          LinkedTxn: [
            {
              TxnId: payment.invoice.quickbooks_invoice_id,
              TxnType: "Invoice",
            },
          ],
        },
      ],
    };

    // Add payment reference if present
    if (payment.payment_reference) {
      qbPayment.PaymentRefNum = payment.payment_reference;
    }

    // Add notes if present
    if (payment.notes) {
      qbPayment.PrivateNote = payment.notes;
    }

    // Create payment in QuickBooks
    const result = await qbClient.createPayment(qbPayment);
    const qbPaymentId = result.Payment.Id || result.Payment.TxnDate;

    // Update payment in our database
    await supabase
      .from("invoice_payments")
      .update({
        quickbooks_payment_id: qbPaymentId,
        quickbooks_synced_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      quickbooks_payment_id: qbPaymentId,
      message: "Payment synced to QuickBooks successfully",
    });
  } catch (error) {
    console.error("Error syncing payment to QuickBooks:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync payment to QuickBooks",
      },
      { status: 500 }
    );
  }
}
