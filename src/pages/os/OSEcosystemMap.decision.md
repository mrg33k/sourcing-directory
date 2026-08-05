# Decision record — Ecosystem Map

## agent

Space OS v4 screen build, `feat/osv4-eco-map` off `feat/spaceos-profiles`. Brief: build
`/ecosystem/map` from Tim Struck's reference comp, fully wired to real data, no invented numbers.

## artifact

- `src/pages/os/OSEcosystemMap.jsx` — the screen
- `src/pages/os/EcoBubbleMap.jsx` — Arizona choropleth with per-city count bubbles
- `src/pages/os/EcoTypeDonut.jsx` — multi-series donut + legend
- `src/pages/os/osv3-eco-map.css` — page-local stylesheet
- `src/lib/azCityCoords.js` — Arizona city lat/lng, the albersUsa projection onto the repo's own
  960×600 canvas, and the city/state normalisers

No shared component was edited. No migration was written. `src/main.jsx` was NOT changed; the route
line is handed back in the report.

## call

**The map is not a street map, and that is the answer rather than a compromise.**

The reference draws an interactive Google map with dropped pins. Two hard facts rule it out:

1. There is not one latitude or longitude in the database. No lat/lng column on any table;
   `grep -riE "latitude|longitude|lng"` across `src/` returns nothing. Organizations carry a
   free-text `city` and `state` and nothing else. Every pin on a street map would be a guess.
2. `MapPanel.jsx:8-11` records the standing decision that no map library is added and the Google
   Maps key is not revived, because a `VITE_`-prefixed key compiles into the public bundle. That
   already happened once on this project.

Read the reference closely and it is not plotting 623 individual pins either — it is showing
clustered count bubbles over cities (Phoenix 412, Tucson 186, …). That is a city-level choropleth,
and a city-level choropleth is exactly what the real data supports. So the screen draws the thing
the reference was communicating, from data that is true.

**The reference's cities are wrong and are not reproduced.** It shows Kingman and Sierra Vista.
Both have zero organizations. The real distribution is the East Valley: Phoenix 34, Tucson 24,
Scottsdale 23, Chandler 20, Tempe 19, Mesa 5, Gilbert 2, then singles.

**The facility-type map legend is dropped.** Launch Facility / Research Institution / Manufacturing
/ Test Facility is a taxonomy that does not exist in any table. The legend box in that corner of the
map is now the honest thing it can say: what a bubble means, and how many records could not be
placed.

**Every count is derived at load.** Nothing on the screen is a literal from the comp.

## measured

Verified in a browser at 1440 and at 390 (emulated viewport, not a resized window), against live
production data through the anon key:

| Control | Action | Result |
|---|---|---|
| Location select | `Tucson, AZ` | 165 → 24, one bubble, "24 of 24 placed" |
| Capability select | `CMMC Level 2` | 165 → 7 (DB: 7), four bubbles |
| Type select | `Academic` | 165 → 6 (DB: 6) |
| Type + Capability | `Academic` + `CMMC Level 2` | 0, "Nothing matches" empty state |
| Search | `raytheon` | 2 |
| Search | `semiconductor` | 39 (DB vertical semiconductor = 39) |
| Sort | Name (A–Z) | 10k24 Studio first |
| Sort | Recently added | Self (2026-07-31) first |
| Map bubble | click Phoenix | 34, location select syncs, bubble highlights |
| Map bubble | click again | clears back to 165 |
| Segmented control | People | 72, type + capability selects disabled |
| Filters toggle (390px) | open → filter → clear | 165 → 24 → 165 |

Layout, measured not eyeballed: the two body columns finish level (both 160→931 at 1440); the four
bottom panels are all 364px with 0–35px of slack under their last child; zero elements in the page
overflow their box horizontally at 390px; no text node is ellipsised at 1440.

**The projection was solved, not guessed.** City lat/lng travel through
`d3.geoConicEqualArea().parallels([29.5,45.5]).rotate([96,0])` — albersUsa's lower-48 cone, inlined
as eleven lines of trigonometry rather than adding d3 — then a scale and translate fitted by least
squares to three states whose borders are meridians and parallels, so their true bounding boxes are
known exactly (Colorado, Wyoming, Utah). Worst residual across those three: **2.5 canvas units**,
about 7 screen pixels at the zoom this map renders. Good enough to put a bubble on the right city;
not good enough for a street address, which is why the label says the city.

## uncertain

- **The anon key sees 164 of the 165 `directory_company_profile` rows.** One is withheld by
  row-level security — most likely the single `status='pending'` organization. The type panel
  therefore says "164 of 165 organizations in this view have a type on file", which is the true
  statement from where the page stands. I did not read the RLS policy to confirm which row.
- **`org_type` is a free-text box** on the company edit form (`ProfileEditCompany.jsx:340`). Today
  the backfilled values happen to be six clean strings. Nothing stops an admin typing "private
  company" and creating a seventh slice that is the same thing as the first. The donut carries eight
  series colours and will silently start recycling at nine.
- **The city coordinate table is reference geography I wrote from knowledge, not from a geocoder.**
  The 13 cities that carry an organization today were sanity-checked by watching them land inside
  Arizona in the right relative positions. The other ~45 entries are there so a city added tomorrow
  lands somewhere rather than nowhere; they have not been individually verified on screen.
- **Bubble collision relaxation is deterministic but not optimal.** Nine cities inside nine canvas
  units is a genuinely hard packing problem; the current pass is 160 iterations of pairwise push
  plus a spring home. It is stable across reloads (no randomness), but I have only looked at it for
  the one distribution the data currently has. A different distribution could place a leader line
  awkwardly.
- **Label placement drops a name rather than draw an unreadable one.** With the current data, five
  single-organization cities inside the Phoenix cluster go unlabelled. They answer on hover and on
  click. I judged that better than overlapping text; someone may disagree.
- **Never loaded the page as a signed-in member.** Everything was verified signed out. The screen
  does not read the session at all, so there should be no difference, but I did not prove it.

## would_change

- Promote `EcoTypeDonut` into `src/components/osv3/` once the parallel Ecosystem Overview screen has
  landed. It is page-local right now purely to avoid a merge conflict in a shared folder two agents
  are working in this week.
- Give `org_type` a controlled vocabulary — a lookup table, or a `<select>` on the edit form fed by
  `directory_tags`. Free text on a field that drives a chart will drift within a month.
- Move `src/lib/directoryCategories.js` into a real table with a foreign key. It is 162 company
  **names** mapped to a category and joined by string match. Four of the 165 organizations already
  fall through it — every organization added since the file was frozen.
- Clean the three dirty location rows at source rather than normalising them at render.

## risk

- **`directory_certifications` is read unscoped by tenant** (`.select('company_id,cert_name')` with
  no `tenant_id` filter) because 10 of the 345 rows have a null `tenant_id` and filtering would drop
  them, undercounting the companies that hold them. Today one tenant is active so this is
  equivalent; the day a second tenant goes live, this query leaks another tenant's certification
  names into this screen's capability filter. It must gain a join through `directory_companies`
  before a second tenant exists.
- **The whole dataset is pulled to the client** — 165 + 72 + 345 + 165 rows, then filtered in the
  browser. That is the right trade at this size (every filter is instant, one round trip) and the
  wrong one at 5,000 organizations. The load function is the single place that has to change.
- **`normalizeState` used to truncate.** It sliced a state value to two characters, which turned
  "Arizona" into "AR" and put two Scottsdale members in Arkansas, splitting Scottsdale into three
  separate locations in the filter. It now looks names up in a table and never truncates. The same
  class of bug is waiting anywhere else a state string is shortened.
- The screen shows a `status='pending'` organization alongside active ones, because it does not
  filter on status. That matches `/directory`'s behaviour today; if moderation ever means "pending
  is not public", this screen needs the filter too.
