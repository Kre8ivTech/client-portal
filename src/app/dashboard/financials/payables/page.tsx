import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFinancialOverview } from "@/lib/financials/overview";
import { ModuleOverview } from "@/components/financials/module-overview";

export default async function PayablesPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const overview = await getFinancialOverview(supabase as any);

  return (
    <ModuleOverview
      title="Accounts Payable"
      description="Track outgoing obligations using current cash, receivables, and invoice settlement data."
      metrics={[
        { label: "Outstanding Receivables", value: `$${(overview.openReceivables / 100).toLocaleString()}`, hint: "Incoming cash not yet collected" },
        { label: "Collected Cash", value: `$${(overview.totalCollected / 100).toLocaleString()}`, hint: "Paid invoice proceeds" },
        { label: "Total Invoiced", value: `$${(overview.totalInvoiced / 100).toLocaleString()}`, hint: "Revenue billed to date" },
        { label: "Collection Ratio", value: `${overview.totalInvoiced > 0 ? ((overview.totalCollected / overview.totalInvoiced) * 100).toFixed(1) : "0.0"}%`, hint: "Collected vs billed" },
      ]}
    />
  );
}
