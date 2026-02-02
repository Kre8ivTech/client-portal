/**
 * API Route: SLA Check
 * 
 * Checks for tickets approaching or breaching SLA and sends notifications
 * Can be called by:
 * - Vercel Cron (daily with CRON_SECRET)
 * - Client-side monitoring (authenticated users)
 * - Manual triggers (authenticated users)
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAndNotifySLA } from '@/lib/notifications/sla-monitor'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Check authorization - either cron secret or authenticated user
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    let isAuthorized = false

    // Check if called from cron with secret
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true
    } else {
      // Check if called by authenticated user
      const supabase = await createServerSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Run SLA check
    const result = await checkAndNotifySLA()

    return NextResponse.json({
      success: true,
      message:
        result.notified > 0
          ? `Sent ${result.notified} notifications for ${result.tickets.length} tickets`
          : 'No tickets need SLA notifications',
      ...result,
    })
  } catch (error) {
    console.error('[SLA Check] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
