/**
 * Email Notification Provider (Resend)
 */

import { NotificationResult } from '../index'

interface EmailOptions {
  to: string
  subject: string
  message: string
  ticketNumber?: number
  ticketId?: string
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
