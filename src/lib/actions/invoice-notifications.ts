'use server'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendTemplatedEmail } from '@/lib/notifications/providers/email'
import type { EmailTemplateType } from '@/lib/email-templates-shared'

/**
 * Send an invoice-related email notification.
 * Fetches invoice + client data, renders a templated email, and sends it.
 */
async function notifyInvoiceEvent(
  invoiceId: string,
  templateType: EmailTemplateType,
  extraVars?: Record<string, string>
) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('*, organization:organizations(id, name)')
      .eq('id', invoiceId)
      .single()

    if (!invoice) return

    // Try to find the client via metadata.client_id or created_by
    const clientId = (invoice as any).metadata?.client_id || (invoice as any).created_by
    let clientEmail: string | null = null
    let clientName = 'Valued Client'

    if (clientId) {
      const { data: clientUser } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name')
        .eq('id', clientId)
        .single()

      if (clientUser) {
        clientEmail = (clientUser as any).email
        clientName = (clientUser as any).full_name || clientName
      }
    }

    if (!clientEmail) return

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'

    await sendTemplatedEmail({
      to: clientEmail,
      templateType,
      variables: {
        recipient_name: clientName,
        invoice_number: (invoice as any).invoice_number || '',
        total: `$${(((invoice as any).total || 0) / 100).toFixed(2)}`,
        due_date: (invoice as any).due_date ? new Date((invoice as any).due_date).toLocaleDateString() : 'N/A',
        status: (invoice as any).status || '',
        organization_name: (invoice as any).organization?.name || '',
        invoice_url: `${appUrl}/dashboard/invoices/${invoiceId}`,
        app_url: appUrl,
        current_year: new Date().getFullYear().toString(),
        ...extraVars,
      },
      organizationId: (invoice as any).organization_id,
    })
  } catch (error) {
    console.error(`[Notifications] Failed to send invoice ${templateType} email:`, error)
  }
}

export async function notifyInvoiceCreated(invoiceId: string) {
  return notifyInvoiceEvent(invoiceId, 'new_invoice')
}

export async function notifyInvoicePaid(invoiceId: string) {
  return notifyInvoiceEvent(invoiceId, 'invoice_paid')
}

export async function notifyInvoiceOverdue(invoiceId: string) {
  return notifyInvoiceEvent(invoiceId, 'invoice_overdue')
}
