-- Migration 029: directory_contacts — close the anonymous PII read
--
-- ╔═══════════════════════════════════════════════════════════════════════════════╗
-- ║  URGENT. NO VISIBLE PRODUCT CHANGE. Ships with 028 Part 1.                    ║
-- ║  This file has no deferred half — everything in it runs.                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════════╝
--
-- THE HOLE
--
--   migrations/007_sourcing_contacts.sql:20
--     CREATE POLICY "service read contacts" ON directory_contacts FOR SELECT USING (true);
--
--   The name is a lie in the same way "service role all" on directory_members was. A
--   policy with no TO clause applies to PUBLIC — every role, anon included. service_role
--   never needed it: it is a BYPASSRLS Postgres role and does not consult policies at all.
--
--   So any caller holding the public anon key (it is in the JS bundle by design) can
--   SELECT * FROM directory_contacts and read every contact and RFQ submission ever sent
--   through the site: sender_name, sender_email, sender_phone, message. Same class of PII
--   leak as the directory_members one that 028 §2 closes, and arguably worse — these are
--   inbound leads from third parties who never had an account, typed into a form that
--   said nothing about being world-readable.
--
-- THE FIX — mirrors 028 §3 (directory_analytics) exactly:
--   * KEEP anonymous INSERT. The public contact form is anon-key and must keep working.
--   * REPLACE the blanket SELECT with a tenant-admin-scoped one.
--
-- WHY NOTHING BREAKS — every reference to directory_contacts in the repo
-- (grep -rn "directory_contacts" src/ api/ scripts/ migrations/):
--
--   | Call site                          | Client                    | Op     | Survives |
--   |------------------------------------|---------------------------|--------|----------|
--   | src/pages/SourcingProfile.jsx:640  | `supabase` — ANON KEY     | INSERT | Yes — contacts_public_insert |
--   | src/pages/SourcingAdmin.jsx:335    | `adminSupabase` -> POST /api/sourcing/admin | SELECT | Yes — server-side service_role, bypasses RLS |
--   | src/pages/SourcingAdmin.jsx:374    | `adminSupabase` -> POST /api/sourcing/admin | UPDATE status | Yes — same |
--   | api/sourcing/lib/tablePolicy.js `directory_contacts:` entry| server allowlist entry (ops: select/update/delete, writable: ['status']) | — | Yes — the server path is service_role |
--
--   There is exactly ONE anon-key toucher of this table and it is a write, not a read.
--   No page, component or endpoint reads directory_contacts with the anon key. The
--   contact form (SourcingProfile.jsx ContactForm) inserts and never selects back — it
--   flips local state to 'success' on a clean insert, so it does not even need RETURNING.
--   That is why removing anonymous SELECT is invisible on the live site.
--
-- ORDERING: this file REQUIRES 028 Part 1, which creates the dir_is_tenant_admin() and
-- dir_is_global_admin() helpers. The guard below fails loudly and rolls back rather than
-- creating a half-configured table if you run them out of order.
--
--   Pre-flight (read-only): node --env-file=.env.prod.local scripts/run-migration-029.mjs --check
--   Apply:                  node --env-file=.env.prod.local scripts/run-migration-029.mjs --apply
--
-- Idempotent: every CREATE POLICY is preceded by DROP POLICY IF EXISTS, and the whole
-- file is one transaction. Safe to run twice.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- GUARD — 028 Part 1 must be applied first
-- ═══════════════════════════════════════════════════════════════════════════════
-- The helpers are deliberately NOT redefined here. Two copies of a SECURITY DEFINER
-- predicate in two migration files is how they drift, and a drifted authorization
-- predicate is a silent hole. One definition, in 028 §0, and a hard stop if it is missing.
DO $$
BEGIN
  IF to_regprocedure('public.dir_is_tenant_admin(uuid)') IS NULL
     OR to_regprocedure('public.dir_is_global_admin()') IS NULL THEN
    RAISE EXCEPTION
      'Migration 029 requires the dir_* helper functions from migration 028 Part 1 (section 0). Apply 028 first: node --env-file=.env.prod.local scripts/run-migration-028.mjs --apply';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- directory_contacts — keep anon INSERT, revoke anon SELECT
-- ═══════════════════════════════════════════════════════════════════════════════
-- No-op, asserted defensively: 007:18 already enabled RLS on this table.
ALTER TABLE directory_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public insert contacts"         ON directory_contacts;
DROP POLICY IF EXISTS "service read contacts"          ON directory_contacts;
DROP POLICY IF EXISTS "contacts_public_insert"         ON directory_contacts;
DROP POLICY IF EXISTS "contacts_select_tenant_admin"   ON directory_contacts;

-- Unchanged in effect: the public contact / RFQ form, submitted by logged-out visitors
-- with the anon key (src/pages/SourcingProfile.jsx:640). Recreated under an explicit
-- name and role list so the intent is legible in pg_policies instead of implied.
CREATE POLICY "contacts_public_insert"
  ON directory_contacts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Reads are now admin-only, scoped to the admin's own tenant. Not exercised today — the
-- admin panel's Contacts tab goes through POST /api/sourcing/admin, which is server-side
-- service_role — but it is the prerequisite for any future session-authenticated read,
-- and it costs nothing to have in place.
CREATE POLICY "contacts_select_tenant_admin"
  ON directory_contacts FOR SELECT
  TO authenticated
  USING (public.dir_is_tenant_admin(tenant_id) OR public.dir_is_global_admin());

-- DELIBERATE: no UPDATE or DELETE policy for anon or authenticated. The only status
-- change (SourcingAdmin.jsx:374, 'new' -> 'read' / 'replied') and the only delete both
-- run through the server admin endpoint under service_role, which bypasses RLS — the
-- `directory_contacts:` entry in api/sourcing/lib/tablePolicy.js allows exactly
-- select/update/delete with 'status' as the only writable column. Adding browser-side
-- write policies would widen the surface for nothing. Not left with zero policies.

-- ACCEPTED RISK, NOT CLOSED HERE: WITH CHECK (true) lets anyone POST forged contact rows
-- against any tenant_id / company_id — spam and lead poisoning, not disclosure. Closing
-- it needs a rate-limited server-side ingest endpoint (the same follow-up the analytics
-- INSERT in 028 §3 needs). Tracked in docs/security/028-impact-analysis.md.

COMMIT;
