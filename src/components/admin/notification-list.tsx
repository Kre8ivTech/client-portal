'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, Info, AlertTriangle, Trash2, Eye, EyeOff } from 'lucide-react'
import type { Notification } from '@/types/notifications'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function NotificationList() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadNotifications()
  }, [])

  async function loadNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete notification')
      }

      loadNotifications()
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
    setDeleteId(null)
  }

  async function toggleActive(id: string, currentStatus: boolean) {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update notification')
      }

      loadNotifications()
    } catch (error) {
      console.error('Error updating notification:', error)
    }
  }

  const priorityConfig = {
    info: { icon: Info, variant: 'default' as const, label: 'Info' },
    warning: { icon: AlertTriangle, variant: 'secondary' as const, label: 'Warning' },
    urgent: { icon: AlertCircle, variant: 'destructive' as const, label: 'Urgent' },
  }

  if (loading) {
    return <div className="text-center py-8">Loading notifications...</div>
  }

  return (
    <>
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No notifications created yet</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => {
            const config = priorityConfig[notification.priority]
            const Icon = config.icon
            const isExpired = notification.expires_at && new Date(notification.expires_at) < new Date()

            return (
              <Card key={notification.id} className={cn(!notification.is_active && 'opacity-60')}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg mb-2">{notification.title}</CardTitle>
                        <CardDescription className="whitespace-pre-wrap">
                          {notification.content}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleActive(notification.id, notification.is_active)}
                        title={notification.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {notification.is_active ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteId(notification.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={config.variant}>{config.label}</Badge>
                    <Badge variant="outline" className="capitalize">
                      {notification.type.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {notification.target_audience.replace('_', ' ')}
                    </Badge>
                    {!notification.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                    {isExpired && (
                      <Badge variant="secondary">Expired</Badge>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground space-y-1">
                    <p>Created {format(new Date(notification.created_at), 'PPp')}</p>
                    {notification.expires_at && (
                      <p>Expires {format(new Date(notification.expires_at), 'PPp')}</p>
                    )}
                    {notification.target_organization_ids && notification.target_organization_ids.length > 0 && (
                      <p>Target orgs: {notification.target_organization_ids.length}</p>
                    )}
                    {notification.target_user_ids && notification.target_user_ids.length > 0 && (
                      <p>Target users: {notification.target_user_ids.length}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notification</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this notification? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
