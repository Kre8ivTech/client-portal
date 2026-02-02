/**
 * SLA Monitoring Settings
 * 
 * Helper functions to read and manage SLA monitoring settings from the database
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface SLAMonitoringSettings {
  enabled: boolean
  cron_schedule: string
  cron_enabled: boolean
  client_monitoring_enabled: boolean
  client_check_interval_minutes: number
  notification_cooldown_hours: number
  warning_threshold_percent: number
  critical_threshold_hours: number
  breach_immediate_notify: boolean
  auto_escalate_breaches: boolean
  escalation_delay_hours: number
}

const DEFAULT_SETTINGS: SLAMonitoringSettings = {
  enabled: true,
  cron_schedule: '0 8 * * *',
  cron_enabled: true,
  client_monitoring_enabled: true,
  client_check_interval_minutes: 5,
  notification_cooldown_hours: 4,
  warning_threshold_percent: 25,
  critical_threshold_hours: 2,
  breach_immediate_notify: true,
  auto_escalate_breaches: false,
  escalation_delay_hours: 1,
}

/**
 * Get SLA monitoring settings from the database
 */
export async function getSLASettings(): Promise<SLAMonitoringSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'sla_monitoring')
      .single()

    if (error) {
      console.error('[SLA Settings] Failed to fetch settings:', error)
      return DEFAULT_SETTINGS
    }

    return { ...DEFAULT_SETTINGS, ...data.value } as SLAMonitoringSettings
  } catch (error) {
    console.error('[SLA Settings] Error fetching settings:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * Update SLA monitoring settings
 */
export async function updateSLASettings(
  settings: Partial<SLAMonitoringSettings>
): Promise<boolean> {
  try {
    const currentSettings = await getSLASettings()
    const newSettings = { ...currentSettings, ...settings }

    const { error } = await supabaseAdmin
      .from('app_settings')
      .update({ value: newSettings })
      .eq('key', 'sla_monitoring')

    if (error) {
      console.error('[SLA Settings] Failed to update settings:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[SLA Settings] Error updating settings:', error)
    return false
  }
}

/**
 * Check if SLA monitoring is enabled
 */
export async function isSLAMonitoringEnabled(): Promise<boolean> {
  const settings = await getSLASettings()
  return settings.enabled
}

/**
 * Check if client-side monitoring is enabled
 */
export async function isClientMonitoringEnabled(): Promise<boolean> {
  const settings = await getSLASettings()
  return settings.enabled && settings.client_monitoring_enabled
}

/**
 * Get notification cooldown period in milliseconds
 */
export async function getNotificationCooldownMs(): Promise<number> {
  const settings = await getSLASettings()
  return settings.notification_cooldown_hours * 60 * 60 * 1000
}

/**
 * Get client check interval in milliseconds
 */
export async function getClientCheckIntervalMs(): Promise<number> {
  const settings = await getSLASettings()
  return settings.client_check_interval_minutes * 60 * 1000
}
