/**
 * Email Notification Provider (Resend)
 * Supports customizable email templates from database
 */

import { NotificationResult } from '../index'
import type { EmailTemplateType } from '@/lib/email-templates-shared'

interface EmailOptions {
  to: string
  subject: string
  message: string
  ticketNumber?: number
  ticketId?: string
  appUrl?: string
}

interface TemplatedEmailOptions {
  to: string
  templateType: EmailTemplateType
  variables: Record<string, string>
  organizationId?: string | null
  appUrl?: string
}

/**
 * Send email notification via Resend
 */
export async function sendEmail({
  to,
  subject,
  message,
  ticketNumber,
  ticketId,
  appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app',
}: EmailOptions): Promise<NotificationResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY

    if (!apiKey) {
      console.error('[Notifications] RESEND_API_KEY not configured')
      return {
        success: false,
        error: 'Email service not configured',
      }
    }

    // Format HTML email
    const ticketLink = ticketId ? `${appUrl}/dashboard/tickets/${ticketId}` : null
    const html = formatEmailHTML(message, ticketNumber, ticketLink)

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'KT-Portal Support <support@ktportal.app>',
        to: [to],
        subject,
        html,
        text: message,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Notifications] Email send failed:', error)
      return {
        success: false,
        error: `Failed to send email: ${response.statusText}`,
        provider: 'resend',
      }
    }

    const data = await response.json()

    return {
      success: true,
      messageId: data.id,
      provider: 'resend',
    }
  } catch (error) {
    console.error('[Notifications] Email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'resend',
    }
  }
}

/**
 * Send email using a template from the database
 */
export async function sendTemplatedEmail({
  to,
  templateType,
  variables,
  organizationId,
  appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app',
}: TemplatedEmailOptions): Promise<NotificationResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY

    if (!apiKey) {
      console.error('[Notifications] RESEND_API_KEY not configured')
      return {
        success: false,
        error: 'Email service not configured',
      }
    }

    // Fetch the template from the database
    const template = await getEffectiveEmailTemplate(templateType, organizationId)

    if (!template) {
      console.warn(`[Notifications] No template found for type: ${templateType}, using fallback`)
      // Fall back to simple email
      return sendEmail({
        to,
        subject: variables.subject || 'Notification',
        message: variables.message || 'You have a new notification.',
        appUrl,
      })
    }

    // Render the template with variables
    let renderedSubject = template.subject
    let renderedHtml = template.body_html
    let renderedText = template.body_text || ''

    // Add default variables
    const allVariables: Record<string, string> = {
      portal_name: 'KT-Portal',
      unsubscribe_url: `${appUrl}/dashboard/settings/notifications`,
      ...variables,
    }

    // Replace all variable placeholders
    for (const [key, value] of Object.entries(allVariables)) {
      const placeholder = `{{${key}}}`
      const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g')
      renderedSubject = renderedSubject.replace(regex, value)
      renderedHtml = renderedHtml.replace(regex, value)
      renderedText = renderedText.replace(regex, value)
    }

    // Determine from address
    const fromName = template.from_name || 'KT-Portal Support'
    const fromEmail = template.from_email || 'support@ktportal.app'
    const from = `${fromName} <${fromEmail}>`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: renderedSubject,
        html: renderedHtml,
        text: renderedText || undefined,
        reply_to: template.reply_to || undefined,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Notifications] Email send failed:', error)
      return {
        success: false,
        error: `Failed to send email: ${response.statusText}`,
        provider: 'resend',
      }
    }

    const data = await response.json()

    return {
      success: true,
      messageId: data.id,
      provider: 'resend',
      templateId: template.id,
    }
  } catch (error) {
    console.error('[Notifications] Templated email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'resend',
    }
  }
}

/**
 * Send raw HTML email (for testing or custom needs)
 */
export async function sendRawEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  text?: string
}): Promise<NotificationResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY

    if (!apiKey) {
      console.error('[Notifications] RESEND_API_KEY not configured')
      return {
        success: false,
        error: 'Email service not configured',
      }
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'KT-Portal Support <support@ktportal.app>',
        to: [to],
        subject,
        html,
        text,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Notifications] Raw email send failed:', error)
      return {
        success: false,
        error: `Failed to send email: ${response.statusText}`,
        provider: 'resend',
      }
    }

    const data = await response.json()

    return {
      success: true,
      messageId: data.id,
      provider: 'resend',
    }
  } catch (error) {
    console.error('[Notifications] Raw email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'resend',
    }
  }
}

/**
 * Get the effective template for a type and organization
 * Priority: org-specific default > org-specific any > system default > system any
 */
async function getEffectiveEmailTemplate(
  templateType: EmailTemplateType,
  organizationId?: string | null
): Promise<EmailTemplateRecord | null> {
  try {
    // Dynamic import to avoid circular dependencies
    const { createClient } = await import('@supabase/supabase-js')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Notifications] Supabase not configured for template lookup')
      return null
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // First try org-specific default
    if (organizationId) {
      const { data: orgDefault } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_type', templateType)
        .eq('organization_id', organizationId)
        .eq('is_default', true)
        .eq('is_active', true)
        .single()

      if (orgDefault) return orgDefault as EmailTemplateRecord

      // Then try any org template
      const { data: orgTemplate } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_type', templateType)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (orgTemplate) return orgTemplate as EmailTemplateRecord
    }

    // Fall back to system default
    const { data: systemDefault } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_type', templateType)
      .is('organization_id', null)
      .eq('is_default', true)
      .eq('is_active', true)
      .single()

    if (systemDefault) return systemDefault as EmailTemplateRecord

    // Last resort: any system template
    const { data: systemTemplate } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_type', templateType)
      .is('organization_id', null)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return systemTemplate as EmailTemplateRecord | null
  } catch (error) {
    console.error('[Notifications] Error fetching email template:', error)
    return null
  }
}

interface EmailTemplateRecord {
  id: string
  organization_id: string | null
  template_type: string
  name: string
  description: string | null
  subject: string
  body_html: string
  body_text: string | null
  from_name: string | null
  from_email: string | null
  reply_to: string | null
  variables: Array<{ name: string; label: string; required?: boolean; default?: string }>
  is_active: boolean
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Format email HTML with consistent styling
 */
function formatEmailHTML(message: string, ticketNumber?: number, ticketLink?: string | null): string {
  const paragraphs = message.split('\n\n').map((p) => `<p style="margin: 0 0 16px 0; line-height: 1.5;">${p.replace(/\n/g, '<br>')}</p>`)

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${ticketNumber ? `Ticket #${ticketNumber}` : 'Notification'}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                      KT-Portal Support
                    </h1>
                    ${ticketNumber ? `<p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Ticket #${ticketNumber}</p>` : ''}
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 32px;">
                    ${paragraphs.join('')}
                    
                    ${ticketLink ? `
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                        <tr>
                          <td align="center">
                            <a href="${ticketLink}" style="display: inline-block; padding: 12px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">
                              View Ticket
                            </a>
                          </td>
                        </tr>
                      </table>
                    ` : ''}
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #64748b;">
                      You received this email because you are subscribed to ticket notifications.
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'}/dashboard/settings/notifications" style="color: #667eea; text-decoration: none;">
                        Manage notification preferences
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}
