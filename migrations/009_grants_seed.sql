-- Seed grant listings for Funding & Grants page
-- Adds grants relevant to Arizona semiconductor and space industries

-- Grant fields use directory_listings with category='grant'
-- Required columns: grant_type, grant_amount_min, grant_amount_max, deadline, eligibility_criteria, application_url

ALTER TABLE directory_listings
  ADD COLUMN IF NOT EXISTS grant_type           text,  -- federal, state, private, nonprofit, local
  ADD COLUMN IF NOT EXISTS grant_amount_min      numeric,
  ADD COLUMN IF NOT EXISTS grant_amount_max      numeric,
  ADD COLUMN IF NOT EXISTS eligibility_criteria  text,
  ADD COLUMN IF NOT EXISTS application_url       text;

-- ─── Federal Grants ─────────────────────────────────────────────────────────

INSERT INTO directory_listings (title, description, category, status, vertical, grant_type, grant_amount_min, grant_amount_max, deadline, eligibility_criteria, application_url)
VALUES (
  'CHIPS Act Manufacturing Incentives Program',
  'Direct funding for semiconductor manufacturing facility construction and modernization in the United States. Arizona projects are prioritized under the regional hub designation. Covers up to 25% of qualified capital expenditures for new fab construction and 35% for facility modernization.',
  'grant', 'active', 'semiconductor', 'federal',
  10000000, 500000000,
  '2026-09-30 23:59:59+00',
  'Must be a US-based semiconductor manufacturer or supplier. Facility must be located in the United States. Must commit to workforce development and community investment plans.',
  'https://www.nist.gov/chips'
),
(
  'SBIR Phase II -- Space Technology',
  'NASA Small Business Innovation Research funding for Arizona companies developing space-related technologies. Phase II awards for companies that successfully completed Phase I. Focus areas include launch systems, satellite components, and ground support equipment.',
  'grant', 'active', 'space', 'federal',
  750000, 1500000,
  '2026-06-15 23:59:59+00',
  'US small business (under 500 employees). Must have completed SBIR Phase I. Technology must align with NASA mission directorates.',
  'https://sbir.nasa.gov'
),
(
  'DOD Microelectronics Commons Hub -- Southwest Region',
  'Department of Defense initiative to strengthen the domestic microelectronics ecosystem. Prototyping and workforce development grants for Arizona-based semiconductor companies supporting defense supply chains.',
  'grant', 'active', 'semiconductor', 'federal',
  500000, 5000000,
  '2026-12-31 23:59:59+00',
  'US-based company in the microelectronics sector. Must demonstrate defense supply chain relevance. ITAR compliance required.',
  'https://www.microelectronicscommons.org'
)
ON CONFLICT DO NOTHING;

-- ─── State Grants ──────────────────────────────────────────────────────────

INSERT INTO directory_listings (title, description, category, status, vertical, grant_type, grant_amount_min, grant_amount_max, deadline, eligibility_criteria, application_url)
VALUES (
  'Arizona Commerce Authority -- Innovation Fund',
  'State-funded grants for technology companies expanding operations in Arizona. Priority sectors include semiconductor manufacturing, aerospace, and advanced materials. Matching funds available for companies creating 25+ jobs.',
  'grant', 'active', 'semiconductor', 'state',
  100000, 1000000,
  '2026-08-31 23:59:59+00',
  'Must be an Arizona-registered business. Must create minimum 25 new full-time jobs within 24 months. Average wage must exceed county median.',
  'https://www.azcommerce.com'
),
(
  'Arizona Spaceport Development Grant',
  'State infrastructure grants for companies operating at or supporting Arizona spaceport facilities. Covers facility improvements, launch pad infrastructure, and environmental compliance costs.',
  'grant', 'active', 'space', 'state',
  50000, 500000,
  '2026-07-31 23:59:59+00',
  'Must operate at a licensed Arizona spaceport facility. Must demonstrate job creation or retention. Environmental compliance plan required.',
  NULL
)
ON CONFLICT DO NOTHING;

-- ─── Private Grants ────────────────────────────────────────────────────────

INSERT INTO directory_listings (title, description, category, status, vertical, grant_type, grant_amount_min, grant_amount_max, deadline, eligibility_criteria, application_url)
VALUES (
  'Intel Arizona Supplier Development Program',
  'Intel provides direct grants and technical assistance to Arizona semiconductor suppliers investing in quality certifications, workforce training, or capacity expansion to support Ocotillo campus operations.',
  'grant', 'active', 'semiconductor', 'private',
  25000, 250000,
  '2026-10-15 23:59:59+00',
  'Must be a current or prospective Intel Arizona supplier. Must be within 100 miles of Chandler, AZ. Investment must directly support semiconductor supply chain.',
  NULL
),
(
  'Raytheon STEM Workforce Pipeline Grant',
  'Raytheon funds training programs and apprenticeships that develop skilled workers for Arizona defense and aerospace manufacturing. Priority given to programs serving underrepresented communities.',
  'grant', 'active', 'space', 'private',
  10000, 100000,
  '2026-11-30 23:59:59+00',
  'Must be an Arizona educational institution or workforce development nonprofit. Program must serve defense/aerospace skill development.',
  NULL
)
ON CONFLICT DO NOTHING;

-- ─── Nonprofit Grants ──────────────────────────────────────────────────────

INSERT INTO directory_listings (title, description, category, status, vertical, grant_type, grant_amount_min, grant_amount_max, deadline, eligibility_criteria, application_url)
VALUES (
  'GPEC Advanced Manufacturing Workforce Grant',
  'Greater Phoenix Economic Council grants for companies implementing advanced manufacturing training programs. Covers training costs, curriculum development, and equipment for workforce readiness programs.',
  'grant', 'active', 'semiconductor', 'nonprofit',
  15000, 75000,
  '2026-06-30 23:59:59+00',
  'Must be located in Greater Phoenix metro area. Must commit to hiring program graduates. Quarterly progress reports required.',
  'https://www.gpec.org'
)
ON CONFLICT DO NOTHING;
