-- Allow a white-label partner to create a child client organization.
-- /dashboard/clients/new inserts through the authenticated user client.
-- The only permissive INSERT policy was "Super admins can manage organizations",
-- so partner inserts failed with a row-level security violation.
--
-- Partners may insert only a client row whose parent is their own partner org.
-- Clients, partner staff, and other tenants are unchanged.
-- Super admins keep "Super admins can manage organizations" (FOR ALL).
-- Staff keep their existing UPDATE/SELECT policies and do not gain INSERT here.
-- The restrictive "Enforce organization insert security" policy still applies.

DROP POLICY IF EXISTS "Partners can create client organizations" ON public.organizations;

CREATE POLICY "Partners can create client organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() = 'partner'
    AND get_user_organization_type() = 'partner'
    AND get_user_organization_id() IS NOT NULL
    AND type = 'client'
    AND status = 'active'
    AND parent_org_id = get_user_organization_id()
    AND custom_domain IS NULL
    AND COALESCE(custom_domain_verified, FALSE) = FALSE
    AND custom_domain_verified_at IS NULL
    AND stripe_customer_id IS NULL
    AND COALESCE(is_priority_client, FALSE) = FALSE
  );
