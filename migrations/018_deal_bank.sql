-- Deal Bank Schema (Space Rising, single-tenant)
-- Three tables + admin approval queue.
-- Decisions locked (Patrik 2026-05-18):
--   - FREE listings, no paid tier
--   - Decks are PUBLIC download
--   - Space Rising only -- no tenant_id
--   - Status enum: pending / approved / rejected / withdrawn

-- ─── deal_bank_listings ──────────────────────────────────────────────────────
-- Opt-in deal profile layered on an existing directory_companies record.
CREATE TABLE IF NOT EXISTS deal_bank_listings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid        NOT NULL REFERENCES directory_companies(id) ON DELETE CASCADE,
  deck_url         text,                       -- public download URL for pitch deck
  exec_summary     text,                       -- written executive summary
  leadership       jsonb       DEFAULT '[]'::jsonb,
  -- Each element: {name, title, photo_url, bio, linkedin_url}  (up to 4)
  capital_sought   text,                       -- display string e.g. "$2M" or "2000000"
  round_stage      text,                       -- Seed, Series A, Series B, etc.
  revenue_y1       numeric,
  revenue_y2       numeric,
  revenue_y3       numeric,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','approved','rejected','withdrawn')),
  submitted_at     timestamptz DEFAULT now(),
  reviewed_at      timestamptz,
  reviewed_by      text,                       -- admin user email / id
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_db_listings_company ON deal_bank_listings(company_id);
CREATE INDEX IF NOT EXISTS idx_db_listings_status  ON deal_bank_listings(status);

ALTER TABLE deal_bank_listings ENABLE ROW LEVEL SECURITY;

-- Public: only approved rows
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename = 'deal_bank_listings'
                   AND policyname = 'public read approved listings') THEN
    CREATE POLICY "public read approved listings"
      ON deal_bank_listings FOR SELECT
      USING (status = 'approved');
  END IF;
END $$;

-- Service role bypass (no policy needed — service role is not subject to RLS)

-- ─── deal_bank_investors ─────────────────────────────────────────────────────
-- Free investor firm listings. contact_email_internal is admin-only, NEVER rendered FE.
CREATE TABLE IF NOT EXISTS deal_bank_investors (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name              text        NOT NULL,
  website                text,
  criteria               text,                 -- investment thesis / what they look for
  check_size_min         numeric,
  check_size_max         numeric,
  deal_types             text[],               -- VC, PE, family fund, angel group, etc.
  deals_last_18mo        integer,
  linkedin_url           text,
  contact_email_internal text,                 -- NEVER public; admin-only
  status                 text        NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending','approved','rejected','withdrawn')),
  submitted_at           timestamptz DEFAULT now(),
  reviewed_at            timestamptz,
  reviewed_by            text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_db_investors_status ON deal_bank_investors(status);

ALTER TABLE deal_bank_investors ENABLE ROW LEVEL SECURITY;

-- Public: only approved rows, and never expose contact_email_internal
-- (the SELECT policy lets through all columns; the FE must not render contact_email_internal)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename = 'deal_bank_investors'
                   AND policyname = 'public read approved investors') THEN
    CREATE POLICY "public read approved investors"
      ON deal_bank_investors FOR SELECT
      USING (status = 'approved');
  END IF;
END $$;

-- ─── deal_bank_completed_rounds ──────────────────────────────────────────────
-- System-managed. No founder-add. Team maintains going forward.
CREATE TABLE IF NOT EXISTS deal_bank_completed_rounds (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company          text        NOT NULL,
  amount_raised    text,                       -- display string: "$460M"
  round            text,                       -- "Series E", "Refinancing", etc.
  date             date,
  source_url       text,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_db_completed_rounds_date    ON deal_bank_completed_rounds(date);
CREATE INDEX IF NOT EXISTS idx_db_completed_rounds_company ON deal_bank_completed_rounds(company);

ALTER TABLE deal_bank_completed_rounds ENABLE ROW LEVEL SECURITY;

-- Completed rounds are always public
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename = 'deal_bank_completed_rounds'
                   AND policyname = 'public read completed rounds') THEN
    CREATE POLICY "public read completed rounds"
      ON deal_bank_completed_rounds FOR SELECT
      USING (true);
  END IF;
END $$;
