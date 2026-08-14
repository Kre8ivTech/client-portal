import { decrypt } from "@/lib/crypto";
import { currentDateInTimeZone, fetchGoogleAdsSnapshot, refreshGoogleAdsAccessToken } from "@/lib/google-ads/client";
import type { GoogleAdsConnectionRecord } from "@/lib/google-ads/types";

type AdminDatabase = {
  from: (table: string) => {
    upsert: (data: unknown, options?: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    update: (data: unknown) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> };
  };
};

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Unknown Google Ads sync error";
}

export async function syncGoogleAdsConnection(
  database: AdminDatabase,
  connection: GoogleAdsConnectionRecord,
): Promise<{ rows: number; issues: number }> {
  if (!connection.customer_id) throw new Error("Select a Google Ads account before syncing");

  try {
    const refreshToken = decrypt(
      connection.refresh_token_encrypted,
      connection.refresh_token_iv,
      connection.refresh_token_auth_tag,
      connection.refresh_token_salt,
    );
    const accessToken = await refreshGoogleAdsAccessToken(refreshToken);
    const snapshot = await fetchGoogleAdsSnapshot({
      accessToken,
      customerId: connection.customer_id,
      loginCustomerId: connection.login_customer_id,
      timeZone: connection.time_zone ?? "UTC",
    });
    const syncedAt = new Date().toISOString();
    const today = currentDateInTimeZone(connection.time_zone ?? "UTC");
    const metricsByDate = new Map(snapshot.dailyMetrics.map((metric) => [metric.date, metric]));
    if (!metricsByDate.has(today)) {
      metricsByDate.set(today, {
        date: today,
        impressions: 0,
        clicks: 0,
        costMicros: 0,
        conversions: 0,
        conversionValue: 0,
      });
    }

    const aggregateRows = Array.from(metricsByDate.values()).map((metric) => ({
      connection_id: connection.id,
      organization_id: connection.organization_id,
      customer_id: connection.customer_id,
      metric_date: metric.date,
      impressions: metric.impressions,
      clicks: metric.clicks,
      cost_micros: metric.costMicros,
      conversions: metric.conversions,
      conversion_value: metric.conversionValue,
      synced_at: syncedAt,
    }));
    const metricsResult = await database.from("google_ads_daily_metrics").upsert(aggregateRows, {
      onConflict: "organization_id,customer_id,metric_date",
    });
    if (metricsResult.error) throw new Error(metricsResult.error.message);

    const snapshotResult = await database.from("google_ads_daily_metrics").upsert({
      connection_id: connection.id,
      organization_id: connection.organization_id,
      customer_id: connection.customer_id,
      metric_date: today,
      campaigns: snapshot.campaigns,
      issues: snapshot.issues,
      synced_at: syncedAt,
    }, { onConflict: "organization_id,customer_id,metric_date" });
    if (snapshotResult.error) throw new Error(snapshotResult.error.message);

    const connectionResult = await database.from("google_ads_connections").update({
      status: "active",
      last_sync_at: syncedAt,
      last_error: null,
    }).eq("id", connection.id);
    if (connectionResult.error) throw new Error(connectionResult.error.message);

    return { rows: aggregateRows.length, issues: snapshot.issues.length };
  } catch (error) {
    await database.from("google_ads_connections").update({
      status: "error",
      last_error: safeErrorMessage(error),
    }).eq("id", connection.id);
    throw error;
  }
}
