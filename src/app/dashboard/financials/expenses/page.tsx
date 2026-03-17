import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFinancialOverview } from "@/lib/financials/overview";
import { ModuleOverview } from "@/components/financials/module-overview";

export default async function ExpensesPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const overview = await getFinancialOverview(supabase as any);

  const estimatedExpenseRunRate = Math.max(overview.totalInvoiced - overview.totalCollected, 0);

  return (
    <ModuleOverview
      title="Expenses & Reimbursements"
      description="Track outbound cash impact using current billing, receivables, and utilization signals."
      metrics={[
        { label: "Estimated Expense Pressure", value: `$${(estimatedExpenseRunRate / 100).toLocaleString()}`, hint: "Open balance not yet collected" },
        { label: "Outstanding Receivables", value: `$${(overview.openReceivables / 100).toLocaleString()}`, hint: "Directly affects expense coverage" },
        { label: "Tracked Hours", value: overview.trackedHours.toFixed(1), hint: "Operational work logged" },
        { label: "Billable Utilization", value: `${overview.trackedHours > 0 ? ((overview.billableHours / overview.trackedHours) * 100).toFixed(1) : "0.0"}%`, hint: "Billable hours share" },
      ]}
    />
  );
}
