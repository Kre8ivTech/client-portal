import { differenceInDays } from "date-fns";
import { wordpressPluginStatus } from "@/lib/sites/wp-plugins";

export type SslState = "valid" | "expiring_soon" | "expired" | "unknown";

export type SiteMonitorOrderRow = {
  name: string;
  status: string;
  ssl_expiry_date?: string | null;
  platform?: string | null;
  wp_plugins?: unknown;
  wp_plugins_updated_at?: string | null;
};

const STATUS_RANK_FALLBACK = 6;

export function parseMonitorDate(value: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    return new Date(year, month - 1, day, 23, 59, 59);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function sslState(expiryDate: string | null | undefined, now = new Date()): SslState {
  if (!expiryDate) return "unknown";
  const expiry = parseMonitorDate(expiryDate);
  if (!expiry) return "unknown";
  if (expiry.getTime() < now.getTime()) return "expired";
  if (differenceInDays(expiry, now) <= 14) return "expiring_soon";
  return "valid";
}

export function siteStatusLabel(status: string): string {
  switch (status) {
    case "up":
      return "Up";
    case "down":
      return "Down";
    case "degraded":
      return "Degraded";
    default:
      return "Unknown";
  }
}

function hasPluginUpdates(site: SiteMonitorOrderRow): boolean {
  const status = wordpressPluginStatus({
    platform: site.platform,
    plugins: site.wp_plugins,
    updatedAt: site.wp_plugins_updated_at,
  });
  return status.available && status.summary.updatesAvailable > 0;
}

export function siteMonitorIssueRank(site: SiteMonitorOrderRow, now = new Date()): number {
  const ssl = sslState(site.ssl_expiry_date, now);
  if (site.status === "down") return 0;
  if (ssl === "expired") return 1;
  if (site.status === "degraded") return 2;
  if (ssl === "expiring_soon") return 3;
  if (hasPluginUpdates(site)) return 4;
  if (site.status === "unknown") return 5;
  return STATUS_RANK_FALLBACK;
}

export function compareSiteMonitors(a: SiteMonitorOrderRow, b: SiteMonitorOrderRow, now = new Date()): number {
  const rank = siteMonitorIssueRank(a, now) - siteMonitorIssueRank(b, now);
  if (rank !== 0) return rank;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
