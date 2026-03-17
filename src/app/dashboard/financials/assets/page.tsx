import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFinancialOverview } from "@/lib/financials/overview";
import { ModuleOverview } from "@/components/financials/module-overview";

export default async function AssetsPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const overview = await getFinancialOverview(supabase as any);

  return (
    <ModuleOverview
      title="Asset Tracking"
      description="Track financial assets tied to subscriptions, contracts, and recognized revenue streams."
      metrics={[
        { label: "Active Subscriptions", value: overview.activeSubscriptions.toString(), hint: "Recurring service assets" },
        { label: "Signed Contracts", value: overview.signedContractCount.toString(), hint: "Committed agreements" },
        { label: "Total Contracts", value: overview.contractCount.toString(), hint: "Pipeline + active" },
        { label: "Collected Revenue", value: `$${(overview.totalCollected / 100).toLocaleString()}`, hint: "Realized financial asset" },
      ]}
    />
  );
}
