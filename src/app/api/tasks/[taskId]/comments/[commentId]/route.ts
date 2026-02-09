/**
 * API Route: Individual Task Comment Operations
 *
 * Handles operations on specific task comments
 * DELETE - Delete a comment (only by comment author)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * DELETE /api/tasks/[taskId]/comments/[commentId]
 * Delete a specific comment (user can only delete their own comments)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; commentId: string }> }
) {
  try {
    const { taskId, commentId } = await params
    const supabase = await createServerSupabaseClient()

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify comment exists and belongs to this task
    const { data: comment, error: commentError } = await supabase
      .from('task_comments')
      .select('id, task_id, created_by')
      .eq('id', commentId)
      .eq('task_id', taskId)
      .single()

    if (commentError || !comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      )
    }

    // Delete comment (RLS policy will ensure only author can delete)
    const { error: deleteError } = await supabase
      .from('task_comments')
      .delete()
      .eq('id', commentId)

    if (deleteError) {
      console.error('[Task Comments] Failed to delete comment:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete comment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Task Comments] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
