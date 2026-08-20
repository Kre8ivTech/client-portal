import { requireRole } from "@/lib/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  Ticket,
  FolderKanban,
  DollarSign,
  Globe,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Search,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

type ClientHealth = {
  id: string;
  name: string;
  slug: string;
  status: string;
  openTickets: number;
  criticalTickets: number;
  activeProjects: number;
  completedProjects: number;
  mrr: number;
  overdueInvoices: number;
  lastActivity: string | null;
  adsConnected: boolean;
  adSpend7d: number;
  healthScore: "healthy" | "attention" | "critical";
};

function computeHealthScore(client: {
  openTickets: number;
  criticalTickets: number;
  overdueInvoices: number;
  lastActivity: string | null;
}): "healthy" | "attention" | "critical" {
  if (client.criticalTickets > 0 || client.overdueInvoices > 2) return "critical";
  if (client.openTickets > 5 || client.overdueInvoices > 0) return "attention";
  return "healthy";
}

const healthBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  healthy: "default",
  attention: "secondary",
  critical: "destructive",
};

const healthColors: Record<string, string> = {
  healthy: "bg-green-100 text-green-700 hover:bg-green-100",
  attention: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  critical: "bg-red-100 text-red-700 hover:bg-red-100",
};

export default async function ClientPortfolioPage() {
  const { profile } = await requireRole(["partner", "partner_staff"]);
  const organizationId = profile?.organization_id;
  if (!organizationId) return null;

  const admin = getSupabaseAdmin();

  // Get child client organizations
  const { data: childOrgs } = await admin
    .from("organizations")
    .select("id, name, slug, status")
    .eq("parent_org_id", organizationId)
    .order("name", { ascending: true });

  const clients = (childOrgs ?? []) as { id: string; name: string; slug: string; status: string }[];
  const clientIds = clients.map((c) => c.id);

  // Build per-client health data
  const clientHealthData: ClientHealth[] = [];

  if (clientIds.length > 0) {
    // Batch fetch tickets per org
    const { data: allTickets } = await admin
      .from("tickets")
      .select("id, organization_id, status, priority, created_at, updated_at")
      .in("organization_id", clientIds)
      .in("status", ["new", "open", "in_progress", "pending_client"]);

    // Batch fetch projects per org
    const { data: allProjects } = await admin
      .from("projects")
      .select("id, organization_id, status")
      .in("organization_id", clientIds);

    // Batch fetch plan assignments for MRR
    const { data: allPlanAssignments } = await admin
      .from("plan_assignments")
      .select("organization_id, plans(monthly_fee)")
      .in("organization_id", clientIds)
      .eq("status", "active");

    // Batch fetch overdue invoices
    const today = new Date().toISOString().split("T")[0];
    const { data: allOverdueInvoices } = await admin
      .from("invoices")
      .select("id, organization_id")
      .in("organization_id", clientIds)
      .in("status", ["sent", "partially_paid"])
      .lt("due_date", today);

    // Batch fetch recent activity (last ticket/project update per org)
    const { data: recentTicketActivity } = await admin
      .from("tickets")
      .select("organization_id, updated_at")
      .in("organization_id", clientIds)
      .order("updated_at", { ascending: false })
      .limit(200);

    // Ads connections for child orgs
    const { data: adsConnections } = await admin
      .from("google_ads_connections")
      .select("organization_id, customer_id, status")
      .in("organization_id", clientIds)
      .eq("status", "active");

    // Build maps
    const ticketsByOrg = new Map<string, typeof allTickets>();
    (allTickets ?? []).forEach((t: any) => {
      const existing = ticketsByOrg.get(t.organization_id) ?? [];
      existing.push(t);
      ticketsByOrg.set(t.organization_id, existing);
    });

    const projectsByOrg = new Map<string, typeof allProjects>();
    (allProjects ?? []).forEach((p: any) => {
      const existing = projectsByOrg.get(p.organization_id) ?? [];
      existing.push(p);
      projectsByOrg.set(p.organization_id, existing);
    });

    const mrrByOrg = new Map<string, number>();
    (allPlanAssignments ?? []).forEach((pa: any) => {
      const fee = pa.plans?.monthly_fee ?? 0;
      mrrByOrg.set(pa.organization_id, (mrrByOrg.get(pa.organization_id) ?? 0) + fee);
    });

    const overdueByOrg = new Map<string, number>();
    (allOverdueInvoices ?? []).forEach((inv: any) => {
      overdueByOrg.set(inv.organization_id, (overdueByOrg.get(inv.organization_id) ?? 0) + 1);
    });

    const lastActivityByOrg = new Map<string, string>();
    (recentTicketActivity ?? []).forEach((t: any) => {
      if (!lastActivityByOrg.has(t.organization_id)) {
        lastActivityByOrg.set(t.organization_id, t.updated_at);
      }
    });

    const adsConnectedOrgs = new Set<string>();
    (adsConnections ?? []).forEach((conn: any) => {
      if (conn.customer_id) adsConnectedOrgs.add(conn.organization_id);
    });

    // Build client health records
    for (const client of clients) {
      const tickets = ticketsByOrg.get(client.id) ?? [];
      const projects = projectsByOrg.get(client.id) ?? [];
      const openTickets = tickets.length;
      const criticalTickets = tickets.filter(
        (t: any) => t.priority === "critical" || t.priority === "high"
      ).length;
      const activeProjects = projects.filter((p: any) => p.status === "active").length;
      const completedProjects = projects.filter((p: any) => p.status === "completed").length;
      const mrr = mrrByOrg.get(client.id) ?? 0;
      const overdueInvoices = overdueByOrg.get(client.id) ?? 0;
      const lastActivity = lastActivityByOrg.get(client.id) ?? null;
      const adsConnected = adsConnectedOrgs.has(client.id);

      const healthData: ClientHealth = {
        ...client,
        openTickets,
        criticalTickets,
        activeProjects,
        completedProjects,
        mrr,
        overdueInvoices,
        lastActivity,
        adsConnected,
        adSpend7d: 0, // Would need per-org ads metric aggregation
        healthScore: "healthy",
      };
      healthData.healthScore = computeHealthScore(healthData);
      clientHealthData.push(healthData);
    }
  }

  // Sort: critical first, then attention, then healthy
  const sortOrder = { critical: 0, attention: 1, healthy: 2 };
  clientHealthData.sort((a, b) => sortOrder[a.healthScore] - sortOrder[b.healthScore]);

  // Summary stats
  const healthyCt = clientHealthData.filter((c) => c.healthScore === "healthy").length;
  const attentionCt = clientHealthData.filter((c) => c.healthScore === "attention").length;
  const criticalCt = clientHealthData.filter((c) => c.healthScore === "critical").length;
  const totalOpenTickets = clientHealthData.reduce((s, c) => s + c.openTickets, 0);
  const totalActiveProjects = clientHealthData.reduce((s, c) => s + c.activeProjects, 0);
  const totalMRR = clientHealthData.reduce((s, c) => s + c.mrr, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Portfolio</h1>
          <p className="text-muted-foreground">
            Health overview of all {clients.length} client organizations with key indicators.
          </p>
        </div>
        <Link
          href="/dashboard/partner-overview"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back to Overview
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{healthyCt}</p>
              <p className="text-xs text-muted-foreground">Healthy</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{attentionCt}</p>
              <p className="text-xs text-muted-foreground">Needs Attention</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{criticalCt}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Ticket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalOpenTickets}</p>
              <p className="text-xs text-muted-foreground">Open Tickets</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                ${(totalMRR / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground">Total MRR</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Clients
          </CardTitle>
          <CardDescription>
            Sorted by health status — critical and attention items appear first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientHealthData.length === 0 ? (
            <div className="flex h-[160px] items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground">
              No client organizations found. Add clients from the Clients page.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead className="text-center">Open Tickets</TableHead>
                    <TableHead className="text-center">Projects</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-center">Overdue</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-center">Ads</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientHealthData.map((client) => (
                    <TableRow key={client.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 group-hover:bg-primary/10 transition-colors">
                            <Users className="h-4 w-4 text-slate-600 group-hover:text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{client.name}</p>
                            <p className="text-xs text-muted-foreground">{client.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={healthColors[client.healthScore]}>
                          {client.healthScore === "healthy" && "Healthy"}
                          {client.healthScore === "attention" && "Attention"}
                          {client.healthScore === "critical" && "Critical"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className={client.criticalTickets > 0 ? "font-bold text-red-600" : ""}>
                            {client.openTickets}
                          </span>
                          {client.criticalTickets > 0 && (
                            <span className="text-xs text-red-500">
                              ({client.criticalTickets} critical)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{client.activeProjects}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          / {client.activeProjects + client.completedProjects}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {client.mrr > 0
                          ? `$${(client.mrr / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {client.overdueInvoices > 0 ? (
                          <Badge variant="destructive">{client.overdueInvoices}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {client.lastActivity ? (
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(client.lastActivity), { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">No activity</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {client.adsConnected ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            <Globe className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/clients/${client.id}`}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          View
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
