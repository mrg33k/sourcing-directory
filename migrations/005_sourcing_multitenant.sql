-- 005: Multi-tenant support for sourcing directory
-- Each vertical becomes an isolated "tenant" (directory)

-- ─── Tenants table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS directory_tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,           -- "SC3 Arizona Semiconductor", "Space Rising"
  slug          text UNIQUE NOT NULL,    -- URL path segment
  description   text,
  vertical      text NOT NULL,           -- primary vertical
  logo_url      text,
  brand_color   text DEFAULT '#1B5E20',  -- dark green default
  website       text,
  status        text DEFAULT 'active',   -- 'active', 'archived'
  features      jsonb DEFAULT '{"jobs":true,"marketplace":true,"events":true,"articles":true,"signup":true}'::jsonb,
  hero_text     text,                    -- custom tagline on tenant landing
  nav_label     text,                    -- override display name in nav
  created_at    timestamptz DEFAULT now()
);

-- ─── Add tenant_id FK to existing tables ────────────────────────────────────
ALTER TABLE directory_organizations ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES directory_tenants(id) ON DELETE CASCADE;
ALTER TABLE directory_companies ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES directory_tenants(id) ON DELETE CASCADE;
ALTER TABLE directory_certifications ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES directory_tenants(id) ON DELETE CASCADE;
ALTER TABLE directory_listings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES directory_tenants(id) ON DELETE CASCADE;

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dir_tenants_slug ON directory_tenants(slug);
CREATE INDEX IF NOT EXISTS idx_dir_tenants_status ON directory_tenants(status);
CREATE INDEX IF NOT EXISTS idx_dir_companies_tenant ON directory_companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dir_orgs_tenant ON directory_organizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dir_listings_tenant ON directory_listings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dir_certs_tenant ON directory_certifications(tenant_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE directory_tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read tenants" ON directory_tenants FOR SELECT USING (status = 'active');

-- ─── Seed default tenants from existing verticals ───────────────────────────
INSERT INTO directory_tenants (name, slug, vertical, hero_text) VALUES
  ('SC3 Arizona Semiconductor', 'sc3-semiconductor', 'semiconductor', 'Arizona''s semiconductor supply chain directory. Find certified fabs, suppliers, and partners.'),
  ('Space Rising Arizona', 'space-rising', 'space', 'Arizona''s space and aerospace industry directory. Launch suppliers, defense contractors, and R&D firms.'),
  ('Arizona Biotech Council', 'az-biotech', 'biotech', 'Arizona''s biotech and life sciences directory. Labs, manufacturers, and clinical partners.'),
  ('Arizona Defense Alliance', 'az-defense', 'defense', 'Arizona''s defense industry directory. Cleared contractors, ITAR suppliers, and mission-critical partners.')
ON CONFLICT (slug) DO NOTHING;

-- ─── Backfill tenant_id on existing data ────────────────────────────────────
UPDATE directory_companies SET tenant_id = (
  SELECT id FROM directory_tenants WHERE vertical = directory_companies.vertical LIMIT 1
) WHERE tenant_id IS NULL;

UPDATE directory_organizations SET tenant_id = (
  SELECT id FROM directory_tenants WHERE vertical = directory_organizations.vertical LIMIT 1
) WHERE tenant_id IS NULL;

UPDATE directory_certifications SET tenant_id = (
  SELECT c.tenant_id FROM directory_companies c WHERE c.id = directory_certifications.company_id
) WHERE tenant_id IS NULL;

UPDATE directory_listings SET tenant_id = (
  SELECT c.tenant_id FROM directory_companies c WHERE c.id = directory_listings.company_id
) WHERE tenant_id IS NULL;
