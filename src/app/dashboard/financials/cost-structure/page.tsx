import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFinancialOverview } from "@/lib/financials/overview";
import { ModuleOverview } from "@/components/financials/module-overview";

export default async function CostStructurePage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const overview = await getFinancialOverview(supabase as any);

  const collectedRatio = overview.totalInvoiced > 0 ? (overview.totalCollected / overview.totalInvoiced) * 100 : 0;
  const receivableRatio = overview.totalInvoiced > 0 ? (overview.openReceivables / overview.totalInvoiced) * 100 : 0;

  return (
    <ModuleOverview
      title="Cost Structure & Categories"
      description="Use collected revenue, open balances, and labor utilization to evaluate your current cost structure."
      metrics={[
        { label: "Revenue Collected Ratio", value: `${collectedRatio.toFixed(1)}%`, hint: "Collected vs total invoiced" },
        { label: "Receivable Exposure", value: `${receivableRatio.toFixed(1)}%`, hint: "Open balance share" },
        { label: "Billable Labor Mix", value: `${overview.trackedHours > 0 ? ((overview.billableHours / overview.trackedHours) * 100).toFixed(1) : "0.0"}%`, hint: "Billable hours ratio" },
        { label: "Active Subscription Base", value: overview.activeSubscriptions.toString(), hint: "Recurring commitments" },
      ]}
    />
  );
}
