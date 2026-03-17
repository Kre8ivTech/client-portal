import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateNotificationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(5000).optional(),
  priority: z.enum(['info', 'low', 'medium', 'high', 'critical']).optional(),
  expires_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean().optional(),
})

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    return NextResponse.json({ data: notification })
  } catch (error) {
    console.error('Error fetching notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update
    const { data: profile } = await (supabase as any)
      .from('users')
      .select('role, is_account_manager')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get the notification to check ownership
    const { data: notification } = await (supabase as any)
      .from('notifications')
      .select('created_by')
      .eq('id', id)
      .single()

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const isAdmin = profile.role === 'super_admin'
    const isOwner = notification.created_by === user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update this notification' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const result = updateNotificationSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const updateData = result.data

    // Update notification
    const { data: updated, error: updateError } = await (supabase as any)
      .from('notifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to delete
    const { data: profile } = await (supabase as any)
      .from('users')
      .select('role, is_account_manager')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get the notification to check ownership
    const { data: notification } = await (supabase as any)
      .from('notifications')
      .select('created_by')
      .eq('id', id)
      .single()

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const isAdmin = profile.role === 'super_admin'
    const isOwner = notification.created_by === user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete this notification' },
        { status: 403 }
      )
    }

    // Delete notification
    const { error: deleteError } = await (supabase as any)
      .from('notifications')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
