import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendTemplatedEmail } from '@/lib/notifications/providers/email'
import { authorizeCronOrSuperAdmin } from '@/lib/api/cron-auth'

export async function GET(request: NextRequest) {
  const denied = await authorizeCronOrSuperAdmin(request)
  if (denied) return denied

  try {
    const supabaseAdmin = getSupabaseAdmin() as any
    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'

    let sent = 0

    // Get invoices due in exactly 7 days (send first reminder)
    const { data: invoices7d } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, total, due_date, organization_id, client_id, client:users!invoices_client_id_fkey(email, full_name)')
      .in('status', ['sent', 'pending', 'partially_paid'])
      .gte('due_date', sevenDaysFromNow.toISOString().split('T')[0])
      .lt('due_date', new Date(sevenDaysFromNow.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    // Get invoices due in exactly 3 days (send urgent reminder)
    const { data: invoices3d } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, total, due_date, organization_id, client_id, client:users!invoices_client_id_fkey(email, full_name)')
      .in('status', ['sent', 'pending', 'partially_paid'])
      .gte('due_date', threeDaysFromNow.toISOString().split('T')[0])
      .lt('due_date', new Date(threeDaysFromNow.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    const allInvoices = [
      ...(invoices7d || []).map((inv: any) => ({ ...inv, daysUntilDue: 7 })),
      ...(invoices3d || []).map((inv: any) => ({ ...inv, daysUntilDue: 3 })),
    ]

    for (const invoice of allInvoices) {
      if (!invoice.client?.email) continue

      const result = await sendTemplatedEmail({
        to: invoice.client.email,
        templateType: 'invoice_due_reminder',
        variables: {
          recipient_name: invoice.client.full_name || invoice.client.email,
          invoice_number: invoice.invoice_number || '',
          amount: `$${((invoice.total || 0) / 100).toFixed(2)}`,
          due_date: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A',
          days_until_due: String(invoice.daysUntilDue),
          invoice_url: `${appUrl}/dashboard/invoices/${invoice.id}`,
          app_url: appUrl,
          current_year: new Date().getFullYear().toString(),
        },
        organizationId: invoice.organization_id,
      })

      if (result.success) sent++
    }

    return NextResponse.json({ success: true, sent, checked: allInvoices.length })
  } catch (error) {
    console.error('[Cron] Invoice due reminder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
