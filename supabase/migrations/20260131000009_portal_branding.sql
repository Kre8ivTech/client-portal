-- Migration: Portal Branding
-- Description: Global branding/styling settings editable by super_admin only
-- Date: 2026-01-31

CREATE TABLE IF NOT EXISTS portal_branding (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    app_name TEXT NOT NULL DEFAULT 'KT-Portal',
    tagline TEXT DEFAULT 'Client Portal',
    logo_url TEXT,
    primary_color TEXT DEFAULT '231 48% 58%',
    favicon_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_portal_branding_updated_at
    BEFORE UPDATE ON portal_branding
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO portal_branding (id, app_name, tagline, primary_color)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'KT-Portal', 'Client Portal', '231 48% 58%')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE portal_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal branding is readable by everyone"
    ON portal_branding FOR SELECT
    USING (true);

CREATE POLICY "Only super_admin can update portal branding"
    ON portal_branding FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

COMMENT ON TABLE portal_branding IS 'Portal-wide branding and styling; editable by super_admin only. Single row.';
