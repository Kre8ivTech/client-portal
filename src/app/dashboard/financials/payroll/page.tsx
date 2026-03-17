import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFinancialOverview } from "@/lib/financials/overview";
import { ModuleOverview } from "@/components/financials/module-overview";

export default async function PayrollPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const overview = await getFinancialOverview(supabase as any);

  const nonBillableHours = Math.max(overview.trackedHours - overview.billableHours, 0);

  return (
    <ModuleOverview
      title="Payroll & Labor Costs"
      description="Use tracked labor and billability to monitor payroll efficiency and utilization."
      metrics={[
        { label: "Tracked Labor Hours", value: overview.trackedHours.toFixed(1), hint: "All logged team hours" },
        { label: "Billable Labor Hours", value: overview.billableHours.toFixed(1), hint: "Revenue-generating hours" },
        { label: "Non-billable Hours", value: nonBillableHours.toFixed(1), hint: "Internal and support overhead" },
        { label: "Labor Utilization", value: `${overview.trackedHours > 0 ? ((overview.billableHours / overview.trackedHours) * 100).toFixed(1) : "0.0"}%`, hint: "Billable share of labor" },
      ]}
    />
  );
}
