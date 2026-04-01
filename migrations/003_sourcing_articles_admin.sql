-- sourcing.directory articles + admin fields
-- Adds article-specific columns to directory_listings
-- Run after 001 + 002 in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/mcngatprgluexjjcqpkp/sql/new

-- ─── Article fields ────────────────────────────────────────────────────────────
ALTER TABLE directory_listings
  ADD COLUMN IF NOT EXISTS body            text,         -- full article body (markdown)
  ADD COLUMN IF NOT EXISTS excerpt         text,         -- short summary for cards
  ADD COLUMN IF NOT EXISTS cover_image_url text,         -- hero/cover image URL
  ADD COLUMN IF NOT EXISTS tags            jsonb DEFAULT '[]'::jsonb,  -- array of tag strings
  ADD COLUMN IF NOT EXISTS read_time_min   int;          -- estimated read time in minutes

-- ─── Admin audit fields ────────────────────────────────────────────────────────
ALTER TABLE directory_listings
  ADD COLUMN IF NOT EXISTS moderated_at   timestamptz,  -- when admin reviewed
  ADD COLUMN IF NOT EXISTS moderated_by   text;         -- admin identifier

-- ─── Index for article queries ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dir_listings_category_status ON directory_listings(category, status);
CREATE INDEX IF NOT EXISTS idx_dir_listings_created ON directory_listings(created_at DESC);

-- ─── Allow article inserts via public form ─────────────────────────────────────
-- (Policy already added in 002 via "public insert listings" -- this is a no-op)
-- Re-run safe because of IF NOT EXISTS equivalent via DO NOTHING on conflict.

-- ─── Sample article listings ───────────────────────────────────────────────────
INSERT INTO directory_listings (
  company_id, title, description, excerpt, body, category, status,
  vertical, read_time_min, tags
)
SELECT
  id,
  'Arizona Semiconductor Workforce: 2026 Outlook',
  'A look at hiring trends and talent pipelines for Arizona''s growing semiconductor ecosystem.',
  'With TSMC ramping, Intel expanding, and CHIPS Act funding flowing, Arizona needs 10,000+ new semiconductor workers by 2027. Here''s what companies are doing about it.',
  E'## The Talent Gap Is Real\n\nArizona''s semiconductor industry is at an inflection point. TSMC''s North Phoenix fab, Intel''s Ocotillo expansion, and a dozen smaller suppliers are all hiring simultaneously — but the pipeline isn''t keeping up.\n\nASU, Maricopa Community Colleges, and the Mesa Community College Semiconductor Academy are responding with accelerated programs. But there''s a 2-3 year lag between curriculum and fab-ready talent.\n\n## What Companies Are Doing\n\n**Intel** has partnered with ASU for on-the-job training programs that bring students directly into Chandler fab operations.\n\n**TSMC Arizona** is importing process engineers from their Taiwan fabs while aggressively recruiting from US universities — particularly for roles that don''t require clearances.\n\n**Microchip Technology** has expanded its Phoenix-area internship program to 200+ spots annually.\n\n## The Next 12 Months\n\nHiring will stay competitive. Expect salaries for process engineers to climb another 8-12% in 2026. Companies with strong relocation packages and training programs will win the talent wars.',
  'article',
  'active',
  'semiconductor',
  5,
  '["Workforce", "TSMC", "Intel", "CHIPS Act", "Hiring"]'::jsonb
FROM directory_companies WHERE slug = 'intel-chandler'
ON CONFLICT DO NOTHING;

INSERT INTO directory_listings (
  company_id, title, description, excerpt, body, category, status,
  vertical, read_time_min, tags
)
SELECT
  id,
  'Stratospheric Ballooning: Arizona''s Quiet Space Advantage',
  'World View and Near Space Corporation are pioneering a new category of space access from Arizona''s high desert.',
  'Tucson has quietly become the world''s leading hub for stratospheric balloon operations. Here''s why the physics and geography make Arizona uniquely suited for this emerging sector.',
  E'## Why Arizona for Stratospheric Access?\n\nThe answer is simple: weather and geography. Arizona''s high desert offers over 330 clear days per year, low humidity, minimal air traffic conflicts over vast swaths of the Sonoran Desert, and proximity to both US military test ranges and civilian research institutions.\n\nWorld View Enterprises operates from Tucson''s Spaceport, launching balloons to 100,000+ feet with payloads ranging from scientific instruments to defense ISR platforms.\n\n## The Market Is Expanding\n\nStratospheric ballooning isn''t a niche — it''s emerging as a cost-effective complement to satellite operations:\n\n- **Persistent surveillance**: Balloons can loiter over an area for days or weeks at a fraction of satellite cost\n- **Science platforms**: NASA and NOAA regularly contract for atmospheric research payloads\n- **Defense applications**: The military''s interest in high-altitude platforms has surged post-2022\n\n## What''s Next for Arizona\n\nWorld View recently secured a $56M Series F. Near Space Corporation is expanding its launch cadence. Arizona''s spaceport infrastructure and regulatory environment position the state as the default home for this sector.',
  'article',
  'active',
  'space',
  6,
  '["Stratospheric", "World View", "Balloon", "Spaceport", "Arizona"]'::jsonb
FROM directory_companies WHERE slug = 'world-view-enterprises'
ON CONFLICT DO NOTHING;
