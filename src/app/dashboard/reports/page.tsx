import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import { ReportsDateFilter } from "@/components/reports/reports-date-filter";
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
import { LineChart, Ticket, Building2, BarChart3 } from "lucide-react";

function parseDateRange(from: string | null, to: string | null) {
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const start = from ? new Date(from) : defaultStart;
  const end = to ? new Date(to) : defaultEnd;
  return { since: start.toISOString(), until: end.toISOString(), from: from ?? defaultStart.toISOString().slice(0, 10), to: to ?? defaultEnd.toISOString().slice(0, 10) };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { role, profile } = await requireRole(["super_admin", "staff", "partner"]);
  const params = await searchParams;
  const { since, until } = parseDateRange(params.from ?? null, params.to ?? null);

  const supabase = await createServerSupabaseClient();
  const orgId = (profile as { organization_id?: string } | null)?.organization_id ?? null;

  const ticketsQuery = supabase
    .from("tickets")
    .select("id, status, priority, organization_id, created_at", { count: "exact" })
    .gte("created_at", since)
    .lte("created_at", until);

  if (role === "partner" && orgId) {
    const { data: childOrgs } = await supabase
      .from("organizations")
      .select("id")
      .eq("parent_org_id", orgId);
    const childIds = (childOrgs ?? []).map((o: { id: string }) => o.id);
    if (childIds.length) ticketsQuery.in("organization_id", childIds);
    else ticketsQuery.eq("organization_id", orgId);
  }

  const { data: tickets, count: totalTickets } = await ticketsQuery.order("created_at", { ascending: false });

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  (tickets ?? []).forEach((t: { status: string; priority: string }) => {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
  });

  type OrgRow = { id: string; name: string };
  let partnerVolume: { org_name: string; org_id: string; count: number }[] = [];
  if (role === "super_admin" || role === "staff") {
    const { data: orgs } = await supabase.from("organizations").select("id, name").eq("type", "partner");
    for (const org of (orgs ?? []) as OrgRow[]) {
      const { data: children } = await supabase.from("organizations").select("id").eq("parent_org_id", org.id);
      const childIds = (children ?? []).map((c: { id: string }) => c.id);
      if (childIds.length === 0) continue;
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .in("organization_id", childIds)
        .gte("created_at", since)
        .lte("created_at", until);
      partnerVolume.push({ org_name: org.name, org_id: org.id, count: count ?? 0 });
    }
    partnerVolume.sort((a, b) => b.count - a.count);
  } else if (role === "partner" && orgId) {
    const { data: children } = await supabase.from("organizations").select("id, name").eq("parent_org_id", orgId);
    for (const child of (children ?? []) as OrgRow[]) {
      const { count: ticketCount } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", child.id)
        .gte("created_at", since)
        .lte("created_at", until);
      partnerVolume.push({ org_name: child.name, org_id: child.id, count: ticketCount ?? 0 });
    }
    partnerVolume.sort((a, b) => b.count - a.count);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          View all reports (admin), tenant reports (staff), or partner volume (partner). Filter by date range.
        </p>
        <div className="mt-4">
          <ReportsDateFilter />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTickets ?? 0}</div>
            <p className="text-xs text-muted-foreground">Total tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">By Status</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              {Object.entries(byStatus).slice(0, 3).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
              {Object.keys(byStatus).length === 0 && <span className="text-muted-foreground">—</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">By Priority</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              {Object.entries(byPriority).slice(0, 3).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
              {Object.keys(byPriority).length === 0 && <span className="text-muted-foreground">—</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partner Volume</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partnerVolume.reduce((s, p) => s + p.count, 0)}</div>
            <p className="text-xs text-muted-foreground">Client tickets (range)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partner / Client Volume</CardTitle>
          <CardDescription>
            Ticket count per partner or per client org for the selected date range. Admin/staff see all partners; partners see their clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {partnerVolume.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 text-center text-muted-foreground text-sm">
              No partner/client volume data.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-right">Tickets (30d)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerVolume.map((p) => (
                  <TableRow key={p.org_id}>
                    <TableCell className="font-medium">{p.org_name}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{p.count}</Badge>
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
