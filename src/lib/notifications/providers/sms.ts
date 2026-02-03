/**
 * SMS Notification Provider (Twilio)
 */

import { NotificationResult } from '../index'

interface SMSOptions {
  to: string
  message: string
}

/**
 * Send SMS notification via Twilio
 */
export async function sendSMS({ to, message }: SMSOptions): Promise<NotificationResult> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      console.error('[Notifications] Twilio credentials not configured')
      return {
        success: false,
        error: 'SMS service not configured',
      }
    }

    // Twilio API uses Basic Auth
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    // Truncate message to 160 characters for SMS
    const smsMessage = message.length > 160 ? message.substring(0, 157) + '...' : message

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          To: to,
          From: fromNumber,
          Body: smsMessage,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('[Notifications] SMS send failed:', error)
      return {
        success: false,
        error: `Failed to send SMS: ${response.statusText}`,
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
    console.error('[Notifications] SMS error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'twilio',
    }
  }
}
