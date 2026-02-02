import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateUserPermissionsSchema = z.object({
  grants: z.array(z.string().uuid()).optional(), // Permission IDs to grant
  denies: z.array(z.string().uuid()).optional(), // Permission IDs to deny
})

/**
 * GET /api/admin/permissions/users/[userId]
 * Get user-specific permission overrides
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { userId } = params

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

    if (!profile || !['super_admin', 'staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's permission overrides
    const { data: userPermissions, error } = await (supabase as any)
      .from('user_permissions')
      .select('*, permissions(id, name, label, category)')
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: userPermissions })
  } catch (error) {
    console.error('Error in GET /api/admin/permissions/users/[userId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/permissions/users/[userId]
 * Update user-specific permission overrides
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { userId } = params

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
    const result = updateUserPermissionsSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.format() },
        { status: 400 }
      )
    }

    const { grants = [], denies = [] } = result.data

    // Delete existing user permissions
    await (supabase as any)
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)

    // Insert grants
    if (grants.length > 0) {
      await (supabase as any)
        .from('user_permissions')
        .insert(
          grants.map((permission_id) => ({
            user_id: userId,
            permission_id,
            granted: true,
            modified_by: user.id,
          }))
        )
    }

    // Insert denies
    if (denies.length > 0) {
      await (supabase as any)
        .from('user_permissions')
        .insert(
          denies.map((permission_id) => ({
            user_id: userId,
            permission_id,
            granted: false,
            modified_by: user.id,
          }))
        )
    }

    return NextResponse.json({
      data: {
        user_id: userId,
        grants_count: grants.length,
        denies_count: denies.length,
      },
    })
  } catch (error) {
    console.error('Error in PUT /api/admin/permissions/users/[userId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
