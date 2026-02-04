-- Add Stripe customer ID to organizations table
-- This allows us to link organizations to Stripe customers for billing portal access

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

COMMENT ON COLUMN organizations.stripe_customer_id IS 'Stripe customer ID for billing portal access (e.g. cus_xxx)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id ON organizations(stripe_customer_id);
