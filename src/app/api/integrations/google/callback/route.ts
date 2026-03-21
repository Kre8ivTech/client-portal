import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifySignedOAuthState, sanitizeOAuthReturnPath } from "@/lib/security";
import { syncStaffCalendarFromOAuth } from "@/lib/integrations/staff-calendar-sync";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`;

function redirectToIntegration(
  request: NextRequest,
  returnPath: string,
  params: Record<string, string>
) {
  const url = new URL(returnPath, request.nextUrl.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const pathFromState = (s: string | null) => {
    if (!s) return "/dashboard/integrations";
    const sd = verifySignedOAuthState(s) as { returnTo?: string } | null;
    return sanitizeOAuthReturnPath(sd?.returnTo as string | undefined);
  };

  // Handle OAuth errors
  if (error) {
    return redirectToIntegration(request, pathFromState(state), {
      error,
    });
  }

  if (!code || !state) {
    return redirectToIntegration(request, pathFromState(state), {
      error: "missing_params",
    });
  }

  // Verify state signature
  const stateData = verifySignedOAuthState(state) as {
    userId: string;
    ts: number;
    returnTo?: string;
  } | null;
  if (!stateData) {
    return redirectToIntegration(request, "/dashboard/integrations", {
      error: "invalid_state",
    });
  }

  const returnPath = sanitizeOAuthReturnPath(stateData.returnTo);

  // Check state age (10 min max)
  if (Date.now() - stateData.ts > 10 * 60 * 1000) {
    return redirectToIntegration(request, returnPath, { error: "state_expired" });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== stateData.userId) {
    return redirectToIntegration(request, returnPath, { error: "unauthorized" });
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return redirectToIntegration(request, returnPath, { error: "oauth_not_configured" });
  }

  // Exchange code for tokens
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Google token error:", errorData);
      return redirectToIntegration(request, returnPath, { error: "token_exchange_failed" });
    }

    const tokens = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const userInfo = await userInfoResponse.json();

    // Get user's organization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    // Store integration (table created in migration, cast to any for type safety)
    const scopeStr = typeof tokens.scope === "string" ? tokens.scope : "";
    const scopesArray = scopeStr ? scopeStr.split(/\s+/).filter(Boolean) : [];

    const { error: upsertError } = await (supabase as unknown as {
      from: (table: string) => {
        upsert: (data: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: Error | null }>;
      };
    }).from("oauth_integrations").upsert({
        user_id: user.id,
        organization_id: (userData as { organization_id: string } | null)?.organization_id,
        provider: "google_calendar",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        provider_user_id: userInfo.id,
        provider_email: userInfo.email,
        scopes: scopesArray,
        status: "active",
      }, {
        onConflict: "user_id,provider",
      });

    if (upsertError) {
      console.error("Failed to save integration:", upsertError);
      return redirectToIntegration(request, returnPath, { error: "save_failed" });
    }

    const label = (userInfo.email as string | undefined) || "Google Calendar";
    const { error: syncErr } = await syncStaffCalendarFromOAuth(
      supabase,
      user.id,
      "google_calendar",
      label
    );
    if (syncErr) {
      console.error("Failed to sync staff_calendar_integrations:", syncErr);
    }

    return redirectToIntegration(request, returnPath, { success: "google_connected" });
  } catch (err) {
    console.error("Google OAuth error:", err);
    return redirectToIntegration(request, returnPath, { error: "oauth_failed" });
  }
}
