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
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Building2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface OrgNotificationPreferences {
  email?: boolean
  slack?: boolean
  slack_webhook_url?: string | null
  notify_on_ticket_created?: boolean
  notify_on_ticket_updated?: boolean
  notify_on_ticket_comment?: boolean
  notify_on_ticket_assigned?: boolean
  notify_on_ticket_resolved?: boolean
}

export function OrgNotificationSettings() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch organization and preferences
  const { data: orgData, isLoading } = useQuery({
    queryKey: ['org-notification-settings'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get user's organization
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (userError) throw userError

      // Get organization details
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, notification_preferences, is_priority_client')
        .eq('id', userData.organization_id)
        .single()

      if (orgError) throw orgError

      return {
        org,
        preferences: (org?.notification_preferences || {}) as OrgNotificationPreferences,
      }
    },
  })

  const [localPreferences, setLocalPreferences] = useState<OrgNotificationPreferences>(
    orgData?.preferences || {}
  )

  // Update local preferences when fetched preferences change
  if (orgData?.preferences && !hasChanges) {
    if (JSON.stringify(orgData.preferences) !== JSON.stringify(localPreferences)) {
      setLocalPreferences(orgData.preferences)
    }
  }

  // Save preferences mutation
  const saveMutation = useMutation({
    mutationFn: async (prefs: OrgNotificationPreferences) => {
      if (!orgData?.org?.id) throw new Error('Organization not found')

      const { error } = await supabase
        .from('organizations')
        .update({ notification_preferences: prefs })
        .eq('id', orgData.org.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-notification-settings'] })
      setHasChanges(false)
      toast.success('Organization notification settings saved successfully')
    },
    onError: (error) => {
      toast.error('Failed to save settings', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    },
  })

  const updatePreference = <K extends keyof OrgNotificationPreferences>(
    key: K,
    value: OrgNotificationPreferences[K]
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
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Notifications
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Configure organization-wide notification settings for {orgData?.org?.name}
          </p>
        </div>
        {orgData?.org?.is_priority_client && (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
            Priority Client
          </Badge>
        )}
      </div>

      {/* Slack Integration */}
      <Card>
        <CardHeader>
          <CardTitle>Slack Integration</CardTitle>
          <CardDescription>
            Send ticket notifications to a Slack channel via webhook
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Label htmlFor="slack" className="text-base font-medium">
                Enable Slack Notifications
              </Label>
              <p className="text-sm text-slate-600 mt-1">
                Post ticket updates to your team's Slack channel
              </p>
            </div>
            <Switch
              id="slack"
              checked={localPreferences.slack === true}
              onCheckedChange={(checked) => updatePreference('slack', checked)}
            />
          </div>

          {localPreferences.slack && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="slack_webhook">Slack Webhook URL</Label>
                <Input
                  id="slack_webhook"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={localPreferences.slack_webhook_url || ''}
                  onChange={(e) => updatePreference('slack_webhook_url', e.target.value)}
                />
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    To get a webhook URL, go to your Slack workspace settings, create an Incoming
                    Webhook, and paste the URL here.{' '}
                    <a
                      href="https://api.slack.com/messaging/webhooks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Learn more
                    </a>
                  </AlertDescription>
                </Alert>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notification Events */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Events</CardTitle>
          <CardDescription>
            Choose which events trigger organization-wide notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="org_notify_ticket_created" className="font-medium">
                New Ticket Created
              </Label>
              <p className="text-sm text-slate-600">When a new ticket is created</p>
            </div>
            <Switch
              id="org_notify_ticket_created"
              checked={localPreferences.notify_on_ticket_created !== false}
              onCheckedChange={(checked) => updatePreference('notify_on_ticket_created', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="org_notify_ticket_updated" className="font-medium">
                Ticket Updated
              </Label>
              <p className="text-sm text-slate-600">When ticket status or priority changes</p>
            </div>
            <Switch
              id="org_notify_ticket_updated"
              checked={localPreferences.notify_on_ticket_updated !== false}
              onCheckedChange={(checked) => updatePreference('notify_on_ticket_updated', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="org_notify_ticket_comment" className="font-medium">
                New Comment
              </Label>
              <p className="text-sm text-slate-600">When someone comments on a ticket</p>
            </div>
            <Switch
              id="org_notify_ticket_comment"
              checked={localPreferences.notify_on_ticket_comment !== false}
              onCheckedChange={(checked) => updatePreference('notify_on_ticket_comment', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="org_notify_ticket_assigned" className="font-medium">
                Ticket Assigned
              </Label>
              <p className="text-sm text-slate-600">When a ticket is assigned to staff</p>
            </div>
            <Switch
              id="org_notify_ticket_assigned"
              checked={localPreferences.notify_on_ticket_assigned !== false}
              onCheckedChange={(checked) => updatePreference('notify_on_ticket_assigned', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="org_notify_ticket_resolved" className="font-medium">
                Ticket Resolved
              </Label>
              <p className="text-sm text-slate-600">When a ticket is marked as resolved</p>
            </div>
            <Switch
              id="org_notify_ticket_resolved"
              checked={localPreferences.notify_on_ticket_resolved !== false}
              onCheckedChange={(checked) => updatePreference('notify_on_ticket_resolved', checked)}
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
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
