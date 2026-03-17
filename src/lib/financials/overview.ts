import type { SupabaseClient } from "@supabase/supabase-js";

export type FinancialOverview = {
  totalInvoiced: number;
  totalCollected: number;
  openReceivables: number;
  invoiceCount: number;
  activeSubscriptions: number;
  monthlyRecurringRevenue: number;
  trackedHours: number;
  billableHours: number;
  contractCount: number;
  signedContractCount: number;
};

export async function getFinancialOverview(supabase: SupabaseClient<any, any, any>): Promise<FinancialOverview> {
  const [
    { data: invoices },
    { count: invoiceCount },
    { data: activePlans },
    { data: timeEntries },
    { count: contractCount },
    { count: signedContractCount },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("total, amount_paid, balance_due, status"),
    supabase.from("invoices").select("id", { count: "exact", head: true }),
    supabase
      .from("plan_assignments")
      .select("id, plans(monthly_fee)")
      .eq("status", "active"),
    supabase
      .from("time_entries")
      .select("hours, billable"),
    supabase.from("contracts").select("id", { count: "exact", head: true }),
    supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", "signed"),
  ]);

  const totalInvoiced = (invoices ?? []).reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
  const totalCollected = (invoices ?? []).reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0);
  const openReceivables = (invoices ?? [])
    .filter((inv: any) => ["sent", "pending", "overdue", "partial"].includes(inv.status))
    .reduce((sum: number, inv: any) => sum + (inv.balance_due || 0), 0);

  const monthlyRecurringRevenue = (activePlans ?? []).reduce(
    (sum: number, assignment: any) => sum + ((assignment.plans as any)?.monthly_fee || 0),
    0,
  );

  const trackedHours = (timeEntries ?? []).reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);
  const billableHours = (timeEntries ?? [])
    .filter((entry: any) => Boolean(entry.billable))
    .reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);

  return {
    totalInvoiced,
    totalCollected,
    openReceivables,
    invoiceCount: invoiceCount ?? 0,
    activeSubscriptions: (activePlans ?? []).length,
    monthlyRecurringRevenue,
    trackedHours,
    billableHours,
    contractCount: contractCount ?? 0,
    signedContractCount: signedContractCount ?? 0,
  };
}
