-- ============================================
-- KNOWLEDGE BASE
-- ============================================

-- KB Categories
CREATE TABLE kb_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id), -- NULL = system-wide
    parent_id UUID REFERENCES kb_categories(id),
    
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    access_level VARCHAR(30) DEFAULT 'public'
        CHECK (access_level IN ('public', 'partner', 'internal', 'client_specific')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KB Articles
CREATE TABLE kb_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    category_id UUID REFERENCES kb_categories(id),
    
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    featured_image VARCHAR(500),
    
    status VARCHAR(20) DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    
    access_level VARCHAR(30) DEFAULT 'public'
        CHECK (access_level IN ('public', 'partner', 'internal', 'client_specific')),
    
    tags JSONB DEFAULT '[]',
    
    author_id UUID REFERENCES profiles(id),
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- Analytics
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX idx_kb_articles_status ON kb_articles(status);
CREATE INDEX idx_kb_articles_org ON kb_articles(organization_id);
CREATE INDEX idx_kb_categories_org ON kb_categories(organization_id);

-- Full-text search index
CREATE INDEX idx_kb_articles_search ON kb_articles 
    USING gin(to_tsvector('english', title || ' ' || content));

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE kb_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;

-- Categories RLS
CREATE POLICY "Public categories are viewable by everyone" 
ON kb_categories FOR SELECT 
USING (access_level = 'public');

CREATE POLICY "Partner categories are viewable by partners" 
ON kb_categories FOR SELECT 
USING (
    access_level = 'partner' 
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'staff', 'partner')
);

CREATE POLICY "Internal categories are viewable by staff" 
ON kb_categories FOR SELECT 
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'staff'));

CREATE POLICY "Client-specific categories" 
ON kb_categories FOR SELECT 
USING (
    access_level = 'client_specific' 
    AND (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'staff')
    )
);

-- Articles RLS
CREATE POLICY "Public articles are viewable by everyone" 
ON kb_articles FOR SELECT 
USING (access_level = 'public' AND status = 'published');

CREATE POLICY "Partner articles are viewable by partners" 
ON kb_articles FOR SELECT 
USING (
    access_level = 'partner' 
    AND status = 'published'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'staff', 'partner')
);

CREATE POLICY "Internal articles are viewable by staff" 
ON kb_articles FOR SELECT 
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'staff'));

CREATE POLICY "Client-specific articles" 
ON kb_articles FOR SELECT 
USING (
    access_level = 'client_specific' 
    AND (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'staff')
    )
);

-- Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE kb_articles;
ALTER PUBLICATION supabase_realtime ADD TABLE kb_categories;
