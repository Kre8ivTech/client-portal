import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
      .eq('id', params.id)
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
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update
    const { data: profile } = await supabase
      .from('users')
      .select('role, is_account_manager')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get the notification to check ownership
    const { data: notification } = await supabase
      .from('notifications')
      .select('created_by')
      .eq('id', params.id)
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

    // Parse request body
    const body = await request.json()
    const updateData: any = {}

    // Allow updating specific fields
    if (body.title !== undefined) updateData.title = body.title
    if (body.content !== undefined) updateData.content = body.content
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.expires_at !== undefined) updateData.expires_at = body.expires_at
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    // Update notification
    const { data: updated, error: updateError } = await supabase
      .from('notifications')
      .update(updateData)
      .eq('id', params.id)
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
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to delete
    const { data: profile } = await supabase
      .from('users')
      .select('role, is_account_manager')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get the notification to check ownership
    const { data: notification } = await supabase
      .from('notifications')
      .select('created_by')
      .eq('id', params.id)
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
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
