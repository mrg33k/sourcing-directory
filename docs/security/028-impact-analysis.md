# Migration 028 — impact analysis

**Read this before applying `migrations/028_security_and_missing_tables.sql` to production.**

- Target: hosted Supabase project `kzzvjtthknsozktmpvak`
- Live surface: `os.spacerising.org`, serving real users off this branch
- Author: agent, authoring only. **The migration has not been run against anything.** No
  SQL in this document or in the migration has been executed against production.
- Apply with: `node --env-file=.env.prod.local scripts/run-migration-028.mjs --apply`
- Pre-flight (read-only, changes nothing): `node --env-file=.env.prod.local scripts/run-migration-028.mjs --check`

Everything in the migration is wrapped in `BEGIN`/`COMMIT` and is idempotent. A failure
rolls the whole thing back and leaves production exactly as it was.

---

## Read this first: the migration is not the fix

`VITE_SOURCING_ADMIN_KEY` in `.env.production` and `.env.prod.local` **is byte-identical
to `SUPABASE_SERVICE_ROLE_KEY`** (verified locally by comparing values and decoding the
JWT `role` claim: `service_role`). Any variable prefixed `VITE_` is inlined into the Vite
bundle at build time, so that key ships to every browser that loads the site
(`src/pages/SourcingAdmin.jsx:37`).

`service_role` is a `BYPASSRLS` Postgres role. It does not consult policies at all.

The consequence, stated plainly: **while that key is in the bundle, no RLS policy on this
database protects anything from anyone.** Migration 028 closes the holes for `anon` and
`authenticated`, which is real and worth doing, but a person with the public JS bundle
still has unrestricted read/write on every table. Tightening RLS without rotating the key
is a locked door in a glass wall.

Ordering that actually fixes it:

1. Apply 028 (this migration). It creates the tenant-admin policies the admin panel needs
   in order to work *without* the service key — that is the prerequisite, not an extra.
2. Hand off the frontend change: `SourcingAdmin.jsx` and `src/pages/admin/*` stop using
   `adminSupabase` and use the session-authenticated `supabase` client, or route through
   an authenticated server endpoint. Every write path there is already admin-gated
   server-side in `api/sourcing/admin-reports.js`; the pattern exists.
3. Remove `VITE_SOURCING_ADMIN_KEY` from Vercel (all environments) and redeploy.
4. Rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase, update the Vercel server-side var,
   redeploy. Treat the old key as public — it has been in the bundle and is referenced in
   a committed `CONTEXT.md` table.

Steps 2–4 are code and ops work outside this agent's file scope. They are listed as
hand-off requests at the bottom.

---

## What the migration changes, at a glance

| # | Table | Policy removed | Replaced by | Breaks anything live? |
|---|---|---|---|---|
| 1 | `directory_members` | `service role all` (FOR ALL, `USING (true)`), `signup insert members` (INSERT, `WITH CHECK (true)`) | `members_select_own`, `members_select_tenant_admin`, `members_insert_self`, `members_update_tenant_admin`, `members_delete_tenant_admin` | **No** — verified caller by caller below |
| 2 | `directory_reports` | — (columns only) | `is_premium`, `updated_at`, `updated_by`, `created_by`, `created_at`, `cover_image_url` | **No** — it *un*-breaks a currently-500ing endpoint |
| 3 | `directory_analytics` | `service read analytics` (SELECT, `USING (true)`) | `analytics_select_tenant_admin`; anon INSERT kept as `analytics_public_insert` | **No** — the only reader uses the service key |
| 4 | `directory_reports` | `public read free reports` / `public read public reports`, `service full access reports` (FOR ALL, `USING (true)`) | `reports_public_read` (accepts `public`, `free`, NULL), `reports_member_read` | **YES — visible product change.** See problem 4 |

---

## Problem 1 — the members hole

### What is wrong

`migrations/006_sourcing_members.sql:25`

```sql
CREATE POLICY "service role all" ON directory_members FOR ALL USING (true);
```

The name is wrong in a way that hid this for months. A policy with no `TO` clause applies
to `PUBLIC`, i.e. every role including `anon`. `FOR ALL USING (true)` is unrestricted
SELECT/UPDATE/DELETE for anonymous callers, and it sits *beside* `members read own`
(line 24) — RLS policies are OR-ed, so the permissive one wins and `members read own`
has never had any effect.

`service_role` never needed this policy. It bypasses RLS regardless.

**Second hole the brief did not name, and it matters:**
`migrations/011_signup_rls_policies.sql:25`

```sql
CREATE POLICY "signup insert members" ON directory_members FOR INSERT WITH CHECK (true);
```

Dropping `service role all` on its own would be cosmetic — this one leaves the write side
wide open by itself. 028 drops both.

### What is exposed today

Anyone with the anon key (it is in the bundle by design) can `SELECT *` from
`directory_members` and read every member's `email`, `full_name`, `role`, `status`,
`company_id` and `auth_user_id` across every tenant. They can also insert a row with an
arbitrary `company_id` and `role: 'admin'` — and an approved member row pointing at a
company is exactly what `api/sourcing/update-company.js:63`,
`api/sourcing/update-deal-bank-listing.js:52` and
`api/sourcing/withdraw-deal-bank-listing.js:54` check before allowing writes. That is a
full account-takeover path against any company profile.

### THE TRAP: every live dependency, enumerated

Two clients exist in this codebase and they behave completely differently under RLS:

- `supabase` (`src/lib/supabase.js`) — **anon key**, carries the user's session JWT.
  Role is `authenticated` when signed in, `anon` when not. **RLS applies.**
- `adminSupabase` (`src/pages/SourcingAdmin.jsx:39`) — **service_role key**.
  **RLS does not apply.** Falls back to the anon key only if
  `VITE_SOURCING_ADMIN_KEY` is unset (it is set in prod).

Every read/write of `directory_members` in the repo:

| File:line | Client | Operation | Survives 028? |
|---|---|---|---|
| `src/pages/SourcingPortalV2.jsx:111` | anon+session | select own by `auth_user_id` + `tenant_id` | Yes — `members_select_own` |
| `src/pages/SourcingPortalV2.jsx:129` | anon+session | **auto-provision insert** | Yes — `members_insert_self` |
| `src/pages/SourcingLoginV2.jsx:132` | anon+session | select own | Yes |
| `src/pages/SourcingLoginV2.jsx:154` | anon+session | **auto-provision insert** | Yes |
| `src/pages/SourcingPortal.jsx:71` | anon+session | select own (V1) | Yes |
| `src/pages/SourcingPortal.jsx:89` | anon+session | **auto-provision insert** (V1) | Yes |
| `src/pages/SourcingLogin.jsx:112` | anon+session | select own (V1) | Yes |
| `src/pages/SourcingLogin.jsx:136` | anon+session | **auto-provision insert** (V1) | Yes |
| `src/pages/SourcingSignupComplete.jsx:32` | anon+session | select own `company_id` | Yes |
| `src/pages/SourcingMarketplace.jsx:186` | anon+session | select own `company_id` | Yes |
| `src/pages/SourcingReports.jsx:90` | anon+session | select own `company_id` | Yes |
| `src/pages/SourcingAdmin.jsx:167` | **service_role** | select admin memberships | Yes — bypasses RLS |
| `src/pages/SourcingAdmin.jsx:200` | **service_role** | select pending members | Yes — bypasses RLS |
| `src/pages/SourcingAdmin.jsx:458` | **service_role** | update status | Yes — bypasses RLS |
| `src/pages/admin/MembersSection.jsx:28` | **service_role** | select all | Yes — bypasses RLS |
| `src/pages/admin/MembersSection.jsx:38` | **service_role** | update role/status | Yes — bypasses RLS |
| `src/pages/admin/MembersSection.jsx:63` | **service_role** | insert | Yes — bypasses RLS |
| `src/pages/admin/MembersSection.jsx:80` | **service_role** | delete | Yes — bypasses RLS |
| `src/pages/admin/AddCompanySection.jsx:40` | server endpoint | POSTs `/api/sourcing/admin-setup` | Yes — service_role server-side |
| `api/sourcing/signup.js:175` | **service_role** | insert member on signup | Yes — bypasses RLS |
| `api/sourcing/admin-setup.js:79/85/87/164/171/180` | **service_role** | upsert admin member | Yes |
| `api/sourcing/update-company.js:63` | **service_role** | authz lookup | Yes |
| `api/sourcing/update-deal-bank-listing.js:52` | **service_role** | authz lookup | Yes |
| `api/sourcing/deal-bank-listing.js:65` | **service_role** | authz lookup | Yes |
| `api/sourcing/upload-deal-bank-deck.js:79` | **service_role** | authz lookup | Yes |
| `api/sourcing/withdraw-deal-bank-listing.js:54` | **service_role** | authz lookup | Yes |
| `api/sourcing/lib/membership.js:36` | **service_role** | tier lookup | Yes |
| `scripts/provision-tenant-admins.mjs:80/88/95` | **service_role** | provisioning | Yes |

**Browser-side signup does not touch `directory_members` at all.** `api/sourcing/signup.js`
is server-side and service-role (`api/sourcing/signup.js:1-8`) — its comment says exactly
that: *"Uses service role key to bypass RLS ... This is the correct architecture."* So
signup is not at risk from this change. The at-risk path is **portal/login
auto-provisioning**, which is a browser insert with the anon key, and it is preserved.

### Why `members_insert_self` cannot break auto-provisioning

The four auto-provision call sites all resolve `company_id` the same way immediately
before inserting (`SourcingPortalV2.jsx:120-124`, `SourcingLoginV2.jsx:141-145`,
`SourcingPortal.jsx:80-84`, `SourcingLogin.jsx:126-131`):

```js
supabase.from('directory_companies').select('id')
  .eq('email', authUser.email).eq('tenant_id', tenant.id).limit(1)
```

then insert `{ tenant_id, auth_user_id: authUser.id, email: authUser.email, full_name,
company_id, status: 'approved', role: 'member' }`.

`dir_may_claim_company()` asserts the same thing case-insensitively, so it is strictly
*more* permissive than the client's own exact-match lookup — it cannot reject a
`company_id` the client is able to produce. `auth_user_id = auth.uid()`, `role = 'member'`
and `status IN ('pending','approved')` are all literally what the client sends.

### Open question A — self-approval (product decision, deliberately left as-is)

`members_insert_self` still permits `status = 'approved'` on a self-insert, because all
four call sites hard-code it. Forcing `'pending'` would strand every returning user on the
"Your account is pending review" screen (`SourcingLoginV2.jsx:178`).

If you want signup approval to actually mean something, the code change is: set
`status: 'pending'` at those four call sites, then tighten the policy to
`AND status = 'pending'`. That is a product call and a frontend hand-off, not a schema
fix — so 028 preserves current behaviour and flags it rather than silently changing who
gets into the portal.

### Verification

**Before** (expect the two open policies to be present):

```sql
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_members'
 ORDER BY cmd, policyname;
-- expect rows: "service role all" (ALL, {public}, qual=true)
--              "signup insert members" (INSERT, {public}, with_check=true)
--              "members read own" (SELECT, {public})
```

Prove the hole is real, as an anonymous caller (run from a shell, anon key only):

```bash
curl -s "https://kzzvjtthknsozktmpvak.supabase.co/rest/v1/directory_members?select=email,role,status&limit=5" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY"
# BEFORE: returns real member emails.  AFTER: returns []
```

**After** (expect exactly five scoped policies and no `true` predicates):

```sql
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_members'
 ORDER BY cmd, policyname;
-- expect: members_select_own, members_select_tenant_admin (SELECT, {authenticated})
--         members_insert_self (INSERT, {authenticated})
--         members_update_tenant_admin (UPDATE), members_delete_tenant_admin (DELETE)
-- expect NO row where qual = 'true' or with_check = 'true'
```

Smoke test after applying (this is the one that matters):

1. Sign in at `os.spacerising.org` as a member whose `directory_members` row already
   exists → portal loads, company details render.
2. Sign in as an auth user with **no** member row → auto-provision fires, portal loads,
   and a new row appears:
   `SELECT id, email, role, status, company_id FROM directory_members ORDER BY created_at DESC LIMIT 3;`
3. Admin panel `/admin` → Members tab still lists members (service_role, unaffected).

---

## Problem 2 — the never-applied columns

### What is wrong

`migrations/014_reports_add_is_premium.sql` and `migrations/016_reports_add_updated_fields.sql`
exist in the repo but were never run against production.
`api/sourcing/admin-reports.js:22-23` selects:

```
id, tenant_id, title, description, category, access, file_url, cover_image_url,
is_premium, published_at, created_at, updated_at, created_by, updated_by
```

PostgREST rejects the entire request if any column in the select list does not exist, and
`admin-reports.js:249` turns that into a 500. So **every** GET/POST/PUT against
`/api/sourcing/admin-reports` fails today — meaning the admin Reports tab cannot create or
edit a report at all (`src/pages/admin/ReportsSection.jsx:99` POST, `:124` PUT).

**Extra finding:** `created_by` is selected at line 23 *and* inserted at line 224
(`created_by: user.id`) but has **no migration anywhere in this repo** — not in
`migrations/`, not in `supabase/migrations/`. It was never authored, only assumed. 028
adds it. `cover_image_url` and `created_at` are re-asserted defensively (no-ops if
`supabase/migrations/20260723150000_directory_reports_cover_image_url.sql` and
`migrations/012` are already live).

### What breaks

Nothing. `ADD COLUMN IF NOT EXISTS` on a table this size is a catalog-only operation;
`is_premium NOT NULL DEFAULT false` uses the Postgres 11+ fast path and does not rewrite
the table. The `UPDATE ... SET updated_at = created_at WHERE updated_at IS NULL` backfill
touches only rows with a NULL, so re-running is a no-op.

The two foreign keys to `auth.users` are guarded: if prod holds orphan `updated_by` /
`created_by` values the constraint is skipped with a `RAISE NOTICE` instead of aborting
the transaction.

### Verification

**Before:**

```sql
SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'directory_reports'
 ORDER BY ordinal_position;
-- expect is_premium / updated_at / updated_by / created_by to be ABSENT
```

**After** — all six present, and the endpoint stops 500ing:

```sql
SELECT string_agg(column_name, ', ' ORDER BY column_name)
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'directory_reports'
   AND column_name IN ('is_premium','updated_at','updated_by','created_by','created_at','cover_image_url');
-- expect: cover_image_url, created_at, created_by, is_premium, updated_at, updated_by

SELECT conname FROM pg_constraint
 WHERE conrelid = 'public.directory_reports'::regclass
   AND conname LIKE '%_by_fkey';
-- expect: directory_reports_created_by_fkey, directory_reports_updated_by_fkey
--         (absent = orphan rows; see the NOTICE in the apply log)
```

Then, signed in as an admin, open `/admin` → Reports → edit any report → Save. It should
return 200 instead of 500.

---

## Problem 3 — analytics

### What is wrong

`migrations/007_sourcing_contacts.sql:36-37`

```sql
CREATE POLICY "public insert analytics" ON directory_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "service read analytics" ON directory_analytics FOR SELECT USING (true);
```

The SELECT policy lets any anonymous caller enumerate every `page_view`, `profile_view`,
`contact_click` and — via `metadata` — every **search query typed into the site**
(`SourcingDirectory.jsx:710` writes `{ query, vertical }`). Competitor intelligence,
free, over HTTP.

### What is kept, and why

Anonymous INSERT stays. `src/pages/sourcingAnalytics.js:15` writes with the anon key,
fire-and-forget, from logged-out visitors. Call sites:
`SourcingDirectory.jsx:527`, `:536`, `:710`; `SourcingProfile.jsx:651`, `:914`.
028 recreates it as `analytics_public_insert` with an explicit `TO anon, authenticated`
so the intent is legible in `pg_policies` instead of implied.

### What breaks

**Client code currently READING `directory_analytics`:** exactly one file, and it is safe.

| File:line | Client | Reads | Survives 028? |
|---|---|---|---|
| `src/pages/SourcingAdmin.jsx:287` | **service_role** | 7-day page-view count | Yes — bypasses RLS |
| `src/pages/SourcingAdmin.jsx:293` | **service_role** | 30-day page-view count | Yes |
| `src/pages/SourcingAdmin.jsx:299` | **service_role** | recent searches | Yes |
| `src/pages/SourcingAdmin.jsx:306` | **service_role** | profile views by company | Yes |

There are **no** anon-key reads of `directory_analytics` anywhere in `src/` or `api/`.
So this change is invisible today.

**The conditional break, and it is a real one:** `adminSupabase` falls back to the anon key
when `VITE_SOURCING_ADMIN_KEY` is unset (`SourcingAdmin.jsx:37`). The moment that key is
pulled from Vercel — which is the correct remediation, step 3 in the section at the top —
the admin analytics panel starts reading with `authenticated`. `analytics_select_tenant_admin`
is in this migration precisely so that keeps working, but **only for a user with an
approved `role='admin'` member row in that tenant**, or a global admin whose JWT carries
`app_metadata.role = 'admin'`. A global admin with no member row will see zeros. Confirm
your admins have member rows before pulling the key:

```sql
SELECT m.email, m.tenant_id, m.role, m.status
  FROM directory_members m
 WHERE m.role = 'admin' AND m.status = 'approved'
 ORDER BY m.tenant_id;
```

### Accepted risk, not closed here

`WITH CHECK (true)` still lets anyone forge analytics rows against any `tenant_id` and
inflate counts. Closing that needs either a signed server-side ingest endpoint or a
`CHECK` on `event_type`. A `CHECK` constraint is not in 028 deliberately: it would be
validated against existing prod rows, and if any historical row carries an event type
outside `page_view | search | profile_view | contact_click` the whole migration would
abort. Follow-up work.

### Verification

**Before** — the leak, as an anonymous caller:

```bash
curl -s "https://kzzvjtthknsozktmpvak.supabase.co/rest/v1/directory_analytics?select=event_type,metadata,created_at&limit=5" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY"
# BEFORE: returns real events including search queries.  AFTER: returns []
```

```sql
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_analytics';
-- BEFORE: "public insert analytics" (INSERT, true), "service read analytics" (SELECT, true)
-- AFTER:  "analytics_public_insert" (INSERT, {anon,authenticated}, with_check=true)
--         "analytics_select_tenant_admin" (SELECT, {authenticated}, dir_is_tenant_admin(...))
```

**After** — confirm anonymous writes still land. Load any public directory page in a
logged-out browser, then:

```sql
SELECT count(*), max(created_at) FROM directory_analytics WHERE created_at > now() - interval '5 minutes';
-- expect a non-zero count that grows as you browse
```

If that count stops growing after the migration, the INSERT policy did not recreate
correctly — roll back by re-applying `migrations/007` lines 35-37.

---

## Problem 4 — reports policy, and the one visible product change

### 4A — the access-value mismatch runs both ways

The brief describes 013 as granting public read on `access='free'` while the app writes
`'public'`. That is half the story, and the half that is missing changes the fix.

- `migrations/008_create_directory_reports.sql:18` shipped `USING (access = 'free')`
- `migrations/013_fix_reports_rls_policy.sql:5` replaced it with `USING (access = 'public')`
- `api/sourcing/admin-reports.js:10` accepts **all five**: `free, member, members, paid, public`
- `api/sourcing/admin-reports.js:205` defaults a **new** report to `access = 'free'`
- `src/pages/admin/ReportsSection.jsx:92` posts `access: reportForm.access || 'free'`
- `src/pages/SourcingReportDetailV2.jsx:151` treats `'free'`, `'public'` and *null* as free
- `src/pages/OSReportsPage.jsx:97` does the same

So free-tier rows exist in prod under **both** literals, and pinning the policy to either
one leaves the other set invisible to anonymous visitors. 028 accepts
`access IS NULL OR lower(btrim(access)) IN ('public','free')`.

Check what is actually in the table before you apply — this single query tells you how
much is currently dark:

```sql
SELECT access, count(*) AS rows, count(file_url) AS with_file_url
  FROM directory_reports
 GROUP BY access
 ORDER BY rows DESC;
```

### 4B — `service full access reports`, and what disappears from the site

`migrations/008_create_directory_reports.sql:19`

```sql
CREATE POLICY "service full access reports" ON directory_reports FOR ALL USING (true);
```

Same pattern as problem 1: no `TO` clause, so it applies to `anon`. This is what makes the
013 access-value bug invisible in production — the broken policy does not matter when a
second policy grants everything to everyone. It also means **every members-only and paid
report, including its `file_url`, is readable by any anonymous caller right now.**
`file_url` points at the public `sourcing-reports` storage bucket
(`src/pages/admin/ReportsSection.jsx:68` uses `getPublicUrl`), so row access equals file
access. The paywall is currently decorative.

**THIS IS THE CHANGE THAT ALTERS THE LIVE SITE. Do not apply it without deciding.**

Seven pages fetch reports with `.select('*')` and **no access filter**. They rely on RLS to
decide what comes back, then render a "Members Only" badge client-side:

| File:line | What it renders |
|---|---|
| `src/pages/SourcingReportsV2.jsx:63` | reports index, badge at `:172` |
| `src/pages/OSReportsPage.jsx:163` | Space Rising reports page, lock logic at `:97`, `:226` |
| `src/pages/SpaceOSHomeV3.jsx:46` | home page report cards |
| `src/pages/SourcingReportDetailV2.jsx:86` | report detail; `:112` related reports |
| `src/pages/SourcingDirectory.jsx:820` | tenant directory reports rail |
| `src/pages/SourcingReports.jsx:147` | V1 reports page, badges at `:260`, `:396` |
| `src/pages/srw/SRWHomeV2.jsx:133` | SRW home search results |

**After 028, logged-out visitors stop seeing members-only and paid reports entirely.** The
locked teaser cards do not render as locked — they vanish from the listings. That is the
paywall conversion surface on a live marketing site. Signed-in approved members are
unaffected (`reports_member_read`).

Three options:

- **Option A — accept it.** Apply as written. Most secure, zero code change. Cost: the
  "Members Only" teasers disappear for anonymous visitors, so nobody logged-out sees that
  premium content exists.
- **Option B — recommended.** Apply as written, and hand off a frontend change repointing
  those seven pages at `GET /api/sourcing/reports` (`api/sourcing/reports.js:61-95`),
  which runs server-side with the service key and already returns the full set. Add one
  guard in that handler: null out `file_url` for premium rows when the caller is not
  entitled (the logic already exists in `api/sourcing/lib/reportAccess.js:47-62`). Result:
  teasers stay, files are actually protected.
- **Option C — not recommended.** Keep anon row access and revoke the column privilege:
  `REVOKE SELECT (file_url) ON directory_reports FROM anon`. RLS is row-level and cannot
  mask a column, so this is the only DB-only way — but it makes `.select('*')` fail
  outright with "permission denied for column file_url" on all seven pages. Strictly worse
  than B.

**Defer option:** to ship 028 without the visibility change, comment out the
`"service full access reports"` line in the section 4A `DROP` block and the
`reports_member_read` policy in section 4B. Every other change in the file is independent
of that. Re-run the file (it is idempotent) once the frontend hand-off lands.

### Known gap, not closed here

`reports_member_read` exposes `file_url` to **any** approved member of the tenant,
including free-tier members — not only paid ones. `api/sourcing/lib/reportAccess.js` is
the real paid gate, but because the bucket is public, row visibility is file visibility.
Properly fixing this means moving `sourcing-reports` to a private bucket and serving
signed URLs from `api/sourcing/download-report.js`. Out of scope for a migration; flagged
as follow-up.

### Verification

**Before:**

```sql
SELECT policyname, cmd, roles::text, qual
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_reports';
-- expect "service full access reports" (ALL, {public}, qual=true)
--    and one of "public read free reports" / "public read public reports"
```

```bash
# Count what an anonymous visitor can see, and how many premium files leak.
curl -s "https://kzzvjtthknsozktmpvak.supabase.co/rest/v1/directory_reports?select=id,title,access,file_url" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" | python3 -c "
import json,sys
rows=json.load(sys.stdin)
prem=[r for r in rows if (r.get('access') or 'public').lower() not in ('public','free')]
print('anon-visible rows:', len(rows))
print('premium rows visible to anon:', len(prem))
print('premium rows exposing file_url:', len([r for r in prem if r.get('file_url')]))"
# BEFORE: premium rows visible > 0, file_urls exposed > 0
# AFTER:  premium rows visible = 0
```

Record the BEFORE numbers. The drop in `anon-visible rows` is exactly the set of cards
that will disappear from the seven pages listed above — that is your blast radius, in a
number, before you commit to it.

**After:**

```sql
SELECT policyname, cmd, roles::text, qual
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_reports'
 ORDER BY policyname;
-- expect exactly: reports_member_read (SELECT, {authenticated})
--                 reports_public_read (SELECT, {anon,authenticated})
-- expect NO INSERT/UPDATE/DELETE policies — writes are service_role-only by design
```

Then walk the site: `os.spacerising.org` reports page logged out (free reports present,
premium gone), then signed in as an approved member (everything present).

---

## Deliberate design choices in the migration

- **`SECURITY DEFINER` helpers.** A policy on `directory_members` that queries
  `directory_members` raises `infinite recursion detected in policy for relation`. The
  four `dir_*` functions run as the owner so the inner read bypasses RLS and terminates.
  Each is `STABLE`, pins `search_path = public, pg_temp` (mandatory for `SECURITY DEFINER`
  — otherwise a rogue schema on the caller's path can shadow the referenced tables), and
  answers only about the *current* caller via `auth.uid()` / `auth.jwt()`. None takes a
  user id, so none can be pointed at another user.
- **`directory_reports` has SELECT policies only.** Intentional, and it matches the code:
  every write already goes through `service_role` (`admin-reports.js` POST/PUT,
  `upload-report.js`, `ReportsSection.jsx:181` delete, `delete-blank-reports.js`). The
  table is not left with RLS on and zero policies.
- **No self-UPDATE / self-DELETE on `directory_members`.** No browser code path updates or
  deletes a member row with the anon key — every one of them uses `adminSupabase`. Adding
  the policies would widen the surface for nothing.
- **Tenant-admin policies that nothing calls today.** `members_select_tenant_admin`,
  `members_update_tenant_admin`, `members_delete_tenant_admin` and
  `analytics_select_tenant_admin` are unexercised while the service key is in the bundle.
  They are the prerequisite for removing it. Applying 028 without them would make the key
  rotation a second migration.

---

## Found but NOT fixed — needs its own decision

**`directory_contacts` has the identical hole.** `migrations/007_sourcing_contacts.sql:20`:

```sql
CREATE POLICY "service read contacts" ON directory_contacts FOR SELECT USING (true);
```

Any anonymous caller can read every RFQ and contact submission — `sender_name`,
`sender_email`, `sender_phone`, `message`. That is arguably a worse PII exposure than the
analytics one this migration does close.

It is **not** in 028. The brief scoped four problems and this is a fifth, on a live site,
in a shared checkout — widening scope unasked is how live systems break. The fix is small
and mirrors section 3 exactly:

- keep `public insert contacts` (`SourcingProfile.jsx:640` writes with the anon key)
- replace `service read contacts` with a `dir_is_tenant_admin(tenant_id)` SELECT policy
- only reader is `SourcingAdmin.jsx:338` (service_role) and `:377` (update, service_role),
  so nothing live breaks

Confirm before deciding:

```sql
SELECT count(*) AS submissions, min(created_at), max(created_at) FROM directory_contacts;
```

Recommend authoring it as `029_contacts_rls.sql` and applying both together.

---

## Hand-off requests (files this agent does not own)

1. **`migrations/017_admin_update_policy.sql:6` and `:17` are checking the wrong claim.**
   `(auth.jwt() ->> 'role') = 'admin'` reads the *top-level* `role` claim, which in a
   Supabase JWT is the Postgres role — `authenticated` — never `admin`. The app reads
   `user.app_metadata.role` (`SourcingAdmin.jsx:156`, `SourcingDirectory.jsx:832`,
   `admin-reports.js:169`). The global-admin branch of that policy has therefore never
   matched, and companies approve/reject only because the browser uses the service key.
   Correct form, used throughout 028: `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`.
   Needs a follow-up migration; 017 is applied so editing the file in place fixes nothing.
2. **Remove `VITE_SOURCING_ADMIN_KEY` from the browser** — `src/pages/SourcingAdmin.jsx:37`
   plus every `adminSupabase` caller in `src/pages/admin/*`, then the Vercel env var, then
   rotate `SUPABASE_SERVICE_ROLE_KEY`. See the top section for ordering.
3. **Problem 4 option B** — repoint the seven report-fetching pages at
   `GET /api/sourcing/reports`, and null `file_url` for unentitled callers in
   `api/sourcing/reports.js`.
4. **`CONTEXT.md`** references the service-role key in its env table; audit it and the git
   history for a committed key value as part of the rotation.
5. **Optional, problem 1 open question A** — set `status: 'pending'` at the four
   auto-provision call sites if signup approval is meant to gate access, then tighten
   `members_insert_self`.

---

## Rollback

The migration is one transaction, so a failure during apply needs no rollback. To reverse
a *successful* apply, author `029_revert_028.sql` re-creating the original policies from
`migrations/006:24-25`, `migrations/007:36-37`, `migrations/008:18-19` and
`migrations/011:22-27`. Do not drop the added columns — `api/sourcing/admin-reports.js`
needs them, and dropping them puts that endpoint back to 500.
