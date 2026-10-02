import { requireRole } from "@/lib/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Shield,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { SiteMonitorCard } from "@/components/sites/site-monitor-card";
import { SiteMonitorEmptyState } from "@/components/sites/site-monitor-empty";
import { SiteMonitorForm } from "@/components/sites/site-monitor-form";
import { WordPressPluginDownload } from "@/components/sites/wordpress-plugin-download";
import { compareSiteMonitors, sslState } from "@/lib/sites/site-monitor-display";

export const dynamic = "force-dynamic";

type SiteMonitor = {
  id: string;
  organization_id: string;
  org_name: string;
  url: string;
  name: string;
  status: "up" | "down" | "degraded" | "unknown";
  last_check_at: string | null;
  response_time_ms: number | null;
  uptime_percentage_30d: number | null;
  ssl_expiry_date: string | null;
  ssl_status: "valid" | "expiring_soon" | "expired" | "unknown";
  performance_score: number | null;
  last_downtime_at: string | null;
  consecutive_failures: number;
  platform: string | null;
  wp_plugins: unknown;
  wp_plugins_updated_at: string | null;
};

export default async function SiteMonitoringPage() {
  const { profile } = await requireRole(["partner", "partner_staff"]);
  const organizationId = profile?.organization_id;
  if (!organizationId) return null;

  const admin = getSupabaseAdmin();

  // Get child client organizations
  const { data: childOrgs } = await admin
    .from("organizations")
    .select("id, name, slug, type")
    .eq("parent_org_id", organizationId)
    .order("name", { ascending: true });

  const clients = (childOrgs ?? []) as { id: string; name: string; slug: string; type: string }[];
  const formOrganizations = clients
    .filter((client) => client.type === "client")
    .map((client) => ({ id: client.id, name: client.name }));
  const clientIds = clients.map((c) => c.id);
  const orgNameMap = new Map(clients.map((c) => [c.id, c.name]));

  // Fetch site monitors from the site_monitors table
  // This table may not exist yet — handle gracefully
  let siteMonitors: SiteMonitor[] = [];
  let tableExists = true;

  if (clientIds.length > 0) {
    const { data, error } = await admin
      .from("site_monitors")
      .select(
        "id, organization_id, url, name, status, last_check_at, response_time_ms, uptime_percentage_30d, ssl_expiry_date, performance_score, last_downtime_at, consecutive_failures, platform, wp_plugins, wp_plugins_updated_at",
      )
      .in("organization_id", clientIds)
      .order("status", { ascending: true });

    if (error && error.code === "42P01") {
      // Table doesn't exist yet
      tableExists = false;
    } else {
      siteMonitors = ((data ?? []) as any[]).map((site) => ({
        ...site,
        org_name: orgNameMap.get(site.organization_id) ?? "Unknown",
        ssl_status: sslState(site.ssl_expiry_date),
      }));
    }
  }

  // Summary stats
  const sitesUp = siteMonitors.filter((s) => s.status === "up").length;
  const sitesDown = siteMonitors.filter((s) => s.status === "down").length;
  const sitesDegraded = siteMonitors.filter((s) => s.status === "degraded").length;
  const sslExpiring = siteMonitors.filter((s) => s.ssl_status === "expiring_soon").length;
  const sslExpired = siteMonitors.filter((s) => s.ssl_status === "expired").length;
  const avgResponseTime = siteMonitors.length > 0
    ? siteMonitors.reduce((s, m) => s + (m.response_time_ms ?? 0), 0) / siteMonitors.filter((m) => m.response_time_ms !== null).length
    : 0;

  const orderedMonitors = [...siteMonitors].sort((a, b) => compareSiteMonitors(a, b));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Website Monitoring</h1>
          <p className="text-muted-foreground">
            Uptime, SSL certificates, and performance for all client websites.
          </p>
        </div>
        <Link
          href="/dashboard/partner-overview"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back to Overview
        </Link>
      </div>

      <WordPressPluginDownload />

      {tableExists ? <SiteMonitorForm organizations={formOrganizations} /> : null}

      {!tableExists ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
              <Globe className="h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4 text-lg font-semibold">Website Monitoring Not Yet Configured</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                The site monitoring system needs to be set up. Run the database migration to create
                the <code className="rounded bg-muted px-1 py-0.5">site_monitors</code> table, then
                add your client websites to begin tracking uptime, SSL, and performance.
              </p>
              <div className="mt-6 rounded-lg bg-muted p-4 text-left text-xs font-mono">
                <p className="text-muted-foreground">-- Required migration:</p>
                <p>CREATE TABLE site_monitors (</p>
                <p className="pl-4">id UUID DEFAULT gen_random_uuid() PRIMARY KEY,</p>
                <p className="pl-4">organization_id UUID REFERENCES organizations(id),</p>
                <p className="pl-4">url TEXT NOT NULL,</p>
                <p className="pl-4">name TEXT NOT NULL,</p>
                <p className="pl-4">status TEXT DEFAULT &apos;unknown&apos;,</p>
                <p className="pl-4">last_check_at TIMESTAMPTZ,</p>
                <p className="pl-4">response_time_ms INTEGER,</p>
                <p className="pl-4">uptime_percentage_30d NUMERIC(5,2),</p>
                <p className="pl-4">ssl_expiry_date DATE,</p>
                <p className="pl-4">performance_score INTEGER,</p>
                <p className="pl-4">last_downtime_at TIMESTAMPTZ,</p>
                <p className="pl-4">consecutive_failures INTEGER DEFAULT 0,</p>
                <p className="pl-4">created_at TIMESTAMPTZ DEFAULT now(),</p>
                <p className="pl-4">updated_at TIMESTAMPTZ DEFAULT now()</p>
                <p>);</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sitesUp}</p>
                  <p className="text-xs text-muted-foreground">Sites Up</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sitesDown}</p>
                  <p className="text-xs text-muted-foreground">Sites Down</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sitesDegraded}</p>
                  <p className="text-xs text-muted-foreground">Degraded</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Shield className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sslExpiring + sslExpired}</p>
                  <p className="text-xs text-muted-foreground">SSL Issues</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {avgResponseTime > 0 ? `${Math.round(avgResponseTime)}ms` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Response</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">All monitored sites</h2>
              <p className="text-sm text-muted-foreground">
                {orderedMonitors.length} website{orderedMonitors.length === 1 ? "" : "s"} monitored. Issues appear first.
              </p>
            </div>
            {orderedMonitors.length === 0 ? (
              <SiteMonitorEmptyState />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {orderedMonitors.map((site) => (
                  <li key={site.id}>
                    <SiteMonitorCard
                      name={site.name}
                      url={site.url}
                      status={site.status}
                      organizationName={site.org_name}
                      lastCheckAt={site.last_check_at}
                      sslExpiryDate={site.ssl_expiry_date}
                      uptimePercentage30d={site.uptime_percentage_30d}
                      responseTimeMs={site.response_time_ms}
                      performanceScore={site.performance_score}
                      platform={site.platform}
                      wpPlugins={site.wp_plugins}
                      wpPluginsUpdatedAt={site.wp_plugins_updated_at}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* SSL Expiry Alerts */}
          {(sslExpiring > 0 || sslExpired > 0) && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <Shield className="h-5 w-5" />
                  SSL Certificate Alerts
                </CardTitle>
                <CardDescription className="text-amber-700">
                  {sslExpired > 0 && `${sslExpired} expired`}
                  {sslExpired > 0 && sslExpiring > 0 && ", "}
                  {sslExpiring > 0 && `${sslExpiring} expiring soon`}
                  {" — action required."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {orderedMonitors
                    .filter((s) => s.ssl_status === "expired" || s.ssl_status === "expiring_soon")
                    .map((site) => (
                      <li
                        key={site.id}
                        className="flex items-center justify-between rounded-lg border bg-white p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Shield
                            className={`h-4 w-4 ${
                              site.ssl_status === "expired" ? "text-red-600" : "text-amber-600"
                            }`}
                          />
                          <div>
                            <p className="font-medium">{site.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {site.org_name} · {site.url}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            className={
                              site.ssl_status === "expired"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                            }
                          >
                            {site.ssl_status === "expired" ? "Expired" : "Expiring Soon"}
                          </Badge>
                          {site.ssl_expiry_date && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {site.ssl_status === "expired"
                                ? `Expired ${formatDistanceToNow(new Date(site.ssl_expiry_date), { addSuffix: true })}`
                                : `Expires in ${differenceInDays(new Date(site.ssl_expiry_date), new Date())} days`}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
