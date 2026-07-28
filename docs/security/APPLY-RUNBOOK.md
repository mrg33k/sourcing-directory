# APPLY RUNBOOK — sourcing-directory security fixes

**This is the document you follow. Everything else in `docs/security/` is background.**

You do not need to understand the codebase. You need a browser signed in to the Supabase
dashboard, a terminal in this repo, and about thirty minutes.

Written 2026-07-28. Executed by a human. Nothing here is automated.

---

## 0. What is broken in production right now

`os.spacerising.org`, Supabase project `kzzvjtthknsozktmpvak`. Every item below is live
today. The first three are exploitable by **anyone**, using only the public `anon` key —
the one that ships inside the site's JavaScript on purpose and can never be rotated away.

| # | What is wrong | Fixed by |
|---|---|---|
| 1 | Anyone can read all 70 rows of `directory_members` — email, full name, role, status, auth user id. Worse: anyone can **insert** a row with `role='admin'`, `status='approved'` and their own auth user id. That is exactly the shape the server's `requireAdmin()` accepts as proof of admin, so it defeats the new authorization work too. | **028 Part 1 §2** |
| 2 | Anyone can read every contact / RFQ submission ever sent through the site: name, email, phone, message body. These are inbound leads from third parties who never had an account. | **029** |
| 3 | Anyone can enumerate every analytics event, including visitors' search queries. | **028 Part 1 §3** |
| 4 | The admin Reports tab cannot save anything. `api/sourcing/admin-reports.js` selects six columns that were never applied to production, so every request to it 500s. | **028 Part 1 §1** |
| 5 | Global-admin approve / reject on companies has never worked through the database. Migration 017 checks the wrong JWT claim. It only ever worked because the browser held the service key — and that is being taken away. | **028 Part 1 §4** |
| 6 | The `service_role` key shipped in the public JavaScript bundle and is in git history. Anyone who loaded `/admin` has it cached. | Code deploy, then **key rotation** — `key-rotation-runbook.md` |
| 7 | Anonymous visitors can read every report row including `file_url` for paid reports, and that URL points at a public storage bucket. The paywall is decorative. | **028 Part 2 — deferred**, see §7 |

---

## 1. The order, and why it matters

```
  1. Apply migration 028 PART 1        <- closes items 1, 3, 4, 5
  2. Apply migration 029               <- closes item 2
  3. Run the probes (§5)               <- this is the pass condition
  4. Deploy the code change
  5. Verify /admin works on production WITHOUT the browser key
  6. Rotate the service_role key + database password
  7. Later: Part 2 (item 7), after frontend work
```

**Migrations first, before any deploy.** Items 1–3 are exploitable with the *public* anon
key. No deploy and no key rotation touches them; only the migrations do. They also cannot
break the site as it is deployed today — every caller was enumerated one by one in
`028-impact-analysis.md`, and the browser paths that use `directory_members` (sign-in
auto-provision) get replacement policies in the same transaction.

**Deploy before you rotate. This one will bite you.** The bundle currently serving
`os.spacerising.org` builds its admin Supabase client from `VITE_SOURCING_ADMIN_KEY`,
which holds the `service_role` key, and relies on service-role privileges to bypass RLS.
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

> **Ignore the "KNOWN FALSE ALARM" warnings you will see elsewhere.** The header comment
> inside `migrations/028_security_and_missing_tables.sql` and the section titled
> "⚠ Expected false alarm on step 1" in `028-impact-analysis.md` both tell you that a
> correct Part-1-only apply prints `POST-CONDITION FAILURES` and exits 1. That *was* true.
> The script asserted Part 2's effects unconditionally. It has been fixed: it now reads
> the `run_part_2` switch out of the migration file, cross-checks it against the database's
> own notices, and asserts only what actually ran. A correct Part-1-only apply exits 0.
> Those two documents are stale and are queued to be corrected. If you see
> `POST-CONDITION FAILURES` now, treat it as real — go to §6.

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

`--check` prints how many contact submissions exist — the size of the exposure — but never
prints a submission. That is the PII this migration exists to stop leaking; it does not
belong in a terminal scrollback.

---

## 5. THE PASS CONDITION IS AN HTTP PROBE

**Do not accept a policy listing as proof.** 028 drops three `directory_members` policies
**by name**. If production carries a fourth permissive policy under a name nobody wrote
down, every listing and every check in both scripts still passes — and the leak survives
untouched. The only thing that settles it is asking the database the same way an attacker
would, with the public anon key.

Run each probe **before** and **after**. Before is what makes after mean something.

### 5.1 `directory_members` — the escalation hole

```bash
curl -si "$SB_URL/rest/v1/directory_members?select=id" \
  -H "apikey: $SB_ANON_KEY" -H "Prefer: count=exact" -H "Range: 0-0"
```

- **BEFORE (leaking):** `HTTP/2 206`, `content-range: 0-0/70`, one real row in the body.
- **AFTER (fixed):** `HTTP/2 200`, body `[]`, and the count in `content-range` is `0`
  (`*/0` or `0-0/0`). A `401` is also a pass.
- **Anything with rows in it is a FAIL.** Do not move on. See §6.

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

### 5.2 `directory_contacts` — the submission PII

```bash
curl -si "$SB_URL/rest/v1/directory_contacts?select=id" \
  -H "apikey: $SB_ANON_KEY" -H "Prefer: count=exact" -H "Range: 0-0"
```

- **BEFORE:** `206` with a nonzero total and a real row.
- **AFTER:** `200`, `[]`, total `0` (or `401`).

Then the half that would actually hurt if it broke — **the contact form must still work**.
Open any company profile on `os.spacerising.org` **logged out**, send a test message,
confirm the success state renders. Then re-run `run-migration-029.mjs --check` and confirm
the submission count went up by one, or in the SQL editor:

```sql
SELECT count(*) FROM directory_contacts WHERE created_at > now() - interval '5 minutes';
```

### 5.3 `directory_analytics`

```bash
curl -si "$SB_URL/rest/v1/directory_analytics?select=id" \
  -H "apikey: $SB_ANON_KEY" -H "Prefer: count=exact" -H "Range: 0-0"
```

- **BEFORE:** `206` with a nonzero total.
- **AFTER:** `200`, `[]`, total `0` (or `401`).

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
# The public directory itself. Must return a row BEFORE and AFTER.
curl -s "$SB_URL/rest/v1/directory_companies?select=id&limit=1" -H "apikey: $SB_ANON_KEY"

# Reports. Must STILL return rows after Part 1 — Part 2 is deferred on purpose.
curl -s "$SB_URL/rest/v1/directory_reports?select=id&limit=1" -H "apikey: $SB_ANON_KEY"
```

- `directory_companies` returning `[]` means the public directory has gone dark. That is
  the single worst outcome available here. Go to §6 immediately.
- `directory_reports` returning `[]` means **Part 2 ran when it should not have**. The
  paywall teaser cards have disappeared from the live site. Go to §6.

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
twice changes nothing the second time.** Verified by reading the SQL:

- Every `CREATE POLICY` is preceded by `DROP POLICY IF EXISTS` for that exact name —
  8 drops before 5 creates on `directory_members`, 4 before 2 on `directory_analytics`,
  2 before 1 on `directory_companies`, 4 before 2 on `directory_contacts`.
- All four helper functions are `CREATE OR REPLACE`.
- All six report columns are `ADD COLUMN IF NOT EXISTS`; the index is
  `CREATE INDEX IF NOT EXISTS`.
- The one data change, `UPDATE directory_reports SET updated_at = created_at`, is scoped
  `WHERE updated_at IS NULL`. A second run matches nothing.
- Both foreign keys are added only after an existence check against `pg_constraint`.
- `ENABLE ROW LEVEL SECURITY` is a no-op when it is already on.
- Each file is a single transaction, so a partial state is not reachable in the first
  place.

This was verified by reading the SQL, not by executing it twice — there is no database
this machine can reach. If you take Path B, `--check` before and after a second `--apply`
is a free confirmation.

**One thing re-running does NOT do:** if Part 2 has already been applied, running 028
again with the switch back to `false` does **not** roll Part 2 back. Nothing drops
`reports_public_read` / `reports_member_read`. Part 2 is forward-only.

---

## 7. What is still open after all of this

**The reports paywall — 028 Part 2, item 7 in §0.** Anonymous visitors can still read
every `directory_reports` row, including `file_url` on members-only and paid reports, and
that URL points at a public storage bucket. Anyone can download a paid report. This is
deliberately still open.

*Waiting on:* seven pages fetch reports with `.select('*')` and no access filter, and lean
on the database to decide what comes back, then draw a "Members Only" badge client-side
(`SourcingReportsV2`, `OSReportsPage`, `SpaceOSHomeV3`, `SourcingReportDetailV2`,
`SourcingDirectory`, `SourcingReports`, `srw/SRWHomeV2`). Close the hole today and those
locked teaser cards do not render as locked — they **vanish** for logged-out visitors.
That is the paywall's conversion surface on a live marketing site.

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
every returning user on the review screen. Role is pinned to `'member'`, so this is not
the admin-escalation path. It is a product decision, not a schema one.

**Key rotation.** Separate track, separate document: `key-rotation-runbook.md`. Not
blocked by these migrations, and they are not blocked by it.

**Admin file uploads.** Reported broken after the service-role key leaves the browser —
see `upload-verification.md`. Unrelated to these migrations and not fixed by them.

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
