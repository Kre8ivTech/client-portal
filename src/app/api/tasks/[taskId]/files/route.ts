/**
 * API Route: Task Files
 *
 * Handles file operations for project tasks
 * GET - List all files for a task
 * POST - Upload a new file to a task
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createTaskFileSchema } from '@/lib/validators/project'

/**
 * GET /api/tasks/[taskId]/files
 * Retrieve all files for a specific task
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

    // Fetch files with uploader details (RLS will handle access control)
    const { data: files, error } = await supabase
      .from('task_files')
      .select(`
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
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Task Files] Failed to fetch files:', error)
      return NextResponse.json(
        { error: 'Failed to fetch files' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: files })
  } catch (error) {
    console.error('[Task Files] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tasks/[taskId]/files
 * Upload a new file to a task
 * Note: This endpoint stores file metadata. Actual file upload to Supabase Storage
 * happens on the client side, then this endpoint is called to save the metadata.
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
    const result = createTaskFileSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { file_name, file_size, mime_type, storage_path, description } = result.data

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

    // Create file metadata record (RLS will enforce access control)
    const { data: file, error: fileError } = await supabase
      .from('task_files')
      .insert({
        task_id: taskId,
        file_name,
        file_size,
        mime_type,
        storage_path,
        description,
        uploaded_by: user.id,
      })
      .select(`
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
      `)
      .single()

    if (fileError) {
      console.error('[Task Files] Failed to create file record:', fileError)
      return NextResponse.json(
        { error: 'Failed to save file metadata' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: file }, { status: 201 })
  } catch (error) {
    console.error('[Task Files] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
