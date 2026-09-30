-- SMTP credentials are accessed only by server routes after role authorization.
-- Browser clients must never read encrypted secrets or bypass those checks.
ALTER TABLE public.smtp_configurations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "smtp_super_admin_select" ON public.smtp_configurations;
DROP POLICY IF EXISTS "smtp_super_admin_manage" ON public.smtp_configurations;
REVOKE ALL ON TABLE public.smtp_configurations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.smtp_configurations TO service_role;
