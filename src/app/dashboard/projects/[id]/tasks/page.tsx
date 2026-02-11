import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProjectTasksDetail } from '@/components/tasks/project-tasks-detail'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Project Tasks',
  description: 'Manage project tasks',
}

interface ProjectTasksPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ taskId?: string }>
}

export default async function ProjectTasksPage({
  params,
  searchParams,
}: ProjectTasksPageProps) {
  const { id } = await params
  const { taskId } = await searchParams
  const supabase = await createServerSupabaseClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Get user info with role
  const { data: userData } = await supabase
    .from('users')
    .select('id, email, role, organization_id, is_account_manager')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/login')
  }

  // Fetch project details
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select(
      `
      id,
      project_number,
      name,
      description,
      status,
      created_by,
      organization_id,
      organizations:organizations!inner (
        id,
        name
      )
    `
    )
    .eq('id', id)
    .single()

  if (projectError || !project) {
    console.error('Error fetching project:', projectError)
    redirect('/dashboard/projects')
  }

  // Fetch project tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('project_tasks')
    .select(
      `
      id,
      title,
      description,
      status,
      priority,
      start_date,
      due_date,
      completed_at,
      progress,
      sort_order,
      parent_task_id,
      created_by,
      created_at,
      updated_at,
      assignee:users!assigned_to (
        id,
        email,
        profiles:profiles!user_id (
          name,
          avatar_url
        )
      ),
      creator:users!created_by (
        id,
        email,
        profiles:profiles!user_id (
          name,
          avatar_url
        )
      )
    `
    )
    .eq('project_id', id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (tasksError) {
    console.error('Error fetching tasks:', tasksError)
  }

  // Fetch project members for assignment
  const { data: members } = await supabase
    .from('project_members')
    .select(
      `
      user_id,
      role,
      is_active,
      user:users!user_id (
        id,
        email,
        role,
        profiles:profiles!user_id (
          name,
          avatar_url
        )
      )
    `
    )
    .eq('project_id', id)
    .eq('is_active', true)

  // Transform members data
  const transformedMembers =
    members
      ?.map((m: any) => ({
        id: m.user.id,
        email: m.user.email,
        role: m.user.role,
        profiles: m.user.profiles,
        project_role: m.role,
      }))
      .filter((m: any) => m.id && m.email) || []

  // Determine if user can edit based on role and project membership
  const isStaff = ['super_admin', 'staff'].includes(userData.role)
  const isProjectMember =
    transformedMembers.some((m: any) => m.id === userData.id) ||
    project.created_by === userData.id
  const canEdit = isStaff || isProjectMember

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/projects/${id}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground">
            {project.project_number} • {project.organizations.name}
          </p>
        </div>
      </div>

      <ProjectTasksDetail
        projectId={id}
        tasks={tasks || []}
        members={transformedMembers}
        canEdit={canEdit}
        highlightedTaskId={taskId}
      />
    </div>
  )
}
