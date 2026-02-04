import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getQuickBooksConfig, QuickBooksClient } from "@/lib/quickbooks/client";
import { randomBytes } from "crypto";

/**
 * Initiate QuickBooks OAuth flow
 * GET /api/quickbooks/connect
 */
export async function GET(request: NextRequest) {
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
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
        { error: "Only account managers can connect QuickBooks" },
        { status: 403 }
      );
    }

    // Generate state parameter for CSRF protection
    const state = randomBytes(32).toString("hex");

    // Store state in database with user and org info
    await supabase.from("oauth_states").insert({
      state,
      provider: "quickbooks",
      user_id: user.id,
      organization_id: profile.organization_id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    });

    // Get QuickBooks config
    const config = getQuickBooksConfig();

    // Generate authorization URL
    const authUrl = QuickBooksClient.getAuthorizationUrl(config, state);

    return NextResponse.json({ authorization_url: authUrl });
  } catch (error) {
    console.error("Error initiating QuickBooks OAuth:", error);
    return NextResponse.json(
      { error: "Failed to initiate QuickBooks connection" },
      { status: 500 }
    );
  }
}
