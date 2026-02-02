import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, DollarSign, TrendingUp, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";

export default async function InvoicingRevenuePage() {
  await requireRole(["super_admin", "staff"]);

  const supabase = await createServerSupabaseClient();

  // Fetch invoice statistics
  const [
    { count: totalInvoices },
    { count: paidInvoices },
    { count: pendingInvoices },
    { count: overdueInvoices },
    { data: recentInvoices },
  ] = await Promise.all([
    supabase.from("invoices").select("id", { count: "exact", head: true }),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "overdue"),
    supabase
      .from("invoices")
      .select("id, invoice_number, amount, currency, status, due_date, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Calculate total revenue
  const { data: revenueData } = await supabase
    .from("invoices")
    .select("amount")
    .eq("status", "paid");

  const totalRevenue = revenueData?.reduce((sum, inv: any) => sum + (inv.amount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoicing & Revenue</h1>
          <p className="text-muted-foreground">
            Manage invoices, track revenue streams, and monitor payment status
          </p>
        </div>
        <Link href="/dashboard/admin/invoices/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalRevenue / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From paid invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices ?? 0}</div>
            <p className="text-xs text-muted-foreground">{paidInvoices ?? 0} paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvoices ?? 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdueInvoices ?? 0}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>Latest invoices across all clients</CardDescription>
        </CardHeader>
        <CardContent>
          {!recentInvoices || recentInvoices.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 text-center text-muted-foreground text-sm">
              No invoices found. Create your first invoice to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInvoices.map((invoice: any) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="hover:underline"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {invoice.currency} {((invoice.amount || 0) / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === "paid"
                            ? "default"
                            : invoice.status === "overdue"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.due_date
                        ? new Date(invoice.due_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
