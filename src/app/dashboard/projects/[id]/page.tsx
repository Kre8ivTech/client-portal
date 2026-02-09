import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FolderKanban,
  ChevronLeft,
  ListTodo,
  FileText,
  MessageSquare,
  CalendarDays,
  Users,
  Building2,
  Settings,
  AlertTriangle,
  LayoutDashboard,
} from 'lucide-react'
import nextDynamic from 'next/dynamic'

const ProjectOverview = nextDynamic(() => import('@/components/projects/workspace/project-overview').then(m => ({ default: m.ProjectOverview })), { ssr: false })
const ProjectTasksBoard = nextDynamic(() => import('@/components/projects/workspace/project-tasks-board').then(m => ({ default: m.ProjectTasksBoard })), { ssr: false })
const ProjectFilesManager = nextDynamic(() => import('@/components/projects/workspace/project-files-manager').then(m => ({ default: m.ProjectFilesManager })), { ssr: false })
const ProjectActivityFeed = nextDynamic(() => import('@/components/projects/workspace/project-activity-feed').then(m => ({ default: m.ProjectActivityFeed })), { ssr: false })
const ProjectCalendar = nextDynamic(() => import('@/components/projects/workspace/project-calendar').then(m => ({ default: m.ProjectCalendar })), { ssr: false })
import { ProjectMembersPanel } from '@/components/projects/project-members-panel'
import { ProjectOrganizationsPanel } from '@/components/projects/project-organizations-panel'
import { ProjectSettingsForm } from '@/components/projects/project-settings-form'
import { ProjectCommunicationSettings } from '@/components/projects/project-communication-settings'

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

export const dynamic = 'force-dynamic'

export default async function ProjectWorkspacePage({
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
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors w-fit"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Projects
          </Link>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Projects system is not available yet</AlertTitle>
            <AlertDescription>
              The database table <span className="font-mono">public.projects</span> was not found. This usually means production migrations haven&apos;t been applied yet.
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

  // Fetch workspace data in parallel
  const [tasksResult, filesResult, activityResult, commentsResult] = await Promise.all([
    supabase
      .from('project_tasks')
      .select(`
        *,
        assignee:users!project_tasks_assigned_to_fkey(id, email, profiles:profiles(name, avatar_url))
      `)
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('project_files')
      .select(`
        *,
        uploader:users!project_files_uploaded_by_fkey(id, email, profiles:profiles(name, avatar_url))
      `)
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('project_activity')
      .select(`
        *,
        user:users!project_activity_user_id_fkey(id, email, profiles:profiles(name, avatar_url))
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('project_comments')
      .select(`
        *,
        author:users!project_comments_author_id_fkey(id, email, profiles:profiles(name, avatar_url))
      `)
      .eq('project_id', projectId)
      .is('task_id', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const tasks = tasksResult.data ?? []
  const files = filesResult.data ?? []
  const activityItems = activityResult.data ?? []
  const projectComments = commentsResult.data ?? []

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

    if (isSuperAdmin || isStaff) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, type, status')
        .eq('status', 'active')
        .order('name', { ascending: true })

      availableOrganizations = orgs ?? []
    } else if (organizationId) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, type, status')
        .or(`id.eq.${organizationId},parent_org_id.eq.${organizationId}`)
        .eq('status', 'active')
        .order('name', { ascending: true })

      availableOrganizations = orgs ?? []
    }
  }

  const activeMembers = project.project_members?.filter((m: any) => m.is_active) ?? []
  const activeFiles = files.filter((f: any) => f.name !== '.folder')

  // Fetch communication settings
  let commSettings: any = null
  const { data: settingsData, error: settingsError } = await supabase
    .from('project_communication_settings')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (!settingsError) {
    commSettings = settingsData
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/projects"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Projects
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium truncate">{project.name}</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FolderKanban className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">PRJ-{project.project_number}</p>
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

      {/* Workspace Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <div className="border-b -mx-1">
          <TabsList className="bg-transparent h-auto p-0 w-full justify-start overflow-x-auto">
            <TabsTrigger
              value="overview"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 gap-2"
            >
              <ListTodo className="h-4 w-4" />
              <span className="hidden sm:inline">Tasks</span>
              {tasks.length > 0 && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{tasks.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="files"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 gap-2"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Files</span>
              {activeFiles.length > 0 && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{activeFiles.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 gap-2"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
            <TabsTrigger
              value="team"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 gap-2"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
            <TabsTrigger
              value="organizations"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 gap-2"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Orgs</span>
            </TabsTrigger>
            {canEdit && (
              <TabsTrigger
                value="settings"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 gap-2"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-6">
          <ProjectOverview
            project={project}
            tasks={tasks}
            members={activeMembers}
            fileCount={activeFiles.length}
            commentCount={projectComments.length}
          />
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <ProjectTasksBoard
            projectId={project.id}
            initialTasks={tasks}
            members={activeMembers}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="files" className="mt-6">
          <ProjectFilesManager
            projectId={project.id}
            initialFiles={files}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ProjectActivityFeed
            projectId={project.id}
            initialActivity={activityItems}
            initialComments={projectComments}
            currentUserId={user.id}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <ProjectCalendar
            tasks={tasks}
            projectStartDate={project.start_date}
            projectEndDate={project.target_end_date}
          />
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <ProjectMembersPanel
            projectId={project.id}
            members={project.project_members ?? []}
            availableStaff={availableStaff}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="organizations" className="mt-6">
          <ProjectOrganizationsPanel
            projectId={project.id}
            projectOrganizations={project.project_organizations ?? []}
            availableOrganizations={availableOrganizations}
            canEdit={canEdit}
          />
        </TabsContent>

        {canEdit && (
          <TabsContent value="settings" className="mt-6">
            <ProjectSettingsForm project={project} />

            <ProjectOrganizationsPanel
              projectId={project.id}
              projectOrganizations={project.project_organizations ?? []}
              availableOrganizations={availableOrganizations}
              canEdit={canEdit}
            />

            <ProjectCommunicationSettings
              projectId={project.id}
              settings={commSettings}
              canEdit={canEdit}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
