import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSignedOAuthState, sanitizeOAuthReturnPath } from "@/lib/oauth-state";
import { clearStaffCalendarFromOAuth } from "@/lib/integrations/staff-calendar-sync";
import { loadGoogleOAuthClientForOrganization } from "@/lib/marketing/credentials";

const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

// GET: Initiate OAuth flow
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("users").select("organization_id").eq("id", user.id).maybeSingle();
    const organizationId = (profile as { organization_id: string | null } | null)?.organization_id ?? null;
    const googleClient = await loadGoogleOAuthClientForOrganization(organizationId);
    if (!googleClient) {
      return NextResponse.json(
        {
          error:
            "Google OAuth not configured. Save a Google OAuth client for this organization or set the platform environment variables.",
        },
        { status: 500 }
      );
    }

    const returnTo = sanitizeOAuthReturnPath(request.nextUrl.searchParams.get("returnTo"));

    // Generate signed state token for CSRF protection
    const state = createSignedOAuthState({ userId: user.id, ts: Date.now(), returnTo });

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", googleClient.clientId);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("[Google OAuth GET] Error:", error);
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
      .eq("provider", "google_calendar");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await clearStaffCalendarFromOAuth(supabase, user.id, "google_calendar");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Google OAuth DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
