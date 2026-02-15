import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireInvoiceAccess } from "@/lib/require-role";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Plus, FileText, Eye, Send } from "lucide-react";
import Link from "next/link";
type InvoiceWithOrg = any;

// Status badge styling
function getStatusBadge(status: string) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    draft: { variant: "secondary", label: "Draft" },
    pending: { variant: "outline", label: "Pending" },
    sent: { variant: "default", label: "Sent" },
    viewed: { variant: "default", label: "Viewed" },
    partial: { variant: "outline", label: "Partial" },
    paid: { variant: "default", label: "Paid" },
    overdue: { variant: "destructive", label: "Overdue" },
    cancelled: { variant: "secondary", label: "Cancelled" },
    refunded: { variant: "secondary", label: "Refunded" },
  };

  const config = variants[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// Format currency from cents
function formatCurrency(cents: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

// Format date
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function InvoicesPage() {
  const { role, canManage } = await requireInvoiceAccess();
  const supabase = await createServerSupabaseClient();

  // Fetch invoices with organization details
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(
      `
      *,
      organization:organizations(name),
      line_items:invoice_line_items(count)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching invoices:", error);
  }

  // Calculate stats
  const stats = {
    totalUnpaid: 0,
    pastDue: 0,
    paidLast30Days: 0,
    upcoming: 0,
  };

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  (invoices as InvoiceWithOrg[] | null)?.forEach((invoice) => {
    if (["pending", "sent", "viewed", "partial"].includes(invoice.status)) {
      stats.totalUnpaid += invoice.balance_due;

      const dueDate = new Date(invoice.due_date);
      if (dueDate < today) {
        stats.pastDue += invoice.balance_due;
      }
    }

    if (invoice.status === "paid" && invoice.paid_at) {
      const paidDate = new Date(invoice.paid_at);
      if (paidDate >= thirtyDaysAgo) {
        stats.paidLast30Days += invoice.total;
      }
    }

    if (invoice.status === "draft") {
      stats.upcoming += 1;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Invoices</h2>
          <p className="text-slate-500">
            {canManage ? "Create, manage, and track client invoices." : "View your billing history and payment status."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download size={18} />
            Export CSV
          </Button>
          {canManage && (
            <Button className="gap-2" asChild>
              <Link href="/dashboard/admin/invoices/new">
                <Plus size={18} />
                New Invoice
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Unpaid" value={formatCurrency(stats.totalUnpaid)} />
        <StatsCard title="Past Due" value={formatCurrency(stats.pastDue)} highlight />
        <StatsCard title="Paid (Last 30d)" value={formatCurrency(stats.paidLast30Days)} />
        <StatsCard title="Drafts" value={stats.upcoming.toString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>
            {canManage ? "All invoices across your managed organizations." : "Your organization's invoice history."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices && invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-slate-500">
                    <th className="pb-3 font-medium">Invoice #</th>
                    {(role === "super_admin" || role === "staff") && <th className="pb-3 font-medium">Organization</th>}
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Issue Date</th>
                    <th className="pb-3 font-medium">Due Date</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium text-right">Balance</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(invoices as InvoiceWithOrg[]).map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="py-4 font-medium">{invoice.invoice_number}</td>
                      {(role === "super_admin" || role === "staff") && (
                        <td className="py-4 text-slate-600">{invoice.organization?.name ?? "-"}</td>
                      )}
                      <td className="py-4">{getStatusBadge(invoice.status)}</td>
                      <td className="py-4 text-slate-600">{formatDate(invoice.issue_date)}</td>
                      <td className="py-4 text-slate-600">{formatDate(invoice.due_date)}</td>
                      <td className="py-4 text-right font-medium">{formatCurrency(invoice.total, invoice.currency)}</td>
                      <td className="py-4 text-right">
                        {invoice.balance_due > 0 ? (
                          <span className="font-medium text-red-600">
                            {formatCurrency(invoice.balance_due, invoice.currency)}
                          </span>
                        ) : (
                          <span className="text-green-600">Paid</span>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-slate-400 text-sm">No actions available</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <FileText className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p className="text-slate-600 font-medium mb-1">No invoices yet</p>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {canManage
                  ? "Create your first invoice to start billing clients."
                  : "Your invoices will appear here once they are created."}
              </p>
              {canManage && (
                <Button className="mt-4 gap-2" asChild>
                  <Link href="/dashboard/admin/invoices/new">
                    <Plus size={18} />
                    Create Invoice
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({ title, value, highlight = false }: { title: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${highlight ? "text-red-600" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
