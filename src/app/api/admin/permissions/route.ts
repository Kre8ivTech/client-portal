import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schemas
const createPermissionSchema = z.object({
  name: z.string().min(3).max(100).regex(/^[a-z0-9._-]+$/i),
  label: z.string().min(3).max(255),
  description: z.string().optional(),
  category: z.string().min(1).max(50),
})

const updateRolePermissionsSchema = z.object({
  role: z.enum(['super_admin', 'staff', 'partner', 'partner_staff', 'client']),
  permission_ids: z.array(z.string().uuid()),
})

/**
 * GET /api/admin/permissions
 * List all permissions with role assignments
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

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

    // Get all permissions
    const { data: permissions, error: permError } = await (supabase as any)
      .from('permissions')
      .select('*')
      .order('category, name')

    if (permError) {
      return NextResponse.json({ error: permError.message }, { status: 500 })
    }

    // Get role permission assignments
    const { data: rolePermissions, error: rpError } = await (supabase as any)
      .from('role_permissions')
      .select('role, permission_id')

    if (rpError) {
      return NextResponse.json({ error: rpError.message }, { status: 500 })
    }

    // Group by role
    const permissionsByRole = rolePermissions.reduce((acc: any, rp: any) => {
      if (!acc[rp.role]) acc[rp.role] = []
      acc[rp.role].push(rp.permission_id)
      return acc
    }, {})

    return NextResponse.json({
      data: {
        permissions,
        rolePermissions: permissionsByRole,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/admin/permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/permissions
 * Create a new permission
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

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
    const result = createPermissionSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.format() },
        { status: 400 }
      )
    }

    const { data: permission, error } = await (supabase as any)
      .from('permissions')
      .insert(result.data)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: permission }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/permissions/roles
 * Update permissions for a role
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

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
    const result = updateRolePermissionsSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.format() },
        { status: 400 }
      )
    }

    const { role, permission_ids } = result.data

    // Delete existing role permissions
    await (supabase as any)
      .from('role_permissions')
      .delete()
      .eq('role', role)

    // Insert new permissions
    if (permission_ids.length > 0) {
      const { error } = await (supabase as any)
        .from('role_permissions')
        .insert(
          permission_ids.map((permission_id) => ({
            role,
            permission_id,
            granted_by: user.id,
          }))
        )

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      data: { role, permission_count: permission_ids.length },
    })
  } catch (error) {
    console.error('Error in PUT /api/admin/permissions/roles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
