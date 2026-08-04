# Decision record — AdminSubscribers.jsx (the Subscribers tab of Admin Tools)

## agent

rex

## artifact

`src/pages/os/AdminSubscribers.jsx` (new screen, commit 8c1cb37 on fix/tim-os-holes,
merged to feat/spaceos-profiles in 4c01dd9). Covers the screen plus its two wiring
touches: the tab append in `AdminTools.jsx` and the read-only `srw_subscribers`
entry in `api/sourcing/lib/tablePolicy.js`.

## call

I am shipping this because Tim asked "how do we access the database" about the
Stay Connected emails, and the honest answer was "an engineer queries it" — 31
real signups invisible to the people they belong to. This screen makes the
answer "open Admin Tools."

Intention, stated plainly: the screen is FOR answering "who subscribed and from
where"; the ONE action is **Export CSV**, and it is the only primary button on
the screen. Everything else (origin segments, search) exists to shape what that
export contains — filtered view, filtered file.

What lost: building this as a new SourcingAdmin section in the legacy panel.
The v3 Admin Tools is where admin work is consolidating (Users, Blueprint), the
osv3 primitives are better than the legacy panel's inline styles, and the
Users tab next door is the pattern admins already know. I also chose read-only
over CRUD: a submission is a record of something a visitor did; nothing on this
screen should be able to rewrite that.

Visibility is gated to global admins because tablePolicy refuses tenant-less
tables to tenant admins (the 2026-07-28 fix), and a tab that can only render a
403 is not a feature. Tim/Taryn seeing it is a one-switch grant that also opens
Deal Bank — Patrik's call, flagged in the report, not smuggled in here.

## measured

`design_facts.py src/pages/os/AdminSubscribers.jsx`:

    VERIFIED FACTS (from the code -- ground truth, do not contradict):
      banned serif present: no

No hardcoded fonts, colors, borders or radii in the component — every visual
token comes from the shipped `osv3-profile.css` classes (`osv3p-seg`,
`osv3p-users-bar`, `osv3p-input`, `Pill`, `DataTable`, `EmptyState`), the same
stylesheet the Users tab passed review with. Spacing and type scale are
therefore the osv3 system's, not values invented for this screen.

Behavioral verification of the same ship (verify-tim-holes.py against preview
deploy lzxurcx5r, signed-out visitor):

    PASS reports add -- url=.../admin/reports
    PASS careers post-a-job -- url=.../jobs/post
    PASS organizations add -- url=.../admin/organizations
    PASS /people add -- url=.../admin/listings?category=person
    PASS /community add -- url=.../admin/listings?category=event
    PASS /marketplace add -- url=.../admin/listings?category=equipment
    PASS directory stay-connected form -- form rendered
    7/7 passed

Build: `vite build` clean on both branches (AdminTools chunk 34.93 kB).

## uncertain

**Nobody has seen this screen rendered.** It renders only for a signed-in
global admin; the robot Chrome was down (restart failed) and the prod alias is
permission-gated, so my confidence is structural — it composes the exact
primitives and classes of the reviewed Users tab — not visual. The first
global-admin login must actually look at it. Specific doubts: the Export CSV
button sits in the same bar as the segments and search on a pattern the Users
tab does not have (three items in `osv3p-users-bar`, not two) — that bar could
wrap ugly at laptop widths; the `contact` origin reuses the `rejected` pill
tone, which reads as red and might wrongly signal "bad" for what is just a
contact message; and long contact messages in the Details column could stretch
row heights in a way the Users tab never exercises.

## would_change

With the browser back: screenshot the tab at 1440 and 1024, crop close on the
bar and the pills, and fix the wrap if it is there. With more time: a date-range
filter on the export, and a per-row "copy email" affordance. The real upgrade
is piping new signups into whatever CRM Tim names, at which point this screen
becomes the audit view rather than the delivery mechanism.

## risk

If the bar wraps or the table misbehaves, the blast radius is Patrik (today's
only global admin) seeing a rough admin screen — no visitor ever sees it, no
data is at stake, and the fix is CSS. If the tablePolicy entry is wrong the
failure is a 403 rendered as the screen's own honest error state, not a leak:
the entry is select-only, writable [], and the server allowlist fails closed.
The email pipeline change carries the real client-facing risk (a subscriber now
gets the welcome email), and that path is the site form's existing code, not
new code.
