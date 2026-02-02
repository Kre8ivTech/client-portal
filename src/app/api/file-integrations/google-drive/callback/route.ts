import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/file-integrations/google-drive/callback`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings/file-storage?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/dashboard/settings/file-storage?error=missing_params", request.url));
  }

  let stateData: { userId: string; ts: number };
  try {
    stateData = JSON.parse(Buffer.from(state, "base64").toString());
  } catch {
    return NextResponse.redirect(new URL("/dashboard/settings/file-storage?error=invalid_state", request.url));
  }

  if (Date.now() - stateData.ts > 10 * 60 * 1000) {
    return NextResponse.redirect(new URL("/dashboard/settings/file-storage?error=state_expired", request.url));
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== stateData.userId) {
    return NextResponse.redirect(new URL("/dashboard/settings/file-storage?error=unauthorized", request.url));
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/dashboard/settings/file-storage?error=oauth_not_configured", request.url));
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(new URL("/dashboard/settings/file-storage?error=token_exchange_failed", request.url));
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = (await userInfoResponse.json()) as { id?: string; email?: string };

    const { data: userRow } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const db = supabase as unknown as {
      from: (table: string) => {
        upsert: (data: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: Error | null }>;
      };
    };

    const { error: upsertError } = await db.from("oauth_integrations").upsert(
      {
        user_id: user.id,
        organization_id: (userRow as { organization_id: string } | null)?.organization_id,
        provider: "google_drive",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        provider_user_id: userInfo.id,
        provider_email: userInfo.email,
        scopes: tokens.scope?.split(" ") || [],
        status: "active",
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) {
      return NextResponse.redirect(new URL("/dashboard/settings/file-storage?error=save_failed", request.url));
    }

    return NextResponse.redirect(new URL("/dashboard/settings/file-storage?success=google_drive_connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/dashboard/settings/file-storage?error=oauth_failed", request.url));
  }
}

