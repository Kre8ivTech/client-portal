/**
 * API Route: Task Comments
 *
 * Handles CRUD operations for comments on project tasks
 * GET - List all comments for a task
 * POST - Create a new comment on a task
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createTaskCommentSchema } from '@/lib/validators/project'

/**
 * GET /api/tasks/[taskId]/comments
 * Retrieve all comments for a specific task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createServerSupabaseClient()

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch comments with author details (RLS will handle access control)
    const { data: comments, error } = await supabase
      .from('task_comments')
      .select(`
        id,
        task_id,
        content,
        content_html,
        parent_comment_id,
        is_internal,
        created_at,
        updated_at,
        created_by:profiles!task_comments_created_by_fkey(
          id,
          name,
          avatar_url
        )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Task Comments] Failed to fetch comments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch comments' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: comments })
  } catch (error) {
    console.error('[Task Comments] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tasks/[taskId]/comments
 * Create a new comment on a task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createServerSupabaseClient()

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const result = createTaskCommentSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { content, parent_comment_id, is_internal } = result.data

    // Verify task exists and user has access (RLS will enforce this)
    const { data: task, error: taskError } = await supabase
      .from('project_tasks')
      .select('id, project_id')
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json(
        { error: 'Task not found or access denied' },
        { status: 404 }
      )
    }

    // Create comment (RLS will enforce access control)
    const { data: comment, error: commentError } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        content,
        parent_comment_id,
        is_internal,
        created_by: user.id,
      })
      .select(`
        id,
        task_id,
        content,
        content_html,
        parent_comment_id,
        is_internal,
        created_at,
        updated_at,
        created_by:profiles!task_comments_created_by_fkey(
          id,
          name,
          avatar_url
        )
      `)
      .single()

    if (commentError) {
      console.error('[Task Comments] Failed to create comment:', commentError)
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: comment }, { status: 201 })
  } catch (error) {
    console.error('[Task Comments] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
