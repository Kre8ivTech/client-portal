import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProjectTaskWorkspace } from '@/components/tasks/project-task-workspace'

interface ProjectTaskPageProps {
  params: Promise<{ id: string; taskId: string }>
}

export default async function ProjectTaskPage({ params }: ProjectTaskPageProps) {
  const { id: projectId, taskId } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/login')
  }

  const [{ data: project }, { data: task }, { data: members }] = await Promise.all([
    supabase
      .from('projects')
      .select(
        `
        id,
        name,
        project_number,
        organizations:organizations!inner(name)
      `
      )
      .eq('id', projectId)
      .single(),
    supabase
      .from('project_tasks')
      .select(
        `
        id,
        project_id,
        title,
        description,
        status,
        priority,
        progress,
        start_date,
        due_date,
        completed_at,
        created_at,
        updated_at,
        created_by,
        assigned_to,
        assignee:users!assigned_to(
          id,
          email,
          profiles:profiles!user_id(name, avatar_url)
        ),
        creator:users!created_by(
          id,
          email,
          profiles:profiles!user_id(name, avatar_url)
        )
      `
      )
      .eq('project_id', projectId)
      .eq('id', taskId)
      .single(),
    supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('is_active', true),
  ])

  if (!project || !task) {
    redirect(`/dashboard/projects/${projectId}/tasks`)
  }

  const [{ data: comments }, { data: files }] = await Promise.all([
    supabase
      .from('task_comments')
      .select(
        `
        id,
        task_id,
        content,
        is_internal,
        parent_comment_id,
        created_at,
        updated_at,
        created_by:profiles!task_comments_created_by_fkey(
          id,
          name,
          avatar_url
        )
      `
      )
      .eq('task_id', taskId)
      .order('created_at', { ascending: true }),
    supabase
      .from('task_files')
      .select(
        `
        id,
        task_id,
        file_name,
        file_size,
        mime_type,
        storage_path,
        description,
        created_at,
        updated_at,
        uploaded_by:profiles!task_files_uploaded_by_fkey(
          id,
          name,
          avatar_url
        )
      `
      )
      .eq('task_id', taskId)
      .order('created_at', { ascending: false }),
  ])

  const role = userData.role ?? 'client'
  const isStaff = role === 'super_admin' || role === 'staff'
  const isProjectMember = (members ?? []).some((member: any) => member.user_id === user.id)
  const canEdit =
    isStaff || isProjectMember || task.created_by === user.id || task.assigned_to === user.id

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/projects/${projectId}/tasks`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project Tasks
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{task.title}</h1>
          <p className="text-sm text-muted-foreground">
            {project.project_number} • {project.name} • {(project as any)?.organizations?.name ?? 'Organization'}
          </p>
        </div>
      </div>

      <ProjectTaskWorkspace
        task={task as any}
        comments={(comments ?? []) as any}
        files={(files ?? []) as any}
        currentUserId={user.id}
        canEdit={canEdit}
      />
    </div>
  )
}
