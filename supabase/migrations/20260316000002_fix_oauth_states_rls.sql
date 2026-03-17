-- SECURITY FIX: Enable RLS on oauth_states table
-- Previously had no RLS, allowing any authenticated user to read OAuth tokens

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Users can only read their own OAuth states
CREATE POLICY "Users can view own oauth states"
  ON oauth_states FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own OAuth states
CREATE POLICY "Users can create own oauth states"
  ON oauth_states FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own OAuth states
CREATE POLICY "Users can delete own oauth states"
  ON oauth_states FOR DELETE
  USING (user_id = auth.uid());

-- System/cron can clean up expired states (service role bypasses RLS)
