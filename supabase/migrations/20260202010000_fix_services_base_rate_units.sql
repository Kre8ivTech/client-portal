-- Clarify services.base_rate unit (USD dollars, not cents)
-- The column is NUMERIC(10,2), which represents dollars and cents.

COMMENT ON COLUMN public.services.base_rate IS 'Base price in USD (dollars), with cents precision';

