import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

// Validation schema for manual payment
const manualPaymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  payment_method: z.string().min(1, "Payment method is required"),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (use YYYY-MM-DD)"),
  payment_reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get user profile to check authorization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_account_manager")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Check if user is authorized (super_admin or account manager)
    if (
      profile.role !== "super_admin" &&
      !(profile.role === "staff" && profile.is_account_manager)
    ) {
      return NextResponse.json(
        { error: "Only account managers can record manual payments" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = manualPaymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { amount, payment_method, payment_date, payment_reference, notes } =
      validation.data;

    // Get invoice to verify it exists and get organization
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, organization_id, total, amount_paid, balance_due, status")
      .eq("id", params.id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Verify user has access to this invoice's organization
    const { data: userOrg, error: userOrgError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (userOrgError || !userOrg) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // For non-super_admin, verify they manage this organization
    if (profile.role !== "super_admin" && userOrg.organization_id !== invoice.organization_id) {
      return NextResponse.json(
        { error: "You do not have access to this invoice" },
        { status: 403 }
      );
    }

    // Convert amount to cents (API accepts dollars, DB stores cents)
    const amountInCents = Math.round(amount * 100);

    // Validate payment amount doesn't exceed balance due
    if (amountInCents > invoice.balance_due) {
      return NextResponse.json(
        {
          error: "Payment amount exceeds balance due",
          balance_due: invoice.balance_due / 100,
        },
        { status: 400 }
      );
    }

    // Get client IP and user agent for audit trail
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    // Call the database function to record payment with audit trail
    const { data: paymentId, error: paymentError } = await supabase.rpc(
      "record_manual_payment",
      {
        p_invoice_id: params.id,
        p_amount: amountInCents,
        p_payment_method: payment_method,
        p_payment_date: payment_date,
        p_payment_reference: payment_reference || null,
        p_notes: notes || null,
        p_ip_address: ip || null,
        p_user_agent: userAgent || null,
      }
    );

    if (paymentError) {
      console.error("Error recording manual payment:", paymentError);
      return NextResponse.json(
        { error: paymentError.message || "Failed to record payment" },
        { status: 500 }
      );
    }

    // Fetch the updated invoice and payment details
    const { data: updatedInvoice, error: fetchError } = await supabase
      .from("invoices")
      .select(
        `
        *,
        invoice_payments (
          id,
          amount,
          payment_method,
          payment_date,
          payment_reference,
          payment_source,
          recorded_by,
          notes,
          created_at
        )
      `
      )
      .eq("id", params.id)
      .single();

    if (fetchError) {
      console.error("Error fetching updated invoice:", fetchError);
      // Payment was recorded successfully, but couldn't fetch updated data
      return NextResponse.json(
        {
          success: true,
          payment_id: paymentId,
          message: "Payment recorded successfully",
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        payment_id: paymentId,
        invoice: updatedInvoice,
        message: "Payment recorded successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error recording manual payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch manual payment history for an invoice
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Fetch invoice with payment history
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        `
        id,
        organization_id,
        invoice_payments!inner (
          id,
          amount,
          payment_method,
          payment_date,
          payment_reference,
          payment_source,
          recorded_by,
          notes,
          created_at,
          recorded_by_profile:profiles!invoice_payments_recorded_by_fkey (
            name,
            email
          )
        )
      `
      )
      .eq("id", params.id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // RLS will handle access control
    return NextResponse.json({
      invoice_id: invoice.id,
      payments: invoice.invoice_payments || [],
    });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
