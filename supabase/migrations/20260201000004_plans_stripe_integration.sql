-- Migration: Add Stripe integration fields to plans table
-- Description: Adds stripe_product_id, stripe_price_id, and billing_interval for Stripe sync
-- Date: 2026-02-01
-- =============================================================================
-- ADD BILLING INTERVAL ENUM
-- =============================================================================
DO $$ BEGIN CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly', 'one_time');
EXCEPTION
WHEN duplicate_object THEN null;
END $$;
-- =============================================================================
-- ADD STRIPE FIELDS TO PLANS TABLE
-- =============================================================================
-- Add Stripe-related columns if they don't exist
DO $$ BEGIN
ALTER TABLE plans
ADD COLUMN stripe_product_id VARCHAR(255);
EXCEPTION
WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE plans
ADD COLUMN stripe_price_id VARCHAR(255);
EXCEPTION
WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE plans
ADD COLUMN billing_interval billing_interval NOT NULL DEFAULT 'monthly';
EXCEPTION
WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
ALTER TABLE plans
ADD COLUMN features JSONB DEFAULT '[]'::jsonb;
EXCEPTION
WHEN duplicate_column THEN null;
END $$;
-- Create indexes for Stripe ID lookups
CREATE INDEX idx_plans_stripe_product ON plans(stripe_product_id)
WHERE stripe_product_id IS NOT NULL;
CREATE INDEX idx_plans_stripe_price ON plans(stripe_price_id)
WHERE stripe_price_id IS NOT NULL;
-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON COLUMN plans.stripe_product_id IS 'Stripe Product ID for this plan';
COMMENT ON COLUMN plans.stripe_price_id IS 'Stripe Price ID for this plan (recurring price)';
COMMENT ON COLUMN plans.billing_interval IS 'Billing interval: monthly, yearly, or one_time';
COMMENT ON COLUMN plans.features IS 'JSON array of feature strings for display on pricing pages';