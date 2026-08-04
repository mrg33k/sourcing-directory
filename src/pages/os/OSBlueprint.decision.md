# Decision record — OSBlueprint.jsx (the /blueprint ship)

## agent

rex

## artifact

`src/pages/os/OSBlueprint.jsx` + `osv3-blueprint.css` (builder's work, merged at `b029a1e`),
route wiring `d96a280`, preview deploy `sourcing-directory-8myiuqo8r-aheads-projects-d2a4c70f.vercel.app`.
Covers the decision to ship this page live at `os.spacerising.org/blueprint`.

## call

I am shipping this because the page does the one thing it exists for: a member lands on the
state's shared strategy and has an obvious action — the hero's VIEW FULL BLUEPRINT DOCUMENT
button, wired to the real published report row (`ccec28b1-…`), not a placeholder. Admins get
the companion action (fill goals/initiatives/KPIs) through the Admin Tools CRUD the same
branch ships. The alternative — holding all four screens until the set is done — lost because
Patrik asked for this one and it stands alone: it degrades honestly when sibling data is
missing (verified: 6 real priorities off `directory_tags`, zeros elsewhere, no crash).
The alias flip itself waits for the `blueprint_*` migration so the page goes live with its
seeded content, not zeros.

## measured

`design_spacing_check.py --surface web osv3-blueprint.css`:

```
distinct spacing values : 2  [1.0, 2.0]        (hairline borders; all layout spacing rides var(--p-*) tokens)
placeholder copy        : none
near-full-height bands  : 0
RESULT: FAIL
  - NO HIERARCHY: the page uses a single font size (or none).
  ! LAZY NEUTRAL: default grey(s) used as a color -> gray.
```

Both flags dispositioned against ground truth, not waved off:

- NO HIERARCHY is the literal-value checker reading a token-driven stylesheet. The page's
  actual type usage: `grep font-size` → exactly 6 tokens (`--t-name --t-num --t-lead --t-body
  --t-meta --t-label`), resolved from the shared scale to **28 / 20 / 16 / 13 / 12 / 11 px** —
  a 6-step ladder under the 8 cap, 2.5:1 dominance, confirmed visually in the 2x crop
  (700-weight title over muted subtitle).
- LAZY NEUTRAL matched the substring in `var(--v3-gray-100)` — a system token, not a CSS
  `gray` keyword. Zero literal greys in the file.

`design_facts.py osv3-blueprint.css` (ground truth):

```
banned serif present: no
font weights: 700, 600, 500
letter-spacing: 0.06em, 0.08em
borders: 1px solid var(--v3-accent), var(--p-hair), 2px solid var(--v3-border), 0, 2px solid currentColor
border radius: var(--p-radius), var(--p-radius-sm), var(--v3-border-radius-full)
padding: var(--p-6), var(--p-2) var(--p-4), var(--p-2) var(--p-2), var(--p-4), 0 var(--p-4), 0, var(--p-4) 0, var(--p-4) var(--p-6)
```

All spacing rides the shared v3 token scale — one scale, not per-gap values. Three font
weights. Accent + 0.12-alpha category tints, consistent.

Deploy verification:

```
curl -s -o /dev/null -w "%{http_code}" .../8myiuqo8r...vercel.app  ->  200
bundle grep: path:"/blueprint",element:h.jsx(kv,{})  (inside the OS shell block, above /:slug)
```

Migration audit (`20260803120000_blueprint_governance.sql`):

```
grep -cE "^\s*create table"  ->  8
grep destructive patterns    ->  9 matches, all `alter table public.blueprint_*`
                                 (enable RLS + add column on its OWN new tables); zero drop/truncate/delete
```

Screenshots read at 1x and 2x crop: `blueprint-preview-pre-migration.png`,
`blueprint-closeup-hero.png` (mission Screenshots/). Hierarchy dominates (700 title over
muted subtitle), hero image fills its frame at natural aspect, tabs on the house pattern.

## uncertain

- I judged composition at a 500px capture only. Desktop-width balance — whether the stat
  grid and two-column zones fill without a void at 1440px — is unverified until the
  post-flip screenshot. This is the crop I am least sure about.
- I never clicked through Priorities/Goals/Initiatives/KPIs tabs in a browser; I read their
  code paths. A tab-level layout fault would have escaped me.
- The migration's seed rows are audited on paper, not proven against the live DB — if a seed
  violates a live constraint the push fails and the flip stalls.
- The builder signed no decision record; their in-round measurements are inferred from
  commit messages (`b029a1e` "balance the overview"), not seen by me.

## would_change

Post-migration: desktop + mobile walkthrough of every tab on the live domain. The open
mission item stands: a Blueprint hero banner on the OS home, and real strategic content
from Taryn/Tim to replace the honest zeros — the page's weight is capped until then.

## risk

If I am wrong, the client's flagship strategy page renders degraded on their own domain and
Tim or Taryn sees it the same day — this is the exact surface they sent comps for. Blast
radius is one route; the campaign page and reports are untouched. Rollback is
`vercel alias set <3i5ypyb9e-url> os.spacerising.org`, seconds, no build.
