# Migrations 028 + 029 — impact analysis and runbook

**Read this before applying anything to production.**

- Target: hosted Supabase project `kzzvjtthknsozktmpvak`
- Live surface: `os.spacerising.org`, serving real users off this branch
- Author: agent, authoring only. **Neither migration has been run against anything.**
  No SQL in this document or in either migration has been executed against production.

---

## The split, in one box

`028` used to bundle two very different things: urgent security fixes with no visible
product change, and one change that visibly alters the live site. Bundling them meant the
urgent part could not ship until a product decision was made. It is now split **inside the
same file**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ RUNNING migrations/028_security_and_missing_tables.sql TODAY EXECUTES:       │
│                                                                              │
│   PART 1   YES — runs by default.  Zero visible change for any visitor,      │
│                  member or admin. This is the whole point of the split.      │
│                                                                              │
│   PART 2   NO  — guarded off by `run_part_2 boolean := false;`.              │
│                  It is the only change users would notice, and it needs      │
│                  frontend work first.                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

| | Part 1 — ship today | Part 2 — deferred |
|---|---|---|
| **What** | `directory_members` RLS · missing `directory_reports` columns · `directory_analytics` anon-SELECT revoke · supersede migration 017 | `directory_reports` read policies: drop `service full access reports`, add `reports_member_read`, align the `access` default |
| **Visible product change** | **None** | **Yes** — members-only and paid report cards vanish for logged-out visitors on 7 pages |
| **Blocked on** | Nothing | Repointing 7 pages at `GET /api/sourcing/reports` |
| **How to run** | Run the file as-is | Flip `run_part_2` to `true`, re-run the file |

`029_contacts_rls.sql` is a separate file with **no deferred half**. Everything in it runs,
and none of it changes anything a user sees. It ships with Part 1.

---

## THE RUNBOOK

Everything below is one transaction per file, and idempotent. A failure rolls back and
leaves production exactly as it was.

### Now — the urgent lane (no product decision required)

```bash
# 0. Read-only pre-flight. Changes nothing. Record the BEFORE output.
node --env-file=.env.prod.local scripts/run-migration-028.mjs --check
node --env-file=.env.prod.local scripts/run-migration-029.mjs --check

# 0b. Prove the two holes are real from outside, with only the PUBLIC anon key.
#     Do this before you fix them — it is the difference between a claim and a receipt.
source .env.prod.local 2>/dev/null || true
curl -si "$VITE_SUPABASE_URL/rest/v1/directory_members?select=email,full_name,role,status,auth_user_id" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Range: 0-0" -H "Prefer: count=exact" | head -20
#   BEFORE: HTTP/2 206, `content-range: 0-0/70`, one real member row in the body.
curl -s "$VITE_SUPABASE_URL/rest/v1/directory_contacts?select=sender_name,sender_email,sender_phone&limit=3" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY"
#   BEFORE: real contact submissions with email and phone.

# 1. Apply 028 PART 1. Part 2 stays off — you do not need to edit anything.
node --env-file=.env.prod.local scripts/run-migration-028.mjs --apply
#    ⚠ EXPECT A FALSE-ALARM FAILURE HERE. See the next section before you react to it.

# 2. Apply 029. It refuses to run unless 028 Part 1 landed first (it needs the helpers).
node --env-file=.env.prod.local scripts/run-migration-029.mjs --apply

# 3. Re-run both curls from step 0b. Both must now return an empty array.
# 4. Smoke-test the live site. The checklist is in "Part 1 changes" below.
```

### Later — the deferred lane (needs a product decision, then code)

```
5. Frontend hand-off: repoint the 7 report-fetching pages at GET /api/sourcing/reports
   and null out file_url for unentitled callers there.  (Option B, detailed below.)
6. Deploy and verify that logged-out visitors still see the "Members Only" teaser cards
   — now served by the endpoint rather than by RLS.
7. Edit migrations/028_security_and_missing_tables.sql: change the single literal on the
       run_part_2 boolean := false;
   line to `true`.
8. node --env-file=.env.prod.local scripts/run-migration-028.mjs --apply
   Re-running the whole file is safe and intended — Part 1 is idempotent.
9. Walk os.spacerising.org logged out, then as an approved member.
```

### Separate track — key rotation

Not blocked on either migration, and neither migration is blocked on it. See
`docs/security/key-rotation-runbook.md`. Current state, verified in this repo:

- `grep -rn "VITE_SOURCING_ADMIN_KEY" src/` returns **one comment** in
  `src/hooks/useAdmin.js:19` and no live reference. `SourcingAdmin.jsx:45` now builds
  `adminSupabase` from `createAdminApiClient()` (`src/lib/adminApi.js`), which POSTs to
  `/api/sourcing/admin`. Vite only inlines env vars that source code references, so the
  **next** bundle will not carry the key.
- The variable is still present in Vercel's env (it appears in the pulled
  `.env.production` and `.env.prod.local`), and **every bundle served up to now shipped
  it**. Treat that key as public. Remove the var and rotate `SUPABASE_SERVICE_ROLE_KEY`.

This matters less than it looks for the urgent lane, and that is worth being precise
about: **the `directory_members` hole is exploitable with the plain anon key**, which is
public by design and can never be rotated away. Part 1 is not waiting on rotation.

---

## ⚠ Expected false alarm on step 1

`scripts/run-migration-028.mjs:161-174` post-checks that five policy names are gone,
including `'service full access reports'` and `'public read free reports'`. Those two
belong to **Part 2**. A correct Part-1-only apply therefore prints:

```
POST-CONDITION FAILURES:
  - policy directory_reports."service full access reports" still present
```

and exits `1`.

**The transaction has already COMMITTED at that point.** Part 1 is applied and production
is fine. The exit code is wrong, not the database.

Confirm the apply with the AFTER queries in this document, not with that exit code. That
script is outside this change's file scope; the one-line patch is hand-off request #1.

---

## What changes, at a glance

| Part | § | Table | Removed | Replaced by | Breaks anything live? |
|---|---|---|---|---|---|
| **1** | §0 | — | — | 4 `SECURITY DEFINER` predicate helpers | No |
| **1** | §1 | `directory_reports` | — (columns only) | `is_premium`, `updated_at`, `updated_by`, `created_by`, `created_at`, `cover_image_url` | **No** — it *un*-breaks a currently-500ing endpoint |
| **1** | §2 | `directory_members` | `service role all` (ALL, `USING (true)`), `signup insert members` (INSERT, `WITH CHECK (true)`) | `members_select_own`, `members_select_tenant_admin`, `members_insert_self`, `members_update_tenant_admin`, `members_delete_tenant_admin` | **No** — verified caller by caller |
| **1** | §3 | `directory_analytics` | `service read analytics` (SELECT, `USING (true)`) | `analytics_select_tenant_admin`; anon INSERT kept as `analytics_public_insert` | **No** — no anon-key reader exists |
| **1** | §4 | `directory_companies` | `admins update companies` (017 — wrong JWT claim) | `companies_update_admin` | **No** — the branch being fixed has never matched |
| **1** | 029 | `directory_contacts` | `service read contacts` (SELECT, `USING (true)`) | `contacts_select_tenant_admin`; anon INSERT kept as `contacts_public_insert` | **No** — the only anon-key toucher is an INSERT |
| **2** | §5 | `directory_reports` | `public read free reports` / `public read public reports`, `service full access reports` (ALL, `USING (true)`) | `reports_public_read` (accepts `public`, `free`, NULL), `reports_member_read` | **YES — visible product change.** See Part 2 |

---

# Part 1 changes

Every item below carries the same claim: **nothing a user sees changes.** Each one states
the evidence for that claim and gives a before/after you can run.

## 1A — `directory_members`: the live hole

### What is wrong

`migrations/006_sourcing_members.sql:25`

```sql
CREATE POLICY "service role all" ON directory_members FOR ALL USING (true);
```

The name is wrong in a way that hid this for months. A policy with no `TO` clause applies
to `PUBLIC`, i.e. every role including `anon`. `FOR ALL USING (true)` is unrestricted
SELECT/UPDATE/DELETE for anonymous callers, and it sits *beside* `members read own`
(line 24) — RLS policies are OR-ed, so the permissive one wins and `members read own` has
never had any effect. `service_role` never needed this policy; it bypasses RLS regardless.

Second hole, and it is the one that matters most —
`migrations/011_signup_rls_policies.sql:25`:

```sql
CREATE POLICY "signup insert members" ON directory_members FOR INSERT WITH CHECK (true);
```

Dropping `service role all` on its own would be cosmetic. Both must go together.

### What is exposed today — confirmed against production

Independently reproduced against the live database using only the **public anon key**:
`SELECT` on `directory_members` returns **all 70 rows** (HTTP 206, `content-range: 0-0/70`)
including `email`, `full_name`, `role`, `status` and `auth_user_id`.

The write side is worse than the read side. Anonymous `INSERT` is open, so anyone can
write themselves:

```json
{ "tenant_id": "<any>", "auth_user_id": "<their own uid>", "role": "admin", "status": "approved" }
```

That is *exactly* the shape `api/sourcing/lib/adminAuth.js:84-89` accepts as proof of
tenant admin. **So this hole defeats both guards the security round just shipped** — the
client route guard (`src/components/RequireAdmin.jsx` / `src/hooks/useAdmin.js`) *and*
the server-side `requireAdmin()`. An attacker does not need the service key; they mint
their own admin row with the public key and then walk in the front door of the new admin
API. It also grants write access to any company profile via `update-company.js:63`,
`update-deal-bank-listing.js:52` and `withdraw-deal-bank-listing.js:54`, which all
authorize off a member row.

This is the single highest-value change in either file.

### THE TRAP: every live dependency, enumerated

Two clients exist in this codebase and they behave completely differently under RLS:

- `supabase` (`src/lib/supabase.js`) — **anon key**, carries the user's session JWT.
  Role is `authenticated` when signed in, `anon` when not. **RLS applies.**
- `adminSupabase` (`src/pages/SourcingAdmin.jsx:45`) — now `createAdminApiClient()`,
  which POSTs to `/api/sourcing/admin`. That endpoint runs **server-side under
  `service_role`**. **RLS does not apply.**

Every read/write of `directory_members` in the repo:

| File:line | Client | Operation | Survives Part 1? |
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
| `src/pages/SourcingAdmin.jsx:167/200/458` | admin API → **service_role** | select / update | Yes — bypasses RLS |
| `src/pages/admin/MembersSection.jsx:28/38/63/80` | admin API → **service_role** | select / update / insert / delete | Yes — bypasses RLS |
| `src/pages/admin/AddCompanySection.jsx:40` | server endpoint | POSTs `/api/sourcing/admin-setup` | Yes |
| `api/sourcing/signup.js:175` | **service_role** | insert member on signup | Yes |
| `api/sourcing/admin-setup.js:79/85/87/164/171/180` | **service_role** | upsert admin member | Yes |
| `api/sourcing/update-company.js:63` | **service_role** | authz lookup | Yes |
| `api/sourcing/update-deal-bank-listing.js:52` | **service_role** | authz lookup | Yes |
| `api/sourcing/deal-bank-listing.js:65` | **service_role** | authz lookup | Yes |
| `api/sourcing/upload-deal-bank-deck.js:79` | **service_role** | authz lookup | Yes |
| `api/sourcing/withdraw-deal-bank-listing.js:54` | **service_role** | authz lookup | Yes |
| `api/sourcing/lib/membership.js:36` | **service_role** | tier lookup | Yes |
| `api/sourcing/lib/adminAuth.js:88` | **service_role** | admin membership lookup | Yes |
| `scripts/provision-tenant-admins.mjs:80/88/95` | **service_role** | provisioning | Yes |

**Browser-side signup does not touch `directory_members` at all.** `api/sourcing/signup.js`
is server-side and service-role — its own comment says so. The at-risk path is
**portal/login auto-provisioning**, a browser insert with the anon key, and it is preserved.

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

**The non-obvious part, and the one that would have broken signup if missed.** All four
call sites chain `.insert({...}).select().single()`. PostgREST needs **both** an INSERT
policy and a SELECT policy to return the inserted row. With `members_insert_self` alone
the write lands but the read-back comes back empty, `.single()` raises `PGRST116`, the
client sets `provisionErr`, and every new user hits *"Could not set up your account.
Please contact support."* (`SourcingPortalV2.jsx:141-145`). `members_select_own` is what
stops that — the two policies are a pair here, not independent additions. Any future
tightening of `members_select_own` must keep the just-inserted row readable.

### Open question A — self-approval (product decision, deliberately left as-is)

`members_insert_self` still permits `status = 'approved'` on a self-insert, because all
four call sites hard-code it. Forcing `'pending'` would strand every returning user on the
"Your account is pending review" screen (`SourcingLoginV2.jsx:178`).

This is **not** the escalation path — `role` is pinned to `'member'`, so a self-inserted
row can never satisfy `requireAdmin()`. It only means self-signup approval is not a real
gate. If you want it to be one: set `status: 'pending'` at those four call sites, then
tighten the policy to `AND status = 'pending'`. Product call, frontend hand-off.

### Verification

**Before** — expect the two open policies:

```sql
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_members'
 ORDER BY cmd, policyname;
-- expect: "service role all"      (ALL,    {public}, qual = true)
--         "signup insert members" (INSERT, {public}, with_check = true)
--         "members read own"      (SELECT, {public})
```

```bash
curl -si "$VITE_SUPABASE_URL/rest/v1/directory_members?select=email,role,status,auth_user_id" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Range: 0-0" -H "Prefer: count=exact"
# BEFORE: 206, content-range: 0-0/70, a real member row.
# AFTER:  200, [] — and content-range 0-0/0 if you keep the count header.
```

Prove the write side too, before and after:

```bash
curl -s -X POST "$VITE_SUPABASE_URL/rest/v1/directory_members" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"tenant_id":"<any real tenant uuid>","email":"probe@example.com","role":"admin","status":"approved"}'
# BEFORE: 201 Created — an admin row you did not have to authenticate for.
# AFTER:  401/403, "new row violates row-level security policy".
# If BEFORE returns 201, DELETE that probe row with the service key before moving on.
```

**After** — expect exactly five scoped policies and no `true` predicates:

```sql
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_members'
 ORDER BY cmd, policyname;
-- expect: members_select_own, members_select_tenant_admin (SELECT, {authenticated})
--         members_insert_self          (INSERT, {authenticated})
--         members_update_tenant_admin  (UPDATE, {authenticated})
--         members_delete_tenant_admin  (DELETE, {authenticated})
-- expect NO row where qual = 'true' or with_check = 'true'
```

Smoke test — this is the one that matters:

1. Sign in at `os.spacerising.org` as a member whose `directory_members` row already
   exists → portal loads, company details render.
2. Sign in as an auth user with **no** member row → auto-provision fires, portal loads,
   and a new row appears:
   `SELECT id, email, role, status, company_id FROM directory_members ORDER BY created_at DESC LIMIT 3;`
3. `/admin` → Members tab still lists members (server admin API, service_role, unaffected).

---

## 1B — `directory_reports`: the never-applied columns

### What is wrong

`migrations/014_reports_add_is_premium.sql` and `migrations/016_reports_add_updated_fields.sql`
exist in the repo but were never run against production. `api/sourcing/admin-reports.js:22-23`
selects:

```
id, tenant_id, title, description, category, access, file_url, cover_image_url,
is_premium, published_at, created_at, updated_at, created_by, updated_by
```

PostgREST rejects the entire request if any column in the select list does not exist, and
`admin-reports.js:249` turns that into a 500. So **every** GET/POST/PUT against
`/api/sourcing/admin-reports` fails today — the admin Reports tab cannot create or edit a
report at all (`src/pages/admin/ReportsSection.jsx:99` POST, `:124` PUT).

**Extra finding:** `created_by` is selected at line 23 *and* inserted at line 224
(`created_by: user.id`) but has **no migration anywhere in this repo**. It was never
authored, only assumed. §1 adds it. `cover_image_url` and `created_at` are re-asserted
defensively (no-ops if `supabase/migrations/20260723150000_directory_reports_cover_image_url.sql`
and `migrations/012` are already live).

### Why this is a no-visible-change item

Adding columns cannot make anything disappear from the site. `ADD COLUMN IF NOT EXISTS`
on a table this size is a catalog-only operation; `is_premium NOT NULL DEFAULT false`
uses the Postgres 11+ fast path and does not rewrite the table. The
`UPDATE ... SET updated_at = created_at WHERE updated_at IS NULL` backfill touches only
NULLs, so re-running is a no-op. The two foreign keys to `auth.users` are guarded: if prod
holds orphan values the constraint is skipped with a `RAISE NOTICE` instead of aborting.

**No policy on `directory_reports` is touched in Part 1.** The
`ALTER COLUMN access SET DEFAULT` statement that used to sit in this section moved to
Part 2 §5a, where the rest of the access-literal question lives. It is inert either way —
`008:7` already declares `access text NOT NULL DEFAULT 'public'`, and every writer sets
`access` explicitly (`admin-reports.js:201` defaults to `'free'` in JS,
`ReportsSection.jsx:92` posts `access || 'free'`, and there is no other INSERT into
`directory_reports` anywhere in `api/` or `src/`). It moved anyway, because Part 1's
promise of zero product change should need no argument to believe.

### Verification

**Before:**

```sql
SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'directory_reports'
 ORDER BY ordinal_position;
-- expect is_premium / updated_at / updated_by / created_by to be ABSENT
```

```bash
# The 500, before. Signed in as an admin, from the browser console on /admin:
await (await fetch('/api/sourcing/admin-reports', {
  headers: { Authorization: 'Bearer ' + (await supabase.auth.getSession()).data.session.access_token }
})).status
// BEFORE: 500.  AFTER: 200.
```

**After** — all six present:

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
--         (absent = orphan rows; look for the NOTICE in the apply log)

SELECT count(*) FROM directory_reports WHERE updated_at IS NULL AND created_at IS NOT NULL;
-- expect 0 (the backfill ran)
```

Then, signed in as an admin: `/admin` → Reports → edit any report → Save. 200, not 500.

---

## 1C — `directory_analytics`: revoke anon SELECT

### What is wrong

`migrations/007_sourcing_contacts.sql:36-37`

```sql
CREATE POLICY "public insert analytics" ON directory_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "service read analytics" ON directory_analytics FOR SELECT USING (true);
```

The SELECT policy lets any anonymous caller enumerate every `page_view`, `profile_view`,
`contact_click` and — via `metadata` — every **search query typed into the site**
(`SourcingDirectory.jsx:710` writes `{ query, vertical }`). Competitor intelligence, free,
over HTTP.

### What is kept, and why nothing visible changes

Anonymous INSERT stays. `src/pages/sourcingAnalytics.js:15` writes with the anon key,
fire-and-forget, from logged-out visitors. Call sites: `SourcingDirectory.jsx:527`, `:536`,
`:710`; `SourcingProfile.jsx:651`, `:914`. Part 1 recreates it as `analytics_public_insert`
with an explicit `TO anon, authenticated` so the intent is legible in `pg_policies` instead
of implied.

**There are zero anon-key READS of `directory_analytics` anywhere in `src/` or `api/`.**
The only reader is the admin analytics panel (`SourcingAdmin.jsx:287-306`), which now goes
through the server admin endpoint under `service_role`. So this change is invisible.

One thing to confirm before you ever move that panel to a session-authenticated read:
`analytics_select_tenant_admin` only matches a user with an approved `role='admin'` member
row in that tenant, or a global admin whose JWT carries `app_metadata.role = 'admin'`.

```sql
SELECT m.email, m.tenant_id, m.role, m.status
  FROM directory_members m
 WHERE m.role = 'admin' AND m.status = 'approved'
 ORDER BY m.tenant_id;
```

### Accepted risk, not closed here

`WITH CHECK (true)` still lets anyone forge analytics rows against any `tenant_id` and
inflate counts. Closing that needs either a signed server-side ingest endpoint or a `CHECK`
on `event_type`. A `CHECK` constraint is deliberately **not** in 028: it would be validated
against existing prod rows, and one historical row with an unexpected event type would
abort the whole migration. Follow-up work.

### Verification

**Before:**

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/directory_analytics?select=event_type,metadata,created_at&limit=5" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY"
# BEFORE: real events including search queries.  AFTER: []
```

```sql
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_analytics';
-- BEFORE: "public insert analytics" (INSERT, true), "service read analytics" (SELECT, true)
-- AFTER:  "analytics_public_insert"       (INSERT, {anon,authenticated}, with_check = true)
--         "analytics_select_tenant_admin" (SELECT, {authenticated}, dir_is_tenant_admin(...))
```

**After** — confirm anonymous writes still land. Load any public directory page in a
logged-out browser, then:

```sql
SELECT count(*), max(created_at) FROM directory_analytics WHERE created_at > now() - interval '5 minutes';
-- expect a non-zero count that grows as you browse
```

If that count stops growing, the INSERT policy did not recreate correctly — restore by
re-applying `migrations/007` lines 35-37.

---

## 1D — `directory_companies`: supersede migration 017

### What is wrong

`migrations/017_admin_update_policy.sql` lines 6 and 17 both test:

```sql
(auth.jwt() ->> 'role') = 'admin'
```

That reads the **top-level** `role` claim. In a Supabase JWT that claim carries the
Postgres role the request will run as — `anon` or `authenticated` — and it is never
`'admin'`. The app's actual admin flag is `app_metadata.role`:

- `src/pages/SourcingAdmin.jsx:154` — `user.app_metadata.role === 'admin'`
- `src/pages/SourcingDirectory.jsx:745` — same
- `api/sourcing/admin-reports.js:169` — same
- `api/sourcing/lib/adminAuth.js:79` — `user.app_metadata?.role === 'admin'`

So the global-admin branch of `"admins update companies"` has **never matched, not once**.
Approve / Reject / Unapprove only ever worked because the browser held the service key.
Now that the key is out of the source, a global admin with no `directory_members` row
would have had nothing left to fall back on.

017 is already applied to production, so editing that file changes nothing. Part 1 §4
supersedes it with `DROP` + `CREATE` under a new name and the correct claim path:

```sql
(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'   -- via public.dir_is_global_admin()
```

**Second fix in the same policy.** 017's tenant-admin branch inlines
`EXISTS (SELECT 1 FROM directory_members m WHERE ...)`. After §2, that subquery runs under
`directory_members` RLS. It happens to still work — `members_select_own` returns exactly
the row the subquery filters for — but relying on that is a trap for the next person. It is
replaced with `public.dir_is_tenant_admin()`, which is `SECURITY DEFINER` and therefore
immune to how `directory_members` RLS is configured. 017 was the **only** other policy in
the repo referencing `directory_members`
(`grep -rn "directory_members" migrations/ supabase/`), so after §4 there are no inline
cross-table member lookups left in any policy.

### Why nothing visible changes

The branch being fixed has never fired, so nothing that works today stops working. The
change can only *widen*: a global admin who was silently blocked now passes. The old policy
also had no `TO` clause, so it nominally applied to `anon` — but `anon` never satisfied
either branch (`auth.uid()` is null, and the top-level claim is `'anon'`), so scoping the
new one `TO authenticated` loses nothing.

`ALTER TABLE directory_companies ENABLE ROW LEVEL SECURITY` in §4 is a defensive no-op —
`migrations/001_sourcing_directory.sql:90` already enabled it. **Verify that before
believing this file.** If RLS were off on `directory_companies`, that line would take the
entire public directory dark, because `001:96 "public read companies"` would suddenly start
being enforced:

```sql
SELECT relrowsecurity FROM pg_class
 WHERE relnamespace = 'public'::regnamespace AND relname = 'directory_companies';
-- must already be `t` BEFORE you apply. It is.
```

§4 deliberately does **not** touch `directory_companies`' other policies — 011's
`"signup insert companies"` and `"read own pending company"` are the public directory's
read path and the signup write path. Both are wider than they should be (see hand-off #6),
and both are visible-product-change territory.

### Verification

**Before:**

```sql
SELECT policyname, cmd, roles::text, qual
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_companies'
 ORDER BY policyname;
-- expect "admins update companies" (UPDATE, {public}) whose qual contains
--   ((auth.jwt() ->> 'role'::text) = 'admin'::text)
```

Prove the claim is the wrong one — in the browser console, signed in as a global admin:

```js
const t = (await supabase.auth.getSession()).data.session.access_token;
const c = JSON.parse(atob(t.split('.')[1]));
console.log({ topLevelRole: c.role, appMetadataRole: c.app_metadata?.role });
// BEFORE and AFTER: { topLevelRole: "authenticated", appMetadataRole: "admin" }
// That is the whole bug: 017 tested the first field, the app sets the second.
```

**After:**

```sql
SELECT policyname, cmd, roles::text, qual
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_companies'
 ORDER BY policyname;
-- expect "companies_update_admin" (UPDATE, {authenticated}) whose qual references
--   dir_is_tenant_admin(tenant_id) OR dir_is_global_admin()
-- expect "admins update companies" to be GONE
-- expect "public read companies", "signup insert companies", "read own pending company"
--   all still present and UNCHANGED
```

Smoke test: `/admin` → Companies → Approve / Unapprove a company. Still works (it goes
through the server admin endpoint either way — this policy is the safety net underneath).

---

## 1E — `directory_contacts` (migration 029)

### What is wrong

`migrations/007_sourcing_contacts.sql:20`

```sql
CREATE POLICY "service read contacts" ON directory_contacts FOR SELECT USING (true);
```

Same lie in the name as `"service role all"`. No `TO` clause means `PUBLIC`, and
`service_role` never needed it. So any caller with the public anon key can read **every
contact and RFQ submission ever sent through the site**: `sender_name`, `sender_email`,
`sender_phone`, `message`.

This is the same class of PII leak as the members one, and arguably worse: these are
inbound leads from third parties who never had an account, typed into a form that said
nothing about being world-readable.

### Every call site (`grep -rn "directory_contacts" src/ api/ scripts/ migrations/`)

| File:line | Client | Operation | Survives 029? |
|---|---|---|---|
| `src/pages/SourcingProfile.jsx:640` | `supabase` — **ANON KEY** | INSERT (public contact / RFQ form) | Yes — `contacts_public_insert` |
| `src/pages/SourcingAdmin.jsx:335` | `adminSupabase` → `POST /api/sourcing/admin` | SELECT (Contacts tab) | Yes — server-side `service_role`, bypasses RLS |
| `src/pages/SourcingAdmin.jsx:374` | `adminSupabase` → `POST /api/sourcing/admin` | UPDATE `status` | Yes — same |
| `api/sourcing/lib/tablePolicy.js:142` | server allowlist entry (`ops: select/update/delete`, `writable: ['status']`) | — | Yes — that path is `service_role` |

**Exactly one anon-key toucher, and it is a write.** No page, component or endpoint reads
`directory_contacts` with the anon key. The contact form (`SourcingProfile.jsx` →
`ContactForm`) inserts and never selects back — it flips local state to `'success'` on a
clean insert, so it does not even need `RETURNING`. That is why removing anonymous SELECT
is invisible on the live site.

029 requires 028 Part 1 (it uses `dir_is_tenant_admin()` / `dir_is_global_admin()`). The
helpers are deliberately **not** redefined in 029 — two copies of a `SECURITY DEFINER`
authorization predicate in two files is how they drift, and a drifted predicate is a silent
hole. 029 hard-fails with a clear message if they are missing, and
`run-migration-029.mjs --apply` refuses to even open the transaction.

### Accepted risk, not closed here

`WITH CHECK (true)` on the INSERT lets anyone POST forged contact rows against any
`tenant_id` / `company_id` — spam and lead poisoning, not disclosure. Closing it needs a
rate-limited server-side ingest endpoint, the same follow-up the analytics INSERT needs.

### Verification

**Before:**

```sql
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_contacts';
-- expect "public insert contacts" (INSERT, {public}, with_check = true)
--        "service read contacts"  (SELECT, {public}, qual = true)

SELECT count(*) AS submissions, count(DISTINCT tenant_id) AS tenants,
       min(created_at), max(created_at)
  FROM directory_contacts;
-- this is the size of the exposure, in rows
```

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/directory_contacts?select=sender_name,sender_email,sender_phone,message&limit=3" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY"
# BEFORE: real submissions with email, phone and message body.
# AFTER:  []
```

**After:**

```sql
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_contacts'
 ORDER BY cmd, policyname;
-- expect exactly: contacts_public_insert       (INSERT, {anon,authenticated}, with_check = true)
--                 contacts_select_tenant_admin (SELECT, {authenticated}, dir_is_tenant_admin(...))
-- expect NO SELECT policy with qual = 'true'
```

Then the write path, which is the thing that would actually hurt if it broke: open any
company profile on `os.spacerising.org` **logged out**, send a test contact through the
form, confirm the success state renders, then:

```sql
SELECT count(*) FROM directory_contacts WHERE created_at > now() - interval '5 minutes';
-- expect 1 (or run `run-migration-029.mjs --check` and watch the submission count rise)
```

---

# Part 2 — the deferred change

**This is the only change that alters what a user sees. Do not run it until the frontend
hand-off has landed.**

## 2A — the access-value mismatch runs both ways

Half of this was described elsewhere as "013 grants public read on `access='free'` while
the app writes `'public'`". The missing half changes the fix:

- `migrations/008_create_directory_reports.sql:18` shipped `USING (access = 'free')`
- `migrations/013_fix_reports_rls_policy.sql:5` replaced it with `USING (access = 'public')`
- `api/sourcing/admin-reports.js:10` accepts **all five**: `free, member, members, paid, public`
- `api/sourcing/admin-reports.js:201` defaults a **new** report to `access = 'free'`
- `src/pages/admin/ReportsSection.jsx:92` posts `access: reportForm.access || 'free'`
- `src/pages/SourcingReportDetailV2.jsx:151` treats `'free'`, `'public'` and null as free
- `src/pages/OSReportsPage.jsx:97` does the same

So free-tier rows exist in prod under **both** literals, and pinning the policy to either
one leaves the other set invisible to anonymous visitors. §5 accepts
`access IS NULL OR lower(btrim(access)) IN ('public','free')`. (`access` is `NOT NULL` in
`008:7`, so the null branch is unreachable today — it is a guard in case that is ever
relaxed, since three pages already treat null as free.)

Check what is actually in the table before you apply — this single query tells you how much
is currently dark:

```sql
SELECT access, count(*) AS rows, count(file_url) AS with_file_url
  FROM directory_reports
 GROUP BY access
 ORDER BY rows DESC;
```

## 2B — `service full access reports`, and what disappears from the site

`migrations/008_create_directory_reports.sql:19`

```sql
CREATE POLICY "service full access reports" ON directory_reports FOR ALL USING (true);
```

Same pattern as 1A: no `TO` clause, so it applies to `anon`. This is what makes the 013
access-value bug invisible in production — a broken policy does not matter when a second
policy grants everything to everyone. It also means **every members-only and paid report,
including its `file_url`, is readable by any anonymous caller right now.** `file_url` points
at the public `sourcing-reports` storage bucket (`ReportsSection.jsx:68` uses
`getPublicUrl`), so row access equals file access. The paywall is currently decorative.

**THIS IS THE CHANGE THAT ALTERS THE LIVE SITE.**

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

**After Part 2, logged-out visitors stop seeing members-only and paid reports entirely.**
The locked teaser cards do not render as locked — they vanish from the listings. That is
the paywall conversion surface on a live marketing site. Signed-in approved members are
unaffected (`reports_member_read`).

Three options:

- **Option A — accept it.** Flip the switch, run it. Most secure, zero code change. Cost:
  the "Members Only" teasers disappear for anonymous visitors, so nobody logged-out sees
  that premium content exists.
- **Option B — recommended.** Repoint those seven pages at `GET /api/sourcing/reports`
  (`api/sourcing/reports.js:61-96`), which runs server-side with the service key and
  already returns the full set. Add one guard in that handler: null out `file_url` for
  premium rows when the caller is not entitled (the logic already exists in
  `api/sourcing/lib/reportAccess.js:48-62`). Ship that, verify the teasers still render,
  *then* flip the switch. Result: teasers stay, files are actually protected.
- **Option C — not recommended.** Keep anon row access and revoke the column privilege:
  `REVOKE SELECT (file_url) ON directory_reports FROM anon`. RLS is row-level and cannot
  mask a column, so this is the only DB-only way — but it makes `.select('*')` fail outright
  with "permission denied for column file_url" on all seven pages. Strictly worse than B.

## Known gap even after Part 2

`reports_member_read` exposes `file_url` to **any** approved member of the tenant, including
free-tier members — not only paid ones. `api/sourcing/lib/reportAccess.js` is the real paid
gate, but because the bucket is public, row visibility is file visibility. Properly fixing
this means moving `sourcing-reports` to a private bucket and serving signed URLs from
`api/sourcing/download-report.js`. Out of scope for a migration; flagged as follow-up.

## Verification

**Before** — record these numbers. The drop in `anon-visible rows` is exactly the set of
cards that will disappear from the seven pages, i.e. your blast radius as a number, before
you commit to it.

```sql
SELECT policyname, cmd, roles::text, qual
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_reports';
-- expect "service full access reports" (ALL, {public}, qual = true)
--    and one of "public read free reports" / "public read public reports"
```

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/directory_reports?select=id,title,access,file_url" \
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

**After:**

```sql
SELECT policyname, cmd, roles::text, qual
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_reports'
 ORDER BY policyname;
-- expect exactly: reports_member_read (SELECT, {authenticated})
--                 reports_public_read (SELECT, {anon,authenticated})
-- expect NO INSERT/UPDATE/DELETE policies — writes are service_role-only by design

SELECT column_default FROM information_schema.columns
 WHERE table_schema='public' AND table_name='directory_reports' AND column_name='access';
-- expect 'public'::text
```

Then walk the site: `os.spacerising.org` reports page logged out (free reports present,
premium gone or served by the endpoint if you took option B), then signed in as an approved
member (everything present).

---

## Deliberate design choices

- **The Part 2 switch is a guard variable, not a commented-out block.** Commenting out
  ~40 lines of SQL means the SQL stops being syntax-checked and is easy to un-comment
  wrong. The `DO $part2$ ... run_part_2 boolean := false; ... $part2$` block keeps the
  statements intact, executes nothing while the flag is off, and prints a `NOTICE` saying
  so — and re-enabling is a one-word edit plus a re-run of the same file. The DDL inside is
  `EXECUTE`'d from dollar-quoted strings so PL/pgSQL never plans it while the flag is off.
- **`SECURITY DEFINER` helpers.** A policy on `directory_members` that queries
  `directory_members` raises `infinite recursion detected in policy for relation`. The four
  `dir_*` functions run as the owner so the inner read bypasses RLS and terminates. Each is
  `STABLE`, pins `search_path = public, pg_temp` (mandatory for `SECURITY DEFINER` —
  otherwise a rogue schema on the caller's path can shadow the referenced tables), and
  answers only about the *current* caller via `auth.uid()` / `auth.jwt()`. None takes a
  user id, so none can be pointed at another user.
- **The helpers live in Part 1 on purpose.** §4 and migration 029 both depend on them, so
  everything downstream can ship without waiting on the Part 2 product call.
- **`directory_reports` ends up with SELECT policies only** (after Part 2). Intentional, and
  it matches the code: every write already goes through `service_role`
  (`admin-reports.js` POST/PUT, `upload-report.js`, `ReportsSection.jsx:181` delete,
  `delete-blank-reports.js`). The table is not left with RLS on and zero policies.
- **No self-UPDATE / self-DELETE on `directory_members`, and none on `directory_contacts`.**
  No browser code path updates or deletes those rows with the anon key — every one goes
  through the server admin endpoint. Adding the policies would widen the surface for nothing.
- **Tenant-admin policies that nothing calls today.** `members_select_tenant_admin`,
  `members_update_tenant_admin`, `members_delete_tenant_admin`, `analytics_select_tenant_admin`
  and `contacts_select_tenant_admin` are unexercised while the admin panel routes through
  `POST /api/sourcing/admin`. They cost nothing and are the prerequisite for any future
  session-authenticated admin read.

---

## Hand-off requests (files this change does not own)

1. **`scripts/run-migration-028.mjs:161-174` reports a false failure on a Part-1-only
   apply.** Its post-condition list includes `'service full access reports'` and
   `'public read free reports'`, which are Part 2 policies. Remove those two names from the
   `policyname IN (...)` list, or gate them on the same flag. Until then, step 1 of the
   runbook exits `1` after a successful commit. Nothing else in the script is wrong.
2. **Problem 4 / Part 2 option B** — repoint the seven report-fetching pages at
   `GET /api/sourcing/reports`, and null `file_url` for unentitled callers in
   `api/sourcing/reports.js`. This is what unblocks Part 2.
3. **Finish the key retirement.** `src/` no longer reads `VITE_SOURCING_ADMIN_KEY` (one
   stale comment in `src/hooks/useAdmin.js:19`), but the var is still set in Vercel and
   every bundle served so far shipped it. Remove it from all Vercel environments, redeploy,
   then rotate `SUPABASE_SERVICE_ROLE_KEY`. Follow `docs/security/key-rotation-runbook.md`.
4. **`CONTEXT.md:56`** documents the key as "COMPROMISED — BEING RETIRED". Update it once
   rotation is done, and audit git history for a committed key value.
5. **Optional, open question A** — set `status: 'pending'` at the four auto-provision call
   sites if signup approval is meant to gate access, then tighten `members_insert_self`.
6. **Not fixed, needs its own decision: `directory_companies` write policies.**
   `011:8 "signup insert companies"` is `WITH CHECK (status = 'pending')` with no `TO`
   clause — any anon caller can create company rows, which is a spam vector. And
   `011:33 "read own pending company"` is `USING (status IN ('active','pending'))`, which
   despite its name lets anyone read every *pending* (unapproved) company, not just their
   own. Both are visible-product-change territory and are deliberately untouched by Part 1.
7. **Private storage bucket for `sourcing-reports`** + signed URLs from
   `api/sourcing/download-report.js`. This is the only real fix for paid-report files.

---

## Rollback

Each migration is a single transaction, so a failure during apply needs no rollback.

To reverse a *successful* apply, author `030_revert_028_029.sql` re-creating the original
policies from `migrations/006:24-25`, `migrations/007:19-20, 36-37`, `migrations/011:22-27`
and `migrations/017`. Two warnings:

- **Do not drop the added columns.** `api/sourcing/admin-reports.js` needs them; dropping
  them puts that endpoint back to 500.
- Reverting means deliberately re-opening the anonymous read on `directory_members` and
  `directory_contacts`. If the reason for reverting is "something broke", identify which
  policy did it first — the tables are independent and can be reverted one at a time.
