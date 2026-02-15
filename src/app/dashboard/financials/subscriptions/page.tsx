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
import { Repeat, DollarSign, TrendingUp, Users } from "lucide-react";

export default async function SubscriptionsPage() {
  await requireRole(["super_admin", "staff"]);

  const supabase = await createServerSupabaseClient();

  // Fetch active plan assignments (subscriptions)
  const { data: subscriptions } = await supabase
    .from("plan_assignments")
    .select("id, status, start_date, end_date, monthly_cost, plans(name)")
    .eq("status", "active")
    .order("start_date", { ascending: false });

  const { count: activeCount } = await supabase
    .from("plan_assignments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  // Calculate MRR
  const mrr = subscriptions?.reduce((sum: number, sub: any) => sum + (sub.monthly_cost || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscriptions & Recurring Revenue</h1>
        <p className="text-muted-foreground">
          Manage recurring revenue, subscriptions, and retainer agreements
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(mrr / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">MRR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">Active plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Annual Run Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${((mrr * 12) / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">ARR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Revenue Per User</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${activeCount ? ((mrr / activeCount) / 100).toFixed(2) : "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">ARPU</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Subscriptions</CardTitle>
          <CardDescription>All active recurring revenue commitments</CardDescription>
        </CardHeader>
        <CardContent>
          {!subscriptions || subscriptions.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 text-center text-muted-foreground text-sm">
              No active subscriptions found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Monthly Cost</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {(sub.plans as any)?.name || "Unknown Plan"}
                    </TableCell>
                    <TableCell>${((sub.monthly_cost || 0) / 100).toFixed(2)}</TableCell>
                    <TableCell>{new Date(sub.start_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {sub.end_date ? new Date(sub.end_date).toLocaleDateString() : "Ongoing"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{sub.status}</Badge>
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
