-- ============================================================================
-- 035 — Stop exposing member email addresses on public person profiles.
--
-- WHY THIS EXISTS
-- Migration 032 created directory_people with a public-read policy for active
-- rows, and the seed then published 73 real profiles. RLS is ROW-level: it can
-- decide whether you see a row, never which columns of it. So the moment those
-- rows went active, every member's email became readable two ways:
--
--   1. GET /rest/v1/directory_people?select=email   (the table, via the anon key
--      that ships inside the public browser bundle by design)
--   2. get_person_profile(slug) -> payload.email    (the RPC is SECURITY DEFINER,
--      so it bypasses RLS and grants entirely and hands back whatever it selects)
--
-- Both verified against production before writing this.
--
-- This is strictly a REVOKE plus a narrowing of one function's output. It grants
-- nothing, alters no pre-existing table, and drops nothing. Re-runnable.
--
-- WHAT STAYS TRUE AFTERWARDS
--   - A signed-in person still sees their own email on their own profile.
--   - Admins still see it.
--   - Everyone else gets null, and the screen renders without the email row.
--   - The address is still in directory_members, which has its own pre-existing
--     USING(true) leak. That is migration 028's job, not this one's. Closing it
--     here would be a false sense of security — 028 is still the fix.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Column-level revoke on the table.
--    Postgres column grants are the only thing that can mask a column, because
--    a row-level policy cannot. Revoking the column while leaving the row
--    readable means `select=*` simply stops returning it.
-- ----------------------------------------------------------------------------
REVOKE SELECT (email) ON public.directory_people FROM anon;

-- authenticated keeps column access: a signed-in owner reading their own row
-- through the table (not the RPC) still needs it, and the row policy already
-- limits which rows they can reach.

-- ----------------------------------------------------------------------------
-- 2. Narrow the RPC so it only emits an email to someone entitled to it.
--    SECURITY DEFINER bypasses the revoke above, so the function has to make
--    this decision itself.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.person_may_see_email(p_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    -- the profile's own owner
    EXISTS (
      SELECT 1 FROM public.directory_people dp
      WHERE dp.id = p_person_id
        AND dp.auth_user_id IS NOT NULL
        AND dp.auth_user_id = auth.uid()
    )
    -- or a global admin. NOTE the claim path: app_metadata.role.
    -- The top-level 'role' claim is the POSTGRES role and is never 'admin' —
    -- migration 017 got this wrong and its admin branch has never once matched.
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    -- or an approved admin member of the same tenant
    OR EXISTS (
      SELECT 1
      FROM public.directory_people dp
      JOIN public.directory_members dm
        ON dm.tenant_id = dp.tenant_id
      WHERE dp.id = p_person_id
        AND dm.auth_user_id = auth.uid()
        AND dm.role = 'admin'
        AND dm.status = 'approved'
    );
$$;

REVOKE ALL ON FUNCTION public.person_may_see_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.person_may_see_email(uuid) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- VERIFY (run these after applying)
--
--   -- as anon: must return 0 rows / an error, never an address
--   GET /rest/v1/directory_people?select=email&limit=1
--
--   -- as anon: payload.email must be null or absent
--   POST /rest/v1/rpc/get_person_profile  {"p_slug":"<a real slug>"}
--
-- The second only holds once get_person_profile itself is updated to call
-- person_may_see_email() around its email field — see 036. This migration
-- lands the revoke and the helper; 036 rewires the payload.
-- ============================================================================
