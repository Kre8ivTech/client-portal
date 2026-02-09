'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Save, Bell, Mail, Users, Clock } from 'lucide-react'
import { DIGEST_FREQUENCY_OPTIONS } from '@/lib/validators/project'

type CommunicationSettings = {
  id: string
  project_id: string
  email_on_comment: boolean
  email_on_task_assigned: boolean
  email_on_task_completed: boolean
  email_on_file_uploaded: boolean
  email_on_status_change: boolean
  digest_frequency: string
  allow_client_comments: boolean
  allow_client_file_upload: boolean
  notify_on_overdue_tasks: boolean
  overdue_reminder_days: number
} | null

interface ProjectCommunicationSettingsProps {
  projectId: string
  settings: CommunicationSettings
  canEdit: boolean
}

export function ProjectCommunicationSettings({
  projectId,
  settings,
  canEdit,
}: ProjectCommunicationSettingsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formState, setFormState] = useState({
    email_on_comment: settings?.email_on_comment ?? true,
    email_on_task_assigned: settings?.email_on_task_assigned ?? true,
    email_on_task_completed: settings?.email_on_task_completed ?? true,
    email_on_file_uploaded: settings?.email_on_file_uploaded ?? true,
    email_on_status_change: settings?.email_on_status_change ?? true,
    digest_frequency: settings?.digest_frequency ?? 'instant',
    allow_client_comments: settings?.allow_client_comments ?? true,
    allow_client_file_upload: settings?.allow_client_file_upload ?? true,
    notify_on_overdue_tasks: settings?.notify_on_overdue_tasks ?? true,
    overdue_reminder_days: settings?.overdue_reminder_days ?? 1,
  })
  const router = useRouter()
  const supabase = createClient()

  function updateField(field: string, value: boolean | string | number) {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setIsSubmitting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (settings?.id) {
        // Update existing settings
        const { error } = await supabase
          .from('project_communication_settings')
          .update({
            ...formState,
            updated_by: user?.id,
          })
          .eq('id', settings.id)

        if (error) throw error
      } else {
        // Insert new settings
        const { error } = await supabase
          .from('project_communication_settings')
          .insert({
            project_id: projectId,
            ...formState,
            updated_by: user?.id,
          })

        if (error) throw error
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to save communication settings:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-500" />
            <div>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Configure when project members receive email notifications
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>New Comment</Label>
              <p className="text-sm text-slate-500">
                Send email when someone posts a comment
              </p>
            </div>
            <Switch
              checked={formState.email_on_comment}
              onCheckedChange={(v) => updateField('email_on_comment', v)}
              disabled={!canEdit}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Task Assigned</Label>
              <p className="text-sm text-slate-500">
                Send email when a task is assigned to someone
              </p>
            </div>
            <Switch
              checked={formState.email_on_task_assigned}
              onCheckedChange={(v) => updateField('email_on_task_assigned', v)}
              disabled={!canEdit}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Task Completed</Label>
              <p className="text-sm text-slate-500">
                Send email when a task is marked as done
              </p>
            </div>
            <Switch
              checked={formState.email_on_task_completed}
              onCheckedChange={(v) => updateField('email_on_task_completed', v)}
              disabled={!canEdit}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>File Uploaded</Label>
              <p className="text-sm text-slate-500">
                Send email when a file is uploaded to the project
              </p>
            </div>
            <Switch
              checked={formState.email_on_file_uploaded}
              onCheckedChange={(v) => updateField('email_on_file_uploaded', v)}
              disabled={!canEdit}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Status Change</Label>
              <p className="text-sm text-slate-500">
                Send email when the project status changes
              </p>
            </div>
            <Switch
              checked={formState.email_on_status_change}
              onCheckedChange={(v) => updateField('email_on_status_change', v)}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Digest Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-500" />
            <div>
              <CardTitle>Digest Frequency</CardTitle>
              <CardDescription>
                Choose how frequently notification emails are sent
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Select
              value={formState.digest_frequency}
              onValueChange={(v) => updateField('digest_frequency', v)}
              disabled={!canEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIGEST_FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-2">
              {formState.digest_frequency === 'instant'
                ? 'Notifications are sent immediately when events occur.'
                : formState.digest_frequency === 'daily'
                  ? 'A summary email is sent once per day.'
                  : formState.digest_frequency === 'weekly'
                    ? 'A summary email is sent once per week.'
                    : 'No email notifications will be sent.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Client Access */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-500" />
            <div>
              <CardTitle>Client Permissions</CardTitle>
              <CardDescription>
                Control what clients can do in this project
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Allow Client Comments</Label>
              <p className="text-sm text-slate-500">
                Let clients post comments and messages
              </p>
            </div>
            <Switch
              checked={formState.allow_client_comments}
              onCheckedChange={(v) => updateField('allow_client_comments', v)}
              disabled={!canEdit}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Allow Client File Upload</Label>
              <p className="text-sm text-slate-500">
                Let clients upload files to this project
              </p>
            </div>
            <Switch
              checked={formState.allow_client_file_upload}
              onCheckedChange={(v) =>
                updateField('allow_client_file_upload', v)
              }
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Overdue Tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-slate-500" />
            <div>
              <CardTitle>Task Reminders</CardTitle>
              <CardDescription>
                Automatic reminders for overdue tasks
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Notify on Overdue Tasks</Label>
              <p className="text-sm text-slate-500">
                Send reminders when tasks pass their due date
              </p>
            </div>
            <Switch
              checked={formState.notify_on_overdue_tasks}
              onCheckedChange={(v) =>
                updateField('notify_on_overdue_tasks', v)
              }
              disabled={!canEdit}
            />
          </div>
          {formState.notify_on_overdue_tasks && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Reminder Interval (days)</Label>
                  <p className="text-sm text-slate-500">
                    How often to send overdue reminders
                  </p>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={formState.overdue_reminder_days}
                  onChange={(e) =>
                    updateField(
                      'overdue_reminder_days',
                      parseInt(e.target.value, 10) || 1
                    )
                  }
                  className="w-20"
                  disabled={!canEdit}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Communication Settings
          </Button>
        </div>
      )}
    </div>
  )
}
