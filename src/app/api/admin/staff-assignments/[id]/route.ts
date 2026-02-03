import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * DELETE /api/admin/staff-assignments/[id]
 * Remove a staff organization assignment
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const supabase = await createServerSupabaseClient()
    const { id } = params

    // Check if user is super_admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await (supabase as any)
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Soft delete by setting is_active = false and unassigned_at
    const { error } = await (supabase as any)
      .from('staff_organization_assignments')
      .update({
        is_active: false,
        unassigned_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('Failed to delete staff assignment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/admin/staff-assignments/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/staff-assignments/[id]
 * Update a staff organization assignment
 */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const supabase = await createServerSupabaseClient()
    const { id } = params

    // Check if user is super_admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await (supabase as any)
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { assignment_role, is_active } = body

    const updates: any = {}
    if (assignment_role !== undefined) updates.assignment_role = assignment_role
    if (is_active !== undefined) {
      updates.is_active = is_active
      if (!is_active) {
        updates.unassigned_at = new Date().toISOString()
      }
    }

    const { data: assignment, error } = await (supabase as any)
      .from('staff_organization_assignments')
      .update(updates)
      .eq('id', id)
      .select('*, organizations(name), users!staff_user_id(email)')
      .single()

    if (error) {
      console.error('Failed to update staff assignment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: assignment })
  } catch (error) {
    console.error('Error in PATCH /api/admin/staff-assignments/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
