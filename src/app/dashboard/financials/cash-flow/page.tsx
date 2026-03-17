import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFinancialOverview } from "@/lib/financials/overview";
import { ModuleOverview } from "@/components/financials/module-overview";

export default async function CashFlowPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const overview = await getFinancialOverview(supabase as any);

  const projectedMonthlyInflow = overview.monthlyRecurringRevenue + Math.round(overview.openReceivables * 0.35);

  return (
    <ModuleOverview
      title="Cash Flow & Runway"
      description="Monitor current inflow signals from recurring plans, collections, and outstanding receivables."
      metrics={[
        { label: "Collected Cash", value: `$${(overview.totalCollected / 100).toLocaleString()}`, hint: "Paid invoices" },
        { label: "Open Receivables", value: `$${(overview.openReceivables / 100).toLocaleString()}`, hint: "Potential near-term inflow" },
        { label: "Monthly Recurring Revenue", value: `$${(overview.monthlyRecurringRevenue / 100).toLocaleString()}`, hint: "Active subscription base" },
        { label: "Projected Monthly Inflow", value: `$${(projectedMonthlyInflow / 100).toLocaleString()}`, hint: "MRR + weighted receivables" },
      ]}
    />
  );
}
