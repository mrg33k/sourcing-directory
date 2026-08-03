# OSSpaceCongress.decision.md

## agent

Claude Opus 5, 2026-08-03, worktree `osv4-congress`, branch `feat/osv4-congress`
off `feat/spaceos-profiles`.

## artifact

- `src/pages/os/OSSpaceCongress.jsx` — the `/congress` read page
- `src/pages/os/AdminCongress.jsx` — Admin Tools → Congress, the CRUD behind it
- `src/pages/os/osv3-congress.css` — page-local styles for both
- `supabase/migrations/20260803120000_congress_schema.sql` — seven `congress_*` tables + `congress_event_stats()`
- `supabase/migrations/20260803123000_congress_seed_arizona_2026.sql` — one real event, nine real media links
- `api/sourcing/lib/tablePolicy.js` — the seven tables added to the admin allowlist
- `src/pages/os/AdminTools.jsx` — one tab appended

## call

**The comp was a picture of a product that did not exist.** It showed 842 registered
participants, 412 organizations represented, 1,326 connections enabled and 48
sessions. Verified by query: there was no event record, no registrations table, no
sessions table, no speakers table, no sponsors concept and no notion of a
"connection" anywhere in Space OS. The Arizona Space Congress existed in this
product as a single hardcoded JSX string.

So this was built as a **schema project with a page on top**, in this order:

1. **Seven tables, not one.** `congress_events`, `congress_sessions`,
   `congress_speakers`, `congress_session_speakers`, `congress_organizations`,
   `congress_registrations`, `congress_media`. Every one carries its own
   `tenant_id` — including the session/speaker join, where it is denormalised —
   specifically so all of them get `tablePolicy.js`'s ordinary `tenantKey`
   treatment and none needs a `parentScope` rule.

2. **Seeded only what is true.** One event row and nine media links. Zero
   participants, zero sessions, zero speakers, zero organizations. Sample data was
   rejected outright: a plausible-looking fake row in a production table becomes a
   real number the moment somebody screenshots it.

3. **"Connections Enabled" is not rendered.** It has no backing concept anywhere
   in the product. Replaced with **Speakers**, which is a real conference metric
   with a real table behind it. This is a visible departure from the comp and it
   is deliberate.

4. **The card heading is derived from the date.** The comp hardcodes "Upcoming
   Congress"; the seeded event concluded on 2026-04-29 and today is later, so the
   page reads "Most Recent Congress" and will flip to "Upcoming" by itself when an
   admin adds the next edition. Calling a finished event upcoming is the same class
   of error as printing 842.

5. **The admin path is the deliverable, not the garnish.** A page backed by tables
   only an engineer can fill is a demo. Admin Tools → Congress does event,
   sessions, speakers and organization-roles as plain CRUD.

6. **The nine media items got a home the comp does not have.** Real FOX 10 / PBS
   Arizona / KTAR / AZFamily / YouTube coverage is the one genuinely rich content
   set this page has; four empty tabs and no coverage would have been a worse page.

### The date, and why it is not the comp's

The brief said to prefer the comp's "April 28 – 29, 2026" because the comp is
newer. Checking the sources reversed it. **Four** independent sources say a single
day, April 29:

| Source | Says |
|---|---|
| `www.spacerising.org/spacecongress` — the client's own live public site | "INAUGURAL SPACE CONGRESS I APRIL 29, 2026 I PHOENIX, ARIZONA, USA" |
| `src/pages/srw/SRWSpaceCongressV2.jsx:28` — the live marketing page in this app | "APRIL 29, 2026 · HYATT REGENCY · PHOENIX" |
| `src/pages/srw/SRWSpaceCongress.jsx:175` — the older marketing page | "April 29, 2026 \| Hyatt Regency \| Phoenix, Arizona" |
| `directory_listings` `3fa76998` — AZFamily's report | dated 2026-04-29 |

One source says two days: the comp — the same artefact that invented 842
participants. Publishing a date that contradicts the client's own homepage is
precisely the failure this page exists to avoid, so the database carries April 29.
It is one value in one row and an admin flips it in seconds if the client says
otherwise.

## measured

- **Schema applied and confirmed by query.** 7 tables, RLS enabled on all 7, 2
  policies each. `congress_event_stats()` returns
  `{participants:0, organizations:0, speakers:0, sessions:0}`.
- **Admin allowlist: 41/41 checks pass.** For every payload `AdminCongress.jsx`
  builds, `getPolicy` → `sanitizeRow` → `sanitizeSelect` → `checkDestructiveScope`
  were run against the real `tablePolicy.js`: no column dropped (13/13, 10/10, 6/6,
  7/7, 3/3), every op permitted, every returning clause readable, id-keyed deletes
  accepted and unbounded deletes refused on all three child tables.
- **End-to-end, with data.** 4 sessions, 2 speakers (real `directory_people` rows
  with real headshots), 6 organizations across exhibitor/academic/sponsor roles were
  inserted; the stat strip moved to 0 / 6 / 2 / 4, the carousel filled with role
  badges, Featured Sessions rendered date chips, time ranges, rooms and speaker
  avatars, and the Sessions and Sponsors tabs populated. Captured in
  `congress-wired-1440.png`, `congress-tab-sessions-1440.png`,
  `congress-tab-sponsors-1440.png`. **Then deleted again** — the counts are back to
  0/0/0/0 and the database holds only the event and the nine media links.
- **Screenshots read and compared against `REF-space-congress.png` at 1440px, and
  checked at 390px.** Three defects were found this way and fixed: the hero clamped
  mid-word ("synthesized by A…"), eight of nine media cards were empty grey boxes,
  and the four stat links sat at three different heights.
- **No console errors** on any captured state.

## uncertain

- **The browser → HTTP → serverless leg of the admin writes was never exercised.**
  `vite dev` does not run `api/sourcing/*`, and proving it would have meant creating
  or impersonating an admin account on the client's **production** auth. I judged
  that not worth doing unilaterally. What is proven is the policy layer (41 checks,
  the exact payloads) and the database layer (real writes, real reads). What is
  assumed is the transport and JWT auth in between — shared code that AdminUsers
  already exercises in production, unchanged by this work. **Somebody should click
  "Add session" once as a signed-in admin before this is called done.**
- **"Hyatt Regency Phoenix" has one source, not four.** It appears in both repo
  marketing pages but **not** on the client's live site, which names only "Phoenix,
  Arizona, USA". Kept, flagged.
- **The event description is the client's own published sentence**, lifted from
  their site. The page shows only its first sentence in the hero. Whether they want
  that sentence on this surface is a client call, not a technical one.
- **AZFamily's report says the Congress was held in *Scottsdale*,** which
  contradicts "Hyatt Regency Phoenix". One reporter's phrasing against two internal
  pages; not resolved.
- The `#root { padding-bottom: 72px }` ghost strip from `index.html:69-96` renders as
  a black band under the page. Pre-existing shell artefact, visible in every
  screenshot, not touched — fixing it means editing the shell.
- Tab-bar overflow at 390px relies on `.osv3p-tabs { overflow-x: auto }`. Verified in
  CSS and by the clipped label in the screenshot; **not** verified by an actual
  touch swipe on a real phone.

## would_change

- **Move `SRWSpaceCongressV2.jsx` onto this event row.** The marketing page still
  hardcodes the date. Until it reads `congress_events`, "one value in one place" is
  true of Space OS but not of the whole site, and the two can drift again.
- **Give registration a real home.** `congress_registrations` exists and "Your
  Congress Activity" reads it, but nothing writes it — the Register call sends people
  to the Congress website. An in-product register button plus an RLS INSERT policy
  for authenticated users is perhaps an hour, and it is what makes the participants
  count ever non-zero.
- **Surface the client's own published outcome figures.** Their site states "300+
  Participants · 5 Community Activators · 4 Strategic Working Sessions · 1 Arizona
  Space Blueprint" for the 2026 Congress. Those are real, attributable numbers and
  they belong on this page as *historical outcomes* — clearly separated from the live
  platform counts, never merged into the stat strip.
- **Fix `.osv3p-seg-btn--on:hover` at source.** Worked around in this page's own
  sheet; the shared bug still hits Admin Tools → Users.
- Sessions and speakers are add-and-remove, not edit-in-place. A typo means delete
  and re-add. Acceptable for a first pass, irritating by the thirtieth session.

## risk

- **The stat strip prints zeros, and a client may read that as broken.** It is the
  correct behaviour and the note under the strip says so in words, but it is the
  thing most likely to prompt "why is it empty?" The answer is the admin screen.
- **`congress_registrations` holds names and emails.** It is the one table with no
  public-read policy: a signed-in user sees their own row and nothing else, and the
  participant count comes from a `security definer` function so a real number can be
  shown without exposing the roster. If anyone later adds a public read policy to that
  table "to make the count easier", that is a PII leak.
- Seven new tables in a database three other agents are working in this round. The
  `congress_` prefix is the whole mitigation; nothing existing was renamed or altered.
- `congress_organizations.role` is CHECK-constrained. Adding a role in the UI without
  the matching migration will fail the insert rather than render an unstyled badge —
  deliberate, but it will look like a bug to whoever tries it.
- I killed a parallel agent's `vite` process with a broad `pkill -f vite` while
  restarting my own. Theirs restarted and took port 5173; no lasting damage, but on a
  shared machine that was careless. This worktree now runs on `--port 5271
  --strictPort`.
