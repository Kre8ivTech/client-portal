import { requireRole } from "@/lib/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Users,
} from "lucide-react";
import Link from "next/link";
import { subDays } from "date-fns";

export const dynamic = "force-dynamic";

type ClientFinancial = {
  id: string;
  name: string;
  slug: string;
  mrr: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueCount: number;
  overdueAmount: number;
  paidLast30d: number;
  invoiceCount: number;
  avgDaysToPayment: number | null;
  paymentHealth: "good" | "fair" | "poor";
};

function computePaymentHealth(client: {
  overdueCount: number;
  avgDaysToPayment: number | null;
  totalOutstanding: number;
  mrr: number;
}): "good" | "fair" | "poor" {
  if (client.overdueCount > 2) return "poor";
  if (client.overdueCount > 0 || (client.avgDaysToPayment !== null && client.avgDaysToPayment > 30)) return "fair";
  return "good";
}

const healthColors: Record<string, string> = {
  good: "bg-green-100 text-green-700",
  fair: "bg-amber-100 text-amber-700",
  poor: "bg-red-100 text-red-700",
};

export default async function FinancialsPage() {
  const { profile } = await requireRole(["partner", "partner_staff"]);
  const organizationId = profile?.organization_id;
  if (!organizationId) return null;

  const admin = getSupabaseAdmin();

  // Get child client organizations
  const { data: childOrgs } = await admin
    .from("organizations")
    .select("id, name, slug")
    .eq("parent_org_id", organizationId)
    .order("name", { ascending: true });

  const clients = (childOrgs ?? []) as { id: string; name: string; slug: string }[];
  const clientIds = clients.map((c) => c.id);

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const thirtyDaysAgo = subDays(now, 30).toISOString();
  const prevThirtyStart = subDays(now, 60).toISOString();
  const prevThirtyEnd = subDays(now, 30).toISOString();

  const clientFinancials: ClientFinancial[] = [];

  if (clientIds.length > 0) {
    // Batch fetch all invoices for child orgs
    const { data: allInvoices } = await admin
      .from("invoices")
      .select("id, organization_id, status, total, amount_paid, balance_due, due_date, paid_at, created_at")
      .in("organization_id", clientIds);

    // Batch fetch plan assignments for MRR
    const { data: allPlanAssignments } = await admin
      .from("plan_assignments")
      .select("organization_id, plans(monthly_fee)")
      .in("organization_id", clientIds)
      .eq("status", "active");

    // Group invoices by org
    const invoicesByOrg = new Map<string, any[]>();
    (allInvoices ?? []).forEach((inv: any) => {
      const existing = invoicesByOrg.get(inv.organization_id) ?? [];
      existing.push(inv);
      invoicesByOrg.set(inv.organization_id, existing);
    });

    // Group MRR by org
    const mrrByOrg = new Map<string, number>();
    (allPlanAssignments ?? []).forEach((pa: any) => {
      const fee = pa.plans?.monthly_fee ?? 0;
      mrrByOrg.set(pa.organization_id, (mrrByOrg.get(pa.organization_id) ?? 0) + fee);
    });

    // Build per-client financials
    for (const client of clients) {
      const invoices = invoicesByOrg.get(client.id) ?? [];
      const mrr = mrrByOrg.get(client.id) ?? 0;

      const totalInvoiced = invoices.reduce((s: number, inv: any) => s + (inv.total ?? 0), 0);
      const totalPaid = invoices
        .filter((inv: any) => inv.status === "paid")
        .reduce((s: number, inv: any) => s + (inv.amount_paid ?? 0), 0);

      const outstandingInvoices = invoices.filter((inv: any) =>
        ["sent", "viewed", "partially_paid"].includes(inv.status)
      );
      const totalOutstanding = outstandingInvoices.reduce(
        (s: number, inv: any) => s + (inv.balance_due ?? 0),
        0
      );

      const overdueInvoices = outstandingInvoices.filter(
        (inv: any) => inv.due_date && inv.due_date < today
      );
      const overdueCount = overdueInvoices.length;
      const overdueAmount = overdueInvoices.reduce(
        (s: number, inv: any) => s + (inv.balance_due ?? 0),
        0
      );

      // Paid in last 30 days
      const paidLast30d = invoices
        .filter((inv: any) => inv.status === "paid" && inv.paid_at && inv.paid_at >= thirtyDaysAgo)
        .reduce((s: number, inv: any) => s + (inv.amount_paid ?? 0), 0);

      // Average days to payment
      const paidInvoices = invoices.filter(
        (inv: any) => inv.status === "paid" && inv.paid_at && inv.created_at
      );
      let avgDaysToPayment: number | null = null;
      if (paidInvoices.length > 0) {
        const totalDays = paidInvoices.reduce((s: number, inv: any) => {
          const created = new Date(inv.created_at).getTime();
          const paid = new Date(inv.paid_at).getTime();
          return s + (paid - created) / (1000 * 60 * 60 * 24);
        }, 0);
        avgDaysToPayment = Math.round(totalDays / paidInvoices.length);
      }

      const financialData: ClientFinancial = {
        id: client.id,
        name: client.name,
        slug: client.slug,
        mrr,
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        overdueCount,
        overdueAmount,
        paidLast30d,
        invoiceCount: invoices.length,
        avgDaysToPayment,
        paymentHealth: "good",
      };
      financialData.paymentHealth = computePaymentHealth(financialData);
      clientFinancials.push(financialData);
    }
  }

  // Sort: poor health first, then by outstanding amount desc
  const healthOrder: Record<string, number> = { poor: 0, fair: 1, good: 2 };
  clientFinancials.sort((a, b) => {
    const healthDiff = healthOrder[a.paymentHealth] - healthOrder[b.paymentHealth];
    if (healthDiff !== 0) return healthDiff;
    return b.totalOutstanding - a.totalOutstanding;
  });

  // Aggregate totals
  const totalMRR = clientFinancials.reduce((s, c) => s + c.mrr, 0);
  const totalRevenue30d = clientFinancials.reduce((s, c) => s + c.paidLast30d, 0);
  const totalOutstanding = clientFinancials.reduce((s, c) => s + c.totalOutstanding, 0);
  const totalOverdue = clientFinancials.reduce((s, c) => s + c.overdueAmount, 0);
  const totalOverdueCount = clientFinancials.reduce((s, c) => s + c.overdueCount, 0);
  const totalLifetimeRevenue = clientFinancials.reduce((s, c) => s + c.totalPaid, 0);
  const clientsWithOverdue = clientFinancials.filter((c) => c.overdueCount > 0).length;

  // Previous period revenue for trend
  let prevRevenue30d = 0;
  if (clientIds.length > 0) {
    const { data: prevPaidInvoices } = await admin
      .from("invoices")
      .select("amount_paid")
      .in("organization_id", clientIds)
      .eq("status", "paid")
      .gte("paid_at", prevThirtyStart)
      .lt("paid_at", prevThirtyEnd);
    prevRevenue30d = (prevPaidInvoices ?? []).reduce(
      (s: number, inv: { amount_paid: number | null }) => s + (inv.amount_paid ?? 0),
      0
    );
  }

  const revenueTrend = prevRevenue30d > 0
    ? ((totalRevenue30d - prevRevenue30d) / prevRevenue30d) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Financials</h1>
          <p className="text-muted-foreground">
            Revenue, MRR, outstanding balances, and payment health across all {clients.length} client
            organizations.
          </p>
        </div>
        <Link
          href="/dashboard/partner-overview"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back to Overview
        </Link>
      </div>

      {/* Aggregate KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Monthly MRR
            </CardDescription>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalMRR / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">From active plans</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Revenue (30d)
            </CardDescription>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalRevenue30d / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </div>
            <div className="flex items-center gap-1">
              {revenueTrend !== 0 && (
                <span
                  className={`inline-flex items-center text-xs font-medium ${
                    revenueTrend > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {revenueTrend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(revenueTrend).toFixed(0)}% vs prev
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Outstanding
            </CardDescription>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalOutstanding / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">Unpaid invoices</p>
          </CardContent>
        </Card>
        <Card className={totalOverdue > 0 ? "border-red-200 bg-red-50/30" : ""}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Overdue
            </CardDescription>
            <AlertCircle className={`h-4 w-4 ${totalOverdue > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalOverdue > 0 ? "text-red-700" : ""}`}>
              ${(totalOverdue / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalOverdueCount} invoice{totalOverdueCount !== 1 ? "s" : ""} from {clientsWithOverdue} client{clientsWithOverdue !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Lifetime Revenue
            </CardDescription>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalLifetimeRevenue / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">All time paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Client Financial Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Client Financial Summary
          </CardTitle>
          <CardDescription>
            Payment health sorted by urgency — clients with overdue invoices appear first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientFinancials.length === 0 ? (
            <div className="flex h-[160px] items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground">
              No client organizations found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-center">Health</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-right">Paid (30d)</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                    <TableHead className="text-center">Avg Days to Pay</TableHead>
                    <TableHead className="text-right">Lifetime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientFinancials.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/clients/${client.id}`}
                          className="hover:underline"
                        >
                          <p className="font-medium">{client.name}</p>
                          <p className="text-xs text-muted-foreground">{client.slug}</p>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={healthColors[client.paymentHealth]}>
                          {client.paymentHealth === "good" && (
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                          )}
                          {client.paymentHealth === "fair" && (
                            <Clock className="mr-1 h-3 w-3" />
                          )}
                          {client.paymentHealth === "poor" && (
                            <AlertCircle className="mr-1 h-3 w-3" />
                          )}
                          {client.paymentHealth.charAt(0).toUpperCase() + client.paymentHealth.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {client.mrr > 0
                          ? `$${(client.mrr / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {client.paidLast30d > 0
                          ? `$${(client.paidLast30d / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {client.totalOutstanding > 0 ? (
                          <span className="font-medium">
                            ${(client.totalOutstanding / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">$0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {client.overdueCount > 0 ? (
                          <div>
                            <span className="font-medium text-red-600">
                              ${(client.overdueAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                            </span>
                            <p className="text-xs text-red-500">
                              {client.overdueCount} invoice{client.overdueCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {client.avgDaysToPayment !== null ? (
                          <span
                            className={`font-medium ${
                              client.avgDaysToPayment > 30
                                ? "text-red-600"
                                : client.avgDaysToPayment > 14
                                  ? "text-amber-600"
                                  : "text-green-600"
                            }`}
                          >
                            {client.avgDaysToPayment}d
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        ${(client.totalPaid / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overdue Invoices Alert */}
      {totalOverdueCount > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              Overdue Invoice Summary
            </CardTitle>
            <CardDescription className="text-red-700">
              {totalOverdueCount} overdue invoice{totalOverdueCount !== 1 ? "s" : ""} totaling $
              {(totalOverdue / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })} across{" "}
              {clientsWithOverdue} client{clientsWithOverdue !== 1 ? "s" : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {clientFinancials
                .filter((c) => c.overdueCount > 0)
                .map((client) => (
                  <li
                    key={client.id}
                    className="flex items-center justify-between rounded-lg border bg-white p-3"
                  >
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.overdueCount} overdue invoice{client.overdueCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-700">
                        ${(client.overdueAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      </p>
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View client →
                      </Link>
                    </div>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
