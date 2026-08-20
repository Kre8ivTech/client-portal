import { requireRole } from "@/lib/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CircleDollarSign,
  Eye,
  MousePointerClick,
  TrendingUp,
  Globe,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { subDays } from "date-fns";

export const dynamic = "force-dynamic";

type AdsAccountSummary = {
  organizationId: string;
  orgName: string;
  customerId: string;
  customerName: string | null;
  currencyCode: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  spend7d: number;
  spend30d: number;
  impressions7d: number;
  clicks7d: number;
  conversions7d: number;
  ctr7d: number;
  spendTrend: number; // % change vs previous 7d
};

function numeric(value: number | string | null | undefined): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function formatCurrency(value: number, currency: string = "USD", fractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export default async function AdsOverviewPage() {
  const { profile } = await requireRole(["partner", "partner_staff"]);
  const organizationId = profile?.organization_id;
  if (!organizationId) return null;

  const admin = getSupabaseAdmin();

  // Get child client organizations + partner's own org
  const { data: childOrgs } = await admin
    .from("organizations")
    .select("id, name, slug")
    .eq("parent_org_id", organizationId)
    .order("name", { ascending: true });

  const { data: ownOrg } = await admin
    .from("organizations")
    .select("id, name, slug")
    .eq("id", organizationId)
    .single();

  const allOrgs = [
    ...(ownOrg ? [ownOrg] : []),
    ...((childOrgs ?? []) as { id: string; name: string; slug: string }[]),
  ];
  const allOrgIds = allOrgs.map((o) => o.id);
  const orgNameMap = new Map(allOrgs.map((o) => [o.id, o.name]));

  // Get all active ads connections across partner + child orgs
  const { data: connections } = await admin
    .from("google_ads_connections")
    .select("organization_id, customer_id, customer_name, currency_code, status, last_sync_at, last_error")
    .in("organization_id", allOrgIds);

  const activeConnections = (connections ?? []).filter(
    (c: any) => c.customer_id && c.status === "active"
  );

  // Calculate date ranges
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7).toISOString().slice(0, 10);
  const fourteenDaysAgo = subDays(now, 14).toISOString().slice(0, 10);
  const thirtyDaysAgo = subDays(now, 30).toISOString().slice(0, 10);

  // Fetch metrics for all connected accounts
  const accountSummaries: AdsAccountSummary[] = [];

  for (const conn of activeConnections as any[]) {
    // Last 14 days of data (7d current + 7d previous for trend)
    const { data: metrics } = await admin
      .from("google_ads_daily_metrics")
      .select("metric_date, impressions, clicks, cost_micros, conversions")
      .eq("organization_id", conn.organization_id)
      .eq("customer_id", conn.customer_id)
      .gte("metric_date", fourteenDaysAgo)
      .order("metric_date", { ascending: false });

    const allMetrics = (metrics ?? []) as {
      metric_date: string;
      impressions: number | string;
      clicks: number | string;
      cost_micros: number | string;
      conversions: number | string;
    }[];

    // Split into current 7d and previous 7d
    const current7d = allMetrics.filter((m) => m.metric_date >= sevenDaysAgo);
    const previous7d = allMetrics.filter((m) => m.metric_date < sevenDaysAgo && m.metric_date >= fourteenDaysAgo);

    // Also get 30d spend
    const { data: thirtyDayMetrics } = await admin
      .from("google_ads_daily_metrics")
      .select("cost_micros")
      .eq("organization_id", conn.organization_id)
      .eq("customer_id", conn.customer_id)
      .gte("metric_date", thirtyDaysAgo);

    const spend7d = current7d.reduce((s, m) => s + numeric(m.cost_micros), 0) / 1_000_000;
    const spendPrev7d = previous7d.reduce((s, m) => s + numeric(m.cost_micros), 0) / 1_000_000;
    const spend30d = ((thirtyDayMetrics ?? []) as { cost_micros: number | string }[]).reduce(
      (s, m) => s + numeric(m.cost_micros), 0
    ) / 1_000_000;
    const impressions7d = current7d.reduce((s, m) => s + numeric(m.impressions), 0);
    const clicks7d = current7d.reduce((s, m) => s + numeric(m.clicks), 0);
    const conversions7d = current7d.reduce((s, m) => s + numeric(m.conversions), 0);
    const ctr7d = impressions7d > 0 ? (clicks7d / impressions7d) * 100 : 0;
    const spendTrend = spendPrev7d > 0 ? ((spend7d - spendPrev7d) / spendPrev7d) * 100 : 0;

    accountSummaries.push({
      organizationId: conn.organization_id,
      orgName: orgNameMap.get(conn.organization_id) ?? "Unknown",
      customerId: conn.customer_id,
      customerName: conn.customer_name,
      currencyCode: conn.currency_code ?? "USD",
      status: conn.status,
      lastSyncAt: conn.last_sync_at,
      lastError: conn.last_error,
      spend7d,
      spend30d,
      impressions7d,
      clicks7d,
      conversions7d,
      ctr7d,
      spendTrend,
    });
  }

  // Aggregate totals
  const totalSpend7d = accountSummaries.reduce((s, a) => s + a.spend7d, 0);
  const totalSpend30d = accountSummaries.reduce((s, a) => s + a.spend30d, 0);
  const totalImpressions = accountSummaries.reduce((s, a) => s + a.impressions7d, 0);
  const totalClicks = accountSummaries.reduce((s, a) => s + a.clicks7d, 0);
  const totalConversions = accountSummaries.reduce((s, a) => s + a.conversions7d, 0);
  const totalCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const connectedCount = accountSummaries.length;
  const disconnectedOrgs = allOrgs.filter(
    (o) => !accountSummaries.some((a) => a.organizationId === o.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ads Overview</h1>
          <p className="text-muted-foreground">
            Aggregated Google Ads performance across all connected accounts ({connectedCount} of{" "}
            {allOrgs.length} organizations).
          </p>
        </div>
        <Link
          href="/dashboard/partner-overview"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back to Overview
        </Link>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Total Spend (7d)
            </CardDescription>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpend7d)}</div>
            <p className="text-xs text-muted-foreground">Across {connectedCount} accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Total Spend (30d)
            </CardDescription>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpend30d)}</div>
            <p className="text-xs text-muted-foreground">Last 30 days combined</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Impressions (7d)
            </CardDescription>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalImpressions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Combined reach</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Clicks (7d)
            </CardDescription>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{totalCTR.toFixed(2)}% CTR</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Conversions (7d)
            </CardDescription>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalConversions.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </div>
            <p className="text-xs text-muted-foreground">Combined conversions</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Account Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Account Performance
          </CardTitle>
          <CardDescription>
            7-day performance metrics per connected Google Ads account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accountSummaries.length === 0 ? (
            <div className="flex h-[160px] items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground">
              <div className="text-center">
                <Globe className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2">No Google Ads accounts connected.</p>
                <p className="text-xs">Connect accounts from the Google Ads page.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Spend (7d)</TableHead>
                    <TableHead className="text-right">Spend (30d)</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-center">Trend</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountSummaries
                    .sort((a, b) => b.spend7d - a.spend7d)
                    .map((account) => (
                      <TableRow key={`${account.organizationId}-${account.customerId}`}>
                        <TableCell>
                          <p className="font-medium">{account.orgName}</p>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{account.customerName ?? account.customerId}</p>
                            <p className="text-xs text-muted-foreground">{account.customerId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(account.spend7d, account.currencyCode)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(account.spend30d, account.currencyCode)}
                        </TableCell>
                        <TableCell className="text-right">
                          {account.impressions7d.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {account.clicks7d.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {account.ctr7d.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {account.conversions7d.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </TableCell>
                        <TableCell className="text-center">
                          {account.spendTrend !== 0 ? (
                            <Badge
                              variant="outline"
                              className={
                                account.spendTrend > 0
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-amber-50 text-amber-700"
                              }
                            >
                              {account.spendTrend > 0 ? "↑" : "↓"}{" "}
                              {Math.abs(account.spendTrend).toFixed(0)}%
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {account.lastError ? (
                            <Badge variant="destructive">Error</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnected Organizations */}
      {disconnectedOrgs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Not Connected
            </CardTitle>
            <CardDescription>
              {disconnectedOrgs.length} organization{disconnectedOrgs.length !== 1 ? "s" : ""} without
              a Google Ads connection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {disconnectedOrgs.map((org) => (
                <Badge key={org.id} variant="secondary">
                  {org.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
