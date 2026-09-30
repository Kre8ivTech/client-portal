import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifySignedOAuthState, sanitizeOAuthReturnPath } from "@/lib/oauth-state";
import { syncStaffCalendarFromOAuth } from "@/lib/integrations/staff-calendar-sync";

import { microsoftCalendarConfig, MICROSOFT_AUTHORITY, MICROSOFT_CALENDAR_COOKIE, validCalendarState, microsoftCalendarTokens, microsoftCalendarProfile, encryptCalendarToken } from "@/lib/integrations/microsoft-calendar";

function redirectToIntegration(
  request: NextRequest,
  returnPath: string,
  params: Record<string, string>
) {
  // The reverse proxy exposes a public origin while Next binds to 0.0.0.0.
  // Use configured origin, not request/forwarded headers, for OAuth returns.
  const url = new URL(returnPath, process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = NextResponse.redirect(url);
  response.cookies.set(MICROSOFT_CALENDAR_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/api/integrations/microsoft/callback", maxAge: 0,
  });
  return response;
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
    console.error("Microsoft authorization was declined or failed");
    return redirectToIntegration(request, pathFromState(state), { error: "authorization_failed" });
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
    challenge?: string;
  } | null;
  if (!stateData) {
    return redirectToIntegration(request, "/dashboard/integrations", {
      error: "invalid_state",
    });
  }

  const returnPath = sanitizeOAuthReturnPath(stateData.returnTo);

  // Check state age (10 min max)
  const verifier = request.cookies.get(MICROSOFT_CALENDAR_COOKIE)?.value;
  if (!validCalendarState(stateData, verifier)) {
    return redirectToIntegration(request, returnPath, { error: "state_expired" });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== stateData.userId) {
    return redirectToIntegration(request, returnPath, { error: "unauthorized" });
  }

  const { clientId, clientSecret, redirectUri } = microsoftCalendarConfig();
  if (!clientId || !clientSecret) {
    return redirectToIntegration(request, returnPath, { error: "oauth_not_configured" });
  }

  // Exchange code for tokens
  try {
    const tokenResponse = await fetch(
      `${MICROSOFT_AUTHORITY}/token`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code_verifier: verifier!,
        }),
      }
    );

    if (!tokenResponse.ok) {
      console.error("Microsoft token exchange failed:", tokenResponse.status);
      return redirectToIntegration(request, returnPath, {
        error: "token_exchange_failed",
      });
    }

    const parsedTokens = microsoftCalendarTokens.safeParse(await tokenResponse.json());
    if (!parsedTokens.success) {
      return redirectToIntegration(request, returnPath, { error: "token_exchange_failed" });
    }
    const tokens = parsedTokens.data;

    // Get user info from Microsoft Graph
    const userInfoResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!userInfoResponse.ok) {
      return redirectToIntegration(request, returnPath, { error: "profile_failed" });
    }
    const parsedProfile = microsoftCalendarProfile.safeParse(await userInfoResponse.json());
    if (!parsedProfile.success) {
      return redirectToIntegration(request, returnPath, { error: "profile_failed" });
    }
    const userInfo = parsedProfile.data;

    // Get user's organization
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return redirectToIntegration(request, returnPath, { error: "save_failed" });
    }

    const scopeStr = typeof tokens.scope === "string" ? tokens.scope : "";
    const scopesArray = scopeStr ? scopeStr.split(/\s+/).filter(Boolean) : [];

    const { error: upsertError } = await (
      supabase as unknown as {
        from: (table: string) => {
          upsert: (
            data: Record<string, unknown>,
            options: { onConflict: string }
          ) => Promise<{ error: Error | null }>;
        };
      }
    )
      .from("oauth_integrations")
      .upsert(
        {
          user_id: user.id,
          organization_id: (userData as { organization_id: string } | null)
            ?.organization_id,
          provider: "microsoft_outlook",
          access_token: encryptCalendarToken(tokens.access_token),
          refresh_token: encryptCalendarToken(tokens.refresh_token),
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          provider_user_id: userInfo.id,
          provider_email: userInfo.mail || userInfo.userPrincipalName,
          scopes: scopesArray,
          status: "active",
        },
        {
          onConflict: "user_id,provider",
        }
      );

    if (upsertError) {
      console.error("Failed to save integration:", upsertError);
      return redirectToIntegration(request, returnPath, { error: "save_failed" });
    }

    const label =
      (userInfo.mail as string | undefined) ||
      (userInfo.userPrincipalName as string | undefined) ||
      "Microsoft Outlook";
    if (["staff", "admin", "super_admin"].includes((userData as { role: string }).role)) {
      const { error: syncErr } = await syncStaffCalendarFromOAuth(
        supabase,
        user.id,
        "microsoft_outlook",
        label
      );
      if (syncErr) {
        console.error("Failed to sync staff_calendar_integrations:", syncErr);
      }
    }

    return redirectToIntegration(request, returnPath, {
      success: "microsoft_connected",
    });
  } catch {
    console.error("Microsoft calendar connection failed");
    return redirectToIntegration(request, returnPath, { error: "oauth_failed" });
  }
}
