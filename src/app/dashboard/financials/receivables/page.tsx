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
import { DollarSign, Clock, AlertTriangle, TrendingDown } from "lucide-react";

export default async function ReceivablesPage() {
  await requireRole(["super_admin", "staff"]);

  const supabase = await createServerSupabaseClient();

  // Fetch unpaid invoices
  const { data: unpaidInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, due_date, created_at")
    .in("status", ["pending", "overdue"])
    .order("due_date", { ascending: true });

  // Calculate AR metrics
  const totalAR = unpaidInvoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;

  const now = new Date();
  const aged30 = unpaidInvoices?.filter((inv) => {
    if (!inv.due_date) return false;
    const daysOverdue = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
    return daysOverdue > 0 && daysOverdue <= 30;
  }) || [];

  const aged60 = unpaidInvoices?.filter((inv) => {
    if (!inv.due_date) return false;
    const daysOverdue = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
    return daysOverdue > 30 && daysOverdue <= 60;
  }) || [];

  const aged90Plus = unpaidInvoices?.filter((inv) => {
    if (!inv.due_date) return false;
    const daysOverdue = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
    return daysOverdue > 60;
  }) || [];

  const aged30Total = aged30.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const aged60Total = aged60.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const aged90PlusTotal = aged90Plus.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accounts Receivable & Collections</h1>
        <p className="text-muted-foreground">
          Track outstanding receivables, aging reports, and collections
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total AR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalAR / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{unpaidInvoices?.length || 0} invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">0-30 Days</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(aged30Total / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{aged30.length} invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">31-60 Days</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${(aged60Total / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{aged60.length} invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">60+ Days</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${(aged90PlusTotal / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{aged90Plus.length} invoices</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding Receivables</CardTitle>
          <CardDescription>All unpaid invoices sorted by due date</CardDescription>
        </CardHeader>
        <CardContent>
          {!unpaidInvoices?.length ? (
            <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 text-center text-muted-foreground text-sm">
              No outstanding receivables. All invoices are paid.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Age Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaidInvoices.map((invoice) => {
                  const daysOverdue = invoice.due_date
                    ? Math.floor((now.getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  const ageCategory =
                    daysOverdue <= 0
                      ? "current"
                      : daysOverdue <= 30
                        ? "0-30"
                        : daysOverdue <= 60
                          ? "31-60"
                          : "60+";

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>
                        {invoice.currency} {((invoice.amount || 0) / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {invoice.due_date
                          ? new Date(invoice.due_date).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {daysOverdue > 0 ? (
                          <span className="text-destructive font-medium">{daysOverdue}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ageCategory === "current"
                              ? "secondary"
                              : ageCategory === "0-30"
                                ? "default"
                                : ageCategory === "31-60"
                                  ? "outline"
                                  : "destructive"
                          }
                        >
                          {ageCategory}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
