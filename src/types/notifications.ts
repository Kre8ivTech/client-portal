export type NotificationType = 'platform_wide' | 'client_specific' | 'staff_specific';
export type NotificationPriority = 'info' | 'warning' | 'urgent';
export type NotificationAudience = 'all' | 'clients' | 'staff' | 'specific_users' | 'specific_organizations';

export interface Notification {
  id: string;
  title: string;
  content: string;
  type: NotificationType;
  target_audience: NotificationAudience;
  target_organization_ids: string[] | null;
  target_user_ids: string[] | null;
  priority: NotificationPriority;
  created_by: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  is_active: boolean;
  metadata: Record<string, any>;
}

export interface NotificationRead {
  id: string;
  notification_id: string;
  user_id: string;
  read_at: string;
  dismissed_at: string | null;
  created_at: string;
}

export interface UserNotification extends Notification {
  read_at: string | null;
  dismissed_at: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  creator_email: string | null;
  creator_name: string | null;
}
