import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

    // Get user's notifications
    const { data: notifications, error } = await (supabase as any)
      .from('user_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user notifications:', error)
      // Return empty array instead of error to prevent page breaks
      return NextResponse.json({ data: [] })
    }

    return NextResponse.json({ data: notifications || [] })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    // Check user permissions
    const { data: profile } = await (supabase as any)
      .from('users')
      .select('role, is_account_manager, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const isAdmin = profile.role === 'super_admin'
    const isAccountManager = profile.is_account_manager
    const isStaff = profile.role === 'staff' || profile.role === 'partner_staff'

    // Parse request body
    const body = await request.json()
    const {
      title,
      content,
      type,
      target_audience,
      priority,
      expires_at,
      target_organization_ids,
      target_user_ids,
    } = body

    // Validate required fields
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    // Validate permissions based on notification type
    if (!isAdmin) {
      // Account managers can only create staff notifications
      if (isAccountManager && !isStaff) {
        if (type !== 'staff_specific' && type !== 'platform_wide') {
          return NextResponse.json(
            { error: 'Account managers can only create staff notifications' },
            { status: 403 }
          )
        }
        if (target_audience !== 'staff' && target_audience !== 'specific_users') {
          return NextResponse.json(
            { error: 'Account managers can only target staff' },
            { status: 403 }
          )
        }
      }

      // Staff can create client and staff notifications
      if (isStaff && !isAccountManager) {
        if (type === 'platform_wide' && target_audience === 'all') {
          return NextResponse.json(
            { error: 'Only admins can create platform-wide notifications to all users' },
            { status: 403 }
          )
        }
      }

      // Non-admin, non-account-manager, non-staff cannot create notifications
      if (!isStaff && !isAccountManager) {
        return NextResponse.json(
          { error: 'Insufficient permissions to create notifications' },
          { status: 403 }
        )
      }
    }

    // Prepare notification data
    const notificationData: any = {
      title,
      content,
      type: type || 'platform_wide',
      target_audience: target_audience || 'all',
      priority: priority || 'info',
      created_by: user.id,
      expires_at: expires_at || null,
      is_active: true,
    }

    // Handle target IDs
    if (target_organization_ids && Array.isArray(target_organization_ids)) {
      notificationData.target_organization_ids = target_organization_ids
    }

    if (target_user_ids && Array.isArray(target_user_ids)) {
      notificationData.target_user_ids = target_user_ids
    }

    // Insert notification
    const { data: notification, error: insertError } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single()

    if (insertError) {
      console.error('Error creating notification:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ data: notification }, { status: 201 })
  } catch (error) {
    console.error('Error creating notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
