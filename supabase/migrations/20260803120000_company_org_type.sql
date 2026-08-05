-- 20260803120000_company_org_type.sql
--
-- ORGANIZATION TYPE BECOMES REAL DATA, AND STAYS AUDITABLE.
--
-- `directory_company_profile.org_type` has existed as a column since the
-- profile-screen migration and has never held a value, because the table has
-- never held a row. Five sections across two screens are blocked on it (the
-- Organizations-by-Type donut, the map's pin categories, the type filter, the
-- Recent Organizations sub-line). This migration does not invent the values —
-- scripts/backfill-org-type.mjs derives them — but it makes the derivation
-- something a human can read, trust, and overrule.
--
-- WHY FOUR EXTRA COLUMNS AND NOT JUST org_type
-- --------------------------------------------
-- A derived value with no provenance is indistinguishable from a guess the
-- moment the person who ran the script leaves. So every derived type carries:
--
--   org_type_source      WHICH rule fired, as a stable string
--                        ('domain-tld:.edu', 'name:academic', ...). An admin
--                        can sort by it and audit one rule at a time instead of
--                        one company at a time.
--   org_type_confidence  high | medium | low | none. `none` is reserved for
--                        rows the classifier refused, which are stored as
--                        'Other' rather than as a made-up type.
--   org_type_evidence    the exact name / website / vertical the classifier
--                        read, plus the substring it matched. If a company
--                        renames itself, the record still shows what the
--                        decision was made on.
--   org_type_derived_at  when the script last wrote it.
--
-- AND THE ONE THAT MAKES THE SCRIPT SAFE TO RE-RUN
-- ------------------------------------------------
--   org_type_reviewed_by / org_type_reviewed_at  stamped when a HUMAN sets the
--   type from Admin Tools. The backfill script skips every row that carries
--   them, so re-running it can never quietly undo a correction. That is the
--   whole reason this is a repeatable script and not a one-off paste.

ALTER TABLE public.directory_company_profile
  ADD COLUMN IF NOT EXISTS org_type_source      text,
  ADD COLUMN IF NOT EXISTS org_type_confidence  text,
  ADD COLUMN IF NOT EXISTS org_type_evidence    jsonb,
  ADD COLUMN IF NOT EXISTS org_type_derived_at  timestamptz,
  ADD COLUMN IF NOT EXISTS org_type_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS org_type_reviewed_at timestamptz;

-- The closed set. Six values, matching the six the design asks for. Anything
-- the classifier cannot place lands on 'Other' — never on a seventh label
-- invented to make a row fit.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.directory_company_profile'::regclass
      AND conname = 'directory_company_profile_org_type_check'
  ) THEN
    ALTER TABLE public.directory_company_profile
      ADD CONSTRAINT directory_company_profile_org_type_check
      CHECK (org_type IS NULL OR org_type = ANY (ARRAY[
        'Private Company', 'Nonprofit', 'Government',
        'Academic', 'Investor', 'Other'
      ]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.directory_company_profile'::regclass
      AND conname = 'directory_company_profile_org_type_confidence_check'
  ) THEN
    ALTER TABLE public.directory_company_profile
      ADD CONSTRAINT directory_company_profile_org_type_confidence_check
      CHECK (org_type_confidence IS NULL OR org_type_confidence = ANY (ARRAY[
        'high', 'medium', 'low', 'none'
      ]));
  END IF;
END
$$;

COMMENT ON COLUMN public.directory_company_profile.org_type IS
  'One of six: Private Company, Nonprofit, Government, Academic, Investor, Other. Derived by scripts/backfill-org-type.mjs unless org_type_reviewed_at is set, in which case a human owns it.';
COMMENT ON COLUMN public.directory_company_profile.org_type_source IS
  'The classifier rule that produced org_type, e.g. domain-tld:.edu. Human edits write "admin:manual".';
COMMENT ON COLUMN public.directory_company_profile.org_type_reviewed_at IS
  'Set when a human confirms or corrects the type. The backfill script never touches a row that has this.';

CREATE INDEX IF NOT EXISTS directory_company_profile_org_type_idx
  ON public.directory_company_profile (org_type);


-- ---------------------------------------------------------------------------
-- get_ecosystem_activity() — the ONE real event stream this platform records.
-- ---------------------------------------------------------------------------
-- directory_audit is the only table in the database with the shape of a feed
-- (actor, action, entity, timestamp). It is an ADMIN MODERATION LOG, and two
-- things follow from that which a plain SELECT would get wrong:
--
--   1. It carries staff email addresses (five of them) and internal support
--      housekeeping (ticket.create, ticket.delete, dealbank.*.delete). None of
--      that belongs on a member-facing screen, and RLS on directory_audit has
--      no anon policy at all, so the browser reads exactly zero rows from it.
--      Loosening that policy to fix the feed would publish the emails. This
--      function is the alternative: SECURITY DEFINER, and it returns no actor
--      column whatsoever.
--
--   2. Most of its actions are not ecosystem events. Exactly one class is:
--      company.approve is the moment an organization becomes part of the
--      directory — the same fact the screen wants to show. company.feature /
--      unfeature are the other two that describe a public listing changing.
--      Deletions are excluded because the row they point at no longer exists,
--      so there is nothing truthful left to name.
--
-- The join to directory_companies is what keeps this honest: a row only
-- appears if the organization it refers to is still live and public, which is
-- the same visibility the directory already grants.
CREATE OR REPLACE FUNCTION public.get_ecosystem_activity(p_limit integer DEFAULT 8)
RETURNS TABLE (
  id           uuid,
  action       text,
  company_name text,
  company_slug text,
  occurred_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT a.id, a.action, c.name, c.slug, a.created_at
  FROM directory_audit a
  JOIN directory_companies c ON c.id = a.entity_id
  WHERE a.entity_type = 'company'
    AND a.action IN ('company.approve', 'company.feature', 'company.unfeature')
    AND c.status = 'active'
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 8), 50));
$function$;

REVOKE ALL ON FUNCTION public.get_ecosystem_activity(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ecosystem_activity(integer) TO anon, authenticated;

COMMENT ON FUNCTION public.get_ecosystem_activity(integer) IS
  'Member-safe read of directory_audit: company approvals and feature changes only, joined to live public companies, with no actor identity. Used by /ecosystem/overview.';
