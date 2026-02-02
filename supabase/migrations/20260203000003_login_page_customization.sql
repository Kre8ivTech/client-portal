-- Migration: Login Page Customization
-- Description: Add login page background customization fields to portal_branding
-- Date: 2026-02-03

-- Add new columns for login page customization
ALTER TABLE portal_branding ADD COLUMN IF NOT EXISTS login_bg_color TEXT DEFAULT NULL;
ALTER TABLE portal_branding ADD COLUMN IF NOT EXISTS login_bg_image_url TEXT DEFAULT NULL;
ALTER TABLE portal_branding ADD COLUMN IF NOT EXISTS login_bg_overlay_opacity NUMERIC(3,2) DEFAULT 0.50 CHECK (login_bg_overlay_opacity >= 0 AND login_bg_overlay_opacity <= 1);

COMMENT ON COLUMN portal_branding.login_bg_color IS 'Login page background color (hex format, e.g., #1e293b)';
COMMENT ON COLUMN portal_branding.login_bg_image_url IS 'Login page background image URL';
COMMENT ON COLUMN portal_branding.login_bg_overlay_opacity IS 'Login page background overlay opacity (0-1, default 0.5)';
