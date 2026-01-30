import { NextRequest, NextResponse } from 'next/server'
import { syncAllIntegrations } from '@/lib/calendar/sync'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const token = request.nextUrl.searchParams.get('token')

  if (secret) {
    const authorized = authHeader === `Bearer ${secret}` || token === secret
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const results = await syncAllIntegrations()
  return NextResponse.json({ data: results }, { status: 200 })
}
