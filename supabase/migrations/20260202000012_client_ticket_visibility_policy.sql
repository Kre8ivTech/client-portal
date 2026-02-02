-- Migration: Client Ticket Visibility Policy Rename
-- Description: Rename "Clients can manage own tickets" to "Clients can manage organization tickets"
--              for clarity. The policy allows clients to see ALL tickets in their organization,
--              not just tickets they personally created.
-- Date: 2026-02-02
--
-- This is a naming clarification only - no functional changes to the policy logic.
-- Clients with role='client' can view/manage all tickets where organization_id matches
-- their organization, enabling team collaboration on support requests.
-- =============================================================================

-- Drop the misleadingly-named policy and recreate with clearer name
DROP POLICY IF EXISTS "Clients can manage own tickets" ON tickets;

CREATE POLICY "Clients can manage organization tickets"
  ON tickets FOR ALL
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- Add comment for documentation
COMMENT ON POLICY "Clients can manage organization tickets" ON tickets IS
  'Allows users to view and manage all tickets within their organization. This enables team collaboration where multiple users in the same organization can see each others support tickets.';
