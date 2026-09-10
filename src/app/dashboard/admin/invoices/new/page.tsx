import { isInvoiceCreator, loadBillableClients } from "@/lib/invoices/billable-clients";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function NewInvoicePage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Unauthorized</div>;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, organization_id, role, is_account_manager")
    .eq("id", user.id)
    .single();

  const p = profile as {
    id: string;
    organization_id: string | null;
    role: string;
    is_account_manager: boolean;
  } | null;

  if (!p || !isInvoiceCreator(p) || !p.organization_id) {
    return <div>Forbidden - Account manager access required</div>;
  }

  let clients: Awaited<ReturnType<typeof loadBillableClients>> = [];
  try {
    clients = await loadBillableClients(supabase, p, user.id);
  } catch (error) {
    console.error(
      "[new-invoice] Failed to load billable clients:",
      error instanceof Error ? error.message : error,
    );
  }

  const { InvoiceForm } = await import("@/components/admin/invoices/invoice-form");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/admin/invoices"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Invoices
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create New Invoice</h1>
        <p className="text-muted-foreground mt-1">Generate an invoice for client billing</p>
      </div>

      <InvoiceForm organizationId={p.organization_id} clients={clients} />
    </div>
  );
}
