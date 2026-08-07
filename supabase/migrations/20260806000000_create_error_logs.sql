-- First-party application errors for super-admin debugging.
-- Error payloads are inserted only by the authenticated server endpoint.

CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'error'
    CHECK (severity IN ('error', 'warning')),
  source TEXT NOT NULL
    CHECK (source IN ('react_error_boundary', 'window_error', 'unhandled_rejection')),
  message TEXT NOT NULL
    CHECK (char_length(message) BETWEEN 1 AND 2000),
  stack_trace TEXT
    CHECK (stack_trace IS NULL OR char_length(stack_trace) <= 12000),
  digest TEXT
    CHECK (digest IS NULL OR char_length(digest) <= 255),
  route TEXT
    CHECK (route IS NULL OR char_length(route) <= 500),
  user_agent TEXT
    CHECK (user_agent IS NULL OR char_length(user_agent) <= 1000),
  environment TEXT
    CHECK (environment IS NULL OR char_length(environment) <= 100),
  release TEXT
    CHECK (release IS NULL OR char_length(release) <= 255),
  context JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(context) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_logs_created_at_idx
  ON public.error_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS error_logs_organization_created_at_idx
  ON public.error_logs (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view error logs" ON public.error_logs;
CREATE POLICY "Super admins can view error logs"
  ON public.error_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = (SELECT auth.uid())
        AND users.role IN ('super_admin', 'admin')
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.error_logs FROM anon, authenticated;
GRANT SELECT ON public.error_logs TO authenticated;
