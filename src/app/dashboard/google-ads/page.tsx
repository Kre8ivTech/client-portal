import { AlertCircle, CheckCircle2, CircleDollarSign, Eye, MousePointerClick, ShieldAlert, TrendingUp } from "lucide-react";

import { DailySpendChart } from "@/components/google-ads/daily-spend-chart";
import { GoogleAdsControls } from "@/components/google-ads/google-ads-controls";
import { GoogleAdsMetricCard } from "@/components/google-ads/google-ads-metric-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GoogleAdsAccount, GoogleAdsCampaign, GoogleAdsIssue } from "@/lib/google-ads/types";
import { requireRole } from "@/lib/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type ConnectionSummary = {
  google_email: string | null;
  available_customers: GoogleAdsAccount[];
  customer_id: string | null;
  customer_name: string | null;
  currency_code: string | null;
  status: "active" | "error" | "revoked";
  last_sync_at: string | null;
  last_error: string | null;
};

type MetricRow = {
  metric_date: string;
  impressions: number | string;
  clicks: number | string;
  cost_micros: number | string;
  conversions: number | string;
  conversion_value: number | string;
  campaigns: GoogleAdsCampaign[];
  issues: GoogleAdsIssue[];
};

function numeric(value: number | string): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function formatCurrency(value: number, currencyCode: string, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits,
  }).format(value);
}

function sum(rows: MetricRow[], field: "impressions" | "clicks" | "cost_micros" | "conversions") {
  return rows.reduce((total, row) => total + numeric(row[field]), 0);
}

function oauthErrorMessage(value: string | undefined): string | null {
  if (!value) return null;
  const messages: Record<string, string> = {
    access_denied: "Google Ads access was not granted.",
    invalid_state: "The Google connection request was invalid or expired.",
    state_expired: "The Google connection took too long. Please try again.",
    missing_code: "Google did not return an authorization code.",
    unauthorized: "Your portal session changed during the Google connection.",
    connection_failed: "Google Ads could not be connected. Check the OAuth and developer-token setup.",
  };
  return messages[value] ?? "Google Ads could not be connected.";
}

export default async function GoogleAdsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { profile, role } = await requireRole(["partner", "partner_staff"]);
  const params = await searchParams;
  const organizationId = profile?.organization_id;
  if (!organizationId) return null;

  const admin = getSupabaseAdmin();
  const { data: connectionData } = await admin
    .from("google_ads_connections")
    .select("google_email, available_customers, customer_id, customer_name, currency_code, status, last_sync_at, last_error")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const connection = connectionData as ConnectionSummary | null;

  let metrics: MetricRow[] = [];
  if (connection?.customer_id) {
    const { data } = await admin
      .from("google_ads_daily_metrics")
      .select("metric_date, impressions, clicks, cost_micros, conversions, conversion_value, campaigns, issues")
      .eq("organization_id", organizationId)
      .eq("customer_id", connection.customer_id)
      .order("metric_date", { ascending: false })
      .limit(30);
    metrics = (data ?? []) as MetricRow[];
  }

  const chronological = [...metrics].reverse();
  const latest = metrics[0] ?? null;
  const lastSeven = metrics.slice(0, 7);
  const currencyCode = connection?.currency_code ?? "USD";
  const spendSevenDays = sum(lastSeven, "cost_micros") / 1_000_000;
  const clicksSevenDays = sum(lastSeven, "clicks");
  const impressionsSevenDays = sum(lastSeven, "impressions");
  const conversionsSevenDays = sum(lastSeven, "conversions");
  const ctr = impressionsSevenDays > 0 ? (clicksSevenDays / impressionsSevenDays) * 100 : 0;
  const issues = Array.isArray(latest?.issues) ? latest.issues : [];
  const campaigns = Array.isArray(latest?.campaigns) ? latest.campaigns : [];
  const configured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    (process.env.ENCRYPTION_SECRET?.length ?? 0) >= 32,
  );
  const connectionError = oauthErrorMessage(params.error);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Ads</h1>
          <p className="mt-1 text-muted-foreground">
            Daily spend, traffic, conversions, campaign delivery, and policy issues for your white-label account.
          </p>
        </div>
        <GoogleAdsControls
          connected={Boolean(connection)}
          configured={configured}
          selectedCustomerId={connection?.customer_id ?? null}
          accounts={connection?.available_customers ?? []}
          canManageConnection={role === "partner"}
        />
      </div>

      {!configured && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Google Ads setup is incomplete</AlertTitle>
          <AlertDescription>
            An administrator must configure the Google OAuth client, Ads developer token, and encryption secret.
          </AlertDescription>
        </Alert>
      )}
      {params.success === "connected" && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Google Ads connected successfully.</AlertDescription>
        </Alert>
      )}
      {connectionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{connectionError}</AlertDescription>
        </Alert>
      )}

      {!connection ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect your Google Ads account</CardTitle>
            <CardDescription>
              Sign in with a Google user that has access to the advertising account or manager account you want to report on.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
            <p><strong className="block text-foreground">Daily performance</strong>Spend, impressions, clicks, CTR, and conversions.</p>
            <p><strong className="block text-foreground">Campaign visibility</strong>Budget, status, delivery, and optimization score.</p>
            <p><strong className="block text-foreground">Issues that need attention</strong>Policy disapprovals, limited delivery, and recommendations.</p>
          </CardContent>
        </Card>
      ) : !connection.customer_id ? (
        <Alert variant="info">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Select an advertising account</AlertTitle>
          <AlertDescription>
            {connection.available_customers.length > 0
              ? "Choose one of the available client accounts above to begin daily reporting."
              : "No non-manager advertising accounts were found for this Google user."}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-2 pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-medium">{connection.customer_name}</span>
                <span className="ml-2 text-muted-foreground">{connection.customer_id}</span>
                {connection.google_email && <span className="block text-muted-foreground sm:inline sm:ml-3">Connected as {connection.google_email}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={connection.status === "active" ? "success" : "destructive"}>{connection.status}</Badge>
                <span className="text-muted-foreground">
                  {connection.last_sync_at ? `Updated ${new Date(connection.last_sync_at).toLocaleString()}` : "Not synced yet"}
                </span>
              </div>
            </CardContent>
          </Card>

          {connection.last_error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Latest sync needs attention</AlertTitle>
              <AlertDescription>{connection.last_error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <GoogleAdsMetricCard title="7-day spend" value={formatCurrency(spendSevenDays, currencyCode)} detail="Across all campaigns" icon={CircleDollarSign} />
            <GoogleAdsMetricCard title="Impressions" value={impressionsSevenDays.toLocaleString()} detail="Last 7 days" icon={Eye} />
            <GoogleAdsMetricCard title="Clicks" value={clicksSevenDays.toLocaleString()} detail={`${ctr.toFixed(2)}% click-through rate`} icon={MousePointerClick} />
            <GoogleAdsMetricCard title="Conversions" value={conversionsSevenDays.toLocaleString(undefined, { maximumFractionDigits: 1 })} detail="Last 7 days" icon={TrendingUp} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Daily spend</CardTitle>
                <CardDescription>Most recent 14 days in {currencyCode}.</CardDescription>
              </CardHeader>
              <CardContent>
                <DailySpendChart
                  points={chronological.map((row) => ({ date: row.metric_date, costMicros: numeric(row.cost_micros) }))}
                  currencyCode={currencyCode}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />Account health</CardTitle>
                <CardDescription>{issues.length} current item{issues.length === 1 ? "" : "s"} to review.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {issues.length === 0 ? (
                  <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
                    <p className="font-medium text-success">No current issues found</p>
                    <p className="mt-1 text-muted-foreground">Campaign delivery and policy checks look clear.</p>
                  </div>
                ) : issues.slice(0, 8).map((issue) => (
                  <div key={issue.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{issue.title}</p>
                      <Badge variant={issue.severity === "critical" ? "destructive" : issue.severity === "warning" ? "warning" : "info"}>
                        {issue.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{issue.detail}</p>
                    {issue.campaignName && <p className="mt-1 text-xs text-muted-foreground">Campaign: {issue.campaignName}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Campaigns today</CardTitle>
              <CardDescription>Spend and performance as of the latest sync.</CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No campaign activity was returned today.</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead><TableHead>Status</TableHead><TableHead>Spend</TableHead><TableHead>Clicks</TableHead><TableHead>Conversions</TableHead><TableHead>Optimization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell><span className="font-medium">{campaign.name}</span><span className="block text-xs text-muted-foreground">{campaign.channelType.replaceAll("_", " ")}</span></TableCell>
                        <TableCell><Badge variant={campaign.status === "ENABLED" ? "success" : "secondary"}>{campaign.status}</Badge></TableCell>
                        <TableCell>{formatCurrency(campaign.costMicros / 1_000_000, currencyCode)}</TableCell>
                        <TableCell>{campaign.clicks.toLocaleString()}</TableCell>
                        <TableCell>{campaign.conversions.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                        <TableCell>{campaign.optimizationScore === null ? "—" : `${Math.round(campaign.optimizationScore * 100)}%`}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Daily performance</CardTitle><CardDescription>Last 30 synced days.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Spend</TableHead><TableHead>Impressions</TableHead><TableHead>Clicks</TableHead><TableHead>CTR</TableHead><TableHead>Conversions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {metrics.map((row) => {
                    const rowImpressions = numeric(row.impressions);
                    const rowClicks = numeric(row.clicks);
                    const rowCtr = rowImpressions > 0 ? (rowClicks / rowImpressions) * 100 : 0;
                    return (
                      <TableRow key={row.metric_date}>
                        <TableCell>{row.metric_date}</TableCell>
                        <TableCell>{formatCurrency(numeric(row.cost_micros) / 1_000_000, currencyCode)}</TableCell>
                        <TableCell>{rowImpressions.toLocaleString()}</TableCell>
                        <TableCell>{rowClicks.toLocaleString()}</TableCell>
                        <TableCell>{rowCtr.toFixed(2)}%</TableCell>
                        <TableCell>{numeric(row.conversions).toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
