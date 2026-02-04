/**
 * API Route: Task Acknowledgement
 *
 * Handles acknowledgement link clicks from notification emails
 * Validates token and marks task as acknowledged
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Use admin client to bypass RLS for acknowledgement validation
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(
        new URL('/?error=invalid_token', request.url)
      )
    }

    // Find the acknowledgement record
    const { data: ack, error: ackError } = await supabaseAdmin
      .from('task_acknowledgements')
      .select(`
        id,
        task_type,
        task_id,
        acknowledged_by,
        token_expires_at,
        organization_id,
        acknowledged_at
      `)
      .eq('acknowledgement_token', token)
      .single()

    if (ackError || !ack) {
      return NextResponse.redirect(
        new URL('/?error=invalid_token', request.url)
      )
    }

    // Check if token is expired
    const now = new Date()
    const expiresAt = new Date(ack.token_expires_at)

    if (now > expiresAt) {
      return NextResponse.redirect(
        new URL('/?error=token_expired', request.url)
      )
    }

    // Check if already acknowledged
    if (ack.acknowledged_at) {
      // Already acknowledged, redirect to task page
      const taskPath = ack.task_type === 'service_request' ? 'service-requests' : 'project-requests'
      return NextResponse.redirect(
        new URL(`/${taskPath}/${ack.task_id}?acknowledged=already`, request.url)
      )
    }

    // Mark as acknowledged
    const { error: updateError } = await supabaseAdmin
      .from('task_acknowledgements')
      .update({
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', ack.id)

    if (updateError) {
      console.error('[Acknowledgement] Failed to update:', updateError)
      return NextResponse.redirect(
        new URL('/?error=update_failed', request.url)
      )
    }

    // Redirect to the task page with success message
    const taskPath = ack.task_type === 'service_request' ? 'service-requests' : 'project-requests'
    return NextResponse.redirect(
      new URL(`/${taskPath}/${ack.task_id}?acknowledged=success`, request.url)
    )
  } catch (error) {
    console.error('[Acknowledgement] Error:', error)
    return NextResponse.redirect(
      new URL('/?error=internal_error', request.url)
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, notes } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 400 }
      )
    }

    // Find the acknowledgement record
    const { data: ack, error: ackError } = await supabaseAdmin
      .from('task_acknowledgements')
      .select(`
        id,
        task_type,
        task_id,
        acknowledged_by,
        token_expires_at,
        organization_id,
        acknowledged_at
      `)
      .eq('acknowledgement_token', token)
      .single()

    if (ackError || !ack) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
    }

    // Check if token is expired
    const now = new Date()
    const expiresAt = new Date(ack.token_expires_at)

    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 410 }
      )
    }

    // Check if already acknowledged
    if (ack.acknowledged_at) {
      return NextResponse.json({
        success: true,
        message: 'Already acknowledged',
        acknowledged_at: ack.acknowledged_at,
      })
    }

    // Mark as acknowledged
    const { error: updateError } = await supabaseAdmin
      .from('task_acknowledgements')
      .update({
        acknowledged_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', ack.id)

    if (updateError) {
      console.error('[Acknowledgement] Failed to update:', updateError)
      return NextResponse.json(
        { error: 'Failed to acknowledge' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Task acknowledged successfully',
      task_type: ack.task_type,
      task_id: ack.task_id,
    })
  } catch (error) {
    console.error('[Acknowledgement] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
