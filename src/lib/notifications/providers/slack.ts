/**
 * Slack Notification Provider
 */

import { NotificationResult, NotificationType, getNotificationColor } from '../index'

interface SlackOptions {
  webhookUrl: string
  message: string
  subject: string
  ticketNumber?: number
  ticketId?: string
  type: NotificationType
  appUrl?: string
}

/**
 * Send Slack notification via webhook
 */
export async function sendSlack({
  webhookUrl,
  message,
  subject,
  ticketNumber,
  ticketId,
  type,
  appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app',
}: SlackOptions): Promise<NotificationResult> {
  try {
    if (!webhookUrl) {
      return {
        success: false,
        error: 'Slack webhook URL not configured',
      }
    }

    const ticketLink = ticketId ? `${appUrl}/dashboard/tickets/${ticketId}` : null
    const color = getNotificationColor(type)

    // Format Slack message using Block Kit
    const payload = {
      text: subject, // Fallback text
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: subject,
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: message.replace(/\n/g, '\n'),
              },
            },
            ...(ticketNumber
              ? [
                  {
                    type: 'context',
                    elements: [
                      {
                        type: 'mrkdwn',
                        text: `*Ticket:* #${ticketNumber}`,
                      },
                    ],
                  },
                ]
              : []),
            ...(ticketLink
              ? [
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: 'View Ticket',
                          emoji: true,
                        },
                        url: ticketLink,
                        style: type === 'sla_breach' ? 'danger' : type === 'sla_warning' ? 'primary' : undefined,
                      },
                    ],
                  },
                ]
              : []),
          ],
        },
      ],
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Notifications] Slack send failed:', error)
      return {
        success: false,
        error: `Failed to send Slack message: ${response.statusText}`,
        provider: 'slack',
      }
    }

    return {
      success: true,
      provider: 'slack',
    }
  } catch (error) {
    console.error('[Notifications] Slack error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'slack',
    }
  }
}
