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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, Bell, Mail, MessageSquare, Phone, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface NotificationPreferences {
  email?: boolean
  sms?: boolean
  slack?: boolean
  whatsapp?: boolean
  sms_number?: string | null
  whatsapp_number?: string | null
  notify_on_ticket_created?: boolean
  notify_on_ticket_updated?: boolean
  notify_on_ticket_comment?: boolean
  notify_on_ticket_assigned?: boolean
  notify_on_ticket_resolved?: boolean
  notify_on_sla_warning?: boolean
  notify_on_sla_breach?: boolean
}

export function NotificationPreferences() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch current preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('users')
        .select('notification_preferences')
        .eq('id', user.id)
        .single()

      if (error) throw error
      return (data?.notification_preferences || {}) as NotificationPreferences
    },
  })

  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences>(preferences || {})

  // Update local preferences when fetched preferences change
  if (preferences && !hasChanges) {
    if (JSON.stringify(preferences) !== JSON.stringify(localPreferences)) {
      setLocalPreferences(preferences)
    }
  }

  // Save preferences mutation
  const saveMutation = useMutation({
    mutationFn: async (prefs: NotificationPreferences) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('users')
        .update({ notification_preferences: prefs })
        .eq('id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
      setHasChanges(false)
      toast.success('Notification preferences saved successfully')
    },
    onError: (error) => {
      toast.error('Failed to save preferences', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    },
  })

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setLocalPreferences((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = () => {
    saveMutation.mutate(localPreferences)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Configure how and when you receive notifications for ticket updates.
        </p>
      </div>

      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>Choose which channels to receive notifications through</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Mail className="h-5 w-5 text-slate-500 mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="email" className="text-base font-medium">
                  Email Notifications
                </Label>
                <p className="text-sm text-slate-600 mt-1">
                  Receive notifications via email for ticket updates
                </p>
              </div>
            </div>
            <Switch
              id="email"
              checked={localPreferences.email !== false}
              onCheckedChange={(checked) => updatePreference('email', checked)}
            />
          </div>

          <Separator />

          {/* SMS */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <MessageSquare className="h-5 w-5 text-slate-500 mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="sms" className="text-base font-medium">
                    SMS Notifications
                  </Label>
                  <p className="text-sm text-slate-600 mt-1">
                    Receive urgent notifications via text message
                  </p>
                </div>
              </div>
              <Switch
                id="sms"
                checked={localPreferences.sms === true}
                onCheckedChange={(checked) => updatePreference('sms', checked)}
              />
            </div>
            {localPreferences.sms && (
              <div className="ml-8 space-y-2">
                <Label htmlFor="sms_number" className="text-sm">
                  Phone Number
                </Label>
                <Input
                  id="sms_number"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={localPreferences.sms_number || ''}
                  onChange={(e) => updatePreference('sms_number', e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Include country code (e.g., +1 for US/Canada)
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* WhatsApp */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Phone className="h-5 w-5 text-slate-500 mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="whatsapp" className="text-base font-medium">
                    WhatsApp Notifications
                  </Label>
                  <p className="text-sm text-slate-600 mt-1">
                    Receive notifications via WhatsApp
                  </p>
                </div>
              </div>
              <Switch
                id="whatsapp"
                checked={localPreferences.whatsapp === true}
                onCheckedChange={(checked) => updatePreference('whatsapp', checked)}
              />
            </div>
            {localPreferences.whatsapp && (
              <div className="ml-8 space-y-2">
                <Label htmlFor="whatsapp_number" className="text-sm">
                  WhatsApp Number
                </Label>
                <Input
                  id="whatsapp_number"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={localPreferences.whatsapp_number || ''}
                  onChange={(e) => updatePreference('whatsapp_number', e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Include country code (e.g., +1 for US/Canada)
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification Events */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Events</CardTitle>
          <CardDescription>Choose which events trigger notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_ticket_created" className="font-medium">
                New Ticket Created
              </Label>
              <p className="text-sm text-slate-600">When a new ticket is created</p>
            </div>
            <Switch
              id="notify_ticket_created"
              checked={localPreferences.notify_on_ticket_created !== false}
              onCheckedChange={(checked) => updatePreference('notify_on_ticket_created', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_ticket_updated" className="font-medium">
                Ticket Updated
              </Label>
              <p className="text-sm text-slate-600">When ticket status or details change</p>
            </div>
            <Switch
              id="notify_ticket_updated"
              checked={localPreferences.notify_on_ticket_updated !== false}
              onCheckedChange={(checked) => updatePreference('notify_on_ticket_updated', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_ticket_comment" className="font-medium">
                New Comment
              </Label>
              <p className="text-sm text-slate-600">When someone comments on a ticket</p>
            </div>
            <Switch
              id="notify_ticket_comment"
              checked={localPreferences.notify_on_ticket_comment !== false}
              onCheckedChange={(checked) => updatePreference('notify_on_ticket_comment', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_ticket_assigned" className="font-medium">
                Ticket Assigned
              </Label>
              <p className="text-sm text-slate-600">When a ticket is assigned to you</p>
            </div>
            <Switch
              id="notify_ticket_assigned"
              checked={localPreferences.notify_on_ticket_assigned !== false}
              onCheckedChange={(checked) => updatePreference('notify_on_ticket_assigned', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_ticket_resolved" className="font-medium">
                Ticket Resolved
              </Label>
              <p className="text-sm text-slate-600">When a ticket is marked as resolved</p>
            </div>
            <Switch
              id="notify_ticket_resolved"
              checked={localPreferences.notify_on_ticket_resolved !== false}
              onCheckedChange={(checked) => updatePreference('notify_on_ticket_resolved', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* SLA Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Alerts</CardTitle>
          <CardDescription>Get notified about SLA deadlines and breaches</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_sla_warning" className="font-medium">
                SLA Warning
              </Label>
              <p className="text-sm text-slate-600">When a ticket is approaching its SLA deadline</p>
            </div>
            <Switch
              id="notify_sla_warning"
              checked={localPreferences.notify_on_sla_warning !== false}
              onCheckedChange={(checked) => updatePreference('notify_on_sla_warning', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_sla_breach" className="font-medium">
                SLA Breach
              </Label>
              <p className="text-sm text-slate-600">When a ticket has breached its SLA deadline</p>
            </div>
            <Switch
              id="notify_sla_breach"
              checked={localPreferences.notify_on_sla_breach !== false}
              onCheckedChange={(checked) => updatePreference('notify_on_sla_breach', checked)}
            />
          </div>
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
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
