import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AllTasksTable } from '@/components/tasks/all-tasks-table'

export const metadata = {
  title: 'All Tasks',
  description: 'View and manage tasks across all projects',
}

export default async function AllTasksPage() {
  const supabase = await createServerSupabaseClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Get user info with organization and role
  const { data: userData } = await supabase
    .from('users')
    .select('id, email, role, organization_id')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/login')
  }

  // Fetch all tasks with project details and assignee info
  // RLS policies will automatically filter based on user's access
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
      created_at,
      updated_at,
      project:projects!inner (
        id,
        project_number,
        name,
        status,
        organization_id,
        organizations:organizations!inner (
          id,
          name
        )
      ),
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
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (tasksError) {
    console.error('Error fetching tasks:', tasksError)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">All Tasks</h1>
        <p className="text-muted-foreground mt-2">
          View and manage tasks across all your projects
        </p>
      </div>

      <AllTasksTable
        tasks={tasks || []}
        userRole={userData.role}
        userId={userData.id}
      />
    </div>
  )
}
