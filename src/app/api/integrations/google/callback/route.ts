import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=missing_params", request.url)
    );
  }

  // Verify state
  let stateData: { userId: string; ts: number };
  try {
    stateData = JSON.parse(Buffer.from(state, "base64").toString());
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=invalid_state", request.url)
    );
  }

  // Check state age (10 min max)
  if (Date.now() - stateData.ts > 10 * 60 * 1000) {
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=state_expired", request.url)
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== stateData.userId) {
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=unauthorized", request.url)
    );
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
      return NextResponse.redirect(
        new URL("/dashboard/integrations?error=token_exchange_failed", request.url)
      );
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
        scopes: tokens.scope?.split(" ") || [],
        status: "active",
      }, {
        onConflict: "user_id,provider",
      });

    if (upsertError) {
      console.error("Failed to save integration:", upsertError);
      return NextResponse.redirect(
        new URL("/dashboard/integrations?error=save_failed", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/dashboard/integrations?success=google_connected", request.url)
    );
  } catch (err) {
    console.error("Google OAuth error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=oauth_failed", request.url)
    );
  }
}
