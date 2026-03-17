import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendTemplatedEmail } from '@/lib/notifications/providers/email'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin() as any
    const now = new Date()
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'

    let sent = 0

    // Get contracts expiring in 7 days
    const { data: contracts7d } = await supabaseAdmin
      .from('contracts')
      .select('id, title, expires_at, organization_id, created_by, creator:users!contracts_created_by_fkey(email, full_name)')
      .in('status', ['signed', 'completed', 'active'])
      .not('expires_at', 'is', null)
      .gte('expires_at', sevenDays.toISOString().split('T')[0])
      .lt('expires_at', new Date(sevenDays.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    // Get contracts expiring in 30 days
    const { data: contracts30d } = await supabaseAdmin
      .from('contracts')
      .select('id, title, expires_at, organization_id, created_by, creator:users!contracts_created_by_fkey(email, full_name)')
      .in('status', ['signed', 'completed', 'active'])
      .not('expires_at', 'is', null)
      .gte('expires_at', thirtyDays.toISOString().split('T')[0])
      .lt('expires_at', new Date(thirtyDays.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    const allContracts = [
      ...(contracts7d || []).map((c: any) => ({ ...c, daysUntilExpiry: 7 })),
      ...(contracts30d || []).map((c: any) => ({ ...c, daysUntilExpiry: 30 })),
    ]

    // Also notify admins
    const { data: admins } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .in('role', ['super_admin', 'staff'])
      .limit(20)

    for (const contract of allContracts) {
      const recipients = [...(admins || [])]
      if (contract.creator?.email) {
        recipients.push(contract.creator)
      }

      const seen = new Set<string>()
      for (const recipient of recipients) {
        if (!recipient.email || seen.has(recipient.email)) continue
        seen.add(recipient.email)

        const result = await sendTemplatedEmail({
          to: recipient.email,
          templateType: 'contract_expiring',
          variables: {
            recipient_name: recipient.full_name || recipient.email,
            contract_title: contract.title || 'Untitled Contract',
            expires_at: contract.expires_at ? new Date(contract.expires_at).toLocaleDateString() : 'N/A',
            days_until_expiry: String(contract.daysUntilExpiry),
            contract_url: `${appUrl}/dashboard/admin/contracts/${contract.id}`,
            app_url: appUrl,
            current_year: new Date().getFullYear().toString(),
          },
          organizationId: contract.organization_id,
        })

        if (result.success) sent++
      }
    }

    return NextResponse.json({ success: true, sent, checked: allContracts.length })
  } catch (error) {
    console.error('[Cron] Contract expiration check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
