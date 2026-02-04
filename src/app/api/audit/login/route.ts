import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * POST /api/audit/login
 * Log a successful login event. Called by the client after password login.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const method = body.method || 'password'

    // Get user's organization_id
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    // Get request metadata
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    await (supabase as any).from('audit_logs').insert({
      organization_id: (profile as { organization_id?: string } | null)?.organization_id ?? null,
      user_id: user.id,
      action: 'user.login',
      entity_type: 'user',
      entity_id: user.id,
      details: {
        method,
        email: user.email,
        ip_address: ip,
        user_agent: userAgent,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error logging login audit:', error)
    // Return success anyway - audit logging should not block user experience
    return NextResponse.json({ success: true })
  }
}
