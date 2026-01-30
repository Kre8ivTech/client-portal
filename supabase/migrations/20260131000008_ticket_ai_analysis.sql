-- Migration: Ticket AI analysis fields
-- Description: Stores AI analysis metadata for tickets
-- Date: 2026-01-31

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_sentiment VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ai_suggested_priority VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ai_suggested_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ai_tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_action_items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_ai_sentiment_valid
  CHECK (ai_sentiment IS NULL OR ai_sentiment IN ('positive', 'neutral', 'negative'));

ALTER TABLE tickets
  ADD CONSTRAINT tickets_ai_priority_valid
  CHECK (
    ai_suggested_priority IS NULL
    OR ai_suggested_priority IN ('low', 'medium', 'high', 'critical')
  );
