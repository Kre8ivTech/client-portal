import { NextRequest, NextResponse } from "next/server";

import { authorizeCronOrSuperAdmin } from "@/lib/api/cron-auth";
import { syncGoogleAdsConnection } from "@/lib/google-ads/sync";
import type { GoogleAdsConnectionRecord } from "@/lib/google-ads/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_CONNECTIONS_PER_RUN = 25;

export async function GET(request: NextRequest) {
  const denied = await authorizeCronOrSuperAdmin(request);
  if (denied) return denied;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("google_ads_connections")
    .select("*")
    .not("customer_id", "is", null)
    .limit(MAX_CONNECTIONS_PER_RUN);
  if (error) return NextResponse.json({ error: "Could not load Google Ads connections" }, { status: 500 });

  const results: Array<{ connectionId: string; success: boolean; rows?: number; issues?: number }> = [];
  for (const connection of (data ?? []) as GoogleAdsConnectionRecord[]) {
    try {
      const synced = await syncGoogleAdsConnection(admin, connection);
      results.push({ connectionId: connection.id, success: true, ...synced });
    } catch (error) {
      console.error(`[Google Ads Cron] Sync failed for connection ${connection.id}`, error);
      results.push({ connectionId: connection.id, success: false });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
