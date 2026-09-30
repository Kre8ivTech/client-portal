-- Partners and their child clients need the partner brand on the shared portal,
-- not only after a custom domain is verified. These helpers return just the
-- public brand fields and bypass organization RLS so a client can read the
-- parent partner's branding without seeing the rest of that organization.

CREATE OR REPLACE FUNCTION public.white_label_branding_for_host(request_host text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'org_name', organizations.name,
    'branding_config', COALESCE(organizations.branding_config, '{}'::jsonb)
  )
  FROM public.organizations
  WHERE organizations.custom_domain = lower(btrim(request_host))
    AND organizations.custom_domain_verified IS TRUE
    AND organizations.type = 'partner'
    AND organizations.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_white_label_branding()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'org_name', partner.name,
    'branding_config', COALESCE(partner.branding_config, '{}'::jsonb)
  )
  FROM public.users
  JOIN public.organizations own ON own.id = users.organization_id
  JOIN public.organizations partner ON partner.id = CASE
    WHEN own.type = 'partner' THEN own.id
    ELSE own.parent_org_id
  END
  WHERE users.id = auth.uid()
    AND own.status = 'active'
    AND partner.type = 'partner'
    AND partner.status = 'active'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.white_label_branding_for_host(text) IS
  'Public brand for a verified partner custom domain. Used on the login page before a session exists.';

COMMENT ON FUNCTION public.current_white_label_branding() IS
  'Public brand for the signed-in partner, or for a client whose parent organization is a partner.';

REVOKE ALL ON FUNCTION public.white_label_branding_for_host(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_white_label_branding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.white_label_branding_for_host(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_white_label_branding() TO authenticated;
