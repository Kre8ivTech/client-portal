-- Latest WordPress plugin snapshot reported by the KT-Portal Monitor heartbeat.
-- Idempotent so a restarted container can reapply it. A new heartbeat replaces
-- the previous snapshot; this migration does not backfill one.

ALTER TABLE public.site_monitors
  ADD COLUMN IF NOT EXISTS wp_plugins JSONB,
  ADD COLUMN IF NOT EXISTS wp_plugins_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.site_monitors.wp_plugins IS
  'Plugin file, name, version, active flag, and update-available flag from the latest WordPress heartbeat. Replaced on each heartbeat. No plugin source, license keys, or file contents.';
COMMENT ON COLUMN public.site_monitors.wp_plugins_updated_at IS
  'When wp_plugins was last replaced by a heartbeat.';
