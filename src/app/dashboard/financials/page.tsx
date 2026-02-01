import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
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
import { DollarSign, FileText, CreditCard } from "lucide-react";

type PaymentTermRow = {
  id: string;
  name: string;
  days: number;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  organization_id: string | null;
};

export default async function FinancialsPage() {
  await requireRole(["super_admin", "staff"]);

  const supabase = await createServerSupabaseClient();
  const { data: paymentTerms } = await (supabase as any)
    .from("payment_terms")
    .select("id, name, days, description, is_default, is_active, organization_id")
    .order("name");

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, monthly_fee, currency, payment_terms_days, is_active")
    .eq("is_template", false)
    .order("name");

  const { count: activeAssignments } = await supabase
    .from("plan_assignments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financials</h1>
        <p className="text-muted-foreground">
          Revenue overview, payment terms, and financial reports (admin/staff).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Terms</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(paymentTerms ?? []).length}</div>
            <p className="text-xs text-muted-foreground">Configured terms</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plans</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(plans ?? []).length}</div>
            <p className="text-xs text-muted-foreground">Plan definitions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAssignments ?? 0}</div>
            <p className="text-xs text-muted-foreground">Plan assignments</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Terms</CardTitle>
          <CardDescription>
            Admin-configurable payment terms. System defaults have no organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!paymentTerms?.length ? (
            <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 text-center text-muted-foreground text-sm">
              No payment terms configured. Add in Settings or via SQL.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(paymentTerms as PaymentTermRow[]).map((pt) => (
                  <TableRow key={pt.id}>
                    <TableCell className="font-medium">{pt.name}</TableCell>
                    <TableCell>{pt.days}</TableCell>
                    <TableCell>{pt.is_default ? <Badge variant="secondary">Default</Badge> : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={pt.is_active ? "default" : "outline"}>{pt.is_active ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plans Overview</CardTitle>
          <CardDescription>Plan definitions (non-templates). Stripe sync coming later.</CardDescription>
        </CardHeader>
        <CardContent>
          {!plans?.length ? (
            <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 text-center text-muted-foreground text-sm">
              No plans defined.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Monthly fee</TableHead>
                  <TableHead>Payment terms (days)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p: { id: string; name: string; monthly_fee: number; currency: string; payment_terms_days: number; is_active: boolean }) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      {p.currency} {(p.monthly_fee / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>{p.payment_terms_days}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "outline"}>{p.is_active ? "Active" : "Inactive"}</Badge>
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
