# Supabase Key Rotation Runbook — `sourcing-directory`

**Status: the service_role key is COMPROMISED. Treat rotation as mandatory, not precautionary.**

Written 2026-07-28. Executed by a human. Do not automate this.

---

## 0. Why this is not a drill

Two independent leaks of the **same** service_role credential:

1. **It shipped in the public JavaScript bundle.** `VITE_SOURCING_ADMIN_KEY` holds the
   service_role key. Vite inlines every `VITE_`-prefixed variable into client JS at build
   time. Verified on the current build output — the admin chunk under `dist/assets/`
   contains a JWT whose payload claims `"role":"service_role"` for project
   `kzzvjtthknsozktmpvak`. Anyone who has loaded `os.spacerising.org/admin` has had that
   credential in their browser cache.
2. **It is in git history.** `CONTEXT.md` carried the service_role key, the anon key, the
   database password, and the full Postgres connection string in plaintext. The values have
   now been removed from the working tree, but **scrubbing a file does not scrub history** —
   `git log -p` still returns them, and so does any clone, fork, or CI cache.

A service_role key bypasses **every** row-level-security policy on the project. It can read,
modify, and delete every row in every `directory_*` table, and it can mint and modify auth
users. There is no scope limitation to fall back on.

Also compromised by the same `CONTEXT.md` commit, and covered below:
- the Postgres database password / connection string,
- the anon key (public by design, but rotating the JWT secret invalidates it too),
- the bootstrap password for `ben@arsenalgpa.com`.

---

## 1. ORDER OF OPERATIONS — read this before touching anything

**Rotating first will break the admin panel.**

`src/pages/SourcingAdmin.jsx` builds its Supabase client from `VITE_SOURCING_ADMIN_KEY` and
relies on service-role privileges to bypass RLS. The moment the old key is invalidated, that
client 401s on every query and the admin panel is dead until a new build ships. There is no
fallback path that still works — it degrades to the anon client, which RLS will refuse.

The correct sequence:

1. **Deploy the server-side authorization change (Agent B's work).** The admin panel must
   read and write through `api/` functions using the server-only
   `SUPABASE_SERVICE_ROLE_KEY`, not through a browser-side service-role client.
2. **Verify `/admin` works on production without `VITE_SOURCING_ADMIN_KEY`.** Not "the build
   passed" — actually sign in as an admin on `os.spacerising.org/admin` and load every tab.
3. **Then rotate.** Steps in section 3.

If you rotate before step 2, you have taken the admin panel down for an unknown number of
hours and you will be doing the server-side migration under outage pressure. Don't.

If the key is being actively abused right now, that calculus flips — accept the outage and
rotate immediately (section 3), then fix forward. That is a judgement call for a human with
evidence of abuse, not the default path.

---

## 2. Inventory — every place the key is referenced

Verified by grep on 2026-07-28. Re-run the commands before you start; the repo moves.

```bash
grep -rn "VITE_SOURCING_ADMIN_KEY" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .
grep -rn "SUPABASE_SERVICE_ROLE_KEY" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .
git ls-files -z | xargs -0 grep -lE 'eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.'   # hardcoded JWTs
```

### 2a. Browser-exposed (the leak) — `VITE_SOURCING_ADMIN_KEY`

| Where | What it does |
|---|---|
| `src/pages/SourcingAdmin.jsx` (~line 37) | Builds `adminSupabase` with the service-role key. **The leak.** |
| `src/pages/admin/AddCompanySection.jsx` (~line 42) | Sends it as the `x-admin-key` header to `/api/sourcing/admin-setup`. |
| Vercel env — **Production** | Confirmed present. |
| Vercel env — **Preview** | Confirmed present. |
| Vercel env — Development | Not present. |
| `CONTEXT.md` | Documented in the env table (now flagged, no value). |

### 2b. Hardcoded literal keys in tracked files — fix these or they break on rotation

| File | Line | What |
|---|---|---|
| `scripts/purge-expired-events.py` | ~35 | Hardcoded **service_role** JWT. Not an env read — a literal. |
| `scripts/seed-investors-from-csv.py` | ~15 | Hardcoded **service_role** JWT. Literal. |
| `public/v10/index.html` | ~623 | Hardcoded **anon** JWT. Ships to the browser (anon is public by design, but it dies when the JWT secret rolls). |

These three are the most likely thing to be forgotten. They will not surface as a build
error — they fail silently at runtime with a 401.

### 2c. Server-side env reads (correct usage — same secret value, still must be updated)

All read `process.env.SUPABASE_SERVICE_ROLE_KEY`. Nothing to change in the code; they pick up
the new value from Vercel on the next deploy.

- `api/sourcing/`: `signup.js`, `admin-setup.js`, `update-company.js`, `tenants.js`,
  `reports.js`, `admin-reports.js`, `upload-report.js`, `download-report.js`,
  `delete-blank-reports.js`, `reset-email.js`, `run-migration.js`, `agent.js`,
  `srw-subscribe.js`, `checkout-session.js`, `checkout-webhook.js`,
  `upload-article-cover.js`, `deal-bank-listing.js`, `update-deal-bank-listing.js`,
  `withdraw-deal-bank-listing.js`, `upload-deal-bank-deck.js`,
  `deal-bank-submit-investor.js`, `reports/[reportId]/access.js`,
  `reports/[reportId]/content.js`
- `api/spaceos/checkout-webhook.js`
- `scripts/`: `provision-tenant-admins.mjs`, `seed-directory-tags.mjs`,
  `run-migration-018.mjs`, `run-migration-025.mjs`, `run-migration-027.mjs`,
  `apply-tracker-updates-2026-06-19.mjs`, `apply-migration-018.mjs`,
  `purge-expired-events.py` (also has the literal — see 2b), `create-admin.sh` (docs only)

### 2d. Local `.env*` files (names only — never open these in a shared screen)

None are tracked by git; all are correctly gitignored. All are on the developer's disk and
must be updated by hand or re-pulled with `vercel env pull`.

| File | Variables holding the compromised value |
|---|---|
| `.env.production` | `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SOURCING_ADMIN_KEY` |
| `.env.prod.local` | `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SOURCING_ADMIN_KEY` |
| `.env.check` | `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SOURCING_ADMIN_KEY` |
| `.env.local`, `.env.vercel.local` | `VERCEL_OIDC_TOKEN` only — not affected |

`.env.production` is loaded by `vite build`. That is the local mirror of the production leak.

### 2e. Anywhere outside this repo

Not greppable from here. A human must check:

- Any other machine or clone with a `.env*` file for this project.
- CI/CD systems other than Vercel.
- Password managers, Notion/Drive docs, Slack DMs, agent handoff notes, mission folders.
- The AOM-EA repo — `CONTEXT.md` from this project has been quoted into briefs before.

---

## 3. Rotation steps

### Step 1 — Confirm the prerequisite

- [ ] Agent B's server-side auth is deployed to production.
- [ ] `/admin` on `os.spacerising.org` loads and functions for a real admin **without**
      needing `VITE_SOURCING_ADMIN_KEY`. Confirm by loading every tab, not just the login.
- [ ] `grep -rn "VITE_SOURCING_ADMIN_KEY" src/` returns nothing.

If any box is unchecked, stop. Go back to section 1.

### Step 2 — Decide which rotation you need

Supabase has two key systems, and this project is straddling both (it has a legacy
`service_role` JWT *and* an `sb_publishable_...` key).

- **New API keys (`sb_secret_...` / `sb_publishable_...`)** — revoke and re-issue
  individually in the dashboard. Does **not** sign users out. Preferred if the project can be
  moved onto them.
- **Legacy JWT keys (`anon` / `service_role`)** — rotated only by rolling the project's **JWT
  secret**. This regenerates *both* the anon and service_role keys at once and **invalidates
  every issued JWT, signing out every logged-in user on the site.**

The leaked credential is a legacy service_role JWT, so **rolling the JWT secret is required.**
Rolling it invalidates the leaked key. Nothing else does.

Plan for the sign-out. It is a user-visible event on a live site — pick a low-traffic window
and be ready to say so on the site if needed.

### Step 3 — Roll the JWT secret

1. Supabase dashboard → project `kzzvjtthknsozktmpvak` → **Project Settings → API** (Supabase
   moves this UI; look for "JWT Settings" / "API Keys" / "Legacy API keys").
2. Generate a new JWT secret.
3. Copy the **new** `anon` key and the **new** `service_role` key straight into the password
   manager. Do not paste them into a file, a chat, a commit message, or a terminal that is
   being recorded.

### Step 4 — Rotate the database password

Same dashboard → **Project Settings → Database → Reset database password**. Independent of the
JWT secret; the old password was in `CONTEXT.md` and in git history, so it goes too.

Store the new password in the password manager. Update any local `psql`/connection strings.
Nothing in this repo reads the raw DB password at runtime — the migration scripts go through
`SUPABASE_SERVICE_ROLE_KEY` — so this is low blast radius, but do not skip it.

### Step 5 — Update Vercel

Project `sourcing-directory`, org `aheads-projects-d2a4c70f`.

```bash
cd /Users/aom-inhouse/Documents/Dev/sourcing-directory

# Server-side key — Production AND Preview.
vercel env rm  SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env rm  SUPABASE_SERVICE_ROLE_KEY preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview

# Anon key — Production AND Preview.
vercel env rm  VITE_SUPABASE_ANON_KEY production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env rm  VITE_SUPABASE_ANON_KEY preview
vercel env add VITE_SUPABASE_ANON_KEY preview

# The leak. DELETE IT — do not re-add it with the new key.
vercel env rm VITE_SOURCING_ADMIN_KEY production
vercel env rm VITE_SOURCING_ADMIN_KEY preview
```

- [ ] `vercel env ls production` shows no `VITE_SOURCING_ADMIN_KEY`.
- [ ] `vercel env ls preview` shows no `VITE_SOURCING_ADMIN_KEY`.

### Step 6 — Fix the hardcoded literals (section 2b)

Replace the inline JWTs with `os.environ` / env reads. These need a code change and a commit —
they cannot be fixed from the Vercel dashboard.

- [ ] `scripts/purge-expired-events.py` — read `SUPABASE_SERVICE_ROLE_KEY` from the env.
- [ ] `scripts/seed-investors-from-csv.py` — same.
- [ ] `public/v10/index.html` — update the anon key, or confirm the page is dead and delete it.

### Step 7 — Redeploy

```bash
vercel --prod
```

Env changes do **not** apply to already-deployed builds. Until this redeploy lands, production
is running the old bundle with the now-invalid key.

### Step 8 — Update local env files

```bash
vercel env pull .env.production --environment=production
```

Then hand-edit `.env.prod.local` and `.env.check` (Vercel will not touch those) and delete the
`VITE_SOURCING_ADMIN_KEY` line from all three.

---

## 4. What breaks between rotation and redeploy

Expect all of the following from the moment the JWT secret rolls until step 7 finishes.

| Breaks | Effect | Recovers |
|---|---|---|
| **Every signed-in session, everywhere** | All users signed out. Existing JWTs are invalid. | Users sign in again. Immediate; no deploy needed. |
| Public directory pages | Anon key invalid → data fetches 401 → empty/broken pages for **all visitors**. | Step 7 redeploy. |
| `/admin` | Dead. | Step 7 redeploy. |
| All `api/sourcing/*` functions | 401 from Supabase — signup, emails, reports, checkout, deal bank. | Step 7 redeploy (functions pick up env on deploy). |
| Stripe webhooks | Fail while functions are broken. Stripe retries, but check the dashboard afterwards. | Step 7, then confirm retries landed. |
| `scripts/*.mjs` run locally | Fail until step 8. | Step 8. |
| `purge-expired-events.py`, `seed-investors-from-csv.py` | Fail **permanently** — hardcoded keys. | Step 6. |

**This is a real outage window for the whole public site, not just the admin panel.** Anon key
invalidation takes the directory down too. Keep steps 3 → 7 tight, and have the deploy queued
before you roll the secret.

---

## 5. Verify it actually worked

Not "the build passed". Look at it.

1. **The old key is dead.** With the OLD service_role key (from the password manager's
   archived entry, not from git):
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     'https://kzzvjtthknsozktmpvak.supabase.co/rest/v1/directory_companies?select=id&limit=1' \
     -H "apikey: $OLD_KEY" -H "Authorization: Bearer $OLD_KEY"
   ```
   Must return **401**. A `200` means the rotation did not take — stop and redo step 3.

2. **The bundle is clean.** After the redeploy:
   ```bash
   npm run build
   node -e "
   const fs=require('fs'),p=require('path');
   let bad=0;
   for(const f of fs.readdirSync('dist/assets').filter(f=>f.endsWith('.js'))){
     const s=fs.readFileSync(p.join('dist/assets',f),'utf8');
     for(const j of new Set(s.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[])){
       try{const b=j.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
       const pl=JSON.parse(Buffer.from(b+'='.repeat((4-b.length%4)%4),'base64').toString());
       if(pl.role==='service_role'){console.log('LEAK:',f);bad=1;}}catch(e){}}}
   process.exit(bad);
   "
   ```
   Must exit 0 and print nothing. Then check the **deployed** bundle the same way — view
   source on `os.spacerising.org`, download the admin chunk, and grep it. The local build is
   not proof about what Vercel served.

3. **The tripwire is armed.**
   ```bash
   STRICT_VITE_SECRETS=1 npm run build
   ```
   Must exit 0. If it fails, a `VITE_` variable still holds a service_role key somewhere.

4. **The site works.** Load `os.spacerising.org` signed out (directory renders), then sign in
   as an admin and load `/admin` and every tab. Then sign in as a non-admin and confirm
   `/admin` shows "Not authorized".

5. **Rotate the human credential.** Reset the password for `ben@arsenalgpa.com` — the
   bootstrap password was committed in plaintext.

---

## 6. Close it out

- [ ] **Remove `VITE_SOURCING_ADMIN_KEY` from `LEGACY_ALLOWLIST`** in
      `scripts/check-no-vite-secrets.mjs`. Until you do, the build only warns about it. After
      you do, it is a permanent hard failure and the mistake cannot come back. **This step is
      the whole point of the allowlist existing.** Commit it.
- [ ] Delete `dist/` locally and rebuild, so no stale bundle with the old key sits on disk.
- [ ] Decide on git history. The old values are still in every clone. Options:
      - **Accept it** — the keys are now dead, so the exposure is historical. Cheapest, and
        usually correct once rotation is done and verified.
      - **Rewrite history** (`git filter-repo`) — forces every collaborator to re-clone and
        breaks open PRs. Only worth it if the repo will be made public or handed to a third
        party.
      Whichever you pick, write the decision down. Do not leave it undecided.
- [ ] Confirm the repo is still private and audit who has access.
- [ ] Note the rotation date here: `_______________`

---

## 7. The rule going forward

**`VITE_` means public. Full stop.** If a value must not be in a stranger's browser, it must
not carry a `VITE_` prefix — put the privileged call in a serverless function under `api/` and
let the browser talk to that.

`scripts/check-no-vite-secrets.mjs` runs as `prebuild` on every `npm run build`, locally and on
Vercel, and fails the build if a `VITE_` variable holds a service_role JWT. It prints variable
names only, never values.
