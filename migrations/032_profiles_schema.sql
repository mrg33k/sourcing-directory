-- ===========================================================================
-- 032_profiles_schema.sql — the person/company profile data model
-- ===========================================================================
--
-- WHAT THIS IS
--   The three profile screens (/people/:slug, /company/:slug, /admin-tools)
--   render today from transcribed fixtures. Nothing behind them exists. This
--   migration creates the tables those screens read, plus the one table that
--   makes a mission SCORE storable at all.
--
-- SCOPE — READ THIS BEFORE EDITING
--   CREATE ONLY. This file must never ALTER or DROP an object that already
--   exists in production. Not a column, not a policy, not a default, not a
--   function. Everything below is brand new and empty, so nothing that
--   currently renders can break, and every object here can be dropped.
--
--   That constraint is WHY directory_company_profile exists as a side table
--   instead of six columns added to directory_companies. See docs/schema/profiles.md.
--
--   Policies on directory_members / directory_companies / directory_listings /
--   directory_analytics / directory_contacts / directory_reports are NOT
--   touched here. Those belong to migration 028, which is human-gated.
--
-- IDEMPOTENT
--   Safe to run twice. Tables and indexes use IF NOT EXISTS, functions use
--   CREATE OR REPLACE, triggers use CREATE OR REPLACE TRIGGER (PG 14+),
--   policies are guarded by pg_policies lookups because PostgreSQL has no
--   CREATE POLICY IF NOT EXISTS even on 17.
--
-- TARGET: PostgreSQL 17.6 (Supabase project kzzvjtthknsozktmpvak)
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. AUTHORIZATION HELPERS
--
-- Every write policy below is expressed through these three functions, for two
-- reasons:
--
--   1. THE ADMIN CLAIM. The correct global-admin claim is
--        auth.jwt() -> 'app_metadata' ->> 'role'
--      NOT the top-level 'role' claim. The top-level claim is the Postgres role
--      ('anon' / 'authenticated' / 'service_role') and never equals 'admin'.
--      migrations/017_admin_update_policy.sql uses the top-level claim, so its
--      admin branch has never matched anything in production. Putting the claim
--      in one function means that mistake can only ever be made once.
--
--   2. RLS RECURSION. A policy subquery against another table is itself subject
--      to that table's RLS. Reading directory_members from inside a policy would
--      couple these tables to whatever policy set directory_members happens to
--      have — which migration 028 is about to change. SECURITY DEFINER isolates
--      that. search_path is pinned on every definer function.
-- ---------------------------------------------------------------------------

-- Platform admin. Reads the JWT only, so it needs no elevated rights.
CREATE OR REPLACE FUNCTION directory_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

COMMENT ON FUNCTION directory_is_platform_admin() IS
  'Global admin check. app_metadata.role = admin. The top-level JWT role claim is the Postgres role and is NEVER admin (see migrations/017 for the version that got this wrong).';

-- Approved member of a company. This is the edit right Patrik chose for company
-- records: "Approved members of that company, plus admins."
--
-- WARNING, and it is not this migration's to fix: directory_members is
-- anon-INSERTable in production today (migrations/006 ships
-- "service role all" FOR ALL USING (true) with no TO clause). Until 028 Part 1
-- lands, anyone can insert a directory_members row naming any company and get
-- the write rights this function grants. 028 closes that. Apply 028 first.
CREATE OR REPLACE FUNCTION directory_is_approved_company_member(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_company_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM directory_members m
       WHERE m.company_id = p_company_id
         AND m.auth_user_id = auth.uid()
         AND m.status = 'approved'
     );
$$;

COMMENT ON FUNCTION directory_is_approved_company_member(uuid) IS
  'True when the caller has an approved directory_members row for this company. The company edit right agreed 2026-07-28.';

-- The two helpers that read directory_people are NOT here. They are in §1c,
-- after the table exists. LANGUAGE sql function bodies are fully analysed at
-- CREATE time (check_function_bodies is on by default), so defining them here
-- would abort the transaction with "relation directory_people does not exist".
-- LANGUAGE plpgsql would hide that, which is exactly why they are not plpgsql.

-- Is this company's record public? Same job, and it also keeps the company
-- child tables from depending on directory_companies' own policy set.
CREATE OR REPLACE FUNCTION directory_company_is_public(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM directory_companies c
    WHERE c.id = p_company_id AND c.status = 'active'
  );
$$;

-- Shared updated_at trigger. Attached ONLY to tables created in this file.
CREATE OR REPLACE FUNCTION directory_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- 1. directory_people — the person profile
--
-- This table is the reason a person can have a URL at all. Before it,
-- "a person" in this database was a directory_members row (an auth link: email,
-- role, status — no slug, no bio, no avatar, no title) or a directory_listings
-- row with category='person' (a name in `title` and a bio in `description`).
-- Neither is addressable and neither is editable as a profile.
--
-- ROUTING: person URLs are /people/:slug ONLY. src/main.jsx maps the bare
-- catch-all /:slug to the COMPANY page, so a person is never reachable at the
-- root. See the slug-collision trigger in §1b.
--
-- auth_user_id is NULLABLE on purpose: admins create profiles for people who
-- have never signed in. That is the normal case for the five real people
-- currently encoded as directory_listings rows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS directory_people (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid REFERENCES directory_tenants(id) ON DELETE CASCADE,
  auth_user_id        uuid,
  member_id           uuid REFERENCES directory_members(id) ON DELETE SET NULL,
  company_id          uuid REFERENCES directory_companies(id) ON DELETE SET NULL,

  slug                text NOT NULL UNIQUE,

  full_name           text NOT NULL,
  avatar_url          text,
  job_title           text,
  org_name            text,

  city                text,
  state               text,
  -- USPS two-letter code. `state` carries the display name ("Arizona");
  -- state_code drives the map highlight ("AZ"). Two columns because the design
  -- prints one and paints the other.
  state_code          text,
  country             text,

  email               text,
  linkedin_url        text,
  website             text,

  bio_short           text,
  bio_long            text,

  -- The pill row under the identity block. Free display chips, not records the
  -- admin panel edits/verifies/counts one by one, so an array is correct here
  -- and the "normalized, not jsonb" rule does not apply. See docs/schema/profiles.md.
  focus_areas         text[] NOT NULL DEFAULT '{}',

  availability_status text,
  availability_note   text,
  accepts_connections boolean NOT NULL DEFAULT true,

  verification        text NOT NULL DEFAULT 'unverified'
                      CHECK (verification IN ('unverified','pending','verified','rejected')),
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','active','inactive')),

  published_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dir_people_tenant   ON directory_people(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dir_people_company  ON directory_people(company_id);
CREATE INDEX IF NOT EXISTS idx_dir_people_auth     ON directory_people(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_dir_people_member   ON directory_people(member_id);
CREATE INDEX IF NOT EXISTS idx_dir_people_status   ON directory_people(status);
CREATE INDEX IF NOT EXISTS idx_dir_people_verif    ON directory_people(verification);

COMMENT ON TABLE directory_people IS
  'Person profile. Public at /people/:slug. auth_user_id is nullable so admins can publish profiles for non-users.';

CREATE OR REPLACE TRIGGER trg_dir_people_touch
  BEFORE UPDATE ON directory_people
  FOR EACH ROW EXECUTE FUNCTION directory_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 1b. SLUG COLLISION WITH COMPANIES — the decision, and its known asymmetry
--
-- DECIDED: a person slug must ALSO be unique against directory_companies.slug.
--
-- Why, when /people/:slug is namespaced and cannot actually collide today:
-- src/main.jsx ends with `<Route path="/:slug" element={<SourcingCompanyV2 />} />`.
-- That bare catch-all says the root namespace belongs to directory entities. The
-- moment anyone wants /tim-struck to resolve, a slug that means two things is a
-- bug — and by then the URLs are live and renaming them is a public break. One
-- index-shaped constraint now is cheaper than a rename later.
--
-- HOW IT IS ENFORCED, and what it does NOT cover:
-- A UNIQUE constraint cannot span two tables, so this is a BEFORE INSERT/UPDATE
-- trigger on directory_people. It is ONE-DIRECTIONAL by necessity: the mirror
-- trigger would have to be created ON directory_companies, and this migration
-- is forbidden from altering an existing table. So:
--
--     a new PERSON cannot take an existing COMPANY's slug   <- enforced here
--     a new COMPANY can still take an existing PERSON's slug <- NOT enforced
--
-- The second half is a two-line trigger on directory_companies. It is
-- deliberately left for a human-gated migration alongside 028. Until then, the
-- company insert path should call the check itself. Written up in
-- docs/schema/profiles.md so the next person does not discover it in prod.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION directory_people_slug_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    RAISE EXCEPTION 'directory_people.slug cannot be blank';
  END IF;

  IF NEW.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'directory_people.slug % must be lowercase kebab-case (a-z, 0-9, single hyphens)', NEW.slug;
  END IF;

  IF EXISTS (SELECT 1 FROM directory_companies c WHERE c.slug = NEW.slug) THEN
    RAISE EXCEPTION 'slug % is already used by an organization; person and organization slugs share the root URL namespace', NEW.slug
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_dir_people_slug_guard
  BEFORE INSERT OR UPDATE OF slug ON directory_people
  FOR EACH ROW EXECUTE FUNCTION directory_people_slug_guard();


-- ---------------------------------------------------------------------------
-- 1c. THE TWO HELPERS THAT READ directory_people
--
-- They live here, and not up in §0 with the others, because a LANGUAGE sql
-- body is parsed AND analysed when the function is created. Defining them
-- before the table exists aborts the whole transaction. Ordering is the fix;
-- switching them to plpgsql would only defer the error to the first call.
-- ---------------------------------------------------------------------------

-- Who may write a person record.
--
--   auth_user_id IS NOT NULL  -> a real user owns this profile. Only they and
--                                admins may write it. A colleague at the same
--                                company may NOT edit a person's own profile.
--   auth_user_id IS NULL      -> an admin created this profile for someone who
--                                is not a user. Approved members of that
--                                person's company may maintain it.
CREATE OR REPLACE FUNCTION directory_can_edit_person(p_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT directory_is_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM directory_people p
        WHERE p.id = p_person_id
          AND (
            (p.auth_user_id IS NOT NULL AND p.auth_user_id = auth.uid())
            OR (p.auth_user_id IS NULL AND directory_is_approved_company_member(p.company_id))
          )
      );
$$;

-- Is this person's record public? Used by the child tables' read policies so a
-- child row can never out-live its parent's visibility.
CREATE OR REPLACE FUNCTION directory_person_is_public(p_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM directory_people p
    WHERE p.id = p_person_id AND p.status = 'active'
  );
$$;


-- ---------------------------------------------------------------------------
-- 2. PERSON CHILD TABLES
--
-- Normalized, not jsonb. Binding decision: the admin panel has to edit, verify
-- and COUNT these individually. A jsonb blob makes "how many capabilities exist
-- across the platform" — a number printed on the admin dashboard — unanswerable
-- without unnesting every row.
-- ---------------------------------------------------------------------------

-- CAPABILITIES card. The design lists ten and states a total of twelve, so the
-- read RPC caps the list and returns the true count separately.
CREATE TABLE IF NOT EXISTS directory_person_capabilities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id  uuid NOT NULL REFERENCES directory_people(id) ON DELETE CASCADE,
  name       text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, name)
);
CREATE INDEX IF NOT EXISTS idx_dir_person_caps_person
  ON directory_person_capabilities(person_id, sort_order);

CREATE OR REPLACE TRIGGER trg_dir_person_caps_touch
  BEFORE UPDATE ON directory_person_capabilities
  FOR EACH ROW EXECUTE FUNCTION directory_touch_updated_at();

-- "WHAT I'M LOOKING FOR" — two columns, one table.
--   kind='seeking'   -> the I'M SEEKING column
--   kind='providing' -> the I CAN PROVIDE column
CREATE TABLE IF NOT EXISTS directory_person_needs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id  uuid NOT NULL REFERENCES directory_people(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('seeking','providing')),
  label      text NOT NULL,
  detail     text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dir_person_needs_person
  ON directory_person_needs(person_id, kind, sort_order);

CREATE OR REPLACE TRIGGER trg_dir_person_needs_touch
  BEFORE UPDATE ON directory_person_needs
  FOR EACH ROW EXECUTE FUNCTION directory_touch_updated_at();

-- AFFILIATIONS card. org_logo_url is per-affiliation because an affiliation is
-- often to an organization that has no directory_companies row at all
-- (a university, a state authority, a council).
CREATE TABLE IF NOT EXISTS directory_person_affiliations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id    uuid NOT NULL REFERENCES directory_people(id) ON DELETE CASCADE,
  company_id   uuid REFERENCES directory_companies(id) ON DELETE SET NULL,
  org_name     text NOT NULL,
  org_logo_url text,
  role         text,
  is_current   boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dir_person_affil_person
  ON directory_person_affiliations(person_id, sort_order);

CREATE OR REPLACE TRIGGER trg_dir_person_affil_touch
  BEFORE UPDATE ON directory_person_affiliations
  FOR EACH ROW EXECUTE FUNCTION directory_touch_updated_at();

-- EXPERIENCE tab. Dates are `date`, not text, so "current role" and ordering
-- are computable rather than parsed out of a display string.
CREATE TABLE IF NOT EXISTS directory_person_experience (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   uuid NOT NULL REFERENCES directory_people(id) ON DELETE CASCADE,
  company_id  uuid REFERENCES directory_companies(id) ON DELETE SET NULL,
  org_name    text NOT NULL,
  title       text,
  description text,
  location    text,
  start_date  date,
  end_date    date,
  is_current  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_dir_person_exp_person
  ON directory_person_experience(person_id, sort_order);

CREATE OR REPLACE TRIGGER trg_dir_person_exp_touch
  BEFORE UPDATE ON directory_person_experience
  FOR EACH ROW EXECUTE FUNCTION directory_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 3. COMPANY CHILD TABLES
-- ---------------------------------------------------------------------------

-- "LOOKING FOR" card. Same two-column shape as the person card.
CREATE TABLE IF NOT EXISTS directory_company_needs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES directory_companies(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('seeking','providing')),
  label      text NOT NULL,
  detail     text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dir_company_needs_company
  ON directory_company_needs(company_id, kind, sort_order);

CREATE OR REPLACE TRIGGER trg_dir_company_needs_touch
  BEFORE UPDATE ON directory_company_needs
  FOR EACH ROW EXECUTE FUNCTION directory_touch_updated_at();

-- LOCATIONS card. label = "Launch Complex 1", place = "Mahia, New Zealand".
-- state_code drives the US map highlight; a location outside the US simply has
-- none and is listed beside the map rather than pinned into the wrong ocean.
CREATE TABLE IF NOT EXISTS directory_company_locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES directory_companies(id) ON DELETE CASCADE,
  label           text NOT NULL,
  place           text,
  city            text,
  state_code      text,
  country_code    text,
  is_headquarters boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dir_company_loc_company
  ON directory_company_locations(company_id, sort_order);

CREATE OR REPLACE TRIGGER trg_dir_company_loc_touch
  BEFORE UPDATE ON directory_company_locations
  FOR EACH ROW EXECUTE FUNCTION directory_touch_updated_at();

-- CAPABILITIES card. name AND subtitle, because the design shows both:
-- "Launch Services" / "Small satellite launch".
CREATE TABLE IF NOT EXISTS directory_company_capabilities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES directory_companies(id) ON DELETE CASCADE,
  name       text NOT NULL,
  subtitle   text,
  icon       text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE INDEX IF NOT EXISTS idx_dir_company_caps_company
  ON directory_company_capabilities(company_id, sort_order);

CREATE OR REPLACE TRIGGER trg_dir_company_caps_touch
  BEFORE UPDATE ON directory_company_capabilities
  FOR EACH ROW EXECUTE FUNCTION directory_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 4. directory_mission_scores — ONE table, BOTH entity types
--
-- Nothing anywhere in this database stores a mission score. The six missions
-- exist (directory_tags, category='market_goal', 6 rows). The alignment number
-- printed beside each bar on both profile screens has never had a home.
--
-- Polymorphic on purpose: the person screen and the company screen render the
-- identical component against the identical six tags. Two tables would mean two
-- of every query, two admin editors, and two places for the scale to drift.
-- entity_id therefore carries no FK — the CHECK on entity_type plus the read
-- RPCs' own filtering is the integrity story, and orphan rows are inert.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS directory_mission_scores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('person','company')),
  entity_id   uuid NOT NULL,
  tag_id      uuid NOT NULL REFERENCES directory_tags(id) ON DELETE CASCADE,
  score       integer NOT NULL CHECK (score >= 0 AND score <= 100),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_dir_mission_scores_entity
  ON directory_mission_scores(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dir_mission_scores_tag
  ON directory_mission_scores(tag_id);

COMMENT ON TABLE directory_mission_scores IS
  'Mission alignment 0-100 for a person or a company against a directory_tags market_goal row. The only home this number has ever had.';

CREATE OR REPLACE TRIGGER trg_dir_mission_scores_touch
  BEFORE UPDATE ON directory_mission_scores
  FOR EACH ROW EXECUTE FUNCTION directory_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 5. directory_company_profile — the enrichment side table
--
-- WHY A SIDE TABLE AND NOT COLUMNS ON directory_companies:
-- directory_companies already exists with 166 live rows and this migration is
-- forbidden from running ALTER TABLE against it. Adding linkedin_url, org_type,
-- naics_code and the six relationship counts as columns would be an ALTER of an
-- existing table. So they live here, keyed 1:1 on company_id.
--
-- This is not a workaround that costs anything: directory_companies is the
-- listing record (name, slug, status, membership, billing) and this is the
-- profile-screen record. Keeping them apart also means the read RPC can select
-- an explicit column list from directory_companies and never come near the
-- stripe/membership columns sitting on it.
--
-- `verification` lives here because the admin dashboard's donut
-- (Verified / Pending Review / Unverified / Rejected) needs a status column and
-- the live tables have none. Additive; directory_companies is untouched.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS directory_company_profile (
  company_id         uuid PRIMARY KEY REFERENCES directory_companies(id) ON DELETE CASCADE,

  linkedin_url       text,
  org_type           text,   -- "Private Company", "Research Institution", ...
  naics_code         text,   -- free text: the design prints "336414, 336414, 541330"
  headquarters_label text,   -- "Long Beach, CA, USA" as printed in AT A GLANCE

  -- The sub-name category line and the pill row. Display chips, not records the
  -- admin panel counts one by one — see the same note on directory_people.
  categories         text[] NOT NULL DEFAULT '{}',
  focus_areas        text[] NOT NULL DEFAULT '{}',

  -- WHO WE WORK WITH: the six counts, exactly as the card prints them.
  -- Stored, not derived: there is no relationship graph in this database yet,
  -- and a card that silently renders zeros is worse than one an owner filled in.
  suppliers_count    integer NOT NULL DEFAULT 0 CHECK (suppliers_count    >= 0),
  partners_count     integer NOT NULL DEFAULT 0 CHECK (partners_count     >= 0),
  customers_count    integer NOT NULL DEFAULT 0 CHECK (customers_count    >= 0),
  universities_count integer NOT NULL DEFAULT 0 CHECK (universities_count >= 0),
  gov_programs_count integer NOT NULL DEFAULT 0 CHECK (gov_programs_count >= 0),
  investors_count    integer NOT NULL DEFAULT 0 CHECK (investors_count    >= 0),

  verification       text NOT NULL DEFAULT 'unverified'
                     CHECK (verification IN ('unverified','pending','verified','rejected')),
  verified_at        timestamptz,
  verified_by        uuid,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dir_company_profile_verif
  ON directory_company_profile(verification);

COMMENT ON TABLE directory_company_profile IS
  'Profile-screen enrichment for directory_companies, 1:1 on company_id. A SIDE TABLE because directory_companies already exists and this migration may not ALTER it.';

CREATE OR REPLACE TRIGGER trg_dir_company_profile_touch
  BEFORE UPDATE ON directory_company_profile
  FOR EACH ROW EXECUTE FUNCTION directory_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
--
-- Every table above gets RLS enabled AND an explicit policy set, in this same
-- migration. A table with RLS on and no policy is invisible to everyone except
-- service_role, which reads as "the feature is broken" rather than as "denied".
--
-- Shape:
--   SELECT  — anon + authenticated, restricted to rows whose parent record is
--             public (person status='active' / company status='active').
--   WRITE   — the three helper functions from §0. No policy grants writes to
--             anon. service_role bypasses RLS entirely and is unaffected.
--
-- Guarded by pg_policies because PostgreSQL 17 still has no
-- CREATE POLICY IF NOT EXISTS.
-- ---------------------------------------------------------------------------

ALTER TABLE directory_people                ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_person_capabilities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_person_needs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_person_affiliations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_person_experience     ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_company_needs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_company_locations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_company_capabilities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_mission_scores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_company_profile       ENABLE ROW LEVEL SECURITY;

DO $policies$
DECLARE
  r record;
BEGIN
  -- ---- directory_people -------------------------------------------------
  FOR r IN
    SELECT * FROM (VALUES
      ('directory_people', 'people public read active', 'SELECT',
       $q$status = 'active'$q$, NULL),
      ('directory_people', 'people owner or admin write', 'ALL',
       $q$directory_is_platform_admin()
          OR (auth_user_id IS NOT NULL AND auth_user_id = auth.uid())
          OR (auth_user_id IS NULL AND directory_is_approved_company_member(company_id))$q$,
       $q$directory_is_platform_admin()
          OR (auth_user_id IS NOT NULL AND auth_user_id = auth.uid())
          OR (auth_user_id IS NULL AND directory_is_approved_company_member(company_id))$q$)
    ) AS t(tbl, pol, cmd, using_expr, check_expr)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = r.tbl AND policyname = r.pol) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR %s TO anon, authenticated USING (%s)%s',
        r.pol, r.tbl, r.cmd, r.using_expr,
        CASE WHEN r.check_expr IS NULL THEN '' ELSE ' WITH CHECK (' || r.check_expr || ')' END
      );
    END IF;
  END LOOP;

  -- ---- person child tables ----------------------------------------------
  FOR r IN
    SELECT * FROM (VALUES
      ('directory_person_capabilities'),
      ('directory_person_needs'),
      ('directory_person_affiliations'),
      ('directory_person_experience')
    ) AS t(tbl)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='public' AND tablename=r.tbl AND policyname='public read when person is public') THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (directory_person_is_public(person_id))',
        'public read when person is public', r.tbl);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='public' AND tablename=r.tbl AND policyname='person editors write') THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO anon, authenticated USING (directory_can_edit_person(person_id)) WITH CHECK (directory_can_edit_person(person_id))',
        'person editors write', r.tbl);
    END IF;
  END LOOP;

  -- ---- company child tables + the profile side table ---------------------
  FOR r IN
    SELECT * FROM (VALUES
      ('directory_company_needs'),
      ('directory_company_locations'),
      ('directory_company_capabilities'),
      ('directory_company_profile')
    ) AS t(tbl)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='public' AND tablename=r.tbl AND policyname='public read when company is public') THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (directory_company_is_public(company_id))',
        'public read when company is public', r.tbl);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='public' AND tablename=r.tbl AND policyname='approved members or admin write') THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO anon, authenticated USING (directory_is_platform_admin() OR directory_is_approved_company_member(company_id)) WITH CHECK (directory_is_platform_admin() OR directory_is_approved_company_member(company_id))',
        'approved members or admin write', r.tbl);
    END IF;
  END LOOP;

  -- ---- directory_mission_scores (polymorphic) ----------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='directory_mission_scores'
                   AND policyname='mission scores public read') THEN
    CREATE POLICY "mission scores public read"
      ON directory_mission_scores FOR SELECT TO anon, authenticated
      USING (
        (entity_type = 'person'  AND directory_person_is_public(entity_id))
        OR (entity_type = 'company' AND directory_company_is_public(entity_id))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='directory_mission_scores'
                   AND policyname='mission scores editors write') THEN
    CREATE POLICY "mission scores editors write"
      ON directory_mission_scores FOR ALL TO anon, authenticated
      USING (
        directory_is_platform_admin()
        OR (entity_type = 'person'  AND directory_can_edit_person(entity_id))
        OR (entity_type = 'company' AND directory_is_approved_company_member(entity_id))
      )
      WITH CHECK (
        directory_is_platform_admin()
        OR (entity_type = 'person'  AND directory_can_edit_person(entity_id))
        OR (entity_type = 'company' AND directory_is_approved_company_member(entity_id))
      );
  END IF;
END
$policies$;


-- ---------------------------------------------------------------------------
-- 7. GRANTS
--
-- RLS decides WHICH rows. Table grants decide whether PostgREST will look at
-- the table at all. Without these, every read returns 42501 regardless of policy.
-- ---------------------------------------------------------------------------
GRANT SELECT ON
  directory_people,
  directory_person_capabilities,
  directory_person_needs,
  directory_person_affiliations,
  directory_person_experience,
  directory_company_needs,
  directory_company_locations,
  directory_company_capabilities,
  directory_mission_scores,
  directory_company_profile
TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON
  directory_people,
  directory_person_capabilities,
  directory_person_needs,
  directory_person_affiliations,
  directory_person_experience,
  directory_company_needs,
  directory_company_locations,
  directory_company_capabilities,
  directory_mission_scores,
  directory_company_profile
TO authenticated;

COMMIT;
