import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createTaskSchema } from '@/lib/validators/project'

/**
 * GET /api/projects/[id]/tasks
 * List tasks for a project with filtering
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const assignee_id = searchParams.get('assignee_id')
    const milestone_id = searchParams.get('milestone_id')
    const priority = searchParams.get('priority')
    const task_type = searchParams.get('task_type')

    // Build query - RLS handles project access
    let query = (supabase as any)
      .from('project_tasks')
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(
          id,
          email,
          profiles:profiles(name, avatar_url)
        ),
        milestone:project_milestones(id, name),
        creator:users!project_tasks_created_by_fkey(
          id,
          email,
          profiles:profiles(name)
        ),
        _count:project_task_comments(count)
      `)
      .eq('project_id', projectId)
      .is('parent_task_id', null) // Only top-level tasks
      .order('board_column_order', { ascending: true })
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (assignee_id) {
      query = query.eq('assignee_id', assignee_id)
    }
    if (milestone_id) {
      query = query.eq('milestone_id', milestone_id)
    }
    if (priority) {
      query = query.eq('priority', priority)
    }
    if (task_type) {
      query = query.eq('task_type', task_type)
    }

    const { data: tasks, error } = await query

    if (error) {
      console.error('Error listing tasks:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: tasks })
  } catch (err) {
    console.error('Error listing tasks:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/tasks
 * Create a new task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user can access the project
    const { data: project, error: projectError } = await (supabase as any)
      .from('projects')
      .select('id, organization_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const result = createTaskSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const input = result.data

    // Get max board_column_order for the status column
    const { data: maxOrder } = await (supabase as any)
      .from('project_tasks')
      .select('board_column_order')
      .eq('project_id', projectId)
      .eq('status', input.status)
      .order('board_column_order', { ascending: false })
      .limit(1)
      .single()

    const newOrder = (maxOrder?.board_column_order ?? -1) + 1

    // Create the task
    const { data: task, error: createError } = await (supabase as any)
      .from('project_tasks')
      .insert({
        project_id: projectId,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        task_type: input.task_type,
        milestone_id: input.milestone_id,
        parent_task_id: input.parent_task_id,
        assignee_id: input.assignee_id,
        due_date: input.due_date,
        start_date: input.start_date,
        estimated_hours: input.estimated_hours,
        billable: input.billable,
        hourly_rate: input.hourly_rate,
        tags: input.tags,
        board_column_order: newOrder,
        created_by: user.id,
      })
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(
          id,
          email,
          profiles:profiles(name, avatar_url)
        ),
        milestone:project_milestones(id, name),
        creator:users!project_tasks_created_by_fkey(
          id,
          email,
          profiles:profiles(name)
        )
      `)
      .single()

    if (createError) {
      console.error('Error creating task:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (err) {
    console.error('Error creating task:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
