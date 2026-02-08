-- Safe migration: Create notifications system if not exists
-- This creates the notifications table, notification_reads table,
-- user_notifications view, and related functions

-- Create enum types (safe with IF NOT EXISTS via DO block)
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('platform_wide', 'client_specific', 'staff_specific');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('info', 'warning', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_audience AS ENUM ('all', 'clients', 'staff', 'specific_users', 'specific_organizations');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type notification_type NOT NULL DEFAULT 'platform_wide',
  target_audience notification_audience NOT NULL DEFAULT 'all',
  target_organization_ids UUID[] DEFAULT NULL,
  target_user_ids UUID[] DEFAULT NULL,
  priority notification_priority NOT NULL DEFAULT 'info',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create notification_reads table
CREATE TABLE IF NOT EXISTS notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(notification_id, user_id)
);

-- Create indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_is_active ON notifications(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_by ON notifications(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_target_orgs ON notifications USING GIN(target_organization_ids);
CREATE INDEX IF NOT EXISTS idx_notifications_target_users ON notifications USING GIN(target_user_ids);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification ON notification_reads(notification_id);

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts, then recreate
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admin can view all notifications" ON notifications;
  DROP POLICY IF EXISTS "Staff can view their created notifications" ON notifications;
  DROP POLICY IF EXISTS "Users can view notifications targeted to them" ON notifications;
  DROP POLICY IF EXISTS "Admin can create notifications" ON notifications;
  DROP POLICY IF EXISTS "Account managers can create staff notifications" ON notifications;
  DROP POLICY IF EXISTS "Project managers can create client notifications" ON notifications;
  DROP POLICY IF EXISTS "Admin can update notifications" ON notifications;
  DROP POLICY IF EXISTS "Creators can update own notifications" ON notifications;
  DROP POLICY IF EXISTS "Admin can delete notifications" ON notifications;
  DROP POLICY IF EXISTS "Creators can delete own notifications" ON notifications;
  DROP POLICY IF EXISTS "Users can view own notification reads" ON notification_reads;
  DROP POLICY IF EXISTS "Users can insert own notification reads" ON notification_reads;
  DROP POLICY IF EXISTS "Users can update own notification reads" ON notification_reads;
  DROP POLICY IF EXISTS "Admin can view all notification reads" ON notification_reads;
END $$;

-- RLS Policies for notifications table
CREATE POLICY "Admin can view all notifications"
  ON notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Staff can view their created notifications"
  ON notifications FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role IN ('staff', 'partner') OR users.is_account_manager = TRUE)
    )
  );

CREATE POLICY "Users can view notifications targeted to them"
  ON notifications FOR SELECT
  USING (
    is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (
      (type = 'platform_wide' AND target_audience = 'all')
      OR (
        type = 'platform_wide' AND target_audience = 'clients'
        AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('client', 'partner'))
      )
      OR (
        type = 'platform_wide' AND target_audience = 'staff'
        AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'super_admin', 'partner_staff'))
      )
      OR (
        type = 'client_specific'
        AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.organization_id = ANY(target_organization_ids))
      )
      OR (
        type = 'staff_specific'
        AND EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid()
          AND users.role IN ('staff', 'super_admin', 'partner_staff')
          AND (target_organization_ids IS NULL OR users.organization_id = ANY(target_organization_ids))
        )
      )
      OR (target_audience = 'specific_users' AND auth.uid() = ANY(target_user_ids))
    )
  );

CREATE POLICY "Admin can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

CREATE POLICY "Account managers can create staff notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid()
      AND users.is_account_manager = TRUE AND users.role IN ('staff', 'partner')
    )
    AND (type IN ('platform_wide', 'staff_specific') AND target_audience IN ('staff', 'specific_users'))
  );

CREATE POLICY "Project managers can create client notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'partner_staff'))
    AND (type = 'client_specific' OR (type = 'staff_specific' AND target_audience IN ('staff', 'specific_users')))
  );

CREATE POLICY "Admin can update notifications"
  ON notifications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

CREATE POLICY "Creators can update own notifications"
  ON notifications FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Admin can delete notifications"
  ON notifications FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

CREATE POLICY "Creators can delete own notifications"
  ON notifications FOR DELETE
  USING (created_by = auth.uid());

-- RLS Policies for notification_reads
CREATE POLICY "Users can view own notification reads"
  ON notification_reads FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification reads"
  ON notification_reads FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notification reads"
  ON notification_reads FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admin can view all notification reads"
  ON notification_reads FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

-- Create/replace user_notifications view
CREATE OR REPLACE VIEW user_notifications AS
SELECT 
  n.*,
  nr.read_at,
  nr.dismissed_at,
  CASE WHEN nr.id IS NULL THEN FALSE ELSE TRUE END AS is_read,
  CASE WHEN nr.dismissed_at IS NOT NULL THEN TRUE ELSE FALSE END AS is_dismissed,
  creator.email AS creator_email,
  creator_profile.name AS creator_name
FROM notifications n
LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = auth.uid()
LEFT JOIN users creator ON n.created_by = creator.id
LEFT JOIN profiles creator_profile ON creator.id = creator_profile.user_id
WHERE n.is_active = TRUE
  AND (n.expires_at IS NULL OR n.expires_at > NOW());

-- Grant access to the view
GRANT SELECT ON user_notifications TO authenticated;

-- Create function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO notification_reads (notification_id, user_id, read_at)
  VALUES (notification_id, auth.uid(), NOW())
  ON CONFLICT (notification_id, user_id)
  DO UPDATE SET read_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to dismiss notification
CREATE OR REPLACE FUNCTION dismiss_notification(notification_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO notification_reads (notification_id, user_id, read_at, dismissed_at)
  VALUES (notification_id, auth.uid(), NOW(), NOW())
  ON CONFLICT (notification_id, user_id)
  DO UPDATE SET dismissed_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO unread_count
  FROM notifications n
  LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = auth.uid()
  WHERE n.is_active = TRUE
    AND (n.expires_at IS NULL OR n.expires_at > NOW())
    AND nr.id IS NULL
    AND (
      (n.type = 'platform_wide' AND n.target_audience = 'all')
      OR (n.type = 'platform_wide' AND n.target_audience = 'clients'
          AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('client', 'partner')))
      OR (n.type = 'platform_wide' AND n.target_audience = 'staff'
          AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'super_admin', 'partner_staff')))
      OR (n.type = 'client_specific'
          AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.organization_id = ANY(n.target_organization_ids)))
      OR (n.type = 'staff_specific'
          AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'super_admin', 'partner_staff')
                      AND (n.target_organization_ids IS NULL OR users.organization_id = ANY(n.target_organization_ids))))
      OR (n.target_audience = 'specific_users' AND auth.uid() = ANY(n.target_user_ids))
    );
  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
