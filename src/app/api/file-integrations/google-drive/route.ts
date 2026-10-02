import { NextRequest, NextResponse } from "next/server";
import { createSignedOAuthState } from "@/lib/oauth-state";
import { loadGoogleOAuthClientForOrganization } from "@/lib/marketing/credentials";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/file-integrations/google-drive/callback`;

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export async function GET(_request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("organization_id").eq("id", user.id).maybeSingle();
  const googleClient = await loadGoogleOAuthClientForOrganization(
    (profile as { organization_id: string | null } | null)?.organization_id ?? null,
  );
  if (!googleClient) {
    return NextResponse.json(
      { error: "Google OAuth not configured. Save a Google OAuth client for this organization or set the platform environment variables." },
      { status: 500 }
    );
  }

  const state = createSignedOAuthState({ userId: user.id, ts: Date.now() });

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", googleClient.clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return NextResponse.json({ authUrl: authUrl.toString() });
}

export async function DELETE(_request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("oauth_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "google_drive");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
