-- Replace mutually recursive contracts/contract_signers SELECT policies.
-- The SECURITY DEFINER helper evaluates access without re-entering either table's RLS.

CREATE OR REPLACE FUNCTION public.can_view_contract(p_contract_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contracts AS contract
    WHERE contract.id = p_contract_id
      AND (
        contract.client_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.contract_signers AS signer
          WHERE signer.contract_id = contract.id
            AND signer.user_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1
          FROM public.users AS viewer
          WHERE viewer.id = (SELECT auth.uid())
            AND (
              viewer.role IN ('super_admin', 'admin', 'staff')
              OR contract.organization_id = viewer.organization_id
              OR (
                viewer.role IN ('partner', 'partner_staff')
                AND EXISTS (
                  SELECT 1
                  FROM public.organizations AS child_organization
                  WHERE child_organization.id = contract.organization_id
                    AND child_organization.parent_org_id = viewer.organization_id
                )
              )
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_contract(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_contract(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view relevant contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can view org contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can view contracts" ON public.contracts;

CREATE POLICY "Users can view contracts"
  ON public.contracts
  FOR SELECT
  TO authenticated
  USING ((SELECT public.can_view_contract(contracts.id)));

DROP POLICY IF EXISTS "Users can view contract signers" ON public.contract_signers;

CREATE POLICY "Users can view contract signers"
  ON public.contract_signers
  FOR SELECT
  TO authenticated
  USING ((SELECT public.can_view_contract(contract_signers.contract_id)));
