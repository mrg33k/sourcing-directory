-- sourcing.directory listings fields extension
-- Adds marketplace, job board, and event-specific columns to directory_listings
-- Run after 001_sourcing_directory.sql

-- ─── Equipment Marketplace fields ─────────────────────────────────────────────
ALTER TABLE directory_listings
  ADD COLUMN IF NOT EXISTS condition       text,       -- 'new', 'used', 'refurbished'
  ADD COLUMN IF NOT EXISTS photo_urls      jsonb DEFAULT '[]'::jsonb,  -- array of image URLs
  ADD COLUMN IF NOT EXISTS vertical        text;       -- industry vertical filter

-- ─── Job Board fields ──────────────────────────────────────────────────────────
ALTER TABLE directory_listings
  ADD COLUMN IF NOT EXISTS job_type        text,       -- 'full-time', 'contract', 'internship', 'part-time'
  ADD COLUMN IF NOT EXISTS location        text,       -- city/state or 'Remote'
  ADD COLUMN IF NOT EXISTS remote          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS salary_min      numeric,
  ADD COLUMN IF NOT EXISTS salary_max      numeric,
  ADD COLUMN IF NOT EXISTS apply_url       text;

-- ─── Event fields ─────────────────────────────────────────────────────────────
ALTER TABLE directory_listings
  ADD COLUMN IF NOT EXISTS event_date      timestamptz,
  ADD COLUMN IF NOT EXISTS event_end_date  timestamptz,
  ADD COLUMN IF NOT EXISTS event_location  text,       -- physical address or 'Virtual'
  ADD COLUMN IF NOT EXISTS event_type      text,       -- 'conference', 'meetup', 'webinar', 'workshop', 'expo'
  ADD COLUMN IF NOT EXISTS virtual_url     text,
  ADD COLUMN IF NOT EXISTS organizer       text;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dir_listings_vertical  ON directory_listings(vertical);
CREATE INDEX IF NOT EXISTS idx_dir_listings_job_type  ON directory_listings(job_type);
CREATE INDEX IF NOT EXISTS idx_dir_listings_event_date ON directory_listings(event_date);
CREATE INDEX IF NOT EXISTS idx_dir_listings_condition  ON directory_listings(condition);

-- ─── Public insert policy (for signup forms) ──────────────────────────────────
-- Allow anyone to insert listings (pending review).
-- In production, tie to authenticated users only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public insert listings' AND tablename = 'directory_listings'
  ) THEN
    CREATE POLICY "public insert listings" ON directory_listings FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ─── Sample Equipment Listings ─────────────────────────────────────────────────
INSERT INTO directory_listings (company_id, title, description, price, category, status, condition, vertical, contact_email)
SELECT
  id,
  'Used Cleanroom Wafer Handler — 200mm',
  'Brooks Automation PRI-300 wafer handler. 200mm compatible. Removed from decommissioned fab line. Fully functional, tested Q3 2025. Includes original documentation.',
  18500,
  'equipment',
  'active',
  'used',
  'semiconductor',
  'chandler@intel.com'
FROM directory_companies WHERE slug = 'intel-chandler'
ON CONFLICT DO NOTHING;

INSERT INTO directory_listings (company_id, title, description, price, category, status, condition, vertical, contact_email)
SELECT
  id,
  'Refurbished Lam Research Etch System',
  'Lam Research 2300 Versys Metal Etch system. Refurbished with new RF generators and process kit. Ideal for R&D or low-volume production. Available immediately.',
  145000,
  'equipment',
  'active',
  'refurbished',
  'semiconductor',
  'chandler@intel.com'
FROM directory_companies WHERE slug = 'intel-chandler'
ON CONFLICT DO NOTHING;

-- ─── Sample Job Listings ──────────────────────────────────────────────────────
INSERT INTO directory_listings (company_id, title, description, category, status, job_type, location, remote, salary_min, salary_max, apply_url, vertical)
SELECT
  id,
  'Process Integration Engineer — TSMC N3',
  'Lead integration of advanced node processes at TSMC''s North Phoenix fab. Work with cross-functional teams on 3nm technology development. ITAR-cleared environment. MS/PhD in EE or Materials Science required.',
  'job',
  'active',
  'full-time',
  'Phoenix, AZ',
  false,
  130000,
  185000,
  'https://tsmc.com/careers',
  'semiconductor'
FROM directory_companies WHERE slug = 'tsmc-arizona'
ON CONFLICT DO NOTHING;

INSERT INTO directory_listings (company_id, title, description, category, status, job_type, location, remote, salary_min, salary_max, apply_url, vertical)
SELECT
  id,
  'Avionics Software Engineer (Contract)',
  'Contract position developing DO-178C compliant avionics software for commercial and defense programs. C/C++ required. Ada a plus. Active security clearance preferred.',
  'job',
  'active',
  'contract',
  'Phoenix, AZ',
  false,
  95,
  130,
  'https://aerospace.honeywell.com/careers',
  'space'
FROM directory_companies WHERE slug = 'honeywell-aerospace'
ON CONFLICT DO NOTHING;

-- ─── Sample Event Listings ─────────────────────────────────────────────────────
INSERT INTO directory_listings (company_id, title, description, category, status, event_date, event_end_date, event_location, event_type, organizer, vertical)
SELECT
  id,
  'AZ Semiconductor Summit 2026',
  'Annual gathering of Arizona''s semiconductor ecosystem. Sessions on fab expansion, workforce development, supply chain localization, and the CHIPS Act impact. 400+ attendees expected.',
  'event',
  'active',
  '2026-05-15 09:00:00+00',
  '2026-05-16 17:00:00+00',
  'Phoenix Convention Center, Phoenix, AZ',
  'conference',
  'SC3 Arizona',
  'semiconductor'
FROM directory_companies WHERE slug = 'intel-chandler'
ON CONFLICT DO NOTHING;

INSERT INTO directory_listings (company_id, title, description, category, status, event_date, event_end_date, event_location, event_type, organizer, vertical, virtual_url)
SELECT
  id,
  'Space Rising Monthly Networking — April',
  'Monthly mixer for Arizona space industry professionals. Informal networking, drinks, and a 15-min spotlight presentation from a member company. Open to members and guests.',
  'event',
  'active',
  '2026-04-09 18:00:00+00',
  '2026-04-09 20:30:00+00',
  'The Vig Arcadia, 4041 N 40th St, Phoenix, AZ',
  'meetup',
  'Space Rising',
  'space',
  null
FROM directory_companies WHERE slug = 'honeywell-aerospace'
ON CONFLICT DO NOTHING;
