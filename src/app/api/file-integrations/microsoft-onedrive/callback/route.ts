import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/file-integrations/microsoft-onedrive/callback`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const msg = errorDescription ? `${error}:${errorDescription}` : error;
    return NextResponse.redirect(
      new URL(`/dashboard/settings/file-storage?error=${encodeURIComponent(msg)}`, request.url)
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

  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/dashboard/settings/file-storage?error=oauth_not_configured", request.url));
  }

  try {
    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
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

    const userInfoResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = (await userInfoResponse.json()) as { id?: string; mail?: string; userPrincipalName?: string };

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
        provider: "microsoft_onedrive",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        provider_user_id: userInfo.id,
        provider_email: userInfo.mail || userInfo.userPrincipalName,
        scopes: tokens.scope?.split(" ") || [],
        status: "active",
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) {
      return NextResponse.redirect(new URL("/dashboard/settings/file-storage?error=save_failed", request.url));
    }

    return NextResponse.redirect(
      new URL("/dashboard/settings/file-storage?success=microsoft_onedrive_connected", request.url)
    );
  } catch {
    return NextResponse.redirect(new URL("/dashboard/settings/file-storage?error=oauth_failed", request.url));
  }
}

