import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateTaskSchema, moveTaskSchema } from '@/lib/validators/project'

/**
 * GET /api/projects/[id]/tasks/[taskId]
 * Get a single task with details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: projectId, taskId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: task, error } = await (supabase as any)
      .from('project_tasks')
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(
          id,
          email,
          profiles:profiles(name, avatar_url)
        ),
        milestone:project_milestones(id, name, due_date),
        creator:users!project_tasks_created_by_fkey(
          id,
          email,
          profiles:profiles(name)
        ),
        comments:project_task_comments(
          id,
          content,
          created_at,
          author:users!project_task_comments_author_id_fkey(
            id,
            email,
            profiles:profiles(name, avatar_url)
          )
        ),
        subtasks:project_tasks!project_tasks_parent_task_id_fkey(
          id,
          title,
          status,
          priority,
          assignee:users!project_tasks_assignee_id_fkey(
            id,
            email,
            profiles:profiles(name, avatar_url)
          )
        ),
        time_entries:project_time_entries(
          id,
          hours,
          entry_date,
          description,
          billable,
          user:users!project_time_entries_user_id_fkey(
            id,
            email,
            profiles:profiles(name)
          )
        )
      `)
      .eq('id', taskId)
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }
      console.error('Error fetching task:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: task })
  } catch (err) {
    console.error('Error fetching task:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/tasks/[taskId]
 * Update a task
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: projectId, taskId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()

    // Check if this is a move operation (status + board_column_order)
    const isMoveOperation = body.status !== undefined && body.board_column_order !== undefined && Object.keys(body).length === 2

    let validatedData: any

    if (isMoveOperation) {
      const result = moveTaskSchema.safeParse(body)
      if (!result.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: result.error.flatten() },
          { status: 400 }
        )
      }
      validatedData = result.data
    } else {
      const result = updateTaskSchema.safeParse(body)
      if (!result.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: result.error.flatten() },
          { status: 400 }
        )
      }
      validatedData = result.data
    }

    // Get current task to check status change
    const { data: currentTask } = await (supabase as any)
      .from('project_tasks')
      .select('status')
      .eq('id', taskId)
      .eq('project_id', projectId)
      .single()

    if (!currentTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Build update object
    const updateData: any = {
      ...validatedData,
      updated_by: user.id,
    }

    // Set completed_at when status changes to completed
    if (validatedData.status === 'completed' && currentTask.status !== 'completed') {
      updateData.completed_at = new Date().toISOString()
    } else if (validatedData.status && validatedData.status !== 'completed') {
      updateData.completed_at = null
    }

    // Update the task
    const { data: task, error: updateError } = await (supabase as any)
      .from('project_tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('project_id', projectId)
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

    if (updateError) {
      console.error('Error updating task:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: task })
  } catch (err) {
    console.error('Error updating task:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/tasks/[taskId]
 * Delete a task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: projectId, taskId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error: deleteError } = await (supabase as any)
      .from('project_tasks')
      .delete()
      .eq('id', taskId)
      .eq('project_id', projectId)

    if (deleteError) {
      console.error('Error deleting task:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting task:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
