'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import { requireRole } from '@/lib/require-role'

export type SecuritySettingsData = {
  mfa_enforced: boolean
  ip_whitelist: string
  session_timeout_minutes: number
}

export async function updateSecuritySettings(organizationId: string, data: SecuritySettingsData) {
  // Only admins can update security settings
  await requireRole(['super_admin', 'staff', 'partner'])

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    // Get existing settings
    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .single()

    const currentSettings = org?.settings || {}
    const newSettings = {
      ...currentSettings,
      security: {
        mfa_enforced: data.mfa_enforced,
        ip_whitelist: data.ip_whitelist.split('\n').map(ip => ip.trim()).filter(Boolean),
        session_timeout_minutes: data.session_timeout_minutes
      }
    }

    const { error } = await supabase
      .from('organizations')
      .update({ settings: newSettings })
      .eq('id', organizationId)

    if (error) throw error

    await writeAuditLog({
      action: 'organization.security_update',
      entity_type: 'organization',
      entity_id: organizationId,
      new_values: data
    })

    revalidatePath('/dashboard/settings')
    return { success: true }
  } catch (error: any) {
    console.error('Update security settings error:', error)
    return { success: false, error: error.message }
  }
}
