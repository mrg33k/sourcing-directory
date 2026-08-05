# Decision record — Ecosystem Overview + organization type as real data (2026-08-03)

## agent

Opus 5, worktree `osv4-eco-overview`, branch `feat/osv4-eco-overview` off
`feat/spaceos-profiles`.

## artifact

`src/pages/os/OSEcosystemOverview.jsx` + `src/pages/os/osv3-ecosystem-overview.css`
(the screen), `src/lib/ecosystemOverview.js` (the live read), `src/lib/cityGeography.js`
(Arizona city coordinates + the albersUsa fit), `supabase/migrations/20260803120000_company_org_type.sql`
(provenance columns, the org_type CHECK, `get_ecosystem_activity()`),
`scripts/backfill-org-type.mjs` (the classifier), `src/pages/os/AdminOrganizationTypes.jsx`
+ `src/pages/os/osv3-admin-org-types.css` (the admin editor),
`api/sourcing/lib/tablePolicy.js` (one additive allowlist entry),
`src/pages/os/AdminTools.jsx` (the Organizations tab body + `?tab=` deep-linking).

The route is **not** wired: `src/main.jsx` is frozen this round and the route line is
in the handoff report instead.

## call

I am shipping this because the page answers the question its title asks with numbers
that are all real, and because the one gap that blocked half of it — no organization
had a type — is closed in a way a non-engineer can correct.

The load-bearing decision is what to do about the four sections the comp asks for that
this platform does not record. The alternative was to render them empty and hand back
a half page. It lost because three of the four have a genuinely interesting real
number sitting next to the fictional one: there is no "Connections Made" but there are
8 published reports; there is no capability taxonomy but there are 30 real
certifications and ISO 9001 is held by 84 organizations; there is no recorded demand
but there is recorded supply and Raytheon holds 7 certifications. A section that shows
a real neighbouring fact under an honest heading is worth more than an empty state,
and is still not a lie. The one case where no neighbouring fact existed — the Verified
badge — is the one I left absent.

The second decision is that `org_type` is DERIVED and says so everywhere. 118 of the
165 come from one inference: an organization in a business directory, with a .com and
no institutional signal, is a private company. That is a reading, not a fact, so it is
stored at `medium` confidence with its own rule string, the admin tab groups by that
rule, and a human correction stamps `org_type_reviewed_at` which the script then
refuses to touch. The alternative — write the types and move on — lost the moment I
noticed the classifier gets "Plug and Play" wrong (a VC, typed Private Company by its
.com). It will get things wrong. The design is that being wrong is visible and cheap
to fix, not that it is rare.

Third: the comp's date-range picker became a comparison-window control. A picker that
filters nothing is a button that does nothing, and there is nothing here for a
start/end date to filter — five of the six tiles are totals and the donut and map are
snapshots. What a date range CAN honestly drive is the "new in ___" line under each
tile, so that is what it drives, and it re-reads the database on change.

## measured

**The projection.** `src/lib/usStatesPaths.js` is albersUsa fitted to 960x600, and the
fit is not the library default. Scale and translate were solved from three surveyed
Arizona corners whose path vertices are known:

    AZ/NV/UT tripoint (-114.0506, 37.0004) -> 221.0, 303.3   residual 0.017, 0.021
    Four Corners      (-109.0452, 37.0004) -> 304.9, 317.2   residual 0.021, 0.036
    AZ/NM/Mexico      (-109.0452, 31.3322) -> 288.1, 438.6   residual 0.004, 0.015

    => scale 1230.2165, translate [515.7739, 295.4629]

Residuals are below the 0.1px rounding in the path data. Checked afterwards against
four states not used in the fit:

    MN NW Angle   (-95.1536, 49.3844) -> y  65.7   MN path min y  65.7
    Brownsville   (-97.4975, 25.8400) -> y 572.4   TX path max y 572.3
    Cape Mendocino(-124.4090,40.4400) -> x  72.4   CA path min x  72.0
    West Quoddy   (-66.9500, 44.8150) -> x 960.6   ME path max x 960.0

All 52 cities in the table land inside Arizona's own path bounding box.

**The classifier**, over all 165 organizations:

    142 Private Company · 7 Nonprofit · 7 Other · 6 Academic · 2 Investor · 1 Government
    118 domain-tld:commercial · 24 name:legal-suffix · 7 unclassified
      5 domain-tld:.org · 4 domain-tld:.edu · 2 each name:{academic,investor,nonprofit}
      1 name:government
    123 medium · 35 high · 7 none

Every non-default assignment was read by eye. The 7 unclassified are the review queue
and the script prints them by name.

**The correction guard**, run end to end against the live database:

    invented type 'Space Agency'  -> 400, violates directory_company_profile_org_type_check
    admin sets AEON Space         -> 200, org_type_source admin:manual, reviewed_at stamped
    re-run backfill               -> "Skipped 1 human-reviewed row(s): AEON Space"
                                     "Wrote 164 of 164 rows"
    correction still present      -> yes

The test row was then reset; the database holds only classifier output today.

**The endpoint policy**, run against `sanitizeRow`:

    kept:    company_id, org_type, org_type_source, org_type_confidence,
             org_type_reviewed_by, org_type_reviewed_at, updated_at
    dropped: verification, verified_at  ("not writable on this table")

**Anon reachability**, with the shipped anon key: `directory_company_profile` 164 rows
(the pending company's is correctly invisible), `get_ecosystem_activity(8)` 200 with 8
rows and no actor column.

**The screen**, 1440px and 390px, screenshots in the mission's `Screenshots/`. Both
card rows end on one line; no horizontal scroll at 390.

## uncertain

- **I never exercised the admin WRITE through the real endpoint.** `vite dev` does not
  serve `api/` at all — `POST /api/sourcing/admin` is a hard 404 locally — so the write
  path has only been verified in its parts: the policy accepts the payload, the
  database accepts the row, the script honours the stamp. The three have not been run
  as one request by a signed-in admin. First thing to check on the preview deploy.
- The screen has only been seen SIGNED OUT. Nothing on it is auth-gated, but I have not
  watched it render for a real session.
- 52 Arizona city coordinates are recalled reference geography, cross-checked only by
  the bounding-box test. The 13 that matter today are the large well-known ones; the
  other 39 are insurance for cities that have no organizations yet, and any one of them
  could be off by a mile without the bbox test noticing.
- **Two figures in `reference/DATA-TRUTH.md` are the un-normalised counts.** It gives
  Phoenix 33 / Scottsdale 22 "after you merge the duplicates"; merging actually gives
  34 and 23, and the raw values are 33 and 22. It gives "16 distinct Arizona city|state
  pairs after you normalize"; 16 is the raw count and normalising gives 13 real cities
  plus one row whose city column holds the word "Arizona". The screen shows the merged
  numbers. Somebody should reconcile that document.
- Capabilities is 335 here and 345 in `/admin-tools`, and people is 72 here and 72
  there but 73 in the table. Both differences are tenant scoping: 10 certifications and
  1 person carry a tenant that is not space-rising. I believe scoping is right for a
  member-facing page; nobody has ruled on it.
- I did not look at whether `/directory` can actually filter by certification. The
  "Browse the directory" link under the capability bars goes somewhere real and
  relevant; it may not go somewhere that continues the exact thought.

## would_change

Give the map card counted bubbles. `MapPanel` takes `markers:[{id,x,y,label}]` and
draws an unlabelled pin, so five Phoenix-metro cities four canvas units apart render as
one blob and the counts had to move into a list underneath. The right fix is a
`badge` field on the marker plus collision-aware placement, in `MapPanel` — which is a
shared component another agent is building against this round, so it did not happen
here.

Second: `KpiTile`'s delta arrow is a hardcoded green up-arrow, so a −85% has to be
written as "4 new · down 85%" with an up-arrow beside the 4. It is honest and it is
awkward. A `direction` prop on that component would let five of these six tiles say
what they mean.

## risk

**The 118.** If `domain-tld:commercial` is wrong for a category of organization nobody
has thought of, 71% of the donut is wrong at once and it will look authoritative while
being so. The mitigations are that the rule is named on every row it produced, the
admin tab filters to exactly it, and the whole thing is one script re-run away from a
different answer. The residual risk is that nobody looks.

**The tenant-scope divergence.** `/ecosystem/overview` says 164 organizations and
`/admin-tools` says 165, because this page counts the live directory and that one
counts records. Both are correct and the footnote explains it, but the first person to
put the two screens side by side will file a bug.

**`get_ecosystem_activity()` is SECURITY DEFINER.** It reads a table anon cannot touch
and returns four columns from it. The actor is not one of them and the join restricts
it to companies that are already public, but it is a function that reads a restricted
table on an unrestricted caller's behalf, and any future widening of its SELECT list
needs to be read with that in mind.

**One additive entry in `api/sourcing/lib/tablePolicy.js`**, a file three agents may be
editing this round. It is a merge-conflict candidate, and the module throws at load if
a tenant-less table declares neither `globalOnly` nor `parentScope` — so a bad merge
takes the whole admin endpoint down rather than failing quietly. That is the intended
behaviour of that guard, and it is worth knowing before the merge.
