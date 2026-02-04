-- Add personal timezone preference to users table
-- Allows each user to set their own timezone for display purposes

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

COMMENT ON COLUMN users.timezone IS 'User personal timezone preference for display formatting (e.g. America/New_York)';

-- Create index for timezone lookups (useful for scheduled notifications)
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);
