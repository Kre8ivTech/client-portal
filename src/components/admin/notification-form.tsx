'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
import type { NotificationType, NotificationPriority, NotificationAudience } from '@/types/notifications'

interface NotificationFormProps {
  userRole: string
  isAccountManager: boolean
  organizationId: string | null
}

export function NotificationForm({ userRole, isAccountManager, organizationId }: NotificationFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'platform_wide' as NotificationType,
    target_audience: 'all' as NotificationAudience,
    priority: 'info' as NotificationPriority,
    expires_at: '',
    target_organization_ids: '',
    target_user_ids: '',
  })

  const isAdmin = userRole === 'super_admin'
  const canCreateStaffNotifications = isAdmin || isAccountManager
  const canCreateClientNotifications = isAdmin || userRole === 'staff' || userRole === 'partner_staff'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const payload: any = {
        title: formData.title,
        content: formData.content,
        type: formData.type,
        target_audience: formData.target_audience,
        priority: formData.priority,
        expires_at: formData.expires_at || null,
      }

      // Parse target IDs if provided
      if (formData.target_organization_ids.trim()) {
        payload.target_organization_ids = formData.target_organization_ids
          .split(',')
          .map(id => id.trim())
          .filter(id => id)
      }

      if (formData.target_user_ids.trim()) {
        payload.target_user_ids = formData.target_user_ids
          .split(',')
          .map(id => id.trim())
          .filter(id => id)
      }

      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create notification')
      }

      setSuccess(true)
      setFormData({
        title: '',
        content: '',
        type: 'platform_wide',
        target_audience: 'all',
        priority: 'info',
        expires_at: '',
        target_organization_ids: '',
        target_user_ids: '',
      })

      // Refresh after a short delay
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Notification</CardTitle>
        <CardDescription>
          Send announcements and updates to users based on their role and organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 text-green-900 border-green-200">
              <AlertDescription>Notification created successfully!</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Important announcement"
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Provide details about this notification..."
              required
              rows={4}
              maxLength={2000}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Notification Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: NotificationType) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform_wide">Platform Wide</SelectItem>
                  {canCreateClientNotifications && (
                    <SelectItem value="client_specific">Client Specific</SelectItem>
                  )}
                  {canCreateStaffNotifications && (
                    <SelectItem value="staff_specific">Staff Specific</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_audience">Target Audience</Label>
              <Select
                value={formData.target_audience}
                onValueChange={(value: NotificationAudience) => 
                  setFormData({ ...formData, target_audience: value })
                }
              >
                <SelectTrigger id="target_audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="all">All Users</SelectItem>}
                  {(isAdmin || canCreateClientNotifications) && (
                    <SelectItem value="clients">Clients Only</SelectItem>
                  )}
                  {canCreateStaffNotifications && (
                    <SelectItem value="staff">Staff Only</SelectItem>
                  )}
                  <SelectItem value="specific_users">Specific Users</SelectItem>
                  <SelectItem value="specific_organizations">Specific Organizations</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value: NotificationPriority) => 
                setFormData({ ...formData, priority: value })
              }
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.target_audience === 'specific_organizations' && (
            <div className="space-y-2">
              <Label htmlFor="target_orgs">Target Organization IDs</Label>
              <Input
                id="target_orgs"
                value={formData.target_organization_ids}
                onChange={(e) => 
                  setFormData({ ...formData, target_organization_ids: e.target.value })
                }
                placeholder="org-id-1, org-id-2, org-id-3"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of organization IDs
              </p>
            </div>
          )}

          {formData.target_audience === 'specific_users' && (
            <div className="space-y-2">
              <Label htmlFor="target_users">Target User IDs</Label>
              <Input
                id="target_users"
                value={formData.target_user_ids}
                onChange={(e) => 
                  setFormData({ ...formData, target_user_ids: e.target.value })
                }
                placeholder="user-id-1, user-id-2, user-id-3"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of user IDs
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="expires_at">Expiration Date (Optional)</Label>
            <Input
              id="expires_at"
              type="datetime-local"
              value={formData.expires_at}
              onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for notifications that don't expire
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Notification
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
