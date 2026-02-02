import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema
const createAssignmentSchema = z.object({
  staff_user_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  assignment_role: z.string().optional(),
})

/**
 * GET /api/admin/staff-assignments
 * List all staff organization assignments
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

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

    // Get all staff with their organization assignments
    const { data: staffWithAssignments, error } = await (supabase as any)
      .from('staff_with_org_assignments')
      .select('*')
      .order('staff_name')

    if (error) {
      console.error('Failed to fetch staff assignments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: staffWithAssignments })
  } catch (error) {
    console.error('Error in GET /api/admin/staff-assignments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/staff-assignments
 * Create a new staff organization assignment
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

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

    // Validate request body
    const body = await request.json()
    const result = createAssignmentSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.format() },
        { status: 400 }
      )
    }

    const { staff_user_id, organization_id, assignment_role } = result.data

    // Verify the user is actually a staff member
    const { data: staffUser } = await (supabase as any)
      .from('users')
      .select('id, role')
      .eq('id', staff_user_id)
      .single()

    if (!staffUser || !['super_admin', 'staff'].includes(staffUser.role)) {
      return NextResponse.json(
        { error: 'User is not a staff member' },
        { status: 400 }
      )
    }

    // Create the assignment
    const { data: assignment, error } = await (supabase as any)
      .from('staff_organization_assignments')
      .insert({
        staff_user_id,
        organization_id,
        assignment_role,
        assigned_by: user.id,
      })
      .select('*, organizations(name), users!staff_user_id(email)')
      .single()

    if (error) {
      console.error('Failed to create staff assignment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: assignment }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/staff-assignments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
