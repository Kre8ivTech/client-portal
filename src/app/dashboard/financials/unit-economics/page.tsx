import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFinancialOverview } from "@/lib/financials/overview";
import { ModuleOverview } from "@/components/financials/module-overview";

export default async function UnitEconomicsPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const overview = await getFinancialOverview(supabase as any);

  const arpu = overview.activeSubscriptions > 0 ? overview.monthlyRecurringRevenue / overview.activeSubscriptions : 0;
  const revenuePerHour = overview.trackedHours > 0 ? overview.totalCollected / overview.trackedHours : 0;

  return (
    <ModuleOverview
      title="Unit Economics & Margins"
      description="Track revenue efficiency per account and per labor hour from live operational and billing data."
      metrics={[
        { label: "ARPU (MRR)", value: `$${(arpu / 100).toFixed(2)}`, hint: "Average recurring revenue per active subscription" },
        { label: "Revenue per Tracked Hour", value: `$${(revenuePerHour / 100).toFixed(2)}`, hint: "Collected revenue / tracked hours" },
        { label: "Active Subscriptions", value: overview.activeSubscriptions.toString(), hint: "Current recurring customer base" },
        { label: "Billable Utilization", value: `${overview.trackedHours > 0 ? ((overview.billableHours / overview.trackedHours) * 100).toFixed(1) : "0.0"}%`, hint: "Billable hour share" },
      ]}
    />
  );
}
