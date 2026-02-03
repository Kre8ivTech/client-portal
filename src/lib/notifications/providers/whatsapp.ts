/**
 * WhatsApp Notification Provider (Twilio)
 */

import { NotificationResult } from '../index'

interface WhatsAppOptions {
  to: string
  message: string
}

/**
 * Send WhatsApp notification via Twilio
 */
export async function sendWhatsApp({ to, message }: WhatsAppOptions): Promise<NotificationResult> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      console.error('[Notifications] Twilio WhatsApp credentials not configured')
      return {
        success: false,
        error: 'WhatsApp service not configured',
      }
    }

    // Twilio API uses Basic Auth
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    // WhatsApp numbers need to be in E.164 format with 'whatsapp:' prefix
    const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
    const whatsappFrom = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          To: whatsappTo,
          From: whatsappFrom,
          Body: message,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('[Notifications] WhatsApp send failed:', error)
      return {
        success: false,
        error: `Failed to send WhatsApp message: ${response.statusText}`,
        provider: 'twilio',
      }
    }

    const data = await response.json()

    return {
      success: true,
      messageId: data.sid,
      provider: 'twilio',
    }
  } catch (error) {
    console.error('[Notifications] WhatsApp error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'twilio',
    }
  }
}
