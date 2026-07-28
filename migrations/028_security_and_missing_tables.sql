-- Migration 028: RLS hardening + never-applied directory_reports columns
--
-- ╔═══════════════════════════════════════════════════════════════════════════════╗
-- ║  WHAT HAPPENS IF YOU RUN THIS FILE RIGHT NOW                                  ║
-- ║                                                                               ║
-- ║    PART 1 RUNS.        Security fixes. ZERO visible change to the live site.  ║
-- ║    PART 2 DOES NOT.    Guarded off. It is the one change users would notice.  ║
-- ║                                                                               ║
-- ║  The switch is a single literal on the `run_part_2 boolean := false;` line    ║
-- ║  inside the PART 2 block at the bottom of this file. Nothing else toggles it. ║
-- ╚═══════════════════════════════════════════════════════════════════════════════╝
--
-- ── PART 1 — URGENT, SHIP TODAY. No visible product change. ──────────────────────
--   §0  SECURITY DEFINER predicate helpers (dir_is_global_admin, dir_is_tenant_admin,
--       dir_is_tenant_member, dir_may_claim_company)
--   §1  directory_reports: the columns 014 + 016 never applied, plus created_by which
--       was never authored anywhere. Un-breaks api/sourcing/admin-reports.js, which
--       500s on every call today.
--   §2  directory_members: CLOSE THE LIVE HOLE. Confirmed against production — an
--       anonymous caller holding only the public anon key reads all 70 member rows
--       (email, full_name, role, status, auth_user_id; HTTP 206, content-range
--       0-0/70). The same permissive policies allow anon INSERT, so anyone can write
--       themselves a row with role='admin', status='approved', auth_user_id=<their
--       own uid>. That defeats BOTH the new client guard (src/hooks/useAdmin.js) AND
--       the new server-side requireAdmin() (api/sourcing/lib/adminAuth.js:84-89,
--       which grants tenant-admin reach off exactly such a row). Highest-value change
--       in this file.
--   §3  directory_analytics: revoke anonymous SELECT. Anonymous INSERT is kept — the
--       browser writes page events fire-and-forget from logged-out visitors.
--   §4  directory_companies: supersede migration 017's admin policy. 017:6 and 017:17
--       test (auth.jwt() ->> 'role') = 'admin', which reads the TOP-LEVEL JWT role
--       claim — in Supabase that is the Postgres role ('authenticated'), never
--       'admin'. That branch has never matched once. Corrected here to
--       (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', which is what the app
--       actually reads. 017 is already applied, so editing 017 in place fixes nothing.
--
-- ── PART 2 — DEFERRED. REQUIRES FRONTEND WORK FIRST. DO NOT RUN YET. ─────────────
--   §5  directory_reports read policies: dropping "service full access reports"
--       (FOR ALL USING (true)) and adding reports_member_read, plus the access-value
--       default. This is what finally stops anonymous callers reading members-only and
--       paid reports — AND it is a VISIBLE PRODUCT CHANGE on os.spacerising.org.
--       Seven pages fetch reports with .select('*') and no access filter; they lean on
--       RLS to decide what comes back and then draw a client-side "Members Only" badge:
--         src/pages/SourcingReportsV2.jsx:63        src/pages/OSReportsPage.jsx:163
--         src/pages/SpaceOSHomeV3.jsx:46            src/pages/SourcingReportDetailV2.jsx:86, :112
--         src/pages/SourcingDirectory.jsx:820       src/pages/SourcingReports.jsx:147
--         src/pages/srw/SRWHomeV2.jsx:133
--       Run Part 2 and those locked teaser cards do not render as locked — they vanish
--       for logged-out visitors. That is the paywall conversion surface. Repoint those
--       seven pages at GET /api/sourcing/reports first (option B in the impact
--       analysis), then flip the switch and re-run this file.
--
-- READ docs/security/028-impact-analysis.md BEFORE APPLYING.
--
--   Pre-flight (read-only): node --env-file=.env.prod.local scripts/run-migration-028.mjs --check
--   Apply Part 1:           node --env-file=.env.prod.local scripts/run-migration-028.mjs --apply
--
-- KNOWN FALSE ALARM, PART 1 ONLY: scripts/run-migration-028.mjs post-checks for
-- 'service full access reports' and 'public read free reports' being gone. Those belong
-- to Part 2, so a correct Part-1-only apply prints "POST-CONDITION FAILURES: policy
-- directory_reports."service full access reports" still present" and exits 1. The
-- transaction has already COMMITTED at that point and production is fine. That script is
-- outside this change's file scope; the exact one-line patch is hand-off request #1 in
-- docs/security/028-impact-analysis.md. Confirm the apply with the AFTER queries in the
-- doc, not with that exit code.
--
-- Idempotent: every object is IF NOT EXISTS / OR REPLACE, and every CREATE POLICY is
-- preceded by DROP POLICY IF EXISTS. Safe to run twice, and safe to re-run with Part 2
-- switched on once the frontend work lands.
--
-- NOTE ON service_role: dropping the policies named "service role all" / "service
-- full access reports" does NOT affect the service_role key. In Supabase, service_role
-- is a BYPASSRLS Postgres role — it never consults policies at all. Those policies
-- were only ever granting access to anon and authenticated. Every server-side handler
-- in api/sourcing/*.js uses the service key and is therefore unaffected by this
-- migration. src/pages/SourcingAdmin.jsx's `adminSupabase` is now the browser shim in
-- src/lib/adminApi.js, which POSTs to /api/sourcing/admin — also server-side
-- service_role. Unaffected too.

BEGIN;


-- ╔═══════════════════════════════════════════════════════════════════════════════╗
-- ║                                                                               ║
-- ║   P A R T   1   —   U R G E N T .   R U N S   B Y   D E F A U L T .           ║
-- ║   No visible change to os.spacerising.org for any visitor, member or admin.   ║
-- ║                                                                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════════╝


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — Predicate helpers                                          [PART 1]
-- ═══════════════════════════════════════════════════════════════════════════════
-- A policy on directory_members cannot query directory_members inline: PostgreSQL
-- raises "infinite recursion detected in policy for relation". These SECURITY DEFINER
-- helpers run as the function owner, so the inner read bypasses RLS and terminates.
--
-- Each helper is STABLE, takes only a tenant/company id, and answers exclusively about
-- the CURRENT caller (auth.uid() / the request JWT). None of them can be coerced into
-- returning another user's data. search_path is pinned so a rogue schema on the caller's
-- path cannot shadow the referenced tables — this is mandatory for SECURITY DEFINER.
--
-- §4 and migration 029 both depend on these existing. They are in Part 1 for that
-- reason: everything downstream of them can ship without waiting on the product call.

-- Global admin: the role lives in the JWT's app_metadata claim.
-- (SourcingAdmin.jsx reads user.app_metadata.role and api/sourcing/lib/adminAuth.js:79
--  reads user.app_metadata?.role. Migration 017 checks the TOP-LEVEL `role` claim, which
--  in a Supabase JWT is the Postgres role — 'authenticated' — and therefore has never
--  matched. §4 below supersedes it.)
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
-- SECTION 1 — directory_reports: the never-applied columns                [PART 1]
-- ═══════════════════════════════════════════════════════════════════════════════
-- Columns only. No policy on this table is touched in Part 1 — see Part 2, §5.
--
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
--
-- Why this is a no-visible-change item: adding columns cannot make anything disappear
-- from the site. It only un-breaks the admin Reports tab, which cannot save at all today.

ALTER TABLE directory_reports
  ADD COLUMN IF NOT EXISTS is_premium      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by      uuid,
  ADD COLUMN IF NOT EXISTS created_by      uuid,
  ADD COLUMN IF NOT EXISTS created_at      timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS cover_image_url text;

CREATE INDEX IF NOT EXISTS idx_dir_reports_is_premium ON directory_reports(is_premium);

-- Backfill updated_at from created_at (016 line 7). Idempotent — only touches NULLs.
UPDATE directory_reports SET updated_at = created_at WHERE updated_at IS NULL;

-- NOTE: `ALTER COLUMN access SET DEFAULT 'public'` used to live here. It moved to Part 2
-- (§5) where the rest of the access-literal question lives. It is inert either way —
-- every writer sets access explicitly (api/sourcing/admin-reports.js:201 defaults to
-- 'free' in JS, src/pages/admin/ReportsSection.jsx:92 posts `access || 'free'`, and
-- there is no other INSERT into directory_reports anywhere in api/ or src/) — but Part 1
-- promises zero product change, and that promise should need no argument to believe.

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
-- SECTION 2 — directory_members: close the anon read+write hole           [PART 1]
-- ═══════════════════════════════════════════════════════════════════════════════
-- THIS IS THE LIVE HOLE, CONFIRMED AGAINST PRODUCTION. An anonymous caller with only
-- the public anon key reads all 70 rows of directory_members — email, full_name, role,
-- status, auth_user_id — over plain HTTP (206, content-range 0-0/70). The write side is
-- open too, and that is the part that matters most: anon can INSERT a row with
-- role='admin', status='approved' and auth_user_id set to their own uid, which is
-- exactly the shape api/sourcing/lib/adminAuth.js:84-89 accepts as proof of tenant
-- admin. So the hole defeats both new guards shipped in the security round — the client
-- one (src/hooks/useAdmin.js) and the server one (requireAdmin()).
--
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
--   * SourcingAdmin.jsx:167/200/458  -> adminSupabase -> POST /api/sourcing/admin
--   * admin/MembersSection.jsx:28/38/63/80  -> same, server-side service_role
--   * api/sourcing/signup.js:175, admin-setup.js, update-company.js,
--     update-deal-bank-listing.js, deal-bank-listing.js, upload-deal-bank-deck.js,
--     withdraw-deal-bank-listing.js, lib/membership.js, lib/adminAuth.js,
--     scripts/provision-tenant-admins.mjs
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
--
-- LOAD-BEARING FOR AUTO-PROVISION, NOT JUST FOR READS: all four auto-provision call
-- sites chain `.insert({...}).select().single()` (SourcingPortalV2.jsx:127-138 and the
-- three siblings). PostgREST needs BOTH an INSERT policy and a SELECT policy to return
-- the inserted row. With members_insert_self alone the write would land but the read-back
-- would come back empty, `.single()` would raise PGRST116, the client would set
-- provisionErr and every new user would hit "Could not set up your account. Please
-- contact support." (SourcingPortalV2.jsx:141-145). members_select_own is what stops that.
CREATE POLICY "members_select_own"
  ON directory_members FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Tenant admins (and global admins) read the member roster for their tenant.
-- Not exercised today — the admin panel now routes through POST /api/sourcing/admin,
-- which is server-side service_role — but it is the prerequisite for any future
-- session-authenticated admin read, and it costs nothing.
CREATE POLICY "members_select_tenant_admin"
  ON directory_members FOR SELECT
  TO authenticated
  USING (public.dir_is_tenant_admin(tenant_id) OR public.dir_is_global_admin());

-- Browser auto-provision. Preserves today's behaviour exactly (role 'member',
-- status 'approved') while blocking three escalations the old WITH CHECK (true) allowed:
--   * inserting a row for somebody else's auth_user_id
--   * self-promoting to role = 'admin'   <- this is the requireAdmin() bypass
--   * claiming an arbitrary company_id (-> write access to that company)
--
-- DELIBERATE, FLAGGED: status = 'approved' is still self-grantable, because the four
-- auto-provision call sites hard-code it and forcing 'pending' would strand every
-- returning user on the "pending review" screen. This is a product decision, not a
-- schema one — see problem 1, open question A in the impact analysis. It is NOT the
-- admin-escalation path: role is pinned to 'member' above.
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
-- Same rationale as members_select_tenant_admin: unexercised while the admin panel
-- goes through the server endpoint, harmless, and the prerequisite for it not to.
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
-- through adminSupabase (now the server admin endpoint). Adding one would widen the
-- surface for nothing.


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — directory_analytics: keep anon INSERT, revoke anon SELECT    [PART 1]
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
--
-- No visible product change: there are zero anon-key READS of directory_analytics
-- anywhere in src/ or api/. The only reader is the admin analytics panel
-- (SourcingAdmin.jsx:287-306), which goes through the server admin endpoint.

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

-- Reads are now admin-only.
CREATE POLICY "analytics_select_tenant_admin"
  ON directory_analytics FOR SELECT
  TO authenticated
  USING (public.dir_is_tenant_admin(tenant_id) OR public.dir_is_global_admin());

-- ACCEPTED RISK, NOT CLOSED HERE: WITH CHECK (true) still lets anyone forge analytics
-- rows against any tenant_id and inflate counts. Constraining it would require either
-- a signed server-side ingest endpoint or a CHECK on event_type — both are code
-- changes outside this migration. Noted in the impact analysis as follow-up work.


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — directory_companies: supersede migration 017                [PART 1]
-- ═══════════════════════════════════════════════════════════════════════════════
-- migrations/017_admin_update_policy.sql lines 6 and 17 both test:
--
--     (auth.jwt() ->> 'role') = 'admin'
--
-- That reads the TOP-LEVEL `role` claim of the JWT. In Supabase that claim carries the
-- Postgres role the request will run as — 'anon' or 'authenticated' — and it is never
-- 'admin'. The app's actual admin flag is app_metadata.role:
--   * src/pages/SourcingAdmin.jsx:154        user.app_metadata.role === 'admin'
--   * src/pages/SourcingDirectory.jsx:745    same
--   * api/sourcing/admin-reports.js:169      same
--   * api/sourcing/lib/adminAuth.js:79       user.app_metadata?.role === 'admin'
--
-- So the global-admin branch of "admins update companies" has never matched, not once.
-- Approve / Reject / Unapprove only ever worked because the browser held the service
-- key. Now that the key is out of the bundle, a global admin with no directory_members
-- row would have had nothing left to fall back on.
--
-- 017 is already applied to production, so editing that file changes nothing. It is
-- superseded here by DROP + CREATE under a new name.
--
-- Second fix, same policy: 017's tenant-admin branch inlines
-- `EXISTS (SELECT 1 FROM directory_members m WHERE ...)`. After §2 above, that subquery
-- runs under directory_members RLS. It happens to still work (members_select_own
-- returns exactly the row the subquery filters for), but relying on that is a trap for
-- the next person. Replaced with public.dir_is_tenant_admin(), which is SECURITY
-- DEFINER and therefore immune to how directory_members RLS is configured.
--
-- No visible product change: this branch has never fired, so nothing that works today
-- stops working. It can only widen — a global admin who was silently blocked now passes.
-- 017 was the ONLY other policy in the repo referencing directory_members
-- (verified: grep -rn "directory_members" migrations/ supabase/), so after this section
-- there are no inline cross-table member lookups left in any policy.

-- No-op, asserted defensively: migrations/001_sourcing_directory.sql:90 already enabled
-- RLS on this table. Verify before believing this file — if RLS were OFF on
-- directory_companies today, this line would take the entire public directory dark,
-- because 001:96 "public read companies" would suddenly start being enforced. It is on:
--   SELECT relrowsecurity FROM pg_class
--    WHERE relnamespace='public'::regnamespace AND relname='directory_companies';  -- t
ALTER TABLE directory_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins update companies"        ON directory_companies;
DROP POLICY IF EXISTS "companies_update_admin"         ON directory_companies;

CREATE POLICY "companies_update_admin"
  ON directory_companies FOR UPDATE
  TO authenticated
  USING      (public.dir_is_tenant_admin(tenant_id) OR public.dir_is_global_admin())
  WITH CHECK (public.dir_is_tenant_admin(tenant_id) OR public.dir_is_global_admin());

-- DELIBERATE: directory_companies' other policies are left exactly as they are. 011's
-- "signup insert companies" (WITH CHECK status = 'pending') and "read own pending
-- company" (SELECT status IN ('active','pending')) are the public directory's read path
-- and the signup write path. Touching either is a visible product change and does not
-- belong in Part 1. Flagged as follow-up in the impact analysis.


-- ╔═══════════════════════════════════════════════════════════════════════════════╗
-- ║                                                                               ║
-- ║   P A R T   2   —   D E F E R R E D .   D O E S   N O T   R U N .             ║
-- ║   Flip `run_part_2 boolean := false;` to `true` below to enable it,           ║
-- ║   but ONLY after the seven report pages are repointed at                      ║
-- ║   GET /api/sourcing/reports. Otherwise members-only and paid report cards     ║
-- ║   disappear from os.spacerising.org for every logged-out visitor.             ║
-- ║                                                                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — directory_reports read policies                             [PART 2]
-- ═══════════════════════════════════════════════════════════════════════════════
-- Everything in this section is inside the guarded block below, so none of it executes
-- while run_part_2 is false. Three changes, all coupled — they only make sense together:
--
-- (5a) The access-value mismatch, which runs BOTH ways. Pinning the policy to either
--      single literal leaves rows dark:
--        * 008:18 shipped        USING (access = 'free')
--        * 013 "fixed" it to     USING (access = 'public')
--        * admin-reports.js:10   VALID_ACCESS = ['free','member','members','paid','public']
--        * admin-reports.js:201  defaults a new report to access = 'free'
--        * ReportsSection.jsx:92 posts access: reportForm.access || 'free'
--        * SourcingReportDetailV2.jsx:151 and OSReportsPage.jsx:97 both treat 'free' and
--          'public' as the same free tier
--      So free-tier rows exist under BOTH literals in prod and the policy must accept
--      both. access IS NULL is included because the app treats a null access as free
--      (SourcingReportDetailV2.jsx:151 `|| !report.access`).
--
-- (5b) Dropping "service full access reports" (008:19, FOR ALL USING (true), no TO
--      clause so it applies to anon). THIS IS THE ONE THAT CHANGES THE LIVE SITE.
--      It is also the change that actually closes the leak: today any anonymous visitor
--      can read EVERY directory_reports row including file_url on members-only and paid
--      reports, and file_url points at the public 'sourcing-reports' storage bucket
--      (ReportsSection.jsx:68 getPublicUrl). The paywall is currently decorative.
--      Blast radius — seven pages fetch with .select('*') and NO access filter, relying
--      on RLS to decide what comes back, then drawing a "Members Only" badge client-side:
--        src/pages/SourcingReportsV2.jsx:63       src/pages/OSReportsPage.jsx:163
--        src/pages/SpaceOSHomeV3.jsx:46           src/pages/SourcingReportDetailV2.jsx:86, :112
--        src/pages/SourcingDirectory.jsx:820      src/pages/SourcingReports.jsx:147
--        src/pages/srw/SRWHomeV2.jsx:133
--      After this runs, logged-out visitors stop seeing members-only / paid reports
--      ENTIRELY — the locked teaser cards do not render as locked, they vanish. That is
--      the paywall conversion surface on a live marketing site.
--
-- (5c) reports_member_read, so signed-in approved members keep full visibility. Only
--      meaningful once (5b) has removed the blanket policy.
--
-- THE PREREQUISITE (option B in docs/security/028-impact-analysis.md): repoint those
-- seven pages at GET /api/sourcing/reports (api/sourcing/reports.js:61-96), which runs
-- server-side with the service key and already returns the full set, and null out
-- file_url for unentitled callers there (the logic exists in
-- api/sourcing/lib/reportAccess.js:48-62). Then teasers stay AND files are protected.
--
-- KNOWN GAP even after Part 2: reports_member_read exposes file_url to ANY approved
-- member of the tenant, including free-tier members, because RLS is row-level and
-- cannot mask a single column. Closing it needs a private bucket + signed URLs.

DO $part2$
DECLARE
  -- ══════════════════════════════════════════════════════════════════════════
  --  T H E   S W I T C H .   This is the only line that decides whether
  --  Part 2 runs. false = skip (default). true = run.
  --  Do not flip it until the seven report pages are repointed. See above.
  -- ══════════════════════════════════════════════════════════════════════════
  run_part_2 boolean := false;
BEGIN
  IF NOT run_part_2 THEN
    RAISE NOTICE '───────────────────────────────────────────────────────────────────';
    RAISE NOTICE 'PART 2 SKIPPED (run_part_2 = false). Part 1 applied.';
    RAISE NOTICE 'directory_reports read policies are UNCHANGED: "service full access';
    RAISE NOTICE 'reports" is still in place and anonymous visitors can still read every';
    RAISE NOTICE 'report row, including paid ones. That leak is deliberately still open';
    RAISE NOTICE 'until the frontend hand-off lands. Nothing users see has changed.';
    RAISE NOTICE '───────────────────────────────────────────────────────────────────';
    RETURN;
  END IF;

  RAISE NOTICE 'PART 2 RUNNING — directory_reports visibility WILL change for logged-out visitors.';

  -- (5a) align the column default with what the app writes.
  -- Belt and braces: 008:7 already declares `access text NOT NULL DEFAULT 'public'`, so
  -- unless something changed it out of band this is a no-op. Re-asserted because the
  -- policy below is written around the literal set, and the default should not drift
  -- away from it silently. (`access` being NOT NULL also means the `access IS NULL`
  -- branch in reports_public_read is unreachable today — it is kept as a guard in case
  -- the NOT NULL is ever relaxed, since three pages already treat null as free.)
  EXECUTE $ddl$
    ALTER TABLE directory_reports ALTER COLUMN access SET DEFAULT 'public'
  $ddl$;

  EXECUTE $ddl$ ALTER TABLE directory_reports ENABLE ROW LEVEL SECURITY $ddl$;

  EXECUTE $ddl$ DROP POLICY IF EXISTS "public read free reports"    ON directory_reports $ddl$;
  EXECUTE $ddl$ DROP POLICY IF EXISTS "public read public reports"  ON directory_reports $ddl$;
  EXECUTE $ddl$ DROP POLICY IF EXISTS "reports_public_read"         ON directory_reports $ddl$;
  EXECUTE $ddl$ DROP POLICY IF EXISTS "reports_member_read"         ON directory_reports $ddl$;

  -- (5b) THE VISIBLE CHANGE
  EXECUTE $ddl$ DROP POLICY IF EXISTS "service full access reports" ON directory_reports $ddl$;

  -- Anonymous + signed-in visitors read free-tier rows under either literal, or null.
  EXECUTE $ddl$
    CREATE POLICY "reports_public_read"
      ON directory_reports FOR SELECT
      TO anon, authenticated
      USING (
        access IS NULL
        OR lower(btrim(access)) IN ('public', 'free')
      )
  $ddl$;

  -- (5c) Signed-in approved members of the tenant keep full visibility of that tenant's
  -- reports, including members-only and paid rows.
  EXECUTE $ddl$
    CREATE POLICY "reports_member_read"
      ON directory_reports FOR SELECT
      TO authenticated
      USING (
        public.dir_is_tenant_member(tenant_id)
        OR public.dir_is_tenant_admin(tenant_id)
        OR public.dir_is_global_admin()
      )
  $ddl$;

  -- DELIBERATE: directory_reports is left with SELECT policies only — no INSERT, UPDATE
  -- or DELETE policy for anon or authenticated. This matches the code: every report
  -- write already goes through service_role, which bypasses RLS.
  --   * create/update -> POST/PUT /api/sourcing/admin-reports (ReportsSection.jsx:99,124)
  --   * file url save -> POST /api/sourcing/upload-report      (SourcingDirectory.jsx:924)
  --   * delete        -> adminSupabase.delete()                (ReportsSection.jsx:181)
  --   * cleanup       -> api/sourcing/delete-blank-reports.js
  -- The table is NOT left with zero policies; writes are simply service-role-only by design.

  RAISE NOTICE 'PART 2 APPLIED. Walk os.spacerising.org logged out and confirm the reports listings.';
END
$part2$;


COMMIT;
