/**
 * API Route: Individual Task File Operations
 *
 * Handles operations on specific task files
 * GET - Download/retrieve a file
 * DELETE - Delete a file (only by uploader or project managers)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * GET /api/tasks/[taskId]/files/[fileId]
 * Retrieve file metadata and generate download URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; fileId: string }> }
) {
  try {
    const { taskId, fileId } = await params
    const supabase = await createServerSupabaseClient()

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch file metadata (RLS will handle access control)
    const { data: file, error: fileError } = await supabase
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
        uploaded_by:profiles!task_files_uploaded_by_fkey(
          id,
          name,
          avatar_url
        )
      `)
      .eq('id', fileId)
      .eq('task_id', taskId)
      .single()

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      )
    }

    // Generate signed URL for download (valid for 1 hour)
    const { data: signedUrlData, error: urlError } = await supabase
      .storage
      .from('task-files')
      .createSignedUrl(file.storage_path, 3600)

    if (urlError) {
      console.error('[Task Files] Failed to generate signed URL:', urlError)
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        ...file,
        download_url: signedUrlData.signedUrl
      }
    })
  } catch (error) {
    console.error('[Task Files] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tasks/[taskId]/files/[fileId]
 * Delete a file (user can delete their own files, project managers can delete any)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; fileId: string }> }
) {
  try {
    const { taskId, fileId } = await params
    const supabase = await createServerSupabaseClient()

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch file metadata to get storage path
    const { data: file, error: fileError } = await supabase
      .from('task_files')
      .select('id, task_id, storage_path, uploaded_by')
      .eq('id', fileId)
      .eq('task_id', taskId)
      .single()

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Delete file from storage
    const { error: storageError } = await supabase
      .storage
      .from('task-files')
      .remove([file.storage_path])

    if (storageError) {
      console.error('[Task Files] Failed to delete from storage:', storageError)
      // Continue anyway to delete metadata
    }

    // Delete file metadata (RLS policy will ensure only uploader or PM can delete)
    const { error: deleteError } = await supabase
      .from('task_files')
      .delete()
      .eq('id', fileId)

    if (deleteError) {
      console.error('[Task Files] Failed to delete file record:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete file' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Task Files] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
