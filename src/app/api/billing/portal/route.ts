import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Stripe from "stripe";

/**
 * POST /api/billing/portal
 * Create a Stripe billing portal session for the user to manage their subscription
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize Stripe inside the function to avoid build-time errors
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured. Please contact support." }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
    });

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and Stripe customer ID
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.organization_id) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", userData.organization_id)
      .single();

    if (orgError || !organization?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found. Please contact support to set up billing." },
        { status: 400 },
      );
    }

    // Get return URL from request body or use default
    const body = await request.json().catch(() => ({}));
    const returnUrl = body.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`;

    // Create Stripe billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripe_customer_id,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Error creating billing portal session:", err);
    return NextResponse.json({ error: err.message || "Failed to create billing portal session" }, { status: 500 });
  }
}
