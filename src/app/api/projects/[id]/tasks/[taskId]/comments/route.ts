import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createTaskCommentSchema } from '@/lib/validators/project'

/**
 * GET /api/projects/[id]/tasks/[taskId]/comments
 * List comments for a task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: comments, error } = await (supabase as any)
      .from('project_task_comments')
      .select(`
        *,
        author:users!project_task_comments_author_id_fkey(
          id,
          email,
          profiles:profiles(name, avatar_url)
        )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error listing comments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: comments })
  } catch (err) {
    console.error('Error listing comments:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/tasks/[taskId]/comments
 * Create a new comment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { taskId } = await params
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
    const result = createTaskCommentSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    // Create the comment
    const { data: comment, error: createError } = await (supabase as any)
      .from('project_task_comments')
      .insert({
        task_id: taskId,
        content: result.data.content,
        author_id: user.id,
      })
      .select(`
        *,
        author:users!project_task_comments_author_id_fkey(
          id,
          email,
          profiles:profiles(name, avatar_url)
        )
      `)
      .single()

    if (createError) {
      console.error('Error creating comment:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({ data: comment }, { status: 201 })
  } catch (err) {
    console.error('Error creating comment:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
