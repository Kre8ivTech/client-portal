import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSignedOAuthState } from "@/lib/security";

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft/callback`;

const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "Calendars.ReadWrite",
].join(" ");

// GET: Initiate OAuth flow
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!MICROSOFT_CLIENT_ID) {
    return NextResponse.json(
      { error: "Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID in environment." },
      { status: 500 }
    );
  }

  // Generate signed state token for CSRF protection
  const state = createSignedOAuthState({ userId: user.id, ts: Date.now() });

  const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  authUrl.searchParams.set("client_id", MICROSOFT_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("state", state);

  return NextResponse.json({ authUrl: authUrl.toString() });
}

// DELETE: Disconnect integration
export async function DELETE(request: NextRequest) {
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

  return NextResponse.json({ success: true });
}
