-- Migration: Add content_html field to contracts table
-- Description: Fix missing content_html field that was causing 404 errors when viewing contracts
-- Date: 2026-02-03

-- Add content_html column to contracts table
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS content_html TEXT;

-- Add index for text search if needed in the future
CREATE INDEX IF NOT EXISTS idx_contracts_content_html ON contracts USING gin(to_tsvector('english', content_html)) WHERE content_html IS NOT NULL;

-- Migrate existing metadata.template_content to content_html
UPDATE contracts
SET content_html = metadata->>'template_content'
WHERE metadata ? 'template_content' AND content_html IS NULL;
