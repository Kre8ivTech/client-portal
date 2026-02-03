import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateTimeEntrySchema } from '@/lib/validators/project'

/**
 * GET /api/projects/[id]/time-entries/[entryId]
 * Get a single time entry
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id: projectId, entryId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: entry, error } = await (supabase as any)
      .from('project_time_entries')
      .select(`
        *,
        user:users!project_time_entries_user_id_fkey(
          id,
          email,
          profiles:profiles(name, avatar_url)
        ),
        task:project_tasks(id, title, task_number)
      `)
      .eq('id', entryId)
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
      }
      console.error('Error fetching time entry:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: entry })
  } catch (err) {
    console.error('Error fetching time entry:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/time-entries/[entryId]
 * Update a time entry
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id: projectId, entryId } = await params
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
    const result = updateTimeEntrySchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    // Update the time entry
    const { data: entry, error: updateError } = await (supabase as any)
      .from('project_time_entries')
      .update(result.data)
      .eq('id', entryId)
      .eq('project_id', projectId)
      .select(`
        *,
        user:users!project_time_entries_user_id_fkey(
          id,
          email,
          profiles:profiles(name, avatar_url)
        ),
        task:project_tasks(id, title, task_number)
      `)
      .single()

    if (updateError) {
      console.error('Error updating time entry:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: entry })
  } catch (err) {
    console.error('Error updating time entry:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/time-entries/[entryId]
 * Delete a time entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id: projectId, entryId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error: deleteError } = await (supabase as any)
      .from('project_time_entries')
      .delete()
      .eq('id', entryId)
      .eq('project_id', projectId)

    if (deleteError) {
      console.error('Error deleting time entry:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting time entry:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
