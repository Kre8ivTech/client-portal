import { NextResponse } from "next/server";

import { getGoogleAdsPartnerContext } from "@/lib/google-ads/access";
import { syncGoogleAdsConnection } from "@/lib/google-ads/sync";
import type { GoogleAdsConnectionRecord } from "@/lib/google-ads/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  const contextResult = await getGoogleAdsPartnerContext({ allowPartnerStaff: true });
  if (!contextResult.ok) return contextResult.response;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("google_ads_connections")
    .select("*")
    .eq("organization_id", contextResult.context.organizationId)
    .single();
  if (error || !data) return NextResponse.json({ error: "Google Ads is not connected" }, { status: 404 });

  try {
    const result = await syncGoogleAdsConnection(admin, data as GoogleAdsConnectionRecord);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Google Ads] Manual sync failed", error);
    return NextResponse.json({ error: "Google Ads sync failed" }, { status: 502 });
  }
}
