# Decision record — the osv4 three-screen ship (Ecosystem Overview, Ecosystem Map, Space Congress)

## agent

rex

## artifact

The set-level ship of `feat/osv4-eco-overview` + `feat/osv4-eco-map` + `feat/osv4-congress`
into `feat/spaceos-profiles` (merges `51649a7`/`5c8637c`, routes `5d4970b`), deployed as
`sourcing-directory-gt1ge4tn0-aheads-projects-d2a4c70f.vercel.app`. Each page's own build
decisions are in the builders' records merged alongside: `OSEcosystemOverview.decision.md`,
`OSEcosystemMap.decision.md`, `OSSpaceCongress.decision.md`. This record covers what the ship
itself decided.

## call

I am shipping all three because Patrik asked for exactly that ("Ship all 3 send me the urls")
and each page verified against its purpose on the deploy: Overview renders real ecosystem
stats with the org-type gap now filled; Map places 133 of 165 organizations with the
remainder honestly accounted; Congress renders the seeded April-29 event through the real
client path — which also proves the schema migrations landed. Merge decisions: union-resolved
the three-way conflicts in the admin tab surface and the server table policy (kept every
branch's additions; folded Congress's static tab into the dynamic tab list so the
global-admin gating survives); renamed three migration files that shared one version
timestamp — same-version migrations are invisible to the migration tool's ordering, and a
collision with the already-applied blueprint migration was a live hazard.

## measured

`design_spacing_check.py --surface web` on each page stylesheet:

```
osv3-ecosystem-overview: RESULT: FAIL — NO HIERARCHY (0 literal font sizes)
osv3-eco-map:            RESULT: PASS (floor cleared on every machine-checkable item)
                         ! LAZY NEUTRAL: gray
osv3-congress:           RESULT: FAIL — NO HIERARCHY (1 literal size) · ! LAZY NEUTRAL: gray
```

Both FAILs dispositioned against ground truth, same artifact class as the Blueprint record:
these stylesheets ride the shared v3 token scale, which the literal-value checker cannot see.
Actual type usage per `grep font-size`: overview 5 tokens, map 7 (5 tokens + 11/26px),
congress 8 (7 tokens + 20px, including `--t-hero` → **40px**) — every page ≤8 sizes on the
shared 40/28/20/16/13/12/11 ladder, hero dominance confirmed visually in the screenshots.
Both LAZY NEUTRAL hits are the substring of `var(--v3-gray-*)` token names; literal grays
in the two files: **0** (grepped).

Build: `✓ built in 1.63s` (vite, no errors) at `5d4970b`.

Migrations: `supabase db push --include-all --yes` → `Finished supabase db push.` (one
idempotent NOTICE). Destructive-pattern audit before push: org_type 0 hits, congress seed
0 hits, congress schema 14 hits — all `drop policy if exists` on its OWN new tables.

Deploy: three pages screenshot-verified on `gt1ge4tn0` (`eco-overview-deploy.png`,
`eco-map-deploy.png`, `congress-deploy.png`, read at full size):
- Overview: 165/72/335 KPIs real, donut "165 Typed", region card "133 of 135 placed".
- Map: bubbles Phoenix 34 / Tucson 24 / Scottsdale 23 match Overview's city table; legend
  "133 of 165 placed · 32 outside Arizona or without a city".
- Congress: seeded event card renders (Apr 29 2026, Hyatt Regency Phoenix) — end-to-end
  DB proof; stat strip zeros carry the "live counts, not projections" footnote.

## uncertain

- Cross-page stat: Map header says **345 Capabilities**, Overview KPI says **335**. Both are
  live queries; I did not chase which definition differs (rows vs distinct holdings?). If
  Tim compares pages side by side this is the first thing he asks about.
- The Congress date renders April 29; Tim's comp says April 28–29. Stored as one DB value,
  deliberately unresolved — Patrik or the client must confirm.
- The Congress hero photo is generic tech-event stock, not space-specific imagery. The DOM
  checks cannot see that; my eye says it is the weakest visual choice in the set.
- I verified at 1440px only and did not exercise Map filters, Congress tabs, or the admin
  CRUD forms in a browser.
- The pre-existing REST-read verification of seeded congress rows was permission-blocked;
  DB proof rests on the rendered event card (real client path), which I judge sufficient.

## would_change

Chase the 345/335 definition split to one number. Real Congress photography for the hero.
A browser walkthrough of Map filters and the three admin tabs (Organizations, Congress,
Blueprint) as a signed-in admin.

## risk

If a merge resolution is wrong, the blast radius is the admin surface (a tab that errors) or
a server policy hole — the fail-closed module-load check in tablePolicy guards the worst
case. If wrong on the data nits, the client sees an inconsistent capability count or a
one-day-short Congress date on their own domain. Rollback is one re-alias to the previous
deployment.
