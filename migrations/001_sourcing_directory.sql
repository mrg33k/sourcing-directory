-- sourcing.directory MVP schema
-- Multi-vertical industry directory (semiconductor, space, biotech, etc.)
-- Run this in the Supabase SQL editor at:
--   https://mcngatprgluexjjcqpkp.supabase.co/sql

-- ─── Organizations (Space Rising, SC3, etc.) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS directory_organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  description     text,
  logo_url        text,
  website         text,
  vertical        text NOT NULL,  -- 'semiconductor', 'space', 'biotech', etc.
  membership_tiers jsonb DEFAULT '[]'::jsonb,
  -- example: [{"name":"Basic","price_yearly":500,"benefits":["Directory listing"]},
  --           {"name":"Pro","price_yearly":2000,"benefits":["Featured badge","RFQ inbox"]}]
  created_at      timestamptz DEFAULT now()
);

-- ─── Companies ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS directory_companies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  description     text,
  logo_url        text,
  website         text,
  phone           text,
  email           text,
  vertical        text NOT NULL,  -- 'semiconductor', 'space', 'biotech', etc.
  city            text,
  state           text,
  country         text DEFAULT 'US',
  employee_count  text,           -- range string: '1-10', '11-50', etc.
  year_founded    int,
  membership_tier text DEFAULT 'free',  -- 'free', 'basic', 'pro', 'enterprise'
  organization_id uuid REFERENCES directory_organizations(id) ON DELETE SET NULL,
  status          text DEFAULT 'pending',  -- 'active', 'pending', 'expired'
  featured        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dir_companies_vertical  ON directory_companies(vertical);
CREATE INDEX IF NOT EXISTS idx_dir_companies_status    ON directory_companies(status);
CREATE INDEX IF NOT EXISTS idx_dir_companies_org       ON directory_companies(organization_id);

-- Full-text search index on name + description
CREATE INDEX IF NOT EXISTS idx_dir_companies_fts ON directory_companies
  USING gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'')));

-- ─── Certifications (flexible per vertical) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS directory_certifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES directory_companies(id) ON DELETE CASCADE,
  cert_name   text NOT NULL,   -- 'ISO 9001', 'AS9100', 'ITAR Registered', etc.
  cert_value  text DEFAULT 'true',  -- 'true' | 'false' | actual cert number
  vertical    text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dir_certs_company ON directory_certifications(company_id);
CREATE INDEX IF NOT EXISTS idx_dir_certs_vertical ON directory_certifications(vertical);

-- ─── Listings (equipment, jobs, events, articles) ─────────────────────────────
CREATE TABLE IF NOT EXISTS directory_listings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES directory_companies(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  price       numeric,
  category    text NOT NULL,  -- 'equipment', 'job', 'event', 'article'
  status      text DEFAULT 'active',  -- 'active', 'sold', 'expired'
  image_url   text,
  contact_email text,
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dir_listings_company   ON directory_listings(company_id);
CREATE INDEX IF NOT EXISTS idx_dir_listings_category  ON directory_listings(category);
CREATE INDEX IF NOT EXISTS idx_dir_listings_status    ON directory_listings(status);

-- ─── RLS (Row Level Security) ─────────────────────────────────────────────────
-- Public read on active companies/orgs/certs/listings
-- Write restricted to service role (admin panel only for now)

ALTER TABLE directory_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_listings      ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "public read orgs"    ON directory_organizations    FOR SELECT USING (true);
CREATE POLICY "public read companies" ON directory_companies      FOR SELECT USING (status = 'active');
CREATE POLICY "public read certs"   ON directory_certifications   FOR SELECT USING (true);
CREATE POLICY "public read listings" ON directory_listings        FOR SELECT USING (status = 'active');

-- Service role can do everything (no policy restriction at service role level)

-- ─── Seed: Verticals reference data ───────────────────────────────────────────
-- Semiconductor certifications available in AZ
-- Space certifications available in AZ

-- ─── Sample Organizations ─────────────────────────────────────────────────────
INSERT INTO directory_organizations (name, slug, description, website, vertical, membership_tiers)
VALUES
  (
    'SC3 Arizona',
    'sc3-arizona',
    'Semiconductor cluster advancing Arizona''s semiconductor ecosystem through workforce development, supply chain, and business growth.',
    'https://sc3az.org',
    'semiconductor',
    '[{"name":"Member","price_yearly":500,"benefits":["Directory listing","RFQ inbox","Events access"]},{"name":"Sponsor","price_yearly":2500,"benefits":["Featured badge","Homepage placement","Logo on events"]}]'
  ),
  (
    'Space Rising',
    'space-rising',
    'Connecting Arizona''s space industry ecosystem. From aerospace manufacturers to satellite companies, Space Rising grows the state''s space economy.',
    'https://spacerising.org',
    'space',
    '[{"name":"Member","price_yearly":750,"benefits":["Directory listing","Member directory","Monthly networking"]},{"name":"Premier","price_yearly":3000,"benefits":["Featured listing","Speaking slots","Sponsor branding"]}]'
  )
ON CONFLICT (slug) DO NOTHING;

-- ─── Sample Companies (AZ Semiconductor) ─────────────────────────────────────
INSERT INTO directory_companies (name, slug, description, website, phone, email, vertical, city, state, employee_count, year_founded, membership_tier, status, featured)
VALUES
  (
    'Intel Chandler',
    'intel-chandler',
    'Intel''s Chandler campus is one of the company''s largest manufacturing sites globally, producing cutting-edge microprocessors and SoCs.',
    'https://intel.com',
    '(480) 765-8080',
    'chandler@intel.com',
    'semiconductor',
    'Chandler', 'AZ', '10000+', 1980, 'enterprise', 'active', true
  ),
  (
    'TSMC Arizona',
    'tsmc-arizona',
    'Taiwan Semiconductor Manufacturing Company''s first US fab, producing 4nm and 3nm chips in North Phoenix.',
    'https://tsmc.com',
    NULL,
    NULL,
    'semiconductor',
    'Phoenix', 'AZ', '2000+', 2021, 'enterprise', 'active', true
  ),
  (
    'Microchip Technology',
    'microchip-technology',
    'Chandler-headquartered leader in microcontrollers, mixed-signal, analog, and Flash-IP solutions for thousands of diverse applications.',
    'https://microchip.com',
    '(480) 792-7200',
    'info@microchip.com',
    'semiconductor',
    'Chandler', 'AZ', '5000+', 1989, 'pro', 'active', false
  ),
  (
    'ON Semiconductor',
    'on-semiconductor',
    'Phoenix-based global leader in energy-efficient power, signal management, logic, standard products and custom devices for automotive, industrial, and cloud.',
    'https://onsemi.com',
    '(602) 244-6600',
    NULL,
    'semiconductor',
    'Scottsdale', 'AZ', '10000+', 1999, 'pro', 'active', false
  )
ON CONFLICT (slug) DO NOTHING;

-- ─── Sample Companies (AZ Space) ─────────────────────────────────────────────
INSERT INTO directory_companies (name, slug, description, website, phone, email, vertical, city, state, employee_count, year_founded, membership_tier, status, featured)
VALUES
  (
    'Honeywell Aerospace',
    'honeywell-aerospace',
    'Honeywell''s Aerospace division in Phoenix develops avionics, flight controls, engines, and space systems for commercial and defense markets.',
    'https://aerospace.honeywell.com',
    '(602) 365-3099',
    NULL,
    'space',
    'Phoenix', 'AZ', '10000+', 1914, 'enterprise', 'active', true
  ),
  (
    'World View Enterprises',
    'world-view-enterprises',
    'Tucson-based stratospheric exploration company operating high-altitude balloons for science, defense, and commercial Earth observation missions.',
    'https://worldview.space',
    '(520) 441-1490',
    'info@worldview.space',
    'space',
    'Tucson', 'AZ', '100-500', 2012, 'pro', 'active', false
  ),
  (
    'Near Space Corporation',
    'near-space-corporation',
    'Tillamook-based but AZ-expanding high-altitude balloon and stratospheric launch vehicle company for scientific and commercial payloads.',
    'https://nearspacecorp.com',
    NULL,
    'info@nearspacecorp.com',
    'space',
    'Chandler', 'AZ', '11-50', 2004, 'basic', 'active', false
  )
ON CONFLICT (slug) DO NOTHING;

-- ─── Sample Certifications ────────────────────────────────────────────────────
-- (These would be populated by the signup form in production)
-- Intel Chandler
INSERT INTO directory_certifications (company_id, cert_name, cert_value, vertical)
SELECT id, 'ISO 9001', 'true', 'semiconductor' FROM directory_companies WHERE slug = 'intel-chandler'
ON CONFLICT DO NOTHING;

INSERT INTO directory_certifications (company_id, cert_name, cert_value, vertical)
SELECT id, 'ISO 14001', 'true', 'semiconductor' FROM directory_companies WHERE slug = 'intel-chandler'
ON CONFLICT DO NOTHING;

INSERT INTO directory_certifications (company_id, cert_name, cert_value, vertical)
SELECT id, 'ITAR Registered', 'true', 'semiconductor' FROM directory_companies WHERE slug = 'intel-chandler'
ON CONFLICT DO NOTHING;

-- Honeywell Aerospace
INSERT INTO directory_certifications (company_id, cert_name, cert_value, vertical)
SELECT id, 'AS9100D', 'true', 'space' FROM directory_companies WHERE slug = 'honeywell-aerospace'
ON CONFLICT DO NOTHING;

INSERT INTO directory_certifications (company_id, cert_name, cert_value, vertical)
SELECT id, 'ITAR Registered', 'true', 'space' FROM directory_companies WHERE slug = 'honeywell-aerospace'
ON CONFLICT DO NOTHING;

INSERT INTO directory_certifications (company_id, cert_name, cert_value, vertical)
SELECT id, 'ISO 9001', 'true', 'space' FROM directory_companies WHERE slug = 'honeywell-aerospace'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4 SEED BLOCK — Run in Supabase SQL editor after initial schema:
--   https://supabase.com/dashboard/project/mcngatprgluexjjcqpkp/sql/new
-- Appended 2026-03-28
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add job-specific columns to directory_listings (safe to run multiple times)
ALTER TABLE directory_listings ADD COLUMN IF NOT EXISTS salary_range text;
ALTER TABLE directory_listings ADD COLUMN IF NOT EXISTS employment_type text;
ALTER TABLE directory_listings ADD COLUMN IF NOT EXISTS location text;

-- ─── 12 More AZ Semiconductor Companies ──────────────────────────────────────
INSERT INTO directory_companies (name, slug, description, website, phone, email, vertical, city, state, employee_count, year_founded, membership_tier, status, featured)
VALUES
  (
    'Skyworks Solutions',
    'skyworks-solutions',
    'Tempe-based global leader in RF semiconductors powering mobile devices, IoT, automotive, and infrastructure applications worldwide.',
    'https://skyworksinc.com',
    '(480) 917-6000',
    'info@skyworksinc.com',
    'semiconductor',
    'Tempe', 'AZ', '9000+', 1962, 'enterprise', 'active', true
  ),
  (
    'NXP Semiconductors',
    'nxp-semiconductors',
    'Chandler operations for one of the world''s leading semiconductor companies, specializing in automotive and IoT chip solutions.',
    'https://nxp.com',
    '(480) 784-7000',
    'contact@nxp.com',
    'semiconductor',
    'Chandler', 'AZ', '34000+', 2006, 'enterprise', 'active', false
  ),
  (
    'Amkor Technology',
    'amkor-technology',
    'Chandler-headquartered global leader in semiconductor packaging and test services, serving fabless and integrated device manufacturers.',
    'https://amkor.com',
    '(480) 786-7000',
    'info@amkor.com',
    'semiconductor',
    'Chandler', 'AZ', '30000+', 1968, 'enterprise', 'active', true
  ),
  (
    'Qorvo',
    'qorvo',
    'RF solutions company with Arizona fab operations, delivering radio frequency products for mobile, defense, and infrastructure markets.',
    'https://qorvo.com',
    NULL,
    NULL,
    'semiconductor',
    'Chandler', 'AZ', '8000+', 2015, 'enterprise', 'active', false
  ),
  (
    'Entegris',
    'entegris',
    'Tempe-based provider of advanced semiconductor materials, filtration systems, and contamination control solutions for chip fabrication.',
    'https://entegris.com',
    '(480) 556-0910',
    'contact@entegris.com',
    'semiconductor',
    'Tempe', 'AZ', '6000+', 1966, 'enterprise', 'active', false
  ),
  (
    'Applied Materials',
    'applied-materials',
    'Mesa operations for the world''s largest semiconductor equipment company, providing deposition, etching, and CMP systems for chip manufacturing.',
    'https://appliedmaterials.com',
    '(480) 308-3400',
    'info@appliedmaterials.com',
    'semiconductor',
    'Mesa', 'AZ', '35000+', 1967, 'enterprise', 'active', false
  ),
  (
    'Axcelis Technologies',
    'axcelis-technologies',
    'Arizona site operations for a leading ion implant system manufacturer, serving advanced semiconductor fabs worldwide.',
    'https://axcelis.com',
    NULL,
    NULL,
    'semiconductor',
    'Chandler', 'AZ', '800+', 2000, 'enterprise', 'active', false
  ),
  (
    'PDF Solutions',
    'pdf-solutions',
    'Tempe office for semiconductor process control and data analytics company, helping fabs optimize yields and manufacturing efficiency.',
    'https://pdfsol.com',
    '(408) 280-7900',
    NULL,
    'semiconductor',
    'Tempe', 'AZ', '400+', 1992, 'pro', 'active', false
  ),
  (
    'Benchmark Electronics',
    'benchmark-electronics',
    'Arizona contract electronics manufacturing operations providing design, supply chain, and production services for complex electronics.',
    'https://bench.com',
    '(602) 437-3000',
    NULL,
    'semiconductor',
    'Phoenix', 'AZ', '11000+', 1979, 'enterprise', 'active', false
  ),
  (
    'Sanmina',
    'sanmina',
    'Phoenix operations for a global contract electronics manufacturer serving communications, industrial, medical, and defense markets.',
    'https://sanmina.com',
    '(602) 437-4000',
    NULL,
    'semiconductor',
    'Phoenix', 'AZ', '40000+', 1980, 'enterprise', 'active', false
  ),
  (
    'Jabil',
    'jabil',
    'Tucson manufacturing site for one of the world''s largest electronics manufacturing services companies, serving global OEM customers.',
    'https://jabil.com',
    '(520) 748-2000',
    NULL,
    'semiconductor',
    'Tucson', 'AZ', '260000+', 1966, 'enterprise', 'active', false
  ),
  (
    'OSI Systems',
    'osi-systems',
    'Scottsdale operations for a global provider of security inspection and optoelectronics solutions for government, defense, and commercial markets.',
    'https://osi-systems.com',
    '(480) 858-0095',
    NULL,
    'semiconductor',
    'Scottsdale', 'AZ', '8700+', 1987, 'enterprise', 'active', false
  )
ON CONFLICT (slug) DO NOTHING;

-- ─── 12 More AZ Space Companies ───────────────────────────────────────────────
INSERT INTO directory_companies (name, slug, description, website, phone, email, vertical, city, state, employee_count, year_founded, membership_tier, status, featured)
VALUES
  (
    'Northrop Grumman',
    'northrop-grumman',
    'Gilbert campus focused on space systems, satellite manufacturing, and defense programs including James Webb Space Telescope components.',
    'https://northropgrumman.com',
    '(480) 592-4000',
    NULL,
    'space',
    'Gilbert', 'AZ', '100000+', 1939, 'enterprise', 'active', true
  ),
  (
    'Raytheon Intelligence & Space',
    'raytheon-intelligence-space',
    'Tucson is Raytheon''s largest site globally, developing precision guidance systems, missiles, and advanced sensors for defense and space.',
    'https://rtx.com',
    '(520) 794-3000',
    NULL,
    'space',
    'Tucson', 'AZ', '15000+', 1950, 'enterprise', 'active', true
  ),
  (
    'General Dynamics Mission Systems',
    'general-dynamics-mission-systems',
    'Scottsdale operations delivering advanced space communications, C4ISR systems, and mission-critical electronics for government customers.',
    'https://gd.com',
    '(480) 441-3000',
    NULL,
    'space',
    'Scottsdale', 'AZ', '10000+', 1952, 'enterprise', 'active', false
  ),
  (
    'L3Harris Technologies',
    'l3harris-technologies',
    'Phoenix facility producing space electronics, sensor systems, and tactical communications for defense and intelligence community customers.',
    'https://l3harris.com',
    '(602) 231-4000',
    NULL,
    'space',
    'Phoenix', 'AZ', '47000+', 2019, 'enterprise', 'active', false
  ),
  (
    'Orbital Sciences',
    'orbital-sciences',
    'Chandler legacy site now part of Northrop Grumman, with deep heritage in satellite manufacturing and launch vehicle development.',
    'https://northropgrumman.com',
    NULL,
    NULL,
    'space',
    'Chandler', 'AZ', '500+', 1982, 'enterprise', 'active', false
  ),
  (
    'Paragon Space Development',
    'paragon-space-development',
    'Tucson-based specialist in life support systems, thermal control, and environmental control for crewed spacecraft and extreme environments.',
    'https://paragonsdc.com',
    '(520) 903-1000',
    'info@paragonsdc.com',
    'space',
    'Tucson', 'AZ', '50-100', 1993, 'basic', 'active', false
  ),
  (
    'Global Aerospace Corporation',
    'global-aerospace-corporation',
    'Aerospace research firm with AZ contracts, specializing in advanced aviation, atmospheric science, and defense system analysis.',
    'https://globalaerocorp.com',
    NULL,
    NULL,
    'space',
    'Scottsdale', 'AZ', '11-50', 1989, 'basic', 'active', false
  ),
  (
    'ASU Space and Earth Exploration',
    'asu-sese',
    'Arizona State University''s School of Earth and Space Exploration driving research in planetary science, astrobiology, and space missions.',
    'https://sese.asu.edu',
    '(480) 965-3561',
    'sese@asu.edu',
    'space',
    'Tempe', 'AZ', '500+', 2006, 'free', 'active', false
  ),
  (
    'Rincon Research',
    'rincon-research',
    'Tucson defense electronics firm specializing in signals intelligence, electronic warfare systems, and advanced sensor processing.',
    'https://rincon.com',
    '(520) 519-0500',
    NULL,
    'space',
    'Tucson', 'AZ', '100-500', 1997, 'pro', 'active', false
  ),
  (
    'Sierra Space',
    'sierra-space',
    'Arizona operations for commercial space company developing the Dream Chaser spaceplane and LIFE habitat for orbital and lunar missions.',
    'https://sierraspace.com',
    NULL,
    NULL,
    'space',
    'Phoenix', 'AZ', '1000+', 2021, 'pro', 'active', false
  ),
  (
    'SpaceX Starlink AZ',
    'spacex-starlink-az',
    'Phoenix operations hub supporting Starlink satellite internet service deployment, installation, and customer infrastructure across the Southwest.',
    'https://starlink.com',
    NULL,
    NULL,
    'space',
    'Phoenix', 'AZ', '5000+', 2019, 'enterprise', 'active', false
  ),
  (
    'Kitty Hawk',
    'kitty-hawk',
    'Chandler-based advanced air mobility startup developing autonomous electric aircraft for urban and regional transportation networks.',
    'https://kittyhawk.aero',
    NULL,
    NULL,
    'space',
    'Chandler', 'AZ', '11-50', 2010, 'basic', 'active', false
  )
ON CONFLICT (slug) DO NOTHING;

-- ─── Sample Job Listings ──────────────────────────────────────────────────────
-- NOTE: Requires salary_range / employment_type / location columns (added above)
INSERT INTO directory_listings (company_id, title, description, category, status, salary_range, employment_type, location)
VALUES
  (
    (SELECT id FROM directory_companies WHERE slug = 'honeywell-aerospace'),
    'RF Systems Engineer',
    'Design and develop RF systems for aerospace and defense platforms. 5+ years RF engineering experience, active clearance preferred.',
    'jobs', 'active', '$120-160K', 'Full Time', 'Phoenix, AZ'
  ),
  (
    (SELECT id FROM directory_companies WHERE slug = 'world-view-enterprises'),
    'Satellite Integration Technician',
    'Hands-on integration and testing of stratospheric balloon payloads and satellite systems. Mechanical aptitude and ITAR eligibility required.',
    'jobs', 'active', '$65-85K', 'Full Time', 'Tucson, AZ'
  ),
  (
    (SELECT id FROM directory_companies WHERE slug = 'tsmc-arizona'),
    'Semiconductor Process Engineer',
    'Develop and optimize advanced node semiconductor processes at TSMC''s North Phoenix fab. MS/PhD preferred, fab experience required.',
    'jobs', 'active', '$130-170K', 'Full Time', 'Phoenix, AZ'
  ),
  (
    (SELECT id FROM directory_companies WHERE slug = 'intel-chandler'),
    'Yield Engineer',
    'Drive yield improvement across Intel''s Chandler manufacturing lines. Statistical analysis, DOE, and fab process experience required.',
    'jobs', 'active', '$110-150K', 'Full Time', 'Chandler, AZ'
  ),
  (
    (SELECT id FROM directory_companies WHERE slug = 'applied-materials'),
    'Equipment Engineer',
    'Support semiconductor equipment installation, qualification, and maintenance at Applied Materials'' Mesa facility. EE/ME degree required.',
    'jobs', 'active', '$100-130K', 'Full Time', 'Mesa, AZ'
  )
ON CONFLICT DO NOTHING;
