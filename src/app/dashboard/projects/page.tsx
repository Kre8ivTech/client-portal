import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FolderKanban, Clock, CheckCircle2, AlertCircle, AlertTriangle, FileQuestion } from "lucide-react";
import { ProjectList } from "@/components/projects/project-list";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { RequestProjectDialog } from "@/components/projects/request-project-dialog";
import { ProjectRequestsList } from "@/components/projects/project-requests-list";

export default async function ProjectsPage() {
  const supabase = (await createServerSupabaseClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, organization_id, role, is_account_manager")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const organizationId = profile.organization_id;
  const role = profile.role;
  const isAccountManager = profile.is_account_manager;

  // Determine if user can create projects (staff/admin)
  const canCreateProject =
    role === "super_admin" || role === "staff" || role === "partner" || (role === "partner_staff" && isAccountManager);

  // Clients can request projects (not create directly)
  const canRequestProject = role === "client" && !!organizationId;

  // Fetch projects based on role
  let projects: any[] = [];
  let projectsTableMissing = false;
  let stats = { total: 0, active: 0, completed: 0, onHold: 0 };

  // RLS policies handle visibility per-role; we can use one query for all roles.
  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      project_number,
      name,
      description,
      status,
      priority,
      start_date,
      target_end_date,
      created_at,
      created_by,
      organization:organizations!projects_organization_id_fkey(id, name),
      project_members(
        id,
        user_id,
        role,
        user:users!project_members_user_id_fkey(id, email, profiles:profiles(name, avatar_url))
      ),
      project_organizations(
        id,
        organization_id,
        role,
        organization:organizations!project_organizations_organization_id_fkey(id, name)
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    if ((error as any).code === "PGRST205") {
      // Table doesn't exist yet - migrations need to run
      projectsTableMissing = true;
      console.warn("projects table not found - migrations pending");
    } else {
      console.error("Error fetching projects:", error);
    }
  } else {
    projects = data ?? [];
  }

  // Calculate stats
  stats.total = projects.length;
  stats.active = projects.filter((p) => p.status === "active").length;
  stats.completed = projects.filter((p) => p.status === "completed").length;
  stats.onHold = projects.filter((p) => p.status === "on_hold").length;

  // Fetch staff users for assignment (if user can create projects)
  let staffUsers: any[] = [];
  let clientOrganizations: any[] = [];

  if (canCreateProject) {
    const { data: staff } = await supabase
      .from("users")
      .select("id, email, role, profiles:profiles(name, avatar_url)")
      .in("role", ["super_admin", "staff", "partner", "partner_staff"])
      .eq("status", "active")
      .order("email", { ascending: true });

    staffUsers = staff ?? [];

    // Fetch organizations for assignment
    if (role === "super_admin" || role === "staff") {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name, type, status")
        .eq("status", "active")
        .order("name", { ascending: true });

      clientOrganizations = orgs ?? [];
    } else if (organizationId) {
      // Partners can assign their own org and child orgs
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name, type, status")
        .or(`id.eq.${organizationId},parent_org_id.eq.${organizationId}`)
        .eq("status", "active")
        .order("name", { ascending: true });

      clientOrganizations = orgs ?? [];
    }
  }

  // Fetch project requests (for clients and staff who can view them)
  let projectRequests: any[] = [];
  let projectRequestsTableMissing = false;

  const { data: requestsData, error: requestsError } = await supabase
    .from("project_requests")
    .select(
      `
      id,
      request_number,
      name,
      description,
      project_type,
      priority,
      status,
      requested_start_date,
      requested_end_date,
      estimated_budget_min,
      estimated_budget_max,
      created_at,
      requested_by,
      requester:users!project_requests_requested_by_fkey(id, email, profiles:profiles(name))
    `,
    )
    .order("created_at", { ascending: false });

  if (requestsError) {
    if ((requestsError as any).code === "PGRST205") {
      projectRequestsTableMissing = true;
    } else {
      console.error("Error fetching project requests:", requestsError);
    }
  } else {
    projectRequests = requestsData ?? [];
  }

  const pendingRequestsCount = projectRequests.filter(
    (r) => r.status === "pending" || r.status === "under_review",
  ).length;

  return (
    <div className="space-y-6">
      {projectsTableMissing && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Projects system is not available yet</AlertTitle>
          <AlertDescription>
            The database table <span className="font-mono">public.projects</span> was not found (Supabase error{" "}
            <span className="font-mono">PGRST205</span>). This usually means production migrations haven&apos;t been
            applied yet.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Projects</h2>
          <p className="text-slate-500">Manage and track your projects and service requests.</p>
        </div>
        <div className="flex gap-2">
          {canRequestProject && !projectRequestsTableMissing && (
            <RequestProjectDialog organizationId={organizationId!} />
          )}
          {canCreateProject && !projectsTableMissing && (
            <CreateProjectDialog
              staffUsers={staffUsers}
              organizations={clientOrganizations}
              userOrganizationId={organizationId}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Total Projects"
          value={String(stats.total)}
          icon={<FolderKanban className="text-slate-400" size={20} />}
        />
        <StatsCard title="Active" value={String(stats.active)} icon={<Clock className="text-blue-400" size={20} />} />
        <StatsCard
          title="Completed"
          value={String(stats.completed)}
          icon={<CheckCircle2 className="text-green-400" size={20} />}
        />
        <StatsCard
          title="On Hold"
          value={String(stats.onHold)}
          icon={<AlertCircle className="text-amber-400" size={20} />}
        />
      </div>

      {/* Project Requests Section - show for clients and staff */}
      {!projectRequestsTableMissing && projectRequests.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileQuestion className="h-5 w-5" />
                  Project Requests
                  {pendingRequestsCount > 0 && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {pendingRequestsCount} pending
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  {canCreateProject
                    ? "Review and manage project requests from clients."
                    : "Track the status of your project requests."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ProjectRequestsList requests={projectRequests} canReview={canCreateProject} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>
            {canCreateProject
              ? "View and manage all projects in your organization."
              : "View projects assigned to your organization."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectList projects={projects} canEdit={canCreateProject} />
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({ title, value, icon }: { title: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
