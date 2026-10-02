-- Let a white-label partner and their staff add a site monitor for a child
-- client organization. The partner overview lists monitors whose
-- organization_id belongs to a child client, so the partner org itself is
-- not a valid target.
--
-- Staff and super_admin keep the existing manage policy.
-- Clients do not gain INSERT. Partners do not gain UPDATE or DELETE.

DROP POLICY IF EXISTS "Partners insert child client site_monitors" ON public.site_monitors;

CREATE POLICY "Partners insert child client site_monitors"
  ON public.site_monitors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('partner', 'partner_staff')
    AND public.get_user_organization_type() = 'partner'
    AND public.get_user_organization_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organizations AS client_org
      WHERE client_org.id = organization_id
        AND client_org.parent_org_id = public.get_user_organization_id()
        AND client_org.type = 'client'
    )
  );
