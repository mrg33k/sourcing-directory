# Admin file uploads after the service-role removal — verification

**Verdict: BROKEN. Confirmed against the live database, not inferred.**

Every admin file upload that goes through the browser now fails. There are **zero** RLS
policies on the `storage` schema — not one, for any role, on any storage table — and RLS is
enabled. Until the security round, those uploads ran as `service_role`, which bypasses RLS,
so the missing policies never mattered. `src/lib/adminApi.js:207` now delegates `.storage`
to the anon-key browser client, and the floor that was never there gave way.

- Target: hosted Supabase project `kzzvjtthknsozktmpvak`
- Written 2026-07-28. **Read-only investigation. Nothing in production was created, altered,
  uploaded or deleted.** The SQL in section 7 is authored and has NOT been applied.

---

## 1. How this was determined

Three independent read paths, all read-only:

| Probe | Credential | What it answered |
|---|---|---|
| `GET /storage/v1/bucket`, `POST /storage/v1/object/list/{bucket}` | service_role and anon, both already on disk in `.env.prod.local` | Bucket config; that anon sees 0 of the objects service_role sees |
| Supabase Management API `POST /v1/projects/{ref}/database/query` with `read_only: true` | management PAT already on disk at `~/.config/supabase/corner.env` | `pg_policies`, `pg_class.relrowsecurity`, raw `relacl`, object owners |
| Repo grep over `migrations/` and `supabase/migrations/` | — | No storage policy has ever been in version control |

The Management API connection lands as `supabase_read_only_user`, which is why an early
`information_schema.role_table_grants` query returned empty — that view only shows grants the
querying role is party to. The raw `pg_class.relacl` in section 4 is the trustworthy read and
says the opposite. Worth knowing before someone repeats the query and draws the wrong
conclusion.

Not used: no direct Postgres connection was possible. `scripts/run-migration-028.mjs`
connects with the service_role key as the database password; that fails
(`password authentication failed for user "postgres"`). The database password is not on this
machine. Anyone planning to run that script should know it cannot work as written.

---

## 2. Bucket configuration

Both buckets exist and both are **public**.

| Bucket | Public | Size limit | Allowed MIME types | Created |
|---|---|---|---|---|
| `sourcing-reports` | yes | 50 MB | `application/pdf`, `image/jpeg`, `image/png`, `application/octet-stream` | 2026-04-29 |
| `company-logos` | yes | 5 MB | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`, `image/gif` | 2026-06-09 |

"Public" governs **downloads only**. Anyone may `GET` an object by URL without a token. It
grants nobody the right to write, and it does not disable RLS on `storage.objects`.

---

## 3. Storage policies that exist

```
select tablename, policyname, roles, cmd from pg_policies where schemaname = 'storage';
-> []
```

Empty. For completeness, every policy in the database:

```
select schemaname, count(*) from pg_policies group by schemaname;
-> public: 31
```

31 policies, all on `public`. **None on `storage`.** Not on `storage.objects`, not on
`storage.buckets`, not for `anon`, not for `authenticated`, not for `public`.

RLS is enabled anyway:

| Table | RLS enabled | RLS forced |
|---|---|---|
| `storage.objects` | true | false |
| `storage.buckets` | true | false |

---

## 4. Is authenticated INSERT permitted? No.

The table grant is present — that part is fine:

```
storage.objects  relacl:
  supabase_storage_admin=a*r*w*d*D*x*t*m*/supabase_storage_admin
  service_role=arwdDxtm/supabase_storage_admin
  authenticated=arwdDxtm/supabase_storage_admin      <- 'a' = INSERT
  anon=arwdDxtm/supabase_storage_admin
  postgres=a*r*w*d*D*x*t*m*/supabase_storage_admin
```

`storage.buckets` carries the identical ACL, and the `storage` schema grants `USAGE` to
`anon`, `authenticated` and `service_role`.

But a `GRANT` is not permission when RLS is on. Postgres row-level security is **default
deny**: with RLS enabled and no policy matching the command, every row fails the check. There
is no policy at all. So `authenticated` holds the INSERT privilege and is refused at the row
check every time.

`service_role` is unaffected — it carries `BYPASSRLS`, which is exactly why nobody noticed
this before the browser stopped using that key.

## 4b. Corroboration from the data

Both facts fall straight out of the above and confirm it independently:

```
select bucket_id, count(*) from storage.objects group by bucket_id;
-> sourcing-reports: 17
-> company-logos:    (absent — zero objects, ever)

select owner, count(*) from storage.objects where bucket_id='sourcing-reports' group by owner;
-> null: 17
```

`owner` is `null` on all 17 objects. `owner` records the `auth.uid()` of the uploader and is
null exactly when the upload was made by `service_role`. **Not one object in this project has
ever been uploaded by an authenticated user.** There was never a working authenticated upload
path to regress — there was a service-role path, and it has now been closed.

`company-logos` is completely empty despite the logo uploader existing since 2026-06-09.
A sample of `directory_companies.logo_url` finds exactly one non-null value and it is an
external URL. The logo uploader has produced nothing, ever.

---

## 5. Blast radius — what actually breaks

Three call sites, all in the admin panel, all reached through `adminSupabase.storage`:

| File | Line | Operation | Result now |
|---|---|---|---|
| `src/pages/admin/AdminUI.jsx` | 89 | `company-logos`.upload — company logo | fails |
| `src/pages/admin/SettingsSection.jsx` | 63 | `company-logos`.upload — directory logo | fails |
| `src/pages/admin/ReportsSection.jsx` | 65 | `sourcing-reports`.upload — report PDF | fails |
| `src/pages/admin/ReportsSection.jsx` | 178 | `sourcing-reports`.remove — delete old file | fails |

One piece of good news: **all four fail loudly.** Each is inside a `try/catch` that writes the
error to visible UI state (`setUploadErr`, `setMsg`, `setReportFormStatus`). The admin sees a
message rather than a silent no-op. The expected text is a storage RLS violation, which reads
as `new row violates row-level security policy` — accurate, but not something an admin can act
on.

### Not broken

- **Public downloads.** Both buckets are public; the public object route does not consult RLS.
  Existing report PDFs and cover images keep serving. `src/lib/reportCovers.js` is fine.
- **`getPublicUrl()`.** Pure string construction, no network call, no auth.
- **Server-side uploads.** `api/sourcing/upload-report.js`, `upload-article-cover.js` and
  `upload-deal-bank-deck.js` run on Vercel with the service_role key and bypass RLS. The
  member-facing flows that use them (`SourcingArticlesPostV2`, `SourcingPortalV2`,
  `SourcingDealBankAddListing`) are unaffected.

### Migration 028 does not fix this

`migrations/028_security_and_missing_tables.sql` mentions the `sourcing-reports` bucket once,
in a comment at line 426. It adds no storage policy. Applying 028 leaves uploads exactly as
broken as they are now.

---

## 6. Two ways to fix it — and which one to pick

**Option A — grant the policies (section 7).** Puts admin write rights on `storage.objects`
where they can be read and audited in SQL. Costs one migration.

**Option B — route admin uploads through a server endpoint, like the rest of the app already
does.** `api/sourcing/upload-report.js` is *already* the correct shape: it verifies the caller's
JWT, requires `app_metadata.role === 'admin'`, confirms the report row exists, and returns a
**signed upload URL** from `createSignedUploadUrl()`. A signed upload URL carries its own
authorization and bypasses storage RLS for that one path. The endpoint exists, is authenticated,
and is called from nowhere in the live admin panel — `ReportsSection.jsx` uploads directly
instead.

**Recommendation: B for reports, A for logos.**

Reports get option B because the endpoint is already written and already correct — wiring
`ReportsSection.jsx` to call it is smaller than a migration and keeps every storage write behind
a server-side authorization check. That is the same principle the whole security round was
built on: authorization decisions belong on the server, not in a policy that trusts a claim in
a browser-held JWT.

Logos get option A because no equivalent endpoint exists for them and writing two is more work
than one policy set. If someone would rather write `api/sourcing/upload-logo.js` on the
upload-report pattern, that is strictly better and section 7 can be skipped entirely.

Do not "fix" this by putting the service_role key back in the browser. That is the thing that
was just removed, and the key is already compromised — see `key-rotation-runbook.md`.

---

## 7. Policy SQL — AUTHORED, NOT APPLIED

**This has not been run against anything.** Read section 6 first and decide whether you want
option A at all.

Admin here means what the application already means by it, in both places that decide it
(`api/sourcing/lib/adminAuth.js:79` and `src/hooks/useAdmin.js:98`): a global admin
(`app_metadata.role = 'admin'`) or an approved tenant admin (a `directory_members` row with
`role='admin'` and `status='approved'`, keyed on `auth_user_id`).

The membership half must go through a `SECURITY DEFINER` function. `public.directory_members`
has RLS enabled with 3 policies of its own; a policy that queries it directly would be
evaluated under the *caller's* RLS and could silently see zero rows, denying a legitimate
admin for reasons nobody would find quickly.

```sql
-- 029_storage_policies.sql
-- Admin write access to the company-logos and sourcing-reports buckets.
--
-- Context: storage.objects has RLS enabled and ZERO policies, so every write by
-- anon/authenticated is denied. This was invisible while the browser held the
-- service_role key (BYPASSRLS). See docs/security/upload-verification.md.
--
-- NOT APPLIED. Review before running.

begin;

-- ── Helper: is the current JWT an admin? ────────────────────────────────────
-- SECURITY DEFINER so the directory_members lookup is not itself filtered by
-- that table's RLS. STABLE so the planner can cache it per statement.
create or replace function public.is_directory_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or exists (
      select 1
      from public.directory_members m
      where m.auth_user_id = auth.uid()
        and m.role = 'admin'
        and m.status = 'approved'
    );
$$;

revoke all on function public.is_directory_admin() from public;
grant execute on function public.is_directory_admin() to authenticated;

-- ── SELECT ──────────────────────────────────────────────────────────────────
-- Both buckets are public, so object bytes are already world-readable by URL.
-- This policy only restores the ability to LIST and to read object metadata,
-- which ReportsSection needs in order to delete a superseded file.
create policy "admins can list logo and report objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('company-logos', 'sourcing-reports')
    and public.is_directory_admin()
  );

-- ── INSERT ──────────────────────────────────────────────────────────────────
create policy "admins can upload logos and reports"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in ('company-logos', 'sourcing-reports')
    and public.is_directory_admin()
  );

-- ── UPDATE ──────────────────────────────────────────────────────────────────
-- Required because every call site passes { upsert: true }. Without this,
-- re-uploading over an existing key fails even though the INSERT policy passes.
create policy "admins can replace logos and reports"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id in ('company-logos', 'sourcing-reports')
    and public.is_directory_admin()
  )
  with check (
    bucket_id in ('company-logos', 'sourcing-reports')
    and public.is_directory_admin()
  );

-- ── DELETE ──────────────────────────────────────────────────────────────────
-- ReportsSection.jsx:178 removes the old file when a report's PDF is replaced.
create policy "admins can delete logos and reports"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id in ('company-logos', 'sourcing-reports')
    and public.is_directory_admin()
  );

commit;
```

### Deliberate limits of the above

- **Scoped to two buckets by name.** A future bucket gets no access from this migration. That
  is intended — a bucket allowlist that grows silently is how this class of bug returns.
- **No policy on `storage.buckets`.** The client never needs to list or create buckets;
  `getPublicUrl()` does not touch the table. Leaving `storage.buckets` fully denied keeps the
  bucket inventory unreadable from the browser, which is worth keeping.
- **`anon` gets nothing.** Signed out means no storage access of any kind beyond the public
  download URL.
- **Tenant scoping is not enforced at the object level.** Any approved tenant admin can write
  to either bucket, including over another tenant's logo, because the storage key format
  (`{company_id}-{timestamp}.png`, `directory-logos/{tenant_id}-{timestamp}.png`) carries no
  tenant boundary the policy can check without parsing filenames. Parsing filenames in an RLS
  predicate is fragile and I would not ship it. If cross-tenant logo overwrite matters, that is
  another reason to prefer option B, where the server already resolves tenant reach via
  `adminAuth.js`. **Flagging this rather than hiding it: option A is a real, if narrow,
  widening of what one tenant admin can touch.**

---

## 8. Two-minute manual confirmation

Nothing here needs to be taken on trust. Either check works:

**In SQL (Supabase Dashboard → SQL Editor):**

```sql
select tablename, policyname, roles, cmd from pg_policies where schemaname = 'storage';
```

An empty result means uploads are broken. Any row means re-read this document before acting.

**In the UI:** Dashboard → Storage → Policies. `company-logos` and `sourcing-reports` should
both read "No policies created yet."

**End to end**, after applying a fix: sign in to `/admin` as a real admin, open a company,
upload a small PNG as its logo, and confirm the image renders rather than an error appearing
under the field. Then re-run the object count — `company-logos` should go from 0 to 1, and
that row's `owner` should be the admin's `auth.uid()` rather than null. A null owner means the
write went through a service-role path, not the one being tested.

---

## 9. One unrelated thing found on the way

`company-logos` accepts `image/svg+xml` and the bucket is public. An SVG is executable
markup; a stored SVG served from `kzzvjtthknsozktmpvak.supabase.co` runs script on the
Supabase storage origin, not on `os.spacerising.org`, so this is not a direct path to a
session on the app. It is still an upload primitive worth removing — nothing in the product
needs SVG logos, and the MIME allowlist is the cheapest place to say so. Not changed here;
noted for whoever owns the bucket config.
