import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import { TimeEntryForm } from "@/components/time/time-entry-form";
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
import { Clock, Plus } from "lucide-react";
import { TimeEntryDeleteButton } from "@/components/time/time-entry-delete-button";

export default async function TimeTrackingPage() {
  const { user, profile } = await requireRole(["super_admin", "staff", "partner"]);

  const supabase = await createServerSupabaseClient();
  const orgId = (profile as { organization_id?: string } | null)?.organization_id ?? null;

  const { data: recentTickets } = orgId
    ? await supabase
        .from("tickets")
        .select("id, ticket_number, subject")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  const { data: entries } = orgId
    ? await supabase
        .from("time_entries")
        .select("id, description, hours, entry_date, billable, ticket_id, created_at")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false })
        .limit(100)
    : { data: [] };

  const totalHours = (entries ?? []).reduce((s: number, e: { hours: number }) => s + e.hours, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Time Tracking</h1>
        <p className="text-muted-foreground">
          Log time and view time reports.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Entries</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(entries ?? []).length}</div>
            <p className="text-xs text-muted-foreground">Time entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">From listed entries</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Entries
              </CardTitle>
              <CardDescription>
                Your logged time. You can only delete your own entries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!entries?.length ? (
                <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 text-center text-muted-foreground text-sm">
                  No time entries yet. Log time with the form.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Billable</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(e.entry_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{e.description}</TableCell>
                        <TableCell>{e.hours}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {e.ticket_id ? `${e.ticket_id.slice(0, 8)}…` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={e.billable ? "default" : "outline"}>{e.billable ? "Yes" : "No"}</Badge>
                        </TableCell>
                        <TableCell>
                          <TimeEntryDeleteButton entryId={e.id} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Log Time
              </CardTitle>
              <CardDescription>
                Add a time entry. Optionally link to a ticket.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimeEntryForm organizationId={orgId ?? ""} tickets={(recentTickets ?? []) as { id: string; ticket_number: number; subject: string }[]} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
