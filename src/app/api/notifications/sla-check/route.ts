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
import { authorizeCronOrStaffLike } from '@/lib/api/cron-auth'

export async function GET(request: NextRequest) {
  try {
    const denied = await authorizeCronOrStaffLike(request)
    if (denied) return denied

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
