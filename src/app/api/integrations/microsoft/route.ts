import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSignedOAuthState, sanitizeOAuthReturnPath } from "@/lib/oauth-state";
import { clearStaffCalendarFromOAuth } from "@/lib/integrations/staff-calendar-sync";

import { randomBytes } from "node:crypto";
import { microsoftCalendarConfig, MICROSOFT_AUTHORITY, MICROSOFT_CALENDAR_SCOPES, MICROSOFT_CALENDAR_COOKIE, calendarPkceChallenge } from "@/lib/integrations/microsoft-calendar";

// GET: Initiate OAuth flow
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clientId, clientSecret, redirectUri } = microsoftCalendarConfig();
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error:
            "Microsoft calendar connection is not configured. Contact your administrator.",
        },
        { status: 500 }
      );
    }

    const returnTo = sanitizeOAuthReturnPath(request.nextUrl.searchParams.get("returnTo") || "/dashboard/settings");

    // Generate signed state token for CSRF protection
    const verifier = randomBytes(32).toString("base64url");
    const challenge = calendarPkceChallenge(verifier);
    const state = createSignedOAuthState({ userId: user.id, ts: Date.now(), returnTo, challenge });

    const authUrl = new URL(`${MICROSOFT_AUTHORITY}/authorize`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", MICROSOFT_CALENDAR_SCOPES);
    authUrl.searchParams.set("response_mode", "query");
    authUrl.searchParams.set("state", state);

    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    const response = NextResponse.json({ authUrl: authUrl.toString() });
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(MICROSOFT_CALENDAR_COOKIE, verifier, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/api/integrations/microsoft/callback", maxAge: 600,
    });
    return response;
  } catch (error) {
    console.error("[Microsoft OAuth GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Disconnect integration
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("oauth_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "microsoft_outlook");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await clearStaffCalendarFromOAuth(supabase, user.id, "microsoft_outlook");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Microsoft OAuth DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
