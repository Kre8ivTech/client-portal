import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFinancialOverview } from "@/lib/financials/overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "lucide-react";
import Link from "next/link";

export default async function FinancialReportsPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const overview = await getFinancialOverview(supabase as any);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financial Reports & Metrics</h1>
        <p className="text-muted-foreground">Live rollups from invoicing, receivables, subscriptions, contracts, and utilization.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Invoiced</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${(overview.totalInvoiced / 100).toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Collected</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${(overview.totalCollected / 100).toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Open Receivables</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${(overview.openReceivables / 100).toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">MRR</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${(overview.monthlyRecurringRevenue / 100).toLocaleString()}</CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LineChart className="h-4 w-4" />Quick Report Links</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/dashboard/financials/invoicing" className="text-sm text-primary hover:underline">Invoicing & Revenue</Link>
          <Link href="/dashboard/financials/receivables" className="text-sm text-primary hover:underline">Accounts Receivable</Link>
          <Link href="/dashboard/financials/subscriptions" className="text-sm text-primary hover:underline">Subscriptions</Link>
          <Link href="/dashboard/financials/time-tracking" className="text-sm text-primary hover:underline">Time Tracking</Link>
          <Link href="/dashboard/financials/contracts" className="text-sm text-primary hover:underline">Contracts</Link>
          <Link href="/dashboard/admin/invoices" className="text-sm text-primary hover:underline">Invoice Ledger</Link>
        </CardContent>
      </Card>
    </div>
  );
}
