import { NextRequest, NextResponse } from "next/server";

import { getGoogleAdsPartnerContext } from "@/lib/google-ads/access";
import { syncGoogleAdsConnection } from "@/lib/google-ads/sync";
import type { GoogleAdsAccount, GoogleAdsConnectionRecord } from "@/lib/google-ads/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { selectGoogleAdsAccountSchema } from "@/lib/validators/google-ads";

export async function POST(request: NextRequest) {
  const contextResult = await getGoogleAdsPartnerContext();
  if (!contextResult.ok) return contextResult.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = selectGoogleAdsAccountSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Google Ads account" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("google_ads_connections")
    .select("*")
    .eq("organization_id", contextResult.context.organizationId)
    .single();
  if (error || !data) return NextResponse.json({ error: "Google Ads is not connected" }, { status: 404 });

  const connection = data as GoogleAdsConnectionRecord;
  const selected = connection.available_customers.find(
    (account: GoogleAdsAccount) => account.customerId === parsed.data.customerId,
  );
  if (!selected) return NextResponse.json({ error: "Account is not available to this connection" }, { status: 403 });

  const { data: updated, error: updateError } = await admin
    .from("google_ads_connections")
    .update({
      customer_id: selected.customerId,
      login_customer_id: selected.loginCustomerId,
      customer_name: selected.name,
      currency_code: selected.currencyCode,
      time_zone: selected.timeZone,
      status: "active",
      last_error: null,
    })
    .eq("id", connection.id)
    .select("*")
    .single();
  if (updateError || !updated) {
    return NextResponse.json({ error: "Could not select Google Ads account" }, { status: 500 });
  }

  try {
    const syncResult = await syncGoogleAdsConnection(admin, updated as GoogleAdsConnectionRecord);
    return NextResponse.json({ success: true, ...syncResult });
  } catch {
    return NextResponse.json({ error: "Account selected, but the first sync failed" }, { status: 502 });
  }
}
