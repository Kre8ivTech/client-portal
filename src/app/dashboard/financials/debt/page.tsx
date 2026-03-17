import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFinancialOverview } from "@/lib/financials/overview";
import { ModuleOverview } from "@/components/financials/module-overview";

export default async function DebtPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const overview = await getFinancialOverview(supabase as any);

  const receivableRatio = overview.totalInvoiced > 0 ? (overview.openReceivables / overview.totalInvoiced) * 100 : 0;

  return (
    <ModuleOverview
      title="Debt & Obligations"
      description="Monitor receivable exposure and fulfillment obligations from active contracts and subscriptions."
      metrics={[
        { label: "Open Obligations", value: `$${(overview.openReceivables / 100).toLocaleString()}`, hint: "Uncollected billed balance" },
        { label: "Receivable Exposure", value: `${receivableRatio.toFixed(1)}%`, hint: "Open vs billed ratio" },
        { label: "Signed Commitments", value: overview.signedContractCount.toString(), hint: "Executed contracts" },
        { label: "Recurring Commitments", value: overview.activeSubscriptions.toString(), hint: "Active subscription obligations" },
      ]}
    />
  );
}
