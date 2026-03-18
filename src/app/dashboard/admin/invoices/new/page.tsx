import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function NewInvoicePage() {
  const supabase = await createServerSupabaseClient();

  // Check auth and role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Unauthorized</div>;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role, is_account_manager")
    .eq("id", user.id)
    .single();

  const p = profile as { organization_id: string | null; role: string; is_account_manager: boolean } | null;
  const isAuthorized = p && (p.role === "super_admin" || (p.role === "staff" && p.is_account_manager));

  if (!isAuthorized || !p?.organization_id) {
    return <div>Forbidden - Account manager access required</div>;
  }

  // Fetch billable clients in scope (own org + child client orgs)
  let orgIds: string[] = [];
  if (p.role === "super_admin") {
    const { data: allOrgs } = await supabase
      .from("organizations")
      .select("id")
      .eq("status", "active");
    orgIds = (allOrgs ?? []).map((o: { id: string }) => o.id);
  } else {
    const { data: childOrgs } = await supabase
      .from("organizations")
      .select("id")
      .eq("parent_org_id", p.organization_id)
      .eq("status", "active");
    orgIds = [p.organization_id, ...(childOrgs ?? []).map((o: { id: string }) => o.id)];
  }

  let clients: { id: string; full_name: string; email: string; organization_name: string }[] = [];
  if (orgIds.length > 0) {
    const { data: clientUsers } = await (supabase as any)
      .from("users")
      .select("id, email, role, organization_id, profiles(name), organizations(name)")
      .in("organization_id", orgIds)
      .in("role", ["client", "partner", "partner_staff"])
      .order("email", { ascending: true });

    const rows = (clientUsers ?? []) as Array<{
      id: string;
      email: string;
      role: string;
      profiles?: { name?: string | null } | null;
      organizations?: { name?: string | null } | null;
    }>;

    clients = rows
      .filter((row) => row.id !== user.id)
      .map((row) => ({
        id: row.id,
        full_name: row.profiles?.name?.trim() || row.email,
        email: row.email,
        organization_name: row.organizations?.name?.trim() || "Unknown Organization",
      }));
  }

  // We need the InvoiceForm component here
  const { InvoiceForm } = await import("@/components/admin/invoices/invoice-form");

  return (
    <div className="space-y-6">
      {/* Header */}
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

      <InvoiceForm organizationId={p.organization_id || ""} clients={clients} />
    </div>
  );
}
