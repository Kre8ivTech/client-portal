'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertCircle, Info, AlertTriangle, X, Bell } from 'lucide-react'
import type { UserNotification } from '@/types/notifications'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export function NotificationBox() {
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const STORAGE_KEY = 'ktp.dashboard.notifications.dismissedSignature'

  useEffect(() => {
    loadNotifications()
    
    // Subscribe to real-time changes
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          loadNotifications()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notification_reads' },
        () => {
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  useEffect(() => {
    // Load persisted dismissal state (client-only)
    try {
      setDismissedSignature(window.localStorage.getItem(STORAGE_KEY))
    } catch {
      // ignore
    }
  }, [])

  async function loadNotifications() {
    try {
      const response = await fetch('/api/notifications')
      if (!response.ok) throw new Error('Failed to fetch notifications')

      const { data } = await response.json()

      setNotifications(data || [])

      // Count unread (notifications not read and not dismissed)
      const unread = (data || []).filter((n: any) => !n.is_read && !n.is_dismissed).length
      setUnreadCount(unread)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      await (supabase as any).rpc('mark_notification_read', { notification_id: notificationId })
      loadNotifications()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  async function dismissNotification(notificationId: string) {
    try {
      await (supabase as any).rpc('dismiss_notification', { notification_id: notificationId })
      loadNotifications()
    } catch (error) {
      console.error('Error dismissing notification:', error)
    }
  }

  const visibleNotifications = notifications.filter(n => !n.is_dismissed)

  const currentSignature = useMemo(() => {
    if (visibleNotifications.length === 0) return ''
    return visibleNotifications
      .map((n) => `${n.id}:${n.updated_at}:${n.read_at ?? ''}:${n.dismissed_at ?? ''}`)
      .join('|')
  }, [visibleNotifications])

  const isSectionDismissed = dismissedSignature !== null && dismissedSignature === currentSignature

  useEffect(() => {
    // If content changes, automatically re-show the section.
    if (!dismissedSignature) return
    if (currentSignature && dismissedSignature !== currentSignature) {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
      setDismissedSignature(null)
    }
  }, [currentSignature, dismissedSignature])

  function dismissSection() {
    if (!currentSignature) return
    try {
      window.localStorage.setItem(STORAGE_KEY, currentSignature)
    } catch {
      // ignore
    }
    setDismissedSignature(currentSignature)
  }

  // Only show this widget when there's something to show.
  if (loading || visibleNotifications.length === 0 || isSectionDismissed) {
    return null
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 opacity-60 hover:opacity-100"
            onClick={dismissSection}
            aria-label="Close notifications section"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Important updates and announcements</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {visibleNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={markAsRead}
                onDismiss={dismissNotification}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

interface NotificationItemProps {
  notification: UserNotification
  onMarkRead: (id: string) => void
  onDismiss: (id: string) => void
}

function NotificationItem({ notification, onMarkRead, onDismiss }: NotificationItemProps) {
  const priorityConfig = {
    info: { icon: Info, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    warning: { icon: AlertTriangle, color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
    urgent: { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  }

  const config = priorityConfig[notification.priority]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'relative p-3 rounded-lg border transition-all',
        notification.is_read ? 'bg-background' : config.bgColor,
        notification.is_read ? 'border-border' : config.borderColor,
        !notification.is_read && 'shadow-sm'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', config.bgColor)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={cn(
              'font-medium text-sm',
              !notification.is_read && 'font-semibold'
            )}>
              {notification.title}
            </h4>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 opacity-50 hover:opacity-100"
              onClick={() => onDismiss(notification.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground mb-2 whitespace-pre-wrap">
            {notification.content}
          </p>
          
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{format(new Date(notification.created_at), 'MMM d, h:mm a')}</span>
              {notification.creator_name && (
                <>
                  <span>•</span>
                  <span>by {notification.creator_name}</span>
                </>
              )}
            </div>
            
            {!notification.is_read && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2"
                onClick={() => onMarkRead(notification.id)}
              >
                Mark as read
              </Button>
            )}
          </div>
          
          {notification.expires_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Expires {format(new Date(notification.expires_at), 'MMM d, yyyy')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
