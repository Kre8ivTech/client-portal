import { requireRole } from "@/lib/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  PlayCircle,
  PauseCircle,
  AlertCircle,
  Users,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";

export const dynamic = "force-dynamic";

type ProjectWithContext = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  organization_id: string;
  org_name: string;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  total_tasks: number;
  completed_tasks: number;
  progress: number;
  is_overdue: boolean;
  days_until_due: number | null;
};

const statusConfig: Record<string, { icon: typeof PlayCircle; color: string; bgColor: string; label: string }> = {
  active: { icon: PlayCircle, color: "text-blue-700", bgColor: "bg-blue-100", label: "Active" },
  completed: { icon: CheckCircle2, color: "text-green-700", bgColor: "bg-green-100", label: "Completed" },
  on_hold: { icon: PauseCircle, color: "text-amber-700", bgColor: "bg-amber-100", label: "On Hold" },
  paused: { icon: PauseCircle, color: "text-amber-700", bgColor: "bg-amber-100", label: "Paused" },
  cancelled: { icon: AlertCircle, color: "text-slate-500", bgColor: "bg-slate-100", label: "Cancelled" },
  planning: { icon: Clock, color: "text-purple-700", bgColor: "bg-purple-100", label: "Planning" },
};

export default async function ProjectsOverviewPage() {
  const { profile } = await requireRole(["partner", "partner_staff"]);
  const organizationId = profile?.organization_id;
  if (!organizationId) return null;

  const admin = getSupabaseAdmin();

  // Get child client organizations
  const { data: childOrgs } = await admin
    .from("organizations")
    .select("id, name, slug")
    .eq("parent_org_id", organizationId)
    .order("name", { ascending: true });

  const clients = (childOrgs ?? []) as { id: string; name: string; slug: string }[];
  const clientIds = clients.map((c) => c.id);
  const orgNameMap = new Map(clients.map((c) => [c.id, c.name]));

  let projects: ProjectWithContext[] = [];

  if (clientIds.length > 0) {
    // Fetch all projects across child orgs
    const { data: allProjects } = await admin
      .from("projects")
      .select("id, name, description, status, organization_id, created_at, updated_at, due_date")
      .in("organization_id", clientIds)
      .order("updated_at", { ascending: false });

    // Fetch task counts per project
    const projectIds = (allProjects ?? []).map((p: any) => p.id);
    let taskCountsByProject = new Map<string, { total: number; completed: number }>();

    if (projectIds.length > 0) {
      const { data: allTasks } = await admin
        .from("project_tasks")
        .select("id, project_id, status")
        .in("project_id", projectIds);

      (allTasks ?? []).forEach((task: any) => {
        const existing = taskCountsByProject.get(task.project_id) ?? { total: 0, completed: 0 };
        existing.total++;
        if (task.status === "completed" || task.status === "done") {
          existing.completed++;
        }
        taskCountsByProject.set(task.project_id, existing);
      });
    }

    const now = new Date();

    projects = (allProjects ?? []).map((p: any) => {
      const taskCounts = taskCountsByProject.get(p.id) ?? { total: 0, completed: 0 };
      const progress = taskCounts.total > 0
        ? Math.round((taskCounts.completed / taskCounts.total) * 100)
        : 0;
      const dueDate = p.due_date ? new Date(p.due_date) : null;
      const isOverdue = dueDate !== null && dueDate < now && p.status === "active";
      const daysUntilDue = dueDate ? differenceInDays(dueDate, now) : null;

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        organization_id: p.organization_id,
        org_name: orgNameMap.get(p.organization_id) ?? "Unknown",
        created_at: p.created_at,
        updated_at: p.updated_at,
        due_date: p.due_date,
        total_tasks: taskCounts.total,
        completed_tasks: taskCounts.completed,
        progress,
        is_overdue: isOverdue,
        days_until_due: daysUntilDue,
      };
    });
  }

  // Stats
  const activeProjects = projects.filter((p) => p.status === "active");
  const completedProjects = projects.filter((p) => p.status === "completed");
  const onHoldProjects = projects.filter((p) => p.status === "on_hold" || p.status === "paused");
  const overdueProjects = projects.filter((p) => p.is_overdue);
  const planningProjects = projects.filter((p) => p.status === "planning");

  // Group active projects by client for the board view
  const projectsByClient = new Map<string, ProjectWithContext[]>();
  for (const project of activeProjects) {
    const existing = projectsByClient.get(project.org_name) ?? [];
    existing.push(project);
    projectsByClient.set(project.org_name, existing);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Status Board</h1>
          <p className="text-muted-foreground">
            Cross-client view of {projects.length} projects across {clients.length} organizations.
          </p>
        </div>
        <Link
          href="/dashboard/partner-overview"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back to Overview
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <PlayCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeProjects.length}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedProjects.length}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <PauseCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{onHoldProjects.length}</p>
              <p className="text-xs text-muted-foreground">On Hold</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{planningProjects.length}</p>
              <p className="text-xs text-muted-foreground">Planning</p>
            </div>
          </CardContent>
        </Card>
        <Card className={overdueProjects.length > 0 ? "border-red-200 bg-red-50/30" : ""}>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${overdueProjects.length > 0 ? "text-red-700" : ""}`}>
                {overdueProjects.length}
              </p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Alert */}
      {overdueProjects.length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              Overdue Projects
            </CardTitle>
            <CardDescription className="text-red-700">
              {overdueProjects.length} project{overdueProjects.length !== 1 ? "s" : ""} past due date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {overdueProjects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between rounded-lg border bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <FolderKanban className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.org_name} · {project.progress}% complete ({project.completed_tasks}/{project.total_tasks} tasks)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive">
                      {Math.abs(project.days_until_due ?? 0)}d overdue
                    </Badge>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Due {project.due_date ? format(new Date(project.due_date), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Active Projects by Client (Board View) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Active Projects by Client
          </CardTitle>
          <CardDescription>
            {activeProjects.length} active projects grouped by client organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeProjects.length === 0 ? (
            <div className="flex h-[160px] items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground">
              No active projects across client organizations.
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(projectsByClient.entries())
                .sort((a, b) => b[1].length - a[1].length)
                .map(([clientName, clientProjects]) => (
                  <div key={clientName} className="space-y-2">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold">{clientName}</h3>
                      <Badge variant="secondary">{clientProjects.length}</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {clientProjects.map((project) => (
                        <Link
                          key={project.id}
                          href={`/dashboard/projects`}
                          className="block rounded-lg border p-4 transition-all hover:border-primary/30 hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm leading-tight">{project.name}</p>
                            {project.is_overdue && (
                              <Badge variant="destructive" className="shrink-0 text-xs">
                                Overdue
                              </Badge>
                            )}
                          </div>
                          {project.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {project.description}
                            </p>
                          )}
                          {/* Progress Bar */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {project.completed_tasks}/{project.total_tasks} tasks
                              </span>
                              <span className="font-medium">{project.progress}%</span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  project.progress === 100
                                    ? "bg-green-500"
                                    : project.is_overdue
                                      ? "bg-red-500"
                                      : "bg-primary"
                                }`}
                                style={{ width: `${project.progress}%` }}
                              />
                            </div>
                          </div>
                          {/* Due date */}
                          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3" />
                            {project.due_date ? (
                              <span className={project.is_overdue ? "text-red-600 font-medium" : ""}>
                                Due {format(new Date(project.due_date), "MMM d")}
                                {project.days_until_due !== null && project.days_until_due > 0 && (
                                  <span className="ml-1">({project.days_until_due}d left)</span>
                                )}
                              </span>
                            ) : (
                              <span>No due date</span>
                            )}
                          </div>
                          {/* Last activity */}
                          <p className="mt-1 text-xs text-muted-foreground">
                            Updated {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>
            Complete list of {projects.length} projects sorted by recent activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="flex h-[120px] items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground">
              No projects found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Progress</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.slice(0, 50).map((project) => {
                    const config = statusConfig[project.status] ?? statusConfig.active;
                    const StatusIcon = config.icon;

                    return (
                      <TableRow key={project.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="font-medium">{project.name}</p>
                              {project.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                                  {project.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{project.org_name}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${config.bgColor} ${config.color}`}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {project.total_tasks > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${
                                    project.progress === 100
                                      ? "bg-green-500"
                                      : project.is_overdue
                                        ? "bg-red-500"
                                        : "bg-primary"
                                  }`}
                                  style={{ width: `${project.progress}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">{project.progress}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No tasks</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {project.due_date ? (
                            <span
                              className={`text-sm ${project.is_overdue ? "font-medium text-red-600" : "text-muted-foreground"}`}
                            >
                              {format(new Date(project.due_date), "MMM d, yyyy")}
                              {project.is_overdue && " (overdue)"}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
