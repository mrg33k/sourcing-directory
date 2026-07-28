-- Migration 028: RLS hardening + never-applied directory_reports columns
--
-- Closes four DB-layer problems:
--   (1) directory_members  — "service role all" FOR ALL USING (true) grants every
--                            role (anon included) full read+write. Plus 011's
--                            "signup insert members" INSERT WITH CHECK (true),
--                            which is the same hole for writes.
--   (2) directory_reports  — 014 (is_premium) and 016 (updated_at/updated_by) were
--                            never applied to prod, so api/sourcing/admin-reports.js
--                            500s on every call. created_by is selected+inserted by
--                            that same handler and was never declared anywhere.
--   (3) directory_analytics— anonymous SELECT USING (true) makes view counts and
--                            search queries publicly enumerable. Anonymous INSERT
--                            is kept (the browser writes page events fire-and-forget).
--   (4) directory_reports  — the access-value mismatch ('free' vs 'public') and
--                            "service full access reports" FOR ALL USING (true).
--
-- READ docs/security/028-impact-analysis.md BEFORE APPLYING. Section 4B below is a
-- VISIBLE PRODUCT CHANGE on os.spacerising.org and has a documented defer option.
--
-- Idempotent: every object is IF NOT EXISTS / OR REPLACE, and every CREATE POLICY is
-- preceded by DROP POLICY IF EXISTS. Safe to run twice.
--
-- NOTE ON service_role: dropping the policies named "service role all" / "service
-- full access reports" does NOT affect the service_role key. In Supabase, service_role
-- is a BYPASSRLS Postgres role — it never consults policies at all. Those policies
-- were only ever granting access to anon and authenticated. Every server-side handler
-- in api/sourcing/*.js and every adminSupabase call in src/pages/ uses the service key
-- and is therefore unaffected by this migration.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — Predicate helpers
-- ═══════════════════════════════════════════════════════════════════════════════
-- A policy on directory_members cannot query directory_members inline: PostgreSQL
-- raises "infinite recursion detected in policy for relation". These SECURITY DEFINER
-- helpers run as the function owner, so the inner read bypasses RLS and terminates.
--
-- Each helper is STABLE, takes only a tenant/company id, and answers exclusively about
-- the CURRENT caller (auth.uid() / the request JWT). None of them can be coerced into
-- returning another user's data. search_path is pinned so a rogue schema on the caller's
-- path cannot shadow the referenced tables — this is mandatory for SECURITY DEFINER.

-- Global admin: the role lives in the JWT's app_metadata claim.
-- (SourcingAdmin.jsx reads user.app_metadata.role; migration 017 checks the TOP-LEVEL
--  `role` claim, which in a Supabase JWT is the Postgres role — 'authenticated' — and
--  therefore never matches. See the hand-off note in the impact analysis.)
CREATE OR REPLACE FUNCTION public.dir_is_global_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- Caller is an approved admin member of this tenant.
CREATE OR REPLACE FUNCTION public.dir_is_tenant_admin(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_tenant_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.directory_members m
    WHERE m.tenant_id    = p_tenant_id
      AND m.auth_user_id = auth.uid()
      AND m.role         = 'admin'
      AND m.status       = 'approved'
  );
$$;

-- Caller is an approved member (any role) of this tenant.
CREATE OR REPLACE FUNCTION public.dir_is_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_tenant_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.directory_members m
    WHERE m.tenant_id    = p_tenant_id
      AND m.auth_user_id = auth.uid()
      AND m.status       = 'approved'
  );
$$;

-- Caller may attach this company_id to their own member row.
--
-- This mirrors EXACTLY what the browser auto-provision code already does before it
-- inserts: SourcingPortalV2.jsx:120-124, SourcingLoginV2.jsx:141-145,
-- SourcingPortal.jsx:80-84 and SourcingLogin.jsx:126-131 all resolve company_id with
--     directory_companies.select('id').eq('email', authUser.email).eq('tenant_id', …)
-- The check below is case-insensitive where the client is exact-match, so it is
-- strictly MORE permissive than the client path and cannot reject a company_id the
-- client is capable of producing. It does stop a hand-rolled request from claiming an
-- arbitrary company_id (which today grants write access to that company's profile via
-- api/sourcing/update-company.js and its deal-bank listing via
-- api/sourcing/update-deal-bank-listing.js).
CREATE OR REPLACE FUNCTION public.dir_may_claim_company(p_company_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_company_id IS NULL OR EXISTS (
    SELECT 1
    FROM public.directory_companies c
    WHERE c.id        = p_company_id
      AND c.tenant_id = p_tenant_id
      AND lower(c.email) = lower(auth.jwt() ->> 'email')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.dir_is_global_admin()                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dir_is_tenant_admin(uuid)              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dir_is_tenant_member(uuid)             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dir_may_claim_company(uuid, uuid)      FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.dir_is_global_admin()             TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dir_is_tenant_admin(uuid)         TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dir_is_tenant_member(uuid)        TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dir_may_claim_company(uuid, uuid) TO anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — directory_reports: the never-applied columns  [problem 2]
-- ═══════════════════════════════════════════════════════════════════════════════
-- api/sourcing/admin-reports.js:22-23 selects
--   id, tenant_id, title, description, category, access, file_url, cover_image_url,
--   is_premium, published_at, created_at, updated_at, created_by, updated_by
-- and line 224 inserts created_by + updated_by. Any column missing in prod makes
-- PostgREST reject the whole request, so every GET/POST/PUT on that endpoint 500s.
--
-- Folded in from 014 (is_premium) and 016 (updated_at, updated_by). created_at (012)
-- and cover_image_url (supabase/migrations/20260723150000) are re-asserted defensively
-- — both are no-ops if already applied. created_by has NO migration anywhere in the
-- repo and is added here for the first time.

ALTER TABLE directory_reports
  ADD COLUMN IF NOT EXISTS is_premium      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by      uuid,
  ADD COLUMN IF NOT EXISTS created_by      uuid,
  ADD COLUMN IF NOT EXISTS created_at      timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS cover_image_url text;

CREATE INDEX IF NOT EXISTS idx_dir_reports_is_premium ON directory_reports(is_premium);

-- Match 012: the admin UI writes 'public' | 'members' | 'paid', not the original 'free'.
ALTER TABLE directory_reports ALTER COLUMN access SET DEFAULT 'public';

-- Backfill updated_at from created_at (016 line 7). Idempotent — only touches NULLs.
UPDATE directory_reports SET updated_at = created_at WHERE updated_at IS NULL;

-- FK on updated_by / created_by -> auth.users, as declared in 016.
-- Guarded twice: skipped if the constraint already exists, and skipped (with a NOTICE
-- rather than a transaction-aborting error) if prod somehow holds orphan values.
-- ON DELETE SET NULL so removing an admin auth user never blocks the delete.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.directory_reports'::regclass
      AND conname  = 'directory_reports_updated_by_fkey'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM directory_reports r
      WHERE r.updated_by IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.updated_by)
    ) THEN
      RAISE NOTICE 'SKIPPED directory_reports_updated_by_fkey: orphan updated_by values present. Clean them, then re-run.';
    ELSE
      ALTER TABLE directory_reports
        ADD CONSTRAINT directory_reports_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.directory_reports'::regclass
      AND conname  = 'directory_reports_created_by_fkey'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM directory_reports r
      WHERE r.created_by IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.created_by)
    ) THEN
      RAISE NOTICE 'SKIPPED directory_reports_created_by_fkey: orphan created_by values present. Clean them, then re-run.';
    ELSE
      ALTER TABLE directory_reports
        ADD CONSTRAINT directory_reports_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — directory_members: close the anon read+write hole  [problem 1]
-- ═══════════════════════════════════════════════════════════════════════════════
-- Removed here:
--   006:25  "service role all"        FOR ALL    USING (true)         -- anon read+write
--   011:25  "signup insert members"   FOR INSERT WITH CHECK (true)    -- anon write
--   006:24  "members read own"        FOR SELECT USING (auth.uid() = auth_user_id)
--                                     -- superseded by members_select_own below,
--                                        which is identical but scoped TO authenticated
--
-- Dropping "service role all" alone would be cosmetic: 011's INSERT policy leaves the
-- write side wide open on its own. Both must go together.
--
-- Live code that MUST keep working, and does (verified caller by caller):
--   * SourcingPortalV2.jsx:104-146   read own + auto-provision  -> members_select_own,
--                                                                  members_insert_self
--   * SourcingLoginV2.jsx:130-172    read own + auto-provision  -> same
--   * SourcingPortal.jsx:69-100      read own + auto-provision  -> same (V1)
--   * SourcingLogin.jsx:110-150      read own + auto-provision  -> same (V1)
--   * SourcingSignupComplete.jsx:32  read own                   -> members_select_own
--   * SourcingMarketplace.jsx:186    read own                   -> members_select_own
--   * SourcingReports.jsx:90         read own                   -> members_select_own
--   * SourcingAdmin.jsx:167/200/458  service_role (adminSupabase) -> bypasses RLS
--   * admin/MembersSection.jsx:28/38/63/80  service_role         -> bypasses RLS
--   * api/sourcing/signup.js:175, admin-setup.js, update-company.js,
--     update-deal-bank-listing.js, deal-bank-listing.js, upload-deal-bank-deck.js,
--     withdraw-deal-bank-listing.js, lib/membership.js, scripts/provision-tenant-admins.mjs
--                                    all service_role            -> bypass RLS

ALTER TABLE directory_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role all"           ON directory_members;
DROP POLICY IF EXISTS "signup insert members"      ON directory_members;
DROP POLICY IF EXISTS "members read own"           ON directory_members;
DROP POLICY IF EXISTS "members_select_own"         ON directory_members;
DROP POLICY IF EXISTS "members_select_tenant_admin" ON directory_members;
DROP POLICY IF EXISTS "members_insert_self"        ON directory_members;
DROP POLICY IF EXISTS "members_update_tenant_admin" ON directory_members;
DROP POLICY IF EXISTS "members_delete_tenant_admin" ON directory_members;

-- A signed-in user reads their own member row. Nothing else.
CREATE POLICY "members_select_own"
  ON directory_members FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Tenant admins (and global admins) read the member roster for their tenant.
-- Not exercised today — SourcingAdmin.jsx uses the service key — but it is the
-- prerequisite for removing that key from the browser bundle without breaking the
-- admin panel. See the hand-off section of the impact analysis.
CREATE POLICY "members_select_tenant_admin"
  ON directory_members FOR SELECT
  TO authenticated
  USING (public.dir_is_tenant_admin(tenant_id) OR public.dir_is_global_admin());

-- Browser auto-provision. Preserves today's behaviour exactly (role 'member',
-- status 'approved') while blocking three escalations the old WITH CHECK (true) allowed:
--   * inserting a row for somebody else's auth_user_id
--   * self-promoting to role = 'admin'
--   * claiming an arbitrary company_id (-> write access to that company)
--
-- DELIBERATE, FLAGGED: status = 'approved' is still self-grantable, because the four
-- auto-provision call sites hard-code it and forcing 'pending' would strand every
-- returning user on the "pending review" screen. This is a product decision, not a
-- schema one — see problem 1, open question A in the impact analysis.
CREATE POLICY "members_insert_self"
  ON directory_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid()
    AND role   = 'member'
    AND status IN ('pending', 'approved')
    AND public.dir_may_claim_company(company_id, tenant_id)
  );

-- Approve / reject / role changes and removals, for tenant + global admins.
-- Same rationale as members_select_tenant_admin: unused while the service key is in
-- the bundle, required the moment it is pulled.
CREATE POLICY "members_update_tenant_admin"
  ON directory_members FOR UPDATE
  TO authenticated
  USING      (public.dir_is_tenant_admin(tenant_id) OR public.dir_is_global_admin())
  WITH CHECK (public.dir_is_tenant_admin(tenant_id) OR public.dir_is_global_admin());

CREATE POLICY "members_delete_tenant_admin"
  ON directory_members FOR DELETE
  TO authenticated
  USING (public.dir_is_tenant_admin(tenant_id) OR public.dir_is_global_admin());

-- DELIBERATE: no self-UPDATE and no self-DELETE policy. No browser code path updates
-- or deletes a member row with the anon key — every such call in src/pages/ goes
-- through adminSupabase (service_role). Adding one would widen the surface for nothing.


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — directory_analytics: keep anon INSERT, revoke anon SELECT  [problem 3]
-- ═══════════════════════════════════════════════════════════════════════════════
-- Removed here:
--   007:37  "service read analytics"  FOR SELECT USING (true)  -- anon can enumerate
--                                                                 every page view,
--                                                                 profile view and
--                                                                 search query
-- Kept (recreated under an explicit name and role list):
--   007:36  "public insert analytics" FOR INSERT WITH CHECK (true)
--
-- src/pages/sourcingAnalytics.js:15 writes with the anon key, fire-and-forget, from
-- logged-out visitors. That must keep working. Call sites: SourcingDirectory.jsx:527,
-- 536, 710 and SourcingProfile.jsx:651, 914.

ALTER TABLE directory_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public insert analytics"         ON directory_analytics;
DROP POLICY IF EXISTS "service read analytics"          ON directory_analytics;
DROP POLICY IF EXISTS "analytics_public_insert"         ON directory_analytics;
DROP POLICY IF EXISTS "analytics_select_tenant_admin"   ON directory_analytics;

-- Unchanged in effect: anonymous, unauthenticated event writes.
CREATE POLICY "analytics_public_insert"
  ON directory_analytics FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Reads are now admin-only. SourcingAdmin.jsx:287-306 uses service_role today and is
-- unaffected; this policy is what keeps it working after the key is pulled.
CREATE POLICY "analytics_select_tenant_admin"
  ON directory_analytics FOR SELECT
  TO authenticated
  USING (public.dir_is_tenant_admin(tenant_id) OR public.dir_is_global_admin());

-- ACCEPTED RISK, NOT CLOSED HERE: WITH CHECK (true) still lets anyone forge analytics
-- rows against any tenant_id and inflate counts. Constraining it would require either
-- a signed server-side ingest endpoint or a CHECK on event_type — both are code
-- changes outside this migration. Noted in the impact analysis as follow-up work.


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4A — directory_reports: fix the access-value mismatch  [problem 4]
-- ═══════════════════════════════════════════════════════════════════════════════
-- The mismatch runs BOTH ways, which is why pinning the policy to either single
-- literal leaves rows dark:
--   * 008:18 shipped        USING (access = 'free')
--   * 013 "fixed" it to     USING (access = 'public')
--   * admin-reports.js:10   VALID_ACCESS = ['free','member','members','paid','public']
--   * admin-reports.js:205  defaults a new report to access = 'free'
--   * ReportsSection.jsx:92 posts access: reportForm.access || 'free'
--   * SourcingReportDetailV2.jsx:151 and OSReportsPage.jsx:97 both treat 'free' and
--     'public' as the same free tier
-- So free-tier rows exist under BOTH literals in prod and the policy must accept both.
-- access IS NULL is included because the app treats a null access as free
-- (SourcingReportDetailV2.jsx:151 `|| !report.access`).

ALTER TABLE directory_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read free reports"     ON directory_reports;
DROP POLICY IF EXISTS "public read public reports"   ON directory_reports;
DROP POLICY IF EXISTS "service full access reports"  ON directory_reports;
DROP POLICY IF EXISTS "reports_public_read"          ON directory_reports;
DROP POLICY IF EXISTS "reports_member_read"          ON directory_reports;

CREATE POLICY "reports_public_read"
  ON directory_reports FOR SELECT
  TO anon, authenticated
  USING (
    access IS NULL
    OR lower(btrim(access)) IN ('public', 'free')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4B — VISIBLE PRODUCT CHANGE ON os.spacerising.org. READ BEFORE APPLYING.
-- ═══════════════════════════════════════════════════════════════════════════════
-- Dropping "service full access reports" (FOR ALL USING (true)) is what actually closes
-- the leak: today any anonymous visitor can read EVERY directory_reports row including
-- file_url on members-only and paid reports, i.e. the paywalled PDFs are one anon
-- PostgREST call away. It is also the change with real product blast radius, because
-- seven pages fetch reports with `.select('*')` and NO access filter — they rely on RLS
-- to decide what comes back and then render a "Members Only" badge client-side:
--
--   src/pages/SourcingReportsV2.jsx:63       src/pages/OSReportsPage.jsx:163
--   src/pages/SpaceOSHomeV3.jsx:46           src/pages/SourcingReportDetailV2.jsx:86,112
--   src/pages/SourcingDirectory.jsx:820      src/pages/SourcingReports.jsx:147
--   src/pages/srw/SRWHomeV2.jsx:133
--
-- AFTER this migration, logged-out visitors stop seeing members-only / paid reports
-- ENTIRELY — the locked teaser cards disappear from those listings rather than
-- rendering as locked. That is the paywall conversion surface. See problem 4 in
-- docs/security/028-impact-analysis.md for the three options and the recommended
-- code hand-off (repoint those pages at GET /api/sourcing/reports, which is
-- server-side service_role and already returns the full set).
--
-- DEFER OPTION: to ship 028 without the visibility change, comment out the
-- "service full access reports" line in the DROP block of section 4A and the
-- reports_member_read policy below. Everything else in this file is then independent
-- of it. Re-run the file after the frontend hand-off lands to complete the fix.

-- Signed-in approved members of the tenant keep full visibility of that tenant's
-- reports, including members-only and paid rows.
CREATE POLICY "reports_member_read"
  ON directory_reports FOR SELECT
  TO authenticated
  USING (
    public.dir_is_tenant_member(tenant_id)
    OR public.dir_is_tenant_admin(tenant_id)
    OR public.dir_is_global_admin()
  );

-- DELIBERATE: directory_reports now has SELECT policies only — no INSERT, UPDATE or
-- DELETE policy for anon or authenticated. This is intentional and matches the code:
-- every report write already goes through service_role, which bypasses RLS.
--   * create/update -> POST/PUT /api/sourcing/admin-reports (ReportsSection.jsx:99,124)
--   * file url save -> POST /api/sourcing/upload-report      (SourcingDirectory.jsx:924)
--   * delete        -> adminSupabase.delete()                (ReportsSection.jsx:181)
--   * cleanup       -> api/sourcing/delete-blank-reports.js
-- The table is NOT left with zero policies; writes are simply service-role-only by design.
--
-- KNOWN GAP, NOT CLOSED HERE: reports_member_read exposes file_url to ANY approved
-- member of the tenant, including free-tier members, because RLS is row-level and
-- cannot mask a single column. api/sourcing/lib/reportAccess.js is the real paid gate,
-- but file_url points at the public 'sourcing-reports' storage bucket, so row access
-- equals file access. Closing it needs a private bucket + signed URLs — flagged as
-- follow-up in the impact analysis.

COMMIT;
