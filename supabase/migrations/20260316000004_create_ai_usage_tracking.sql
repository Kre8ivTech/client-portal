-- AI Usage Tracking Table
-- Logs every AI API call for cost tracking, analytics, and rate limiting

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  
  -- Provider details
  provider TEXT NOT NULL, -- 'openrouter', 'anthropic', 'openai'
  model TEXT NOT NULL, -- 'claude-sonnet-4-20250514', 'gpt-4o', etc.
  
  -- Token usage
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  
  -- Cost (in USD cents to avoid floating point)
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  
  -- Request metadata
  request_type TEXT NOT NULL DEFAULT 'chat', -- 'chat', 'contract_generate', 'other'
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'rate_limited'
  error_message TEXT,
  latency_ms INTEGER, -- response time in milliseconds
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_ai_usage_user_id ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_org_id ON ai_usage_logs(organization_id);
CREATE INDEX idx_ai_usage_created_at ON ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_provider ON ai_usage_logs(provider);
CREATE INDEX idx_ai_usage_date ON ai_usage_logs(DATE(created_at));

-- Enable RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Only super_admin and staff can view usage logs
CREATE POLICY "Staff can view all AI usage"
  ON ai_usage_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'staff'))
  );

-- System can insert usage logs (via service role)
CREATE POLICY "Authenticated users can insert own usage"
  ON ai_usage_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Add daily rate limit tracking view
CREATE OR REPLACE VIEW ai_usage_daily AS
SELECT 
  user_id,
  organization_id,
  DATE(created_at) as usage_date,
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(input_tokens + output_tokens) as total_tokens,
  SUM(estimated_cost_cents) as total_cost_cents,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count
FROM ai_usage_logs
GROUP BY user_id, organization_id, DATE(created_at);
