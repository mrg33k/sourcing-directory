# The profile data model, in plain language

**What this covers:** `migrations/032_profiles_schema.sql` and
`migrations/033_profile_read_rpcs.sql` — the tables and the two read functions
behind `/people/:slug`, `/company/:slug` and the admin dashboard.

Written 2026-07-28, against Supabase project `kzzvjtthknsozktmpvak`, PostgreSQL
17.6. Every claim about what production already contains was measured read-only
the same day through PostgREST with the service key (counts and column names
only — no row data, no key value anywhere in this file).

---

## 1. The problem this solves

Three screens are built and rendering. Nothing is behind them.

Before these migrations, "a person" in this database was one of two things, and
neither is a profile:

| What existed | What it actually is | Why it is not a profile |
|---|---|---|
| `directory_members` (70 rows) | an auth link: `email`, `full_name`, `role`, `status`, `auth_user_id` | no slug, no bio, no avatar, no job title. It cannot have a URL. |
| `directory_listings` where `category='person'` (5 rows) | a real person encoded into a listing: `title`=name, `description`=bio, `vertical`=org, `author_name`=job title, `virtual_url`=link | it is a listing. It is not addressable as a person and cannot be edited as one. |

And the mission score — the number beside every bar on both profile screens —
had **no home at all**. The six missions exist (`directory_tags`,
`category='market_goal'`, 6 rows). The alignment percentage did not exist
anywhere in the database.

`directory_companies` (166 rows) was closer, but it is a *listing* record. It has
`name`, `slug`, `description`, `logo_url`, `website`, `city`, `state`,
`employee_count`, `year_founded` — and then thirteen membership and Stripe
billing columns. It has no LinkedIn URL, no organization type, no NAICS code, no
verification status, and no relationship counts. Only 1 of its 166 rows has a
logo.

---

## 2. What was created

Ten tables, six helper functions, two read functions.

### The person

**`directory_people`** — the reason a person can have a URL at all.

`slug` is the public URL and is `UNIQUE`. `auth_user_id` is **nullable on
purpose**: admins publish profiles for people who have never signed in, which is
the normal case for the five real people currently trapped in
`directory_listings`.

Two columns exist where you might expect one:

- `state` holds the display name (`"Arizona"`) because that is what the identity
  line prints.
- `state_code` holds the USPS code (`"AZ"`) because that is what lights up the
  map.

`focus_areas` is a `text[]` — the pill row under the bio. See §5 on why that one
is an array while everything else is a child table.

### The person's child tables

| Table | Card it feeds | Notes |
|---|---|---|
| `directory_person_capabilities` | CAPABILITIES | `UNIQUE (person_id, name)` |
| `directory_person_needs` | WHAT I'M LOOKING FOR | `kind` is `seeking` or `providing` — one table, two columns on screen |
| `directory_person_affiliations` | AFFILIATIONS | carries its own `org_logo_url`, because affiliations are usually to organizations with no `directory_companies` row (a university, a state authority, a council) |
| `directory_person_experience` | Experience tab | real `date` columns, so "current role" and ordering are computable rather than parsed out of a display string |

### The company's child tables

| Table | Card it feeds | Notes |
|---|---|---|
| `directory_company_needs` | LOOKING FOR | same `seeking` / `providing` shape |
| `directory_company_locations` | LOCATIONS + map | `label` = "Launch Complex 1", `place` = "Mahia, New Zealand". `state_code` drives the map highlight; a non-US location simply has none and is listed beside the map rather than pinned into the wrong ocean |
| `directory_company_capabilities` | CAPABILITIES | `name` **and** `subtitle`, because the design shows both: "Launch Services" / "Small satellite launch" |

### The mission score

**`directory_mission_scores`** — one table, both entity types.

```
entity_type  'person' | 'company'
entity_id    uuid (no FK — it is polymorphic)
tag_id       -> directory_tags
score        integer 0..100
UNIQUE (entity_type, entity_id, tag_id)
```

One table and not two because the person screen and the company screen render
the *identical* component against the *identical* six tags. Two tables would
mean two of every query, two admin editors, and two places for the scale to
drift apart. `entity_id` carries no foreign key — that is the cost of the
polymorphism, and it is paid with a `CHECK` on `entity_type` plus the read
functions' own filtering. Orphan rows are inert.

### The company enrichment side table

**`directory_company_profile`** — keyed 1:1 on `company_id`.

Carries `linkedin_url`, `org_type`, `naics_code`, `headquarters_label`, the six
"who we work with" counts, and `verification`.

**It is a side table specifically because `directory_companies` already exists
and migration 032 is forbidden from running `ALTER TABLE` against it.** Adding
these as columns on `directory_companies` would be an alteration of a live table
with 166 rows, which is outside the consent that was given for this work. So
they live beside it instead.

That constraint turned out to be the right shape anyway:
`directory_companies` is the *listing and billing* record, this is the
*profile screen* record, and keeping them apart is what lets the read function
name an explicit column list and never come near the Stripe columns.

`verification` lives here because **the admin dashboard's donut needs a status
column and the live tables have none.** There is no verification state anywhere
in production today. This adds one without touching `directory_companies`.

---

## 3. The slug decision

**Decided: a person slug must also be unique against `directory_companies.slug`.**

Person URLs are `/people/:slug` and only ever that. `src/main.jsx` ends with:

```jsx
<Route path="/company/:slug" element={<SourcingCompanyV2 />} />
<Route path="/:slug"         element={<SourcingCompanyV2 />} />
```

So the bare root namespace already belongs to organizations. Today a collision
cannot actually break a page — `/people/tim-struck` resolves the person no
matter what `/tim-struck` does.

The reason to enforce it anyway: that catch-all is a statement that a
single-segment path identifies a directory entity. The moment anyone wants
`/tim-struck` to resolve — and a people directory eventually does — a slug that
means two things is a bug, and by then the URLs are public and renaming them is
a visible break. One constraint now is cheaper than a rename later.

### How it is enforced, and the half that is not

A `UNIQUE` constraint cannot span two tables, so this is a `BEFORE INSERT OR
UPDATE OF slug` trigger on `directory_people`
(`directory_people_slug_guard()`). It also enforces kebab-case, because a slug
with a slash or a space in it is a broken URL that fails silently.

**The enforcement is one-directional and that is a known gap:**

```
a new PERSON cannot take an existing COMPANY's slug    <- enforced
a new COMPANY can still take an existing PERSON's slug <- NOT enforced
```

The mirror trigger would have to be created **on** `directory_companies`, and
creating a trigger on an existing table is a change to that table — outside the
consent for this work. It is a two-line migration and belongs with the
human-gated 028 batch:

```sql
CREATE OR REPLACE FUNCTION directory_companies_slug_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM directory_people p WHERE p.slug = NEW.slug) THEN
    RAISE EXCEPTION 'slug % is already used by a person', NEW.slug
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER trg_dir_companies_slug_guard
  BEFORE INSERT OR UPDATE OF slug ON directory_companies
  FOR EACH ROW EXECUTE FUNCTION directory_companies_slug_guard();
```

Until that lands, the company creation path should call the check itself.

---

## 4. Permissions

### The admin claim, and the migration that got it wrong

The correct global-admin check is:

```sql
(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
```

**Not** the top-level `role` claim. The top-level claim is the *Postgres* role —
`anon`, `authenticated`, `service_role` — and never equals `'admin'`.
`migrations/017_admin_update_policy.sql` uses the top-level claim, which is why
its admin branch has never matched anything in production; global-admin
approve/reject on companies has only ever worked because the browser was holding
the service key.

That claim now lives in exactly one place, `directory_is_platform_admin()`, so
the mistake can only be made once.

### Who can edit what

| Record | Who may write it |
|---|---|
| a person's own profile (`auth_user_id` set) | that person, or a platform admin |
| a person profile with no user (`auth_user_id` null) | approved members of that person's company, or a platform admin |
| any company profile row | approved members of that company, or a platform admin |
| a mission score | whoever may edit the entity it belongs to |

"Approved member" means a `directory_members` row with that `company_id` and
`status = 'approved'`. This is the model Patrik chose on 2026-07-28.

Note the split on person records: a colleague at the same company can maintain a
profile that has **no** account behind it, but cannot edit a real user's own
profile. That is deliberate.

### Why the checks are functions and not inline subqueries

A policy subquery against another table is itself subject to *that* table's RLS.
Reading `directory_members` from inside a policy would couple these ten tables
to whatever policy set `directory_members` happens to have — which migration 028
is about to change. All five helpers are `SECURITY DEFINER` with
`SET search_path = public, pg_temp`, so the policies here keep working no matter
what 028 does next door.

### Reads

Public `SELECT` for `anon` and `authenticated`, restricted to rows whose parent
record is live: `directory_people.status = 'active'`, or
`directory_companies.status = 'active'` for the company side. Child rows can
never outlive their parent's visibility. No policy grants writes to `anon`.

Table `GRANT`s are issued alongside the policies. Without them PostgREST returns
`42501` regardless of what the policies say — RLS decides *which rows*, grants
decide whether the table is looked at at all.

### ⚠ One inherited hole, and it is not this migration's to close

`directory_members` is **anon-INSERTable in production right now**.
`migrations/006:25` ships `"service role all" FOR ALL USING (true)` with no `TO`
clause, so it applies to `PUBLIC`. Anyone can insert a row naming any company
with `status='approved'`.

That means: **until 028 Part 1 is applied, the company write policies here can
be defeated by inserting a membership row.** The reads are unaffected. Apply 028
first, or accept that company profile writes are open until you do. This is
documented in `docs/security/APPLY-RUNBOOK.md` as item 1.

Deliberately **not** done here: adding a "tenant admin" branch that trusts
`directory_members.role = 'admin'`. That is exactly the escalation 028 exists to
close, and reproducing it in ten new policies would be a step backwards.

---

## 5. Two judgement calls worth knowing about

**Child tables are normalized, not jsonb.** Binding decision: the admin panel
has to edit, verify and *count* these individually. "How many capabilities exist
across the platform" is a number printed on the admin dashboard; against a jsonb
blob it is unanswerable without unnesting every row.

**Except the display chips, which are `text[]`.** `directory_people.focus_areas`,
`directory_company_profile.focus_areas` and `directory_company_profile.categories`
are arrays. They are free display chips — the pill row and the category line
under the name. Nobody edits, verifies or counts them one at a time, so the rule
that produced the child tables does not apply to them. They are also not jsonb;
they are typed arrays, which Postgres can index and constrain.

---

## 6. The two read functions

`get_person_profile(p_slug text)` and `get_company_profile(p_slug text)` each
return **one** `jsonb` payload containing everything its screen needs.

Key names match `src/lib/profileFixtures.js` exactly, so **the screens need no
edits**. The RPC result drops into the same normalizer the fixtures pass
through. The only change needed is in `src/lib/profileApi.js`:

```js
// instead of .from('directory_people').select('*').eq('slug', slug)
const { data, error } = await supabase.rpc('get_person_profile', { p_slug: slug })
if (error || !data) return null
return data                      // already the full payload, `source: 'live'`
```

Same shape for `get_company_profile`. That file belongs to the wiring phase, not
to this one, so it is untouched here.

### Rules both functions follow

- **`SECURITY DEFINER`, so RLS is bypassed — each one filters `status` itself.**
  A definer function that forgets this is a data leak with a friendly name.
- `SET search_path = public, pg_temp` on every function in both migrations.
- **Explicit column allowlist against `directory_companies`. Never `select *`.**
  That table carries `membership_tier`, `membership_seats`,
  `membership_paid_at`, `membership_expires_at`, `membership_billing`,
  `paid_stripe_session_id`, `paid_stripe_payment_intent_id`,
  `paid_stripe_subscription_id`, `pending_checkout_session_id`,
  `pending_checkout_seats`, `pending_checkout_at`, `paid_seats`, `paid_at` and
  `paid_receipt_url`. None of that may ever reach a public payload, and
  `select *` is precisely how it would.
- **Not found returns SQL `NULL`, not an exception.** PostgREST answers `200`
  with a `null` body and the screen shows its not-found state.
- `EXECUTE` is revoked from `PUBLIC` and granted to `anon, authenticated` — the
  default `PUBLIC` grant is a wider door than a definer function should have.

### What is computed, and what is deliberately missing

Computed, because real data exists:

| Number | Source |
|---|---|
| company profile views (30d) | `directory_analytics` where `event_type='profile_view'` and `company_id` matches |
| person profile views | `directory_analytics` matched on `metadata->>'path' = '/people/<slug>'` |
| opportunities posted (30d) | `directory_listings`, categories `job`, `rfp`, `grant`, `equipment` — editorial categories excluded on purpose |
| people count on the People tab | `directory_people` for that company |
| capability totals | the child tables |

**Omitted rather than zero-filled**, because no data exists anywhere: Connections,
Organizations, Projects, Events Attended. The card renders its own empty state
and asks for the data in place. That is Patrik's call from 2026-07-28 — a
confident `0` is worse than an honest ask.

Two consequences to expect on day one:

- **Person profile views will be 0 for everyone**, because nothing currently
  emits a `profile_view` event for `/people/*`. That is the true number, not a
  bug. `directory_analytics` has a `company_id` column and no person column, so
  path matching is the only honest join available.
- **"Who we work with" shows all six counts or none.** If the company has a
  `directory_company_profile` row, all six render including zeros — the owner
  filled that record in. If it has no row, the array is empty and the card shows
  its empty state. A card of six zeros nobody entered is not data, it is a shrug.

### Map markers are not in the payload

Both payloads return `markers: []`. The fixtures' markers are pixel coordinates
in the 960×600 albersUsa space of `src/lib/usStatesPaths.js` — a rendering
concern the database has no business holding. `state_code` is the data;
`highlight` is populated from it and the state lights up. Placing the pin stays
with the frontend.

---

## 7. Known mismatch: the mission names

The six live tags do not match the labels in the design:

| `directory_tags.name` (live) | Design / fixture label |
|---|---|
| Build Space | Build Space ✓ |
| Live in Space | Live in Space ✓ |
| Operate in Space | Operate in Space ✓ |
| Secure Space | Secure Space ✓ |
| **Move in Space** | **Move Through Space** |
| **Prosper in Space** | **Prosper Through Space** |

The read functions return the tag's real `name`, so the screens will print the
live wording, not the design's. Two of six bars will read differently from the
reference PNG.

This is **not** fixed here: renaming those rows is a data change to an existing
table, outside the consent for this work. It is a two-row `UPDATE` on
`directory_tags` once someone decides which wording is correct. Flagging it so
it is not discovered as a "bug" during visual review.

---

## 8. Applying

Both files are idempotent and safe to run twice — `IF NOT EXISTS` on tables and
indexes, `CREATE OR REPLACE` on functions, `CREATE OR REPLACE TRIGGER` (PG 14+)
on triggers, and `pg_policies` guards around every policy because PostgreSQL 17
still has no `CREATE POLICY IF NOT EXISTS`. Each file is wrapped in a single
transaction, so a failure rolls back completely.

Order matters: **032 before 033.** The read functions reference the tables.

Two ways to run them, both needing a credential that is not in this repo:

**A — Supabase SQL editor.** Paste `032_profiles_schema.sql`, run, then
`033_profile_read_rpcs.sql`. Needs a browser signed in to the Supabase
dashboard. This is the same path `docs/security/APPLY-RUNBOOK.md` uses for 028.

**B — direct Postgres.** Needs the **database password**, not the service_role
key. Those are different secrets, and passing the service key as the password is
what the 027 / 028 / 029 runners used to do — it has never once authenticated.

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f migrations/032_profiles_schema.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f migrations/033_profile_read_rpcs.sql
```

Do **not** run `supabase db push` for these. That command applies everything in
`supabase/migrations/`, which is a different directory with a different history
and other people's unapplied work in it.

### Verifying afterwards

```sql
-- 10 tables, all with RLS on
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname='public' AND tablename IN (
  'directory_people','directory_person_capabilities','directory_person_needs',
  'directory_person_affiliations','directory_person_experience',
  'directory_company_needs','directory_company_locations',
  'directory_company_capabilities','directory_mission_scores',
  'directory_company_profile')
ORDER BY tablename;

-- every one of them has at least one policy
SELECT tablename, count(*) FROM pg_policies
WHERE schemaname='public' AND tablename LIKE 'directory_%'
GROUP BY tablename ORDER BY tablename;

-- both functions callable, and empty rather than erroring on a bad slug
SELECT get_person_profile('no-such-person')  IS NULL AS person_returns_null;
SELECT get_company_profile('no-such-company') IS NULL AS company_returns_null;
```

Through PostgREST with the public anon key, the same check is:

```
POST /rest/v1/rpc/get_person_profile   {"p_slug":"no-such-person"}   -> 200, body: null
POST /rest/v1/rpc/get_company_profile  {"p_slug":"no-such-company"}  -> 200, body: null
```

A `404` with `PGRST202` means the function is not there — the migration did not
apply.

---

## 9. What is still missing after this

- Nothing writes to any of these tables yet. They are created empty. The edit
  surface and the backfill of the five `category='person'` listings into
  `directory_people` are the next piece of work.
- No reverse slug trigger on `directory_companies` (§3).
- `directory_tags` wording (§7).
- Person `profile_view` events are not emitted by the `/people/*` route, so that
  stat stays at 0 until they are (§6).
- 028 is still unapplied, and the company write policies here depend on it (§4).
