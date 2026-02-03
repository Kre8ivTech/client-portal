import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FolderKanban,
  ChevronLeft,
  Calendar,
  Users,
  Building2,
  Clock,
  Target,
  Settings,
  AlertTriangle,
} from 'lucide-react'
import { ProjectMembersPanel } from '@/components/projects/project-members-panel'
import { ProjectOrganizationsPanel } from '@/components/projects/project-organizations-panel'
import { ProjectSettingsForm } from '@/components/projects/project-settings-form'

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'active':
      return 'default'
    case 'completed':
      return 'secondary'
    case 'on_hold':
    case 'cancelled':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'medium':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'low':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return ''
  }
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = await params
  const supabase = (await createServerSupabaseClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, organization_id, role, is_account_manager')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const role = profile.role
  const organizationId = profile.organization_id
  const isAccountManager = profile.is_account_manager

  // Fetch project with related data
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      organization:organizations!projects_organization_id_fkey(id, name),
      creator:users!projects_created_by_fkey(id, email, profiles:profiles(name)),
      project_members(
        id,
        user_id,
        role,
        is_active,
        joined_at,
        user:users!project_members_user_id_fkey(id, email, role, profiles:profiles(name, avatar_url))
      ),
      project_organizations(
        id,
        organization_id,
        role,
        is_active,
        organization:organizations!project_organizations_organization_id_fkey(id, name, type, status)
      )
    `)
    .eq('id', projectId)
    .single()

  if (error) {
    if ((error as any).code === 'PGRST205') {
      return (
        <div className="space-y-6">
          <Link
            href="/dashboard/projects"
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors w-fit"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Projects
          </Link>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Projects system is not available yet</AlertTitle>
            <AlertDescription>
              The database table <span className="font-mono">public.projects</span> was not found
              (Supabase error <span className="font-mono">PGRST205</span>). This usually means
              production migrations haven&apos;t been applied yet.
            </AlertDescription>
          </Alert>
        </div>
      )
    }

    notFound()
  }

  if (!project) notFound()

  // Determine permissions
  const isSuperAdmin = role === 'super_admin'
  const isStaff = role === 'staff'
  const isPartner = role === 'partner' || role === 'partner_staff'

  const canEdit =
    isSuperAdmin ||
    isStaff ||
    (isPartner && project.organization_id === organizationId) ||
    (isPartner && isAccountManager)

  // Fetch available staff for assignment
  let availableStaff: any[] = []
  let availableOrganizations: any[] = []

  if (canEdit) {
    const { data: staff } = await supabase
      .from('users')
      .select('id, email, role, profiles:profiles(name, avatar_url)')
      .in('role', ['super_admin', 'staff', 'partner', 'partner_staff'])
      .eq('status', 'active')
      .order('email', { ascending: true })

    availableStaff = staff ?? []

    // Fetch organizations for assignment
    if (isSuperAdmin || isStaff) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, type, status')
        .eq('status', 'active')
        .order('name', { ascending: true })

      availableOrganizations = orgs ?? []
    } else if (organizationId) {
      // Partners can assign their own org and child orgs
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, type, status')
        .or(`id.eq.${organizationId},parent_org_id.eq.${organizationId}`)
        .eq('status', 'active')
        .order('name', { ascending: true })

      availableOrganizations = orgs ?? []
    }
  }

  const memberCount = project.project_members?.filter((m: any) => m.is_active).length ?? 0
  const orgCount = project.project_organizations?.filter((o: any) => o.is_active).length ?? 0

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/projects"
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderKanban className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {project.name}
            </h1>
            <p className="text-slate-500 font-mono text-sm">PRJ-{project.project_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(project.status)} className="capitalize">
            {project.status.replace('_', ' ')}
          </Badge>
          <Badge variant="outline" className={`capitalize ${getPriorityBadgeClass(project.priority)}`}>
            {project.priority}
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberCount}</div>
            <p className="text-xs text-slate-500">Active members</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orgCount}</div>
            <p className="text-xs text-slate-500">Assigned orgs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Start Date</CardTitle>
            <Calendar className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {project.start_date
                ? new Date(project.start_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Not set'}
            </div>
            <p className="text-xs text-slate-500">
              {project.start_date
                ? new Date(project.start_date).getFullYear()
                : 'Schedule pending'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Target End</CardTitle>
            <Target className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {project.target_end_date
                ? new Date(project.target_end_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Not set'}
            </div>
            <p className="text-xs text-slate-500">
              {project.target_end_date
                ? new Date(project.target_end_date).getFullYear()
                : 'No deadline'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <FolderKanban className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="organizations" className="gap-2">
            <Building2 className="h-4 w-4" />
            Organizations
          </TabsTrigger>
          {canEdit && (
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>Overview and description of this project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {project.description && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Description</h4>
                  <p className="text-slate-600 whitespace-pre-wrap">{project.description}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Status</span>
                    <Badge variant={getStatusBadgeVariant(project.status)} className="capitalize">
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Priority</span>
                    <Badge
                      variant="outline"
                      className={`capitalize ${getPriorityBadgeClass(project.priority)}`}
                    >
                      {project.priority}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Created By</span>
                    <span className="font-medium">
                      {project.creator?.profiles?.name ?? project.creator?.email ?? 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Created</span>
                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Start Date</span>
                    <span>
                      {project.start_date
                        ? new Date(project.start_date).toLocaleDateString()
                        : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Target End Date</span>
                    <span>
                      {project.target_end_date
                        ? new Date(project.target_end_date).toLocaleDateString()
                        : 'Not set'}
                    </span>
                  </div>
                  {project.actual_end_date && (
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500">Actual End Date</span>
                      <span>{new Date(project.actual_end_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {project.budget_amount && (
                    <div className="flex justify-between py-2">
                      <span className="text-slate-500">Budget</span>
                      <span className="font-medium">
                        ${(project.budget_amount / 100).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {project.tags && project.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((tag: string, index: number) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <ProjectMembersPanel
            projectId={project.id}
            members={project.project_members ?? []}
            availableStaff={availableStaff}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="organizations">
          <ProjectOrganizationsPanel
            projectId={project.id}
            projectOrganizations={project.project_organizations ?? []}
            availableOrganizations={availableOrganizations}
            canEdit={canEdit}
          />
        </TabsContent>

        {canEdit && (
          <TabsContent value="settings">
            <ProjectSettingsForm project={project} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
