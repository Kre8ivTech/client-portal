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
import { Clock, Users, TrendingUp, DollarSign } from "lucide-react";

export default async function TimeTrackingPage() {
  await requireRole(["super_admin", "staff"]);

  const supabase = await createServerSupabaseClient();

  // Fetch time entries
  const { data: timeEntries } = await supabase
    .from("time_entries")
    .select("id, hours, billable_rate, is_billable, date, user_id")
    .order("date", { ascending: false })
    .limit(50);

  // Calculate metrics
  const totalHours = timeEntries?.reduce((sum, entry) => sum + (entry.hours || 0), 0) || 0;
  const billableHours = timeEntries
    ?.filter((e) => e.is_billable)
    .reduce((sum, entry) => sum + (entry.hours || 0), 0) || 0;
  const billableRevenue = timeEntries
    ?.filter((e) => e.is_billable)
    .reduce((sum, entry) => sum + (entry.hours || 0) * (entry.billable_rate || 0), 0) || 0;

  const utilization = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Time Tracking & Utilization</h1>
        <p className="text-muted-foreground">
          Monitor billable hours, staff utilization, and productivity metrics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">All tracked time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billable Hours</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{billableHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Client billable</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilization Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{utilization.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Billable vs total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billable Revenue</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(billableRevenue / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From tracked time</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
          <CardDescription>Latest time tracking activity</CardDescription>
        </CardHeader>
        <CardContent>
          {!timeEntries?.length ? (
            <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 text-center text-muted-foreground text-sm">
              No time entries found. Start tracking time to see data here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.slice(0, 10).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{entry.hours.toFixed(2)}</TableCell>
                    <TableCell>
                      <span
                        className={
                          entry.is_billable ? "text-green-600" : "text-muted-foreground"
                        }
                      >
                        {entry.is_billable ? "Billable" : "Non-billable"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {entry.is_billable && entry.billable_rate
                        ? `$${(entry.billable_rate / 100).toFixed(2)}/hr`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {entry.is_billable && entry.billable_rate
                        ? `$${((entry.hours * entry.billable_rate) / 100).toFixed(2)}`
                        : "—"}
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
