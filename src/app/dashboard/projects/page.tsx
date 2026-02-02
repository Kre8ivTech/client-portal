import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FolderKanban, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { ProjectList } from '@/components/projects/project-list'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'

export default async function ProjectsPage() {
  const supabase = (await createServerSupabaseClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, organization_id, role, is_account_manager')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const organizationId = profile.organization_id
  const role = profile.role
  const isAccountManager = profile.is_account_manager

  // Determine if user can create projects
  const canCreateProject =
    role === 'super_admin' ||
    role === 'staff' ||
    role === 'partner' ||
    (role === 'partner_staff' && isAccountManager)

  // Fetch projects based on role
  let projects: any[] = []
  let stats = { total: 0, active: 0, completed: 0, onHold: 0 }

  if (role === 'super_admin' || role === 'staff') {
    // Staff/admin can see all projects
    const { data } = await supabase
      .from('projects')
      .select(`
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
      `)
      .order('created_at', { ascending: false })

    projects = data ?? []
  } else if (role === 'partner' || role === 'partner_staff') {
    // Partners see their org's projects and projects with their clients assigned
    const { data } = await supabase
      .from('projects')
      .select(`
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
      `)
      .order('created_at', { ascending: false })

    projects = data ?? []
  } else {
    // Clients see only projects where their org is assigned
    const { data } = await supabase
      .from('projects')
      .select(`
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
      `)
      .order('created_at', { ascending: false })

    projects = data ?? []
  }

  // Calculate stats
  stats.total = projects.length
  stats.active = projects.filter((p) => p.status === 'active').length
  stats.completed = projects.filter((p) => p.status === 'completed').length
  stats.onHold = projects.filter((p) => p.status === 'on_hold').length

  // Fetch staff users for assignment (if user can create projects)
  let staffUsers: any[] = []
  let clientOrganizations: any[] = []

  if (canCreateProject) {
    const { data: staff } = await supabase
      .from('users')
      .select('id, email, role, profiles:profiles(name, avatar_url)')
      .in('role', ['super_admin', 'staff', 'partner', 'partner_staff'])
      .eq('status', 'active')
      .order('email', { ascending: true })

    staffUsers = staff ?? []

    // Fetch organizations for assignment
    if (role === 'super_admin' || role === 'staff') {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, type, status')
        .eq('status', 'active')
        .order('name', { ascending: true })

      clientOrganizations = orgs ?? []
    } else if (organizationId) {
      // Partners can assign their own org and child orgs
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, type, status')
        .or(`id.eq.${organizationId},parent_org_id.eq.${organizationId}`)
        .eq('status', 'active')
        .order('name', { ascending: true })

      clientOrganizations = orgs ?? []
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Projects
          </h2>
          <p className="text-slate-500">
            Manage and track your projects and service requests.
          </p>
        </div>
        {canCreateProject && (
          <CreateProjectDialog
            staffUsers={staffUsers}
            organizations={clientOrganizations}
            userOrganizationId={organizationId}
          />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Total Projects"
          value={String(stats.total)}
          icon={<FolderKanban className="text-slate-400" size={20} />}
        />
        <StatsCard
          title="Active"
          value={String(stats.active)}
          icon={<Clock className="text-blue-400" size={20} />}
        />
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

      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>
            {canCreateProject
              ? 'View and manage all projects in your organization.'
              : 'View projects assigned to your organization.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectList projects={projects} canEdit={canCreateProject} />
        </CardContent>
      </Card>
    </div>
  )
}

function StatsCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon?: React.ReactNode
}) {
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
  )
}
