import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getQuickBooksConfig, QuickBooksClient } from "@/lib/quickbooks/client";

/**
 * Handle QuickBooks OAuth callback
 * GET /api/quickbooks/callback?code=xxx&state=xxx&realmId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const realmId = searchParams.get("realmId");
    const error = searchParams.get("error");

    // Check for OAuth errors
    if (error) {
      console.error("QuickBooks OAuth error:", error);
      return NextResponse.redirect(
        new URL(
          `/dashboard/settings/integrations?error=quickbooks_${error}`,
          request.url
        )
      );
    }

    if (!code || !state || !realmId) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings/integrations?error=missing_parameters",
          request.url
        )
      );
    }

    const supabase = await createServerSupabaseClient();

    // Verify state parameter (CSRF protection)
    const { data: oauthState, error: stateError } = await supabase
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .eq("provider", "quickbooks")
      .single();

    if (stateError || !oauthState) {
      console.error("Invalid OAuth state:", stateError);
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings/integrations?error=invalid_state",
          request.url
        )
      );
    }

    // Check if state has expired
    if (new Date(oauthState.expires_at) < new Date()) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings/integrations?error=state_expired",
          request.url
        )
      );
    }

    // Exchange authorization code for tokens
    const config = await getQuickBooksConfig(supabase, oauthState.organization_id);
    const tokens = await QuickBooksClient.getTokens(config, code);

    // Calculate token expiry timestamps
    const accessTokenExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    );
    const refreshTokenExpiresAt = new Date(
      Date.now() + tokens.x_refresh_token_expires_in * 1000
    );

    // Test the connection
    const client = new QuickBooksClient(
      config,
      realmId,
      tokens.access_token
    );
    const connectionTest = await client.testConnection();

    if (!connectionTest) {
      console.error("QuickBooks connection test failed");
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings/integrations?error=connection_failed",
          request.url
        )
      );
    }

    // Store integration in database (upsert)
    const { error: integrationError } = await supabase
      .from("quickbooks_integrations")
      .upsert(
        {
          organization_id: oauthState.organization_id,
          realm_id: realmId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: accessTokenExpiresAt.toISOString(),
          is_sandbox: config.environment === "sandbox",
          connected_by: oauthState.user_id,
          connected_at: new Date().toISOString(),
          sync_status: "idle",
        },
        {
          onConflict: "organization_id",
        }
      );

    if (integrationError) {
      console.error("Error storing QuickBooks integration:", integrationError);
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings/integrations?error=database_error",
          request.url
        )
      );
    }

    // Clean up used state
    await supabase.from("oauth_states").delete().eq("state", state);

    // Redirect to settings page with success message
    return NextResponse.redirect(
      new URL(
        "/dashboard/settings/integrations?success=quickbooks_connected",
        request.url
      )
    );
  } catch (error) {
    console.error("Error in QuickBooks OAuth callback:", error);
    return NextResponse.redirect(
      new URL(
        "/dashboard/settings/integrations?error=unexpected_error",
        request.url
      )
    );
  }
}
