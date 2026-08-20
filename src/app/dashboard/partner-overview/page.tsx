import { requireRole } from "@/lib/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  TrendingUp,
  Ticket,
  FolderKanban,
  DollarSign,
  CircleDollarSign,
  Activity,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import Link from "next/link";
import { format, subDays } from "date-fns";

export const dynamic = "force-dynamic";

type ChildOrg = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export default async function PartnerOverviewPage() {
  const { profile } = await requireRole(["partner", "partner_staff"]);
  const organizationId = profile?.organization_id;
  if (!organizationId) return null;

  const admin = getSupabaseAdmin();

  // Get child client organizations
  const { data: childOrgs } = await admin
    .from("organizations")
    .select("id, name, slug, status")
    .eq("parent_org_id", organizationId)
    .order("name", { ascending: true });

  const clients = (childOrgs ?? []) as ChildOrg[];
  const clientIds = clients.map((c) => c.id);
  const activeClients = clients.filter((c) => c.status === "active");

  // Aggregate KPIs across all child organizations
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30).toISOString();
  const sevenDaysAgo = subDays(now, 7).toISOString();
  const prevThirtyStart = subDays(now, 60).toISOString();
  const prevThirtyEnd = subDays(now, 30).toISOString();

  // --- Open Tickets ---
  let openTicketsCount = 0;
  let openTicketsPrev = 0;
  if (clientIds.length > 0) {
    const { count } = await admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .in("organization_id", clientIds)
      .in("status", ["new", "open", "in_progress", "pending_client"]);
    openTicketsCount = count ?? 0;

    // Previous period for trend
    const { count: prevCount } = await admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .in("organization_id", clientIds)
      .in("status", ["new", "open", "in_progress", "pending_client"])
      .lt("created_at", prevThirtyEnd)
      .gte("created_at", prevThirtyStart);
    openTicketsPrev = prevCount ?? 0;
  }

  // --- Active Projects ---
  let activeProjectsCount = 0;
  if (clientIds.length > 0) {
    const { count } = await admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .in("organization_id", clientIds)
      .eq("status", "active");
    activeProjectsCount = count ?? 0;
  }

  // --- Tickets resolved last 30 days ---
  let resolvedTickets30d = 0;
  let resolvedTicketsPrev30d = 0;
  if (clientIds.length > 0) {
    const { count } = await admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .in("organization_id", clientIds)
      .eq("status", "resolved")
      .gte("updated_at", thirtyDaysAgo);
    resolvedTickets30d = count ?? 0;

    const { count: prevResolved } = await admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .in("organization_id", clientIds)
      .eq("status", "resolved")
      .gte("updated_at", prevThirtyStart)
      .lt("updated_at", prevThirtyEnd);
    resolvedTicketsPrev30d = prevResolved ?? 0;
  }

  // --- Revenue (invoices paid last 30 days) ---
  let revenueLast30 = 0;
  let revenuePrev30 = 0;
  if (clientIds.length > 0) {
    const { data: paidInvoices } = await admin
      .from("invoices")
      .select("amount_paid, paid_at")
      .in("organization_id", clientIds)
      .eq("status", "paid")
      .gte("paid_at", thirtyDaysAgo);
    revenueLast30 = (paidInvoices ?? []).reduce(
      (sum: number, inv: { amount_paid: number | null }) => sum + (inv.amount_paid ?? 0),
      0
    );

    const { data: prevPaidInvoices } = await admin
      .from("invoices")
      .select("amount_paid, paid_at")
      .in("organization_id", clientIds)
      .eq("status", "paid")
      .gte("paid_at", prevThirtyStart)
      .lt("paid_at", prevThirtyEnd);
    revenuePrev30 = (prevPaidInvoices ?? []).reduce(
      (sum: number, inv: { amount_paid: number | null }) => sum + (inv.amount_paid ?? 0),
      0
    );
  }

  // --- MRR (active plan assignments) ---
  let totalMRR = 0;
  if (clientIds.length > 0) {
    const { data: planAssignments } = await admin
      .from("plan_assignments")
      .select("plans(monthly_fee)")
      .in("organization_id", clientIds)
      .eq("status", "active");
    totalMRR = (planAssignments ?? []).reduce(
      (sum: number, pa: { plans: { monthly_fee: number } | null }) =>
        sum + (pa.plans?.monthly_fee ?? 0),
      0
    );
  }

  // --- Google Ads total spend (7 days across all child orgs) ---
  let totalAdSpend7d = 0;
  let adAccountsConnected = 0;
  if (clientIds.length > 0) {
    // Check partner's own ads connection
    const { data: adsConnection } = await admin
      .from("google_ads_connections")
      .select("customer_id, currency_code")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();

    if (adsConnection?.customer_id) {
      adAccountsConnected = 1;
      const { data: adsMetrics } = await admin
        .from("google_ads_daily_metrics")
        .select("cost_micros")
        .eq("organization_id", organizationId)
        .eq("customer_id", adsConnection.customer_id)
        .gte("metric_date", subDays(now, 7).toISOString().slice(0, 10));
      totalAdSpend7d = (adsMetrics ?? []).reduce(
        (sum: number, row: { cost_micros: number | string }) => sum + Number(row.cost_micros),
        0
      ) / 1_000_000;
    }
  }

  // --- Recent Activity (last 10 events across child orgs) ---
  type RecentTicket = {
    id: string;
    ticket_number: number;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
    organization_id: string;
  };
  let recentActivity: (RecentTicket & { org_name: string })[] = [];
  if (clientIds.length > 0) {
    const { data: recentTickets } = await admin
      .from("tickets")
      .select("id, ticket_number, subject, status, priority, created_at, organization_id")
      .in("organization_id", clientIds)
      .order("created_at", { ascending: false })
      .limit(10);

    const orgNameMap = new Map(clients.map((c) => [c.id, c.name]));
    recentActivity = (recentTickets ?? []).map((t: RecentTicket) => ({
      ...t,
      org_name: orgNameMap.get(t.organization_id) ?? "Unknown",
    }));
  }

  // Compute trends
  const ticketTrend = openTicketsPrev > 0
    ? ((openTicketsCount - openTicketsPrev) / openTicketsPrev) * 100
    : 0;
  const resolvedTrend = resolvedTicketsPrev30d > 0
    ? ((resolvedTickets30d - resolvedTicketsPrev30d) / resolvedTicketsPrev30d) * 100
    : 0;
  const revenueTrend = revenuePrev30 > 0
    ? ((revenueLast30 - revenuePrev30) / revenuePrev30) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Partner Overview</h1>
        <p className="text-muted-foreground">
          Centralized view of all your client organizations, projects, support, and financials.
        </p>
      </div>

      {/* Top KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={Users}
          title="Total Clients"
          value={String(clients.length)}
          description={`${activeClients.length} active`}
          href="/dashboard/partner-overview/clients"
        />
        <KPICard
          icon={Ticket}
          title="Open Tickets"
          value={String(openTicketsCount)}
          description={`${resolvedTickets30d} resolved this month`}
          trend={ticketTrend}
          trendLabel="vs prev 30d"
          invertTrend
          href="/dashboard/partner-overview/clients"
        />
        <KPICard
          icon={FolderKanban}
          title="Active Projects"
          value={String(activeProjectsCount)}
          description="Across all clients"
          href="/dashboard/partner-overview/projects"
        />
        <KPICard
          icon={DollarSign}
          title="Monthly Revenue"
          value={`$${(totalMRR / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          description="Active plan MRR"
          href="/dashboard/partner-overview/financials"
        />
      </div>

      {/* Second Row KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KPICard
          icon={CircleDollarSign}
          title="Revenue (30d)"
          value={`$${(revenueLast30 / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          description="From paid invoices"
          trend={revenueTrend}
          trendLabel="vs prev 30d"
          href="/dashboard/partner-overview/financials"
        />
        <KPICard
          icon={TrendingUp}
          title="Tickets Resolved"
          value={String(resolvedTickets30d)}
          description="Last 30 days"
          trend={resolvedTrend}
          trendLabel="vs prev 30d"
          href="/dashboard/reports"
        />
        <KPICard
          icon={Globe}
          title="Ad Spend (7d)"
          value={`$${totalAdSpend7d.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          description={`${adAccountsConnected} account${adAccountsConnected !== 1 ? "s" : ""} connected`}
          href="/dashboard/partner-overview/ads"
        />
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Client Activity
          </CardTitle>
          <CardDescription>Latest support tickets across all client organizations</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="flex h-[120px] items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground">
              No recent activity from client organizations.
            </div>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Ticket className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        #{ticket.ticket_number} · {ticket.org_name} ·{" "}
                        {format(new Date(ticket.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={ticket.priority === "critical" || ticket.priority === "high" ? "destructive" : "secondary"}
                      >
                        {ticket.priority}
                      </Badge>
                      <Badge variant="outline">{ticket.status.replace(/_/g, " ")}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {recentActivity.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <Link
                href="/dashboard/partner-overview/clients"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all client activity →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Navigation */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickNavCard
          href="/dashboard/partner-overview/clients"
          icon={Users}
          title="Client Portfolio"
          description="View all clients with health indicators"
        />
        <QuickNavCard
          href="/dashboard/partner-overview/ads"
          icon={Globe}
          title="Ads Overview"
          description="Multi-client advertising performance"
        />
        <QuickNavCard
          href="/dashboard/partner-overview/sites"
          icon={Activity}
          title="Website Monitoring"
          description="Uptime, SSL, and performance"
        />
        <QuickNavCard
          href="/dashboard/partner-overview/projects"
          icon={FolderKanban}
          title="Project Status"
          description="Cross-client project board"
        />
      </div>
    </div>
  );
}

function KPICard({
  icon: Icon,
  title,
  value,
  description,
  trend,
  trendLabel,
  invertTrend,
  href,
}: {
  icon: typeof Users;
  title: string;
  value: string;
  description: string;
  trend?: number;
  trendLabel?: string;
  invertTrend?: boolean;
  href?: string;
}) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;
  // For tickets, "up" is bad — invert the color
  const trendIsGood = invertTrend ? isNegative : isPositive;
  const trendIsBad = invertTrend ? isPositive : isNegative;

  const content = (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {title}
        </CardDescription>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{description}</p>
          {trend !== undefined && trend !== 0 && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                trendIsGood ? "text-green-600" : trendIsBad ? "text-red-600" : "text-muted-foreground"
              }`}
            >
              {isPositive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(trend).toFixed(0)}%
              {trendLabel && <span className="text-muted-foreground font-normal ml-0.5">{trendLabel}</span>}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

function QuickNavCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="transition-all hover:shadow-md hover:border-primary/30">
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
