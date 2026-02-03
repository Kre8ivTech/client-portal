import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateAssignmentSchema = z.object({
  assignment_role: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})

async function canManageAssignmentId(supabase: any, userId: string, assignmentId: string) {
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (!profile) return { ok: false as const, status: 403, error: 'Forbidden' }
  if (profile.role === 'super_admin') return { ok: true as const }
  if (profile.role !== 'staff') return { ok: false as const, status: 403, error: 'Forbidden' }

  const { data: assignment } = await (supabase as any)
    .from('staff_organization_assignments')
    .select('id, organization_id')
    .eq('id', assignmentId)
    .maybeSingle()

  if (!assignment) return { ok: false as const, status: 404, error: 'Not found' }

  const { data: pmAssignment } = await (supabase as any)
    .from('staff_organization_assignments')
    .select('id')
    .eq('staff_user_id', userId)
    .eq('organization_id', assignment.organization_id)
    .eq('assignment_role', 'project_manager')
    .eq('is_active', true)
    .maybeSingle()

  if (!pmAssignment) return { ok: false as const, status: 403, error: 'Forbidden' }
  return { ok: true as const }
}

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

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authz = await canManageAssignmentId(supabase, user.id, id)
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status })
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

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authz = await canManageAssignmentId(supabase, user.id, id)
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status })
    }

    const body = await request.json()
    const parsed = updateAssignmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { assignment_role, is_active } = parsed.data

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
