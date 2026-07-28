# APPLY RUNBOOK — sourcing-directory security fixes

**This is the document you follow. Everything else in `docs/security/` is background.**

You do not need to understand the codebase. You need a browser signed in to the Supabase
dashboard, a terminal in this repo, and about thirty minutes.

Written 2026-07-28. Executed by a human. Nothing here is automated.

**Standard of evidence in this document.** Every claim about what production is doing
*right now* was measured on 2026-07-28 against `kzzvjtthknsozktmpvak`, read-only:
PostgREST `HEAD`-style counts (`Prefer: count=exact`, `Range: 0-0`) with the public anon
key and the `service_role` key side by side, plus a fetch of the live JS bundle. No row
data was read and no key value appears anywhere in this repo. Claims that could **not** be
measured are labelled as unverified rather than asserted — the one that matters is in §2,
and it is the most consequential thing in the file. Claims about code are cited to
`file:line` and were re-checked against the working tree the same day.

An earlier draft of this document stated three things about production that turned out not
to be true. They are corrected here, and each correction says what the old claim was, so
nobody re-derives it from a stale copy.

---

## 0. What is broken in production right now

`os.spacerising.org`, Supabase project `kzzvjtthknsozktmpvak`.

**Every claim in this section was measured against production on 2026-07-28** — public
`anon` key and `service_role` key side by side, `Prefer: count=exact` with `Range: 0-0`,
so counts only and no row data. Where something could not be measured from outside the
database, it says so instead of asserting. Nothing here is inherited from an earlier draft
on trust. Re-run any of it yourself with §5.

**One hole is open to anonymous callers today, not three.** The earlier version of this
document said items 2 and 3 were anon-readable. They are not. That mattered enough to
change the shape of the table.

| # | What is wrong | Measured 2026-07-28 | Fixed by |
|---|---|---|---|
| 1 | **The live leak.** Anyone can read all 70 rows of `directory_members` — `email`, `full_name`, `role`, `status`, `auth_user_id`. Worse: anyone can **insert** a row with `role='admin'`, `status='approved'` and their own auth user id. That is exactly the shape the server's `requireAdmin()` accepts as proof of admin, so it defeats the new authorization work too. | **CONFIRMED OPEN.** anon → `HTTP 206`, `content-range: 0-0/70`, a real member row in the body. `service_role` sees the same 70. Cause is in the files: `migrations/006:25` `"service role all" FOR ALL USING (true)` has no `TO` clause, so it applies to `PUBLIC`. | **028 Part 1 §2** |
| 2 | `directory_contacts` — name, email, phone and message body of every contact / RFQ submission ever sent through the site. | **NOT ANON-READABLE TODAY.** anon → `HTTP 200`, `content-range: */0`, body `[]`. `service_role` sees 7 rows. `migrations/007:20` ships `"service read contacts" FOR SELECT USING (true)` with no `TO` clause, which *would* leak — production is not running that. It was changed out of band and there is no file for it. **029 is hardening, not plugging:** it replaces an undocumented production state with a policy set that lives in a migration, so the next hand-edit shows up as drift instead of disappearing. | **029** |
| 3 | `directory_analytics` — every analytics event, including visitors' search queries. | **NOT ANON-READABLE TODAY.** anon → `HTTP 200`, `content-range: */0`, body `[]`. `service_role` sees 3,105 rows. Same story as #2: `migrations/007:37` says `USING (true)`, production disagrees. **028 §3 is hardening, not plugging.** | **028 Part 1 §3** |
| 4 | The admin Reports tab cannot save anything. `api/sourcing/admin-reports.js:23` selects 14 columns and **five of them do not exist in production**, so PostgREST rejects the query and the endpoint throws into its 500 handler (`admin-reports.js:258`). | **CONFIRMED.** Probed each of the 14 with `service_role`. Missing: `cover_image_url`, `is_premium`, `updated_at`, `created_by`, `updated_by`. Present: `id`, `tenant_id`, `title`, `description`, `category`, `access`, `file_url`, `published_at`, `created_at`. Five, not six — 028 §1 issues six `ADD COLUMN IF NOT EXISTS` because it also re-asserts `created_at`, which already exists and is a no-op. | **028 Part 1 §1** |
| 5 | Global-admin approve / reject on companies has never worked through the database. Migration 017 checks the wrong JWT claim. It only ever worked because the browser held the service key — and that is being taken away. | **Not measurable from outside**; verified by reading `migrations/017_admin_update_policy.sql:6,17` (`auth.jwt() ->> 'role'`) against `api/sourcing/lib/adminAuth.js:79` (`app_metadata.role`). ⚠ **This item has a live-site hazard attached that the earlier draft got wrong — read §2 before applying.** | **028 Part 1 §4** |
| 6 | The `service_role` key ships in the public JavaScript bundle and is in git history. Anyone who loaded `/admin` has it. | **CONFIRMED, STILL SERVING.** Fetched `https://os.spacerising.org/` and all 87 of its JS chunks today. `assets/SourcingAdmin-zbp9a1l4.js` contains a decodable JWT with `role: service_role`, `ref: kzzvjtthknsozktmpvak`. (The `anon` key appears in two other chunks, which is by design.) The fix is in this branch but **nothing has been deployed**, so the live bundle still carries it. | Code deploy, then **key rotation** — `key-rotation-runbook.md` |
| 7 | Anonymous visitors can read every `directory_reports` row including `file_url`, and that URL points at a public storage bucket. The paywall is decorative. | **CONFIRMED OPEN — and empty of loot today.** anon reads all 8 report rows, `file_url` populated on all 8. But all 8 have `access = 'free'`: **there is no gated or paid report in production right now**, so nothing behind a paywall is currently downloadable. The hole is structural, not currently exploited. That changes the urgency of Part 2 — see §7. | **028 Part 2 — deferred**, see §7 |

---

## 1. The order, and why it matters

```
  1. Apply migration 028 PART 1        <- CLOSES item 1 (the live leak) and item 4.
                                          Hardens item 3. Item 5 is fixed but may be
                                          inert — see §2.
  2. Apply migration 029               <- HARDENS item 2. It is already closed in prod
                                          by an out-of-band edit nobody recorded.
  3. Run the probes (§5)               <- this is the pass condition
  4. Deploy the code change
  5. Verify /admin works on production WITHOUT the browser key
  6. Rotate the service_role key + database password
  7. Later: Part 2 (item 7), after frontend work
```

"Closes" and "hardens" are different words on purpose. Only item 1 is bleeding right now.

**Migrations first, before any deploy.** Item 1 is exploitable right now with the *public*
anon key — the one that ships inside the site's JavaScript on purpose and can never be
rotated away. No deploy and no key rotation touches it; only the migration does. Items 2
and 3 are already closed in production by out-of-band edits (§0), so those sections are
hardening — but they run in the same transaction and cost nothing extra, and putting the
real policy set in a file is the point.

The migrations cannot break the site as it is deployed today. Every caller was enumerated
one by one in `028-impact-analysis.md`, the browser paths that use `directory_members`
(sign-in auto-provision) get replacement policies in the same transaction, and §4's one
line that *could* have taken the public directory dark has been made conditional (§2).

**Deploy before you rotate. This one will bite you.** The bundle currently serving
`os.spacerising.org` builds its admin Supabase client from `VITE_SOURCING_ADMIN_KEY`,
which holds the `service_role` key, and relies on service-role privileges to bypass RLS.
**Measured, not assumed:** the live chunk `assets/SourcingAdmin-zbp9a1l4.js` was fetched
today and does contain a `service_role` JWT for this project.
The moment you invalidate that key, the admin panel 401s on every query. There is no
fallback — it degrades to the anon client, which RLS refuses. You would have taken the
admin panel down for as long as it takes to ship a new build, and you would be doing that
under outage pressure. Deploy the server-side admin API first, load every tab of `/admin`
on production, *then* rotate.

**028 before 029.** 029 uses the `dir_is_tenant_admin()` / `dir_is_global_admin()` helper
functions that 028 §0 creates. Run out of order and 029 raises an exception and rolls
itself back — harmless, but it will not apply.

**Part 2 last, and not today.** See §7.

---

## 2. Before you start

```bash
cd /path/to/sourcing-directory

# These two values are PUBLIC. The anon key ships in the site's JavaScript by design.
# NEVER put the service_role key in either of them.
export SB_URL="https://<project-ref>.supabase.co"
export SB_ANON_KEY="<the public anon key, from Supabase dashboard -> Project Settings -> API>"
```

Run the BEFORE probes in §5 now, and keep the output. It is the difference between "we
fixed it" and "we believe we fixed it".

### The one thing nobody could measure from outside — read this before applying

Everything else in §0 was probed over HTTP. **One fact could not be**, because `pg_catalog`
is not reachable through PostgREST and there is no database password on the machine this
was written on: whether row-level security is actually **on** for `directory_companies`.

This matters more than any other unknown in the file. Migration 028 §4 used to run
`ALTER TABLE directory_companies ENABLE ROW LEVEL SECURITY` unconditionally, under a
comment claiming `relrowsecurity` had been verified as `t`. It had not been. And the
measurements point the other way:

```
directory_companies                     anon -> 206, 166 rows
directory_companies?status=eq.active    anon -> 206, 165 rows
directory_companies?status=eq.inactive  anon -> 200,   1 row   <- anon CAN read this
```

The only SELECT policies this repo ships for that table are `001:96`
(`USING (status = 'active')`) and `011:33` (`USING (status IN ('active','pending'))`).
Neither admits `status = 'inactive'`. So production is running **either** RLS off on that
table, **or** RLS on plus a permissive SELECT policy that exists in no migration file.
Both are consistent with drift that is already proven here — items 2 and 3 in §0 are
policies the files say are `USING (true)` and production has quietly changed.

If RLS is off and something enables it while the live policy set has no working public
read path, `os.spacerising.org`'s company directory goes dark. That is the single worst
outcome available in this whole exercise.

**§4 has been changed so it cannot cause that.** It now reads `relrowsecurity` first and
enables RLS only if it is already enabled — a true no-op. If it is off, it leaves it off,
prints a loud `WARNING` block in the result pane, and records the follow-up. Leaving it
off is exactly today's behaviour: no better, no worse. It is **not** fixed, and §8 says so.

Run this in the SQL editor first anyway, so you know which branch you are in before you
paste anything:

```sql
SELECT c.relrowsecurity AS rls_on_directory_companies
  FROM pg_class c
 WHERE c.relnamespace = 'public'::regnamespace
   AND c.relname = 'directory_companies';

SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'directory_companies'
 ORDER BY cmd, policyname;
```

- **`t`, and the policy list contains `public read companies` / `read own pending
  company`** → §4's ALTER is the no-op it always claimed to be. Note that anon can still
  read the `inactive` row, so expect a third permissive SELECT policy in that list. Do not
  drop it today; log it in §8.
- **`f`** → §4 will skip the ALTER and warn. Expected. Keep going; the members leak is the
  urgent item and it is unaffected.

---

## 3. Apply migration 028 Part 1

Two paths. **Path A needs no credentials and is the one to use.** Path B only works if
someone can produce the database password, which is not on the machine this was written
on.

Both paths apply **byte-identical SQL**. Path A is not a lesser version.

### Path A — Supabase SQL editor (primary)

```bash
node scripts/run-migration-028.mjs --emit-sql=/tmp/028.sql
# or straight to the clipboard:
node scripts/run-migration-028.mjs --emit-sql | pbcopy
```

Then:

1. Supabase dashboard → your project → **SQL Editor** → **New query**.
2. Paste the whole file. Do not trim the header comment — it is a comment, it costs
   nothing, and it records what you ran.
3. **Run**.
4. Read the result grid at the bottom. It is a table of checks; every row says what it
   expects. Row 12 is the Part 2 marker and should read **1** (Part 2 still deferred —
   that is correct today).
5. **Read the notices/messages pane too, not just the grid.** §4 now reports the real
   `directory_companies` RLS state there — either a one-line `NOTICE` saying RLS was
   already on, or a boxed `WARNING` block saying it is off and was deliberately left off.
   Whichever you get, write it down: it is the answer to the §2 question and nobody has it
   yet. Row 11 of the grid carries the same fact as `relname=relrowsecurity` pairs.
   ⚠ Row 11's label reads *"expect every one = true"*. That label is stale — it predates
   §4 being made conditional, and it lives in `scripts/run-migration-028.mjs`, which was
   out of this round's file scope. **`directory_companies=false` in row 11 is an expected
   result, not a failure.** It means §4 correctly declined to enable RLS. Every other table
   in that row must still read `true`.

The whole file is one transaction. If anything fails, the editor shows the error and
**nothing at all is applied**. If you see a notice about a transaction already being in
progress, ignore it — the verification query at the bottom runs after `COMMIT` and only
reads.

> **What the emitted file contains:** the exact contents of
> `migrations/028_security_and_missing_tables.sql`, plus a header comment and a read-only
> verification `SELECT` after `COMMIT`. Nothing is rewritten or summarised. The generator
> also reads the `run_part_2` switch out of the source file and states in the header which
> parts will run, so the file cannot silently disagree with itself.

### Path B — the runner, if you have the database password

The password is **not** the `service_role` key. Get the real one from the Supabase
dashboard → **Project Settings → Database → Connection string → URI**, then put it in
`.env.prod.local` (which is git-ignored):

```
SUPABASE_DB_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

Use the direct connection or the **session** pooler (port 5432). The transaction pooler
(port 6543) cannot run a multi-statement migration; the script warns you if you point it
there.

```bash
# Read-only. Changes nothing. Read the BEFORE block it prints.
node --env-file=.env.prod.local scripts/run-migration-028.mjs --check

# Apply.
node --env-file=.env.prod.local scripts/run-migration-028.mjs --apply
```

Expected on success: `Migration 028 applied and verified — PART 1 ONLY.` and exit code 0,
followed by a note that Part 2 was deliberately skipped. **That note is not an error.**

> **Ignore the "KNOWN FALSE ALARM" note in the migration header.**
> `migrations/028_security_and_missing_tables.sql:58-65` tells you that a correct
> Part-1-only apply prints `POST-CONDITION FAILURES` and exits 1. That *was* true — the
> script asserted Part 2's effects unconditionally. It was fixed in commit `252f2c7`: it
> now reads the `run_part_2` switch out of the migration file, cross-checks it against the
> database's own notices, and asserts only what actually ran. **A correct Part-1-only apply
> exits 0.**
>
> That header comment is stale and is still stale as of 2026-07-28 — it was out of this
> round's file scope, which only covered §4. The matching stale section in
> `028-impact-analysis.md` **has** been corrected and now says so.
>
> If you see `POST-CONDITION FAILURES` now, treat it as real — go to §6.

---

## 4. Apply migration 029

Identical shape. 028 Part 1 must already be applied.

```bash
# Path A
node scripts/run-migration-029.mjs --emit-sql=/tmp/029.sql     # then paste + Run
node scripts/run-migration-029.mjs --emit-sql | pbcopy

# Path B
node --env-file=.env.prod.local scripts/run-migration-029.mjs --check
node --env-file=.env.prod.local scripts/run-migration-029.mjs --apply
```

If 028 Part 1 has not landed, Path B refuses to start and Path A raises an exception and
rolls back. Either way nothing is half-applied. Go back to §3.

`--check` prints how many contact submissions exist but never prints a submission. **7 as
of 2026-07-28.** That is the amount of PII at risk *if* the SELECT policy on that table is
ever loosened again — not the size of a current exposure, because anon cannot read it today
(§5.2). Either way it does not belong in a terminal scrollback.

---

## 5. THE PASS CONDITION IS AN HTTP PROBE

**Do not accept a policy listing as proof.** 028 drops three `directory_members` policies
**by name**. If production carries a fourth permissive policy under a name nobody wrote
down, every listing and every check in both scripts still passes — and the leak survives
untouched. The only thing that settles it is asking the database the same way an attacker
would, with the public anon key.

Run each probe **before** and **after**. Before is what makes after mean something.

**The BEFORE values below are not predictions — they are what these exact probes returned
on 2026-07-28.** If your BEFORE does not match, production has moved since this was
written; stop and work out why before applying anything.

### 5.1 `directory_members` — the escalation hole

```bash
curl -si "$SB_URL/rest/v1/directory_members?select=id" \
  -H "apikey: $SB_ANON_KEY" -H "Prefer: count=exact" -H "Range: 0-0"
```

- **BEFORE (measured 2026-07-28, leaking):** `HTTP/2 206`, `content-range: 0-0/70`, one
  real row in the body.
- **AFTER (fixed):** `HTTP/2 200`, body `[]`, and the count in `content-range` is `0`
  (`*/0` or `0-0/0`). A `401` is also a pass.
- **Anything with rows in it is a FAIL.** Do not move on. See §6.

**This is the only one of the three that is actually leaking.** It is the reason the
migration is urgent. 5.2 and 5.3 are already closed — see below.

The write side, optional but worth doing — this is the actual privilege escalation.
Substitute a real tenant uuid, or the BEFORE will fail on a foreign key rather than on
authorization:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$SB_URL/rest/v1/directory_members" \
  -H "apikey: $SB_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"tenant_id":"<a real tenant uuid>","email":"probe@example.com","role":"admin","status":"approved"}'
```

- **BEFORE:** `201` — an admin row created without authenticating. **Delete that row**
  before you go any further.
- **AFTER:** `401` or `403`, `new row violates row-level security policy`.

### 5.2 `directory_contacts` — already closed; this is a regression guard

```bash
curl -si "$SB_URL/rest/v1/directory_contacts?select=id" \
  -H "apikey: $SB_ANON_KEY" -H "Prefer: count=exact" -H "Range: 0-0"
```

- **BEFORE (measured 2026-07-28):** `HTTP/2 200`, `content-range: */0`, body `[]`.
  **Anon cannot read this table today.** `service_role` sees 7 rows, so the data is there
  — anon is being filtered.
- **AFTER:** identical. `200`, `[]`, total `0`.
- **A FAIL here is rows appearing that were not there before**, i.e. 029 made it *worse*.

An earlier draft of this document claimed this table was anon-readable and that the BEFORE
would show real submissions. It does not. `migrations/007:20` ships
`"service read contacts" FOR SELECT USING (true)` with no `TO` clause, which would leak —
but production is not running that policy. Somebody changed it by hand and left no file.

**029 is still worth applying.** It is defence in depth, not a plug: it drops whatever is
there by name, recreates a named INSERT policy for the public form and a
`dir_is_tenant_admin()`-scoped SELECT policy, and puts the whole thing in a migration. The
current state is correct by accident and nothing stops the next dashboard edit from undoing
it silently. Do not describe this as closing an open leak — it is not one today.

Then the half that would actually hurt if it broke — **the contact form must still work**.
Open any company profile on `os.spacerising.org` **logged out**, send a test message,
confirm the success state renders. Then re-run `run-migration-029.mjs --check` and confirm
the submission count went up by one, or in the SQL editor:

```sql
SELECT count(*) FROM directory_contacts WHERE created_at > now() - interval '5 minutes';
```

### 5.3 `directory_analytics` — already closed; this is a regression guard

```bash
curl -si "$SB_URL/rest/v1/directory_analytics?select=id" \
  -H "apikey: $SB_ANON_KEY" -H "Prefer: count=exact" -H "Range: 0-0"
```

- **BEFORE (measured 2026-07-28):** `HTTP/2 200`, `content-range: */0`, body `[]`.
  **Anon cannot enumerate analytics today.** `service_role` sees 3,105 rows.
- **AFTER:** identical. `200`, `[]`, total `0`.

Same correction as 5.2: `migrations/007:37` ships `"service read analytics" FOR SELECT
USING (true)` with no `TO` clause and production is not running it. The search-query
exposure an earlier draft described is **not open**. 028 §3 is hardening — it names the
policies, scopes the SELECT to tenant admins via `dir_is_tenant_admin()`, and makes the
kept anon INSERT explicit as `analytics_public_insert TO anon, authenticated`.

Anonymous event **writes** must survive. Browse two or three public directory pages logged
out, then in the SQL editor:

```sql
SELECT count(*), max(created_at) FROM directory_analytics WHERE created_at > now() - interval '5 minutes';
```

A count that grows as you browse is the pass. If it stops growing, the INSERT policy did
not recreate — see §6.

### 5.4 Two probes that must NOT change

These catch the two ways this could go wrong in the other direction.

```bash
# The public directory itself. 166 rows BEFORE and AFTER (measured 2026-07-28).
curl -si "$SB_URL/rest/v1/directory_companies?select=id" \
  -H "apikey: $SB_ANON_KEY" -H "Prefer: count=exact" -H "Range: 0-0"

# Reports. 8 rows BEFORE and AFTER — Part 2 is deferred on purpose.
curl -si "$SB_URL/rest/v1/directory_reports?select=id" \
  -H "apikey: $SB_ANON_KEY" -H "Prefer: count=exact" -H "Range: 0-0"
```

- `directory_companies` **must stay at 166.** `[]` means the public directory has gone
  dark — the single worst outcome available here. Go to §6 immediately. A drop to **165**
  is the other thing to watch for: that is the one `status = 'inactive'` row, and it means
  RLS was switched on for that table by something. §4 is written not to do that; if the
  count moves, something else did.
- `directory_reports` **must stay at 8.** A drop means Part 2 ran when it should not have.
  Note that all 8 rows currently have `access = 'free'`, so even a stray Part 2 apply would
  leave all 8 visible — an unchanged count is necessary but not sufficient. Confirm with
  row 12 of the emitted VERIFY grid (`1` = Part 2 still deferred).

### 5.5 Then look at the site

Logged out: the directory lists companies, a company profile opens, the reports listings
render exactly as before. Signed in as a member: the portal loads. Signed in as an admin:
`/admin` opens and the Members, Contacts, Analytics and Reports tabs all load.

Sign up as a brand-new user if you can — auto-provision is the one browser path 028 §2
rewrites. The failure mode to watch for is the message *"Could not set up your account.
Please contact support."*

---

## 6. If a step fails

**During apply, either path.** Each migration is a single `BEGIN … COMMIT`. Any error
rolls back the entire file and production is exactly as it was. There is nothing to undo.
Read the error, fix the cause, run it again.

**`password authentication failed for user "postgres"`.** A credentials problem, not a
migration problem — and the reason these runners never worked before today. You have the
wrong value in `SUPABASE_DB_URL`. Switch to Path A; it needs no credentials.

**`Migration 029 requires the dir_* helper functions from migration 028 Part 1`.** 029 ran
first. Nothing was applied. Do §3, then §4.

**`POST-CONDITION FAILURES` after an apply.** The transaction already committed — the
database is in the state the script prints under `AFTER`. **Do not hand-revert anything.**
Run the §5 probes. If the probes pass, the leak is closed and the post-condition is
telling you about a naming or shape difference in production that nobody documented.
Capture the whole `AFTER` block and escalate. If the probes *fail*, the migration did not
do its job — capture the same output and escalate; do not improvise policy SQL against
production.

**A probe still returns rows after apply.** There is a permissive policy under a name the
migration does not drop. Do not guess at it. In the SQL editor:

```sql
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('directory_members','directory_analytics','directory_contacts')
 ORDER BY tablename, cmd, policyname;
```

Anything reachable by `{public}` or `{anon}` on a `SELECT` or `ALL` row is the culprit.
Drop it by name, then re-run the probe.

**The public directory went dark** (§5.4 returns `[]`). Restore the read policy from
migration 001 in the SQL editor:

```sql
CREATE POLICY "public read companies" ON directory_companies FOR SELECT USING (status = 'active');
```

Then re-probe. Do **not** disable RLS on that table as a fix — that re-opens writes.

**Analytics or contact writes stopped landing.** The INSERT policy did not recreate.
Re-run the migration (it is idempotent); if it still fails, in the SQL editor:

```sql
SELECT policyname, cmd, roles::text, with_check FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('directory_analytics','directory_contacts') AND cmd='INSERT';
-- expect analytics_public_insert and contacts_public_insert, TO {anon,authenticated}, WITH CHECK true
```

**New sign-ups break** ("Could not set up your account"). `members_insert_self` is
rejecting a row the browser used to be allowed to write. Get the exact PostgREST error out
of the browser console and escalate it. Do **not** re-open `directory_members` to fix it —
that restores the escalation hole, which is worse than a broken sign-up.

### What is safe to re-run

**Everything. Both migrations are idempotent, by construction, and running either one
twice changes nothing the second time.** Every count below was recounted against the SQL
on 2026-07-28:

- Every `CREATE POLICY` is preceded by `DROP POLICY IF EXISTS` for that exact name —
  8 drops before 5 creates on `directory_members`, 4 before 2 on `directory_analytics`,
  2 before 1 on `directory_companies`, 4 before 2 on `directory_contacts` (029).
- **Five** helper functions, all `CREATE OR REPLACE`: `dir_is_global_admin`,
  `dir_is_tenant_admin`, `dir_is_tenant_member`, `dir_may_claim_company`,
  `dir_may_join_tenant`. (An earlier draft said four. It is five.)
- All six report columns are `ADD COLUMN IF NOT EXISTS`; the index is
  `CREATE INDEX IF NOT EXISTS`. Five of the six are genuinely missing from production;
  `created_at` already exists and its `ADD COLUMN` is a no-op on the first run too.
- The one data change, `UPDATE directory_reports SET updated_at = created_at`, is scoped
  `WHERE updated_at IS NULL`. A second run matches nothing.
- Both foreign keys are added only after an existence check against `pg_constraint`.
- §4's `ENABLE ROW LEVEL SECURITY` on `directory_companies` now runs only when
  `relrowsecurity` is already true, so it is a no-op on every run including the first.
- Each file is a single transaction, so a partial state is not reachable in the first
  place.

This was verified by reading the SQL, not by executing it twice — there is no database
this machine can reach with write access. If you take Path B, `--check` before and after a
second `--apply` is a free confirmation.

**One thing re-running does NOT do:** if Part 2 has already been applied, running 028
again with the switch back to `false` does **not** roll Part 2 back. Nothing drops
`reports_public_read` / `reports_member_read`. Part 2 is forward-only.

---

## 7. What is still open after all of this

**The reports paywall — 028 Part 2, item 7 in §0.** Anonymous visitors can still read
every `directory_reports` row, including `file_url`, and that URL points at a public
storage bucket. This is deliberately still open.

*Measured 2026-07-28, and it changes the urgency:* there are **8 reports in production and
all 8 have `access = 'free'`**. So nothing gated is downloadable today, because nothing is
gated. The hole is structural — the first members-only or paid report anyone publishes is
immediately world-readable — but "anyone can download a paid report" is not true right now,
and the earlier draft said it was. Treat this as a gate to close *before* the first paid
report ships, not as an active breach.

*Waiting on:* seven pages fetch reports with `.select('*')` and no access filter, and lean
on the database to decide what comes back, then draw a "Members Only" badge client-side
(`SourcingReportsV2`, `OSReportsPage`, `SpaceOSHomeV3`, `SourcingReportDetailV2`,
`SourcingDirectory`, `SourcingReports`, `srw/SRWHomeV2` — all seven files confirmed to
exist on this branch). Close the hole while those pages still trust RLS and locked teaser
cards do not render as locked — they **vanish** for logged-out visitors. That is the
paywall's conversion surface on a live marketing site.

*One nuance the earlier draft missed:* Part 2's `reports_public_read` admits
`access IS NULL OR lower(btrim(access)) IN ('public','free')`, and **all 8 live reports are
`'free'`**. So if you flipped the switch today, nothing would actually disappear — the
teaser problem is entirely about reports that do not exist yet. That makes the frontend
hand-off cheaper to do *now*, before there is anything to lose, rather than under pressure
after the first paid report is published. It does not make Part 2 safe to flip blind: the
argument holds only while every row is free, and one new members-only report invalidates it.

*The sequence when it is time:* repoint those seven pages at `GET /api/sourcing/reports`
(which runs server-side and already returns the full set) and null out `file_url` for
callers without entitlement → deploy → verify logged-out visitors still see the teasers →
change the single literal `run_part_2 boolean := false;` to `true` in
`migrations/028_security_and_missing_tables.sql` → apply 028 again. Re-running Part 1 is
safe and intended.

*Still not closed even then:* `reports_member_read` exposes `file_url` to any approved
member of the tenant, including free-tier members. RLS is row-level and cannot mask a
single column. That needs a private bucket and signed URLs.

**Forged writes.** Both `analytics_public_insert` and `contacts_public_insert` are
`WITH CHECK (true)`, so anyone can POST junk analytics events or fake contact submissions
against any tenant. That is spam and lead poisoning, not disclosure — a deliberate
trade to keep the public forms working. Closing it needs a rate-limited server-side
ingest endpoint.

**Self-approval.** `members_insert_self` still allows `status = 'approved'`, because all
four browser auto-provision call sites hard-code it and forcing `'pending'` would strand
every returning user on the review screen (confirmed: `SourcingPortal.jsx:96`,
`SourcingPortalV2.jsx:136`, `SourcingLogin.jsx:143`, `SourcingLoginV2.jsx:161`). Role is
pinned to `'member'`, so this is not the admin-escalation path. It is a product decision,
not a schema one.

**Key rotation.** Separate track, separate document: `key-rotation-runbook.md`. Not
blocked by these migrations, and they are not blocked by it.

**Admin file uploads.** Reported broken after the service-role key leaves the browser —
see `upload-verification.md`. Unrelated to these migrations and not fixed by them.

---

## 8. KNOWN ISSUES NOT FIXED

An adversarial review of this branch surfaced a family of admin-panel defects that all
share one shape: **the screen says the action worked when it did not.** They are real. They
are also, with one exception, *pre-existing* — they behave exactly the same on production
today as they will after this work lands.

That is the whole bar for this round: **be no worse than production is today, with the
security holes closed.** These are recorded here so they are not lost, not because they are
being deferred quietly. Every line item below was re-checked against the working tree on
2026-07-28; file and line references are current.

| # | What it is | Worse than production today? |
|---|---|---|
| 1 | **`directory_companies` RLS state is unknown, and may be off.** See §2. Anon reads a `status = 'inactive'` company that no policy in this repo permits under enforced RLS. If RLS is off, every policy on the public company directory is inert and anon holds whatever raw table privileges Postgres granted it — which on a default Supabase project includes writes. | **No — identical.** §4 was rewritten specifically so this migration does not change it in either direction. But this is the highest-value thing on this list and it needs its own round: measure `relrowsecurity`, read the live policy list, then decide. Do not enable RLS on that table without first confirming a working public read policy exists. |
| 2 | **"Account deleted" deletes half an account.** `src/pages/admin/MembersSection.jsx:75-89` deletes the `directory_members` row (`:80`) and reports `Account deleted.` (`:84`). The Supabase **auth user survives** — the person can still sign in, and the portal's auto-provision path will hand them a fresh member row on next login. (The DB call itself *is* error-checked, `if (error) throw error` at `:81`; the defect is the claim the UI makes, not a swallowed error.) | **No — identical.** Same code path, same outcome, before and after. |
| 3 | **`api/sourcing/upgrade-membership.js` is unauthenticated and reports success without doing anything.** No auth check of any kind (`:10-26` — CORS, method, body-shape and nothing else); builds an **anon** client (`:27`); updates `directory_companies` (`:30-36`) then returns `{success:true}` (`:40`). It *does* check `if (error) throw error` at `:38` — but a PostgREST `UPDATE` that RLS filters down to zero rows returns **no error**, so the check never fires. Success is reported, nothing is written. (The brief for this round described the error as unchecked; it is checked, and the check is simply blind to this failure mode. Same outcome, different mechanism.) | **No — identical**, and it has been this way since the file was written. ⚠ Read together with #1: *if* RLS is off on `directory_companies`, this is not a silent no-op — it is an **unauthenticated write to the public company directory** by anyone who can guess a `company_id`. Settle #1 before deciding how urgent this is. |
| 4 | **`fetchReports` cannot distinguish failure from empty.** `src/pages/SourcingAdmin.jsx:364` destructures `const { data } = await q` — the `error` is dropped on the floor — then `setReports(data \|\| [])`. A permissions failure and "there are no reports" render identically. | **No — identical.** The `try/catch` around it only sees thrown exceptions, and supabase-js resolves rather than throwing. |
| 5 | **Self-contradicting write policy on `membership_tiers`.** `src/pages/admin/OrganizationsSection.jsx:26` sends `membership_tiers: []` on every org insert. `api/sourcing/lib/tablePolicy.js:136` lists `membership_tiers` as writable, but `PROTECTED_COLUMNS` (`tablePolicy.js:55`) strips everything matching `/^membership_/` from every payload on every table. The field is advertised as writable and is always stripped. The contradiction is already flagged in a code comment at `tablePolicy.js:134-135`, so it is known — it is just not resolved. | **No — identical**, and arguably safer than the old path: under the browser service-role client the write went straight through. Now it is stripped and reported as a warning. The bug is the policy table lying about it, not data loss. |
| 6 | **`src/lib/adminApi.js` never rejects.** Documented at `adminApi.js:41`: *"Always resolves — never rejects — with `{ data, error, count, warnings }`."* That is a deliberate drop-in match for supabase-js, but it means every caller that ignores `error` fails silently. **Measured: 36 `adminSupabase` write call sites in `src/`, 21 of which never mention `error`** (line-level scan, so treat 21 as a floor, not a precise count). Sites include `SourcingAdmin.jsx:379, :409, :443, :451, :693`, `DealBankSection.jsx:106, :116, :427-428`, `TagsSection.jsx:61, :74`, `admin/audit.js:6`. | **No — but the risk profile changed.** These errors were *structurally impossible* before: the browser held `service_role`, which bypasses RLS, so writes did not fail. Now they route through `/api/sourcing/admin` and can fail on authorization. The call sites did not change; what changed is that failure is now reachable. This is the item most likely to produce a "why didn't my change save" report after deploy. |

**Fixed this round, so no longer on this list:** *Add Company in global mode.* It used to
create companies with no `tenant_id` whenever the admin was in "All Directories" mode —
which is the default, and all five live admin accounts are platform admins — so every
company added from that form landed invisible while the form said "Added!". Now blocked up
front with an explicit error (`src/pages/admin/AddCompanySection.jsx:35`, `:40-43`) and
`tenant_id` is sent unconditionally (`:65`). Commit `6137791`.

**None of the six above is a reason to delay the migrations.** They are admin-panel
truthfulness bugs; the migrations are about anonymous access to member PII. Different
lanes.

---

## Reference

| Document | What it is for |
|---|---|
| **this file** | the procedure |
| `028-impact-analysis.md` | why each change is safe, caller by caller |
| `key-rotation-runbook.md` | rotating the leaked service_role key |
| `upload-verification.md` | the admin upload regression |
| `migrations/028_security_and_missing_tables.sql` | the SQL, Part 1 + deferred Part 2 |
| `migrations/029_contacts_rls.sql` | the SQL |

**No key value belongs in this file, in a commit, or in a screenshot. Not the anon key,
and absolutely not the service_role key.**
