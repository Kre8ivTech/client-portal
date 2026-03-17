import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFinancialOverview } from "@/lib/financials/overview";
import { ModuleOverview } from "@/components/financials/module-overview";

export default async function BudgetingPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const overview = await getFinancialOverview(supabase as any);

  const projectedArr = overview.monthlyRecurringRevenue * 12;

  return (
    <ModuleOverview
      title="Budgeting & Forecasting"
      description="Build budget assumptions from recurring revenue, collections, and utilization trends."
      metrics={[
        { label: "Current MRR", value: `$${(overview.monthlyRecurringRevenue / 100).toLocaleString()}`, hint: "Active subscription run-rate" },
        { label: "Projected ARR", value: `$${(projectedArr / 100).toLocaleString()}`, hint: "MRR x 12" },
        { label: "Collected Revenue", value: `$${(overview.totalCollected / 100).toLocaleString()}`, hint: "Cash collected to date" },
        { label: "Utilization Signal", value: `${overview.trackedHours > 0 ? ((overview.billableHours / overview.trackedHours) * 100).toFixed(1) : "0.0"}%`, hint: "Billable labor ratio" },
      ]}
    />
  );
}
