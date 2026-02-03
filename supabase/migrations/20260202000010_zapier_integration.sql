-- Migration: Zapier Integration
-- Description: Add Zapier webhook subscriptions and API keys for automation
-- Date: 2026-02-02

-- =============================================================================
-- 1. CREATE API_KEYS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Key details
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL, -- e.g., 'kt_live_' or 'kt_test_'
  key_hash TEXT NOT NULL, -- Hashed version of the full key
  
  -- Permissions
  scopes TEXT[] DEFAULT ARRAY['read:tickets', 'write:tickets', 'read:invoices', 'read:contracts', 'read:messages']::TEXT[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(key_hash)
);

CREATE INDEX idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_org ON public.api_keys(organization_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON public.api_keys(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. CREATE ZAPIER_WEBHOOKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.zapier_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Webhook details
  url TEXT NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- e.g., 'ticket.created', 'invoice.paid', 'contract.signed'
  
  -- Filtering (optional JSONB for custom filters)
  filters JSONB DEFAULT '{}'::JSONB,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  failure_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_zapier_webhooks_user ON public.zapier_webhooks(user_id);
CREATE INDEX idx_zapier_webhooks_org ON public.zapier_webhooks(organization_id);
CREATE INDEX idx_zapier_webhooks_event ON public.zapier_webhooks(event_type);
CREATE INDEX idx_zapier_webhooks_active ON public.zapier_webhooks(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_zapier_webhooks_updated_at
  BEFORE UPDATE ON public.zapier_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 3. CREATE WEBHOOK_DELIVERIES TABLE (for debugging)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.zapier_webhooks(id) ON DELETE CASCADE,
  
  -- Request details
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  
  -- Response details
  status_code INTEGER,
  response_body TEXT,
  error TEXT,
  duration_ms INTEGER,
  
  -- Status
  success BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_created ON public.webhook_deliveries(created_at);
CREATE INDEX idx_webhook_deliveries_success ON public.webhook_deliveries(success);

-- Auto-delete old deliveries after 30 days
CREATE OR REPLACE FUNCTION delete_old_webhook_deliveries()
RETURNS void AS $$
BEGIN
  DELETE FROM public.webhook_deliveries
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. RLS POLICIES
-- =============================================================================

-- API Keys Policies
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API keys"
  ON public.api_keys FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own API keys"
  ON public.api_keys FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own API keys"
  ON public.api_keys FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all API keys"
  ON public.api_keys FOR SELECT
  USING (is_super_admin());

-- Zapier Webhooks Policies
ALTER TABLE public.zapier_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own webhooks"
  ON public.zapier_webhooks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own webhooks"
  ON public.zapier_webhooks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own webhooks"
  ON public.zapier_webhooks FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own webhooks"
  ON public.zapier_webhooks FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all webhooks"
  ON public.zapier_webhooks FOR SELECT
  USING (is_super_admin());

-- Webhook Deliveries Policies
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (
    webhook_id IN (
      SELECT id FROM public.zapier_webhooks
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (is_super_admin());

-- =============================================================================
-- 5. HELPER FUNCTIONS
-- =============================================================================

-- Function to generate API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
  key_value TEXT;
BEGIN
  -- Generate a random key (32 bytes = 64 hex chars)
  key_value := encode(gen_random_bytes(32), 'hex');
  RETURN key_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to hash API key
CREATE OR REPLACE FUNCTION hash_api_key(key_value TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(key_value, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. GRANT PERMISSIONS
-- =============================================================================

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION generate_api_key() TO authenticated;
GRANT EXECUTE ON FUNCTION hash_api_key(TEXT) TO authenticated;
