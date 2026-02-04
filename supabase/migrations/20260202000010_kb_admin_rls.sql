-- ============================================
-- KNOWLEDGE BASE ADMIN RLS POLICIES
-- ============================================
-- Allow staff and super_admin to manage KB content

-- Categories - Staff can INSERT
DROP POLICY IF EXISTS "Staff can insert categories" ON kb_categories;
CREATE POLICY "Staff can insert categories"
ON kb_categories FOR INSERT
WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('super_admin', 'staff')
);

-- Categories - Staff can UPDATE
DROP POLICY IF EXISTS "Staff can update categories" ON kb_categories;
CREATE POLICY "Staff can update categories"
ON kb_categories FOR UPDATE
USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('super_admin', 'staff')
);

-- Categories - Staff can DELETE
DROP POLICY IF EXISTS "Staff can delete categories" ON kb_categories;
CREATE POLICY "Staff can delete categories"
ON kb_categories FOR DELETE
USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('super_admin', 'staff')
);

-- Articles - Staff can INSERT
DROP POLICY IF EXISTS "Staff can insert articles" ON kb_articles;
CREATE POLICY "Staff can insert articles"
ON kb_articles FOR INSERT
WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('super_admin', 'staff')
);

-- Articles - Staff can UPDATE
DROP POLICY IF EXISTS "Staff can update articles" ON kb_articles;
CREATE POLICY "Staff can update articles"
ON kb_articles FOR UPDATE
USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('super_admin', 'staff')
);

-- Articles - Staff can DELETE
DROP POLICY IF EXISTS "Staff can delete articles" ON kb_articles;
CREATE POLICY "Staff can delete articles"
ON kb_articles FOR DELETE
USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('super_admin', 'staff')
);
