'use server'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendTemplatedEmail } from '@/lib/notifications/providers/email'

/**
 * Notify other participants when a new message is sent in a conversation.
 * Best-effort: errors are logged but do not propagate.
 */
export async function notifyNewMessage(
  conversationId: string,
  senderUserId: string,
  senderName: string,
  messagePreview: string
) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    // Get conversation participants
    const { data: participants } = await (supabaseAdmin as any)
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)

    if (!participants?.length) return

    // Get conversation for organization_id
    const { data: conversation } = await (supabaseAdmin as any)
      .from('conversations')
      .select('organization_id')
      .eq('id', conversationId)
      .single()

    const otherUserIds = participants
      .map((p: any) => p.user_id)
      .filter((id: string) => id !== senderUserId)

    if (otherUserIds.length === 0) return

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'

    for (const userId of otherUserIds) {
      const { data: user } = await (supabaseAdmin as any)
        .from('users')
        .select('email, full_name')
        .eq('id', userId)
        .single()

      if (!user?.email) continue

      await sendTemplatedEmail({
        to: user.email,
        templateType: 'new_message',
        variables: {
          recipient_name: user.full_name || user.email,
          sender_name: senderName,
          message_preview: messagePreview.substring(0, 150),
          conversation_url: `${appUrl}/dashboard/messages`,
          app_url: appUrl,
          current_year: new Date().getFullYear().toString(),
        },
        organizationId: conversation?.organization_id,
      }).catch(() => {})
    }
  } catch (error) {
    console.error('[Notifications] Failed to send message email:', error)
  }
}
