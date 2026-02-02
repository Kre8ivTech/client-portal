'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Clock, AlertTriangle, CheckCircle2, Play, Info } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SLAMonitoringSettings {
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

const CRON_PRESETS = [
  { value: '0 8 * * *', label: 'Daily at 8 AM (Hobby Compatible)', description: 'Runs once per day' },
  { value: '0 */12 * * *', label: 'Every 12 hours (Pro Required)', description: 'Runs twice per day' },
  { value: '0 */6 * * *', label: 'Every 6 hours (Pro Required)', description: 'Runs 4 times per day' },
  { value: '0 */4 * * *', label: 'Every 4 hours (Pro Required)', description: 'Runs 6 times per day' },
  { value: '0 */2 * * *', label: 'Every 2 hours (Pro Required)', description: 'Runs 12 times per day' },
  { value: '0 * * * *', label: 'Every hour (Pro Required)', description: 'Runs 24 times per day' },
  { value: '*/30 * * * *', label: 'Every 30 minutes (Pro Required)', description: 'Runs 48 times per day' },
  { value: '*/15 * * * *', label: 'Every 15 minutes (Pro Required)', description: 'Runs 96 times per day' },
  { value: 'custom', label: 'Custom Schedule', description: 'Enter your own cron expression' },
]

export function SLAMonitoringSettings() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [hasChanges, setHasChanges] = useState(false)
  const [isCustomSchedule, setIsCustomSchedule] = useState(false)

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['sla-monitoring-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'sla_monitoring')
        .single()

      if (error) throw error
      return data.value as SLAMonitoringSettings
    },
  })

  const [localSettings, setLocalSettings] = useState<SLAMonitoringSettings>(
    settings || {
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
  )

  // Update local settings when fetched settings change
  if (settings && !hasChanges) {
    if (JSON.stringify(settings) !== JSON.stringify(localSettings)) {
      setLocalSettings(settings)
      setIsCustomSchedule(!CRON_PRESETS.some((p) => p.value === settings.cron_schedule))
    }
  }

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: SLAMonitoringSettings) => {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: newSettings })
        .eq('key', 'sla_monitoring')

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-monitoring-settings'] })
      setHasChanges(false)
      toast.success('SLA monitoring settings saved successfully')
    },
    onError: (error) => {
      toast.error('Failed to save settings', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    },
  })

  // Manual SLA check mutation
  const triggerCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/sla-check', {
        method: 'GET',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to trigger SLA check')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast.success('SLA check completed', {
        description: `Checked ${data.checked} tickets, sent ${data.notified} notifications`,
      })
    },
    onError: (error) => {
      toast.error('Failed to trigger SLA check', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    },
  })

  const updateSetting = <K extends keyof SLAMonitoringSettings>(
    key: K,
    value: SLAMonitoringSettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = () => {
    saveMutation.mutate(localSettings)
  }

  const handleTriggerCheck = () => {
    triggerCheckMutation.mutate()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  const selectedPreset = CRON_PRESETS.find((p) => p.value === localSettings.cron_schedule)
  const isHobbyCompatible = localSettings.cron_schedule === '0 8 * * *'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            SLA Monitoring Configuration
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Configure automated SLA checks and notification thresholds
          </p>
        </div>
        <Button
          onClick={handleTriggerCheck}
          disabled={triggerCheckMutation.isPending || !localSettings.enabled}
          variant="outline"
          className="gap-2"
        >
          {triggerCheckMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Check Now
            </>
          )}
        </Button>
      </div>

      {/* Global Enable/Disable */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Enable or disable the entire SLA monitoring system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="enabled" className="text-base font-medium">
                SLA Monitoring Enabled
              </Label>
              <p className="text-sm text-slate-600 mt-1">
                Master switch for all SLA monitoring and notifications
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={localSettings.enabled ? 'default' : 'secondary'}>
                {localSettings.enabled ? 'Active' : 'Inactive'}
              </Badge>
              <Switch
                id="enabled"
                checked={localSettings.enabled}
                onCheckedChange={(checked) => updateSetting('enabled', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cron Schedule Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Automated Cron Checks</CardTitle>
          <CardDescription>Configure when automated SLA checks run on the server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="cron_enabled" className="text-base font-medium">
                Enable Cron Jobs
              </Label>
              <p className="text-sm text-slate-600 mt-1">
                Automated server-side SLA checks via Vercel Cron
              </p>
            </div>
            <Switch
              id="cron_enabled"
              checked={localSettings.cron_enabled}
              onCheckedChange={(checked) => updateSetting('cron_enabled', checked)}
            />
          </div>

          {localSettings.cron_enabled && (
            <>
              <Separator />

              {!isHobbyCompatible && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Vercel Pro Required</AlertTitle>
                  <AlertDescription>
                    This schedule runs more than once per day and requires a Vercel Pro plan
                    ($20/month). Hobby accounts only support daily cron jobs.
                  </AlertDescription>
                </Alert>
              )}

              {isHobbyCompatible && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Hobby Plan Compatible</AlertTitle>
                  <AlertDescription>
                    This schedule runs once per day and works with Vercel Hobby (free) accounts.
                    Real-time client monitoring provides additional coverage.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="cron_schedule">Cron Schedule</Label>
                {!isCustomSchedule ? (
                  <Select
                    value={localSettings.cron_schedule}
                    onValueChange={(value) => {
                      if (value === 'custom') {
                        setIsCustomSchedule(true)
                      } else {
                        updateSetting('cron_schedule', value)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRON_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          <div className="flex flex-col">
                            <span>{preset.label}</span>
                            <span className="text-xs text-slate-500">{preset.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    <Input
                      id="cron_schedule"
                      value={localSettings.cron_schedule}
                      onChange={(e) => updateSetting('cron_schedule', e.target.value)}
                      placeholder="0 8 * * *"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCustomSchedule(false)
                        updateSetting('cron_schedule', '0 8 * * *')
                      }}
                    >
                      Use Preset
                    </Button>
                  </div>
                )}
                {selectedPreset && (
                  <p className="text-xs text-slate-500">{selectedPreset.description}</p>
                )}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Cron format: minute hour day month weekday. Example: "0 8 * * *" = Daily at
                    8:00 AM
                  </AlertDescription>
                </Alert>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Client-side Monitoring */}
      <Card>
        <CardHeader>
          <CardTitle>Real-time Client Monitoring</CardTitle>
          <CardDescription>
            Browser-based monitoring that checks SLA status while users are active
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="client_monitoring_enabled" className="text-base font-medium">
                Enable Client Monitoring
              </Label>
              <p className="text-sm text-slate-600 mt-1">
                Check SLA status in the browser every few minutes
              </p>
            </div>
            <Switch
              id="client_monitoring_enabled"
              checked={localSettings.client_monitoring_enabled}
              onCheckedChange={(checked) => updateSetting('client_monitoring_enabled', checked)}
            />
          </div>

          {localSettings.client_monitoring_enabled && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="client_check_interval">Check Interval (minutes)</Label>
                <Input
                  id="client_check_interval"
                  type="number"
                  min={1}
                  max={60}
                  value={localSettings.client_check_interval_minutes}
                  onChange={(e) =>
                    updateSetting('client_check_interval_minutes', parseInt(e.target.value) || 5)
                  }
                />
                <p className="text-xs text-slate-500">
                  How often to check SLA status when ticket pages are active
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Thresholds</CardTitle>
          <CardDescription>Configure when to send SLA warning and breach notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="warning_threshold">Warning Threshold (%)</Label>
            <Input
              id="warning_threshold"
              type="number"
              min={1}
              max={75}
              value={localSettings.warning_threshold_percent}
              onChange={(e) =>
                updateSetting('warning_threshold_percent', parseInt(e.target.value) || 25)
              }
            />
            <p className="text-xs text-slate-500">
              Send warning when less than this % of time remaining (default: 25%)
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="critical_threshold">Critical Threshold (hours)</Label>
            <Input
              id="critical_threshold"
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={localSettings.critical_threshold_hours}
              onChange={(e) =>
                updateSetting('critical_threshold_hours', parseFloat(e.target.value) || 2)
              }
            />
            <p className="text-xs text-slate-500">
              Mark as critical when less than this many hours remaining (default: 2 hours)
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="cooldown">Notification Cooldown (hours)</Label>
            <Input
              id="cooldown"
              type="number"
              min={1}
              max={24}
              value={localSettings.notification_cooldown_hours}
              onChange={(e) =>
                updateSetting('notification_cooldown_hours', parseInt(e.target.value) || 4)
              }
            />
            <p className="text-xs text-slate-500">
              Minimum time between duplicate notifications for the same ticket
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="breach_immediate" className="font-medium">
                Immediate Breach Notifications
              </Label>
              <p className="text-sm text-slate-600 mt-1">
                Send notifications immediately when SLA is breached
              </p>
            </div>
            <Switch
              id="breach_immediate"
              checked={localSettings.breach_immediate_notify}
              onCheckedChange={(checked) => updateSetting('breach_immediate_notify', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto Escalation */}
      <Card>
        <CardHeader>
          <CardTitle>Auto Escalation</CardTitle>
          <CardDescription>
            Automatically escalate tickets when SLA breaches are not addressed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="auto_escalate" className="text-base font-medium">
                Enable Auto Escalation
              </Label>
              <p className="text-sm text-slate-600 mt-1">
                Automatically escalate breached tickets to higher priority
              </p>
            </div>
            <Switch
              id="auto_escalate"
              checked={localSettings.auto_escalate_breaches}
              onCheckedChange={(checked) => updateSetting('auto_escalate_breaches', checked)}
            />
          </div>

          {localSettings.auto_escalate_breaches && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="escalation_delay">Escalation Delay (hours)</Label>
                <Input
                  id="escalation_delay"
                  type="number"
                  min={0.5}
                  max={48}
                  step={0.5}
                  value={localSettings.escalation_delay_hours}
                  onChange={(e) =>
                    updateSetting('escalation_delay_hours', parseFloat(e.target.value) || 1)
                  }
                />
                <p className="text-xs text-slate-500">
                  How long to wait after breach before escalating
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4 border-t">
        {hasChanges && (
          <Alert className="flex-1 mr-4">
            <AlertDescription>You have unsaved changes</AlertDescription>
          </Alert>
        )}
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className="gap-2"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
