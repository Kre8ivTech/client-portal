import { NextRequest, NextResponse } from "next/server";

import { decrypt } from "@/lib/crypto";
import { getGoogleAdsPartnerContext } from "@/lib/google-ads/access";
import { getGoogleAdsOAuthConfig, GOOGLE_ADS_OAUTH_SCOPES, revokeGoogleAdsToken } from "@/lib/google-ads/client";
import type { GoogleAdsConnectionRecord } from "@/lib/google-ads/types";
import { createSignedOAuthState } from "@/lib/oauth-state";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is required for Google Ads OAuth");
  return new URL("/api/integrations/google-ads/callback", appUrl).toString();
}

export async function GET() {
  try {
    const result = await getGoogleAdsPartnerContext();
    if (!result.ok) return result.response;
    if ((process.env.ENCRYPTION_SECRET?.length ?? 0) < 32) {
      throw new Error("ENCRYPTION_SECRET must be at least 32 characters");
    }
    const { clientId } = getGoogleAdsOAuthConfig();
    const state = createSignedOAuthState({
      userId: result.context.userId,
      organizationId: result.context.organizationId,
      returnTo: "/dashboard/google-ads",
      ts: Date.now(),
    });

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", getRedirectUri());
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", GOOGLE_ADS_OAUTH_SCOPES.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("[Google Ads OAuth] Failed to start connection", error);
    return NextResponse.json({ error: "Google Ads OAuth is not configured" }, { status: 500 });
  }
}

export async function DELETE() {
  const result = await getGoogleAdsPartnerContext();
  if (!result.ok) return result.response;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("google_ads_connections")
    .select("*")
    .eq("organization_id", result.context.organizationId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load Google Ads connection" }, { status: 500 });

  const connection = data as GoogleAdsConnectionRecord | null;
  if (connection) {
    try {
      const refreshToken = decrypt(
        connection.refresh_token_encrypted,
        connection.refresh_token_iv,
        connection.refresh_token_auth_tag,
        connection.refresh_token_salt,
      );
      await revokeGoogleAdsToken(refreshToken);
    } catch (error) {
      console.error("[Google Ads OAuth] Token revocation failed; deleting local connection", error);
    }
  }

  const { error: deleteError } = await admin
    .from("google_ads_connections")
    .delete()
    .eq("organization_id", result.context.organizationId);
  if (deleteError) {
    return NextResponse.json({ error: "Could not disconnect Google Ads" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
