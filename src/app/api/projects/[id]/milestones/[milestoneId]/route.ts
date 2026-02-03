import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateMilestoneSchema } from '@/lib/validators/project'

/**
 * GET /api/projects/[id]/milestones/[milestoneId]
 * Get a single milestone with details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const { id: projectId, milestoneId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: milestone, error } = await (supabase as any)
      .from('project_milestones')
      .select(`
        *,
        creator:users!project_milestones_created_by_fkey(
          id,
          email,
          profiles:profiles(name)
        ),
        tasks:project_tasks(
          id,
          title,
          status,
          priority,
          due_date,
          assignee:users!project_tasks_assignee_id_fkey(
            id,
            email,
            profiles:profiles(name, avatar_url)
          )
        )
      `)
      .eq('id', milestoneId)
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
      }
      console.error('Error fetching milestone:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: milestone })
  } catch (err) {
    console.error('Error fetching milestone:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/milestones/[milestoneId]
 * Update a milestone
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const { id: projectId, milestoneId } = await params
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
    const result = updateMilestoneSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const input = result.data

    // Get current milestone to check status change
    const { data: currentMilestone } = await (supabase as any)
      .from('project_milestones')
      .select('status')
      .eq('id', milestoneId)
      .eq('project_id', projectId)
      .single()

    if (!currentMilestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    // Build update object
    const updateData: any = { ...input }

    // Set completed_date when status changes to completed
    if (input.status === 'completed' && currentMilestone.status !== 'completed') {
      updateData.completed_date = new Date().toISOString().split('T')[0]
    }

    // Update the milestone
    const { data: milestone, error: updateError } = await (supabase as any)
      .from('project_milestones')
      .update(updateData)
      .eq('id', milestoneId)
      .eq('project_id', projectId)
      .select(`
        *,
        creator:users!project_milestones_created_by_fkey(
          id,
          email,
          profiles:profiles(name)
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating milestone:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: milestone })
  } catch (err) {
    console.error('Error updating milestone:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/milestones/[milestoneId]
 * Delete a milestone
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const { id: projectId, milestoneId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error: deleteError } = await (supabase as any)
      .from('project_milestones')
      .delete()
      .eq('id', milestoneId)
      .eq('project_id', projectId)

    if (deleteError) {
      console.error('Error deleting milestone:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting milestone:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
