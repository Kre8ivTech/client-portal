import { NextRequest, NextResponse } from "next/server";

import { encrypt } from "@/lib/crypto";
import { getGoogleAdsPartnerContext } from "@/lib/google-ads/access";
import {
  exchangeGoogleAdsCode,
  getGoogleAdsUserEmail,
  listGoogleAdsAccounts,
} from "@/lib/google-ads/client";
import { syncGoogleAdsConnection } from "@/lib/google-ads/sync";
import type { GoogleAdsAccount, GoogleAdsConnectionRecord } from "@/lib/google-ads/types";
import { sanitizeOAuthReturnPath, verifySignedOAuthState } from "@/lib/oauth-state";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_STATE_AGE_MS = 10 * 60 * 1000;

type GoogleAdsState = {
  userId: string;
  organizationId: string;
  returnTo?: string;
  ts: number;
};

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is required for Google Ads OAuth");
  return new URL("/api/integrations/google-ads/callback", appUrl).toString();
}

function redirectToDashboard(
  request: NextRequest,
  returnTo: string,
  params: Record<string, string>,
) {
  const url = new URL(sanitizeOAuthReturnPath(returnTo), request.nextUrl.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

function parseState(value: string | null): GoogleAdsState | null {
  if (!value) return null;
  const parsed = verifySignedOAuthState(value);
  if (
    !parsed ||
    typeof parsed.userId !== "string" ||
    typeof parsed.organizationId !== "string" ||
    typeof parsed.ts !== "number"
  ) {
    return null;
  }
  return parsed as GoogleAdsState;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  const state = parseState(request.nextUrl.searchParams.get("state"));
  const returnTo = state?.returnTo ?? "/dashboard/google-ads";

  if (oauthError) return redirectToDashboard(request, returnTo, { error: "access_denied" });
  if (!state) return redirectToDashboard(request, returnTo, { error: "invalid_state" });
  if (Date.now() - state.ts > MAX_STATE_AGE_MS) {
    return redirectToDashboard(request, returnTo, { error: "state_expired" });
  }
  if (!code) return redirectToDashboard(request, returnTo, { error: "missing_code" });

  const contextResult = await getGoogleAdsPartnerContext();
  if (
    !contextResult.ok ||
    contextResult.context.userId !== state.userId ||
    contextResult.context.organizationId !== state.organizationId
  ) {
    return redirectToDashboard(request, returnTo, { error: "unauthorized" });
  }

  try {
    const tokens = await exchangeGoogleAdsCode({ code, redirectUri: getRedirectUri() });
    const [googleEmail, availableCustomers] = await Promise.all([
      getGoogleAdsUserEmail(tokens.access_token),
      listGoogleAdsAccounts(tokens.access_token),
    ]);
    const admin = getSupabaseAdmin();
    const { data: existingData, error: existingError } = await admin
      .from("google_ads_connections")
      .select("*")
      .eq("organization_id", state.organizationId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    const existing = existingData as GoogleAdsConnectionRecord | null;

    const selectedAccount = selectInitialAccount(availableCustomers, existing?.customer_id ?? null);
    const refreshFields = tokens.refresh_token
      ? encryptedRefreshFields(tokens.refresh_token)
      : existing
        ? existingRefreshFields(existing)
        : null;
    if (!refreshFields) throw new Error("Google did not return an offline refresh token");

    const { data: savedData, error: saveError } = await admin
      .from("google_ads_connections")
      .upsert({
        organization_id: state.organizationId,
        connected_by: state.userId,
        google_email: googleEmail,
        ...refreshFields,
        scopes: (tokens.scope ?? "").split(/\s+/).filter(Boolean),
        available_customers: availableCustomers,
        customer_id: selectedAccount?.customerId ?? null,
        login_customer_id: selectedAccount?.loginCustomerId ?? null,
        customer_name: selectedAccount?.name ?? null,
        currency_code: selectedAccount?.currencyCode ?? null,
        time_zone: selectedAccount?.timeZone ?? null,
        status: "active",
        last_error: null,
      }, { onConflict: "organization_id" })
      .select("*")
      .single();
    if (saveError || !savedData) throw new Error(saveError?.message ?? "Connection save failed");

    if (selectedAccount) {
      try {
        await syncGoogleAdsConnection(admin, savedData as GoogleAdsConnectionRecord);
      } catch (error) {
        console.error("[Google Ads OAuth] Initial reporting sync failed", error);
      }
    }

    return redirectToDashboard(request, returnTo, { success: "connected" });
  } catch (error) {
    console.error("[Google Ads OAuth] Callback failed", error);
    return redirectToDashboard(request, returnTo, { error: "connection_failed" });
  }
}

function selectInitialAccount(
  accounts: GoogleAdsAccount[],
  existingCustomerId: string | null,
): GoogleAdsAccount | null {
  const existing = accounts.find((account) => account.customerId === existingCustomerId);
  if (existing) return existing;
  return accounts.length === 1 ? accounts[0] : null;
}

function encryptedRefreshFields(refreshToken: string) {
  const encrypted = encrypt(refreshToken);
  return {
    refresh_token_encrypted: encrypted.encryptedData,
    refresh_token_iv: encrypted.iv,
    refresh_token_auth_tag: encrypted.authTag,
    refresh_token_salt: encrypted.salt,
  };
}

function existingRefreshFields(connection: GoogleAdsConnectionRecord) {
  return {
    refresh_token_encrypted: connection.refresh_token_encrypted,
    refresh_token_iv: connection.refresh_token_iv,
    refresh_token_auth_tag: connection.refresh_token_auth_tag,
    refresh_token_salt: connection.refresh_token_salt,
  };
}
