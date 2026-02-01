-- Migration: OAuth Integrations table
-- Description: Store OAuth tokens for calendar and other integrations
-- Date: 2026-02-01

-- =============================================================================
-- 1. CREATE OAUTH_INTEGRATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.oauth_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Integration type
  provider VARCHAR(50) NOT NULL, -- 'google_calendar', 'microsoft_outlook', 'apple_caldav'

  -- OAuth tokens (encrypted at rest by Supabase)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Provider-specific data
  provider_user_id VARCHAR(255),
  provider_email VARCHAR(255),
  scopes TEXT[], -- Array of granted scopes

  -- For CalDAV (Apple)
  caldav_url VARCHAR(500),
  caldav_username VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One integration per provider per user
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_oauth_integrations_user ON public.oauth_integrations(user_id);
CREATE INDEX idx_oauth_integrations_org ON public.oauth_integrations(organization_id);
CREATE INDEX idx_oauth_integrations_provider ON public.oauth_integrations(provider);

-- Trigger for updated_at
CREATE TRIGGER update_oauth_integrations_updated_at
  BEFORE UPDATE ON public.oauth_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. RLS POLICIES
-- =============================================================================

ALTER TABLE public.oauth_integrations ENABLE ROW LEVEL SECURITY;

-- Users can view their own integrations
CREATE POLICY "Users can view own integrations"
  ON public.oauth_integrations FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own integrations
CREATE POLICY "Users can create own integrations"
  ON public.oauth_integrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own integrations
CREATE POLICY "Users can update own integrations"
  ON public.oauth_integrations FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own integrations
CREATE POLICY "Users can delete own integrations"
  ON public.oauth_integrations FOR DELETE
  USING (user_id = auth.uid());

-- Super admins can view all integrations
CREATE POLICY "Super admins can view all integrations"
  ON public.oauth_integrations FOR SELECT
  USING (is_super_admin());
