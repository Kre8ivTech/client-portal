import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFinancialOverview } from "@/lib/financials/overview";
import { ModuleOverview } from "@/components/financials/module-overview";

export default async function TaxesPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const overview = await getFinancialOverview(supabase as any);

  const estimatedTaxBase = overview.totalCollected;
  const estimatedTaxReserve = Math.round(estimatedTaxBase * 0.2);

  return (
    <ModuleOverview
      title="Taxes & Compliance"
      description="Monitor taxable revenue signals and maintain reserve visibility for filing cycles."
      metrics={[
        { label: "Collected Revenue Base", value: `$${(estimatedTaxBase / 100).toLocaleString()}`, hint: "Potential taxable base" },
        { label: "Estimated Tax Reserve", value: `$${(estimatedTaxReserve / 100).toLocaleString()}`, hint: "20% planning reserve" },
        { label: "Open Receivables", value: `$${(overview.openReceivables / 100).toLocaleString()}`, hint: "Future taxable inflow" },
        { label: "Invoice Count", value: overview.invoiceCount.toString(), hint: "Documents impacting tax records" },
      ]}
    />
  );
}
