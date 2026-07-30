# Decision record — Admin Tools › Users tab

## agent

rex (Patrik's EA), 2026-07-30. My call, my name on it.

## artifact

- `src/pages/os/AdminUsers.jsx` (new)
- `src/styles/osv3-profile.css` — new "ADMIN › USERS" block, 12 classes
- `src/pages/os/AdminTools.jsx` — renders the tab, `users` removed from `TAB_PROMISES`

Evidence: `Screenshots/admin-users-tab3.png` in the mission folder.

## intention

**What the screen is for:** an admin needs to know who is waiting on them.
Somebody signs up, they cannot use the product until an admin approves them, and
nothing else on this platform surfaces that.

**The ONE thing they must be able to do:** approve a pending account.

That drove three decisions:

1. **The filter opens on Pending whenever anyone is pending**, and on Everyone
   when the queue is clear. The screen opens on the work, not on a roster you
   have to filter yourself.
2. **Approve is `solid`; everything else is `quiet`.** Approving is the common
   action, revoking is rare and destructive. Equal weight would misrepresent
   which one you are meant to reach for. My first render had them equal and it
   read as a list of options rather than a queue with an obvious next move.
3. **The counts live in the filter, not in a separate stat row.** "How many are
   waiting" is the question, so the answer belongs on the control you press.

## call

I built this rather than extending the legacy panel because the legacy Members
section only ever showed the *pending* subset and offered approve-with-a-role.
There was no way to see the whole roster, find one person, or undo a decision.

**The load-bearing decision is that this screen refuses to lie about whether a
write landed.** It was built the same day the UI sweep found four admin tabs
that report success on failure, and one where "the report was NOT deleted"
renders in a colour you cannot read. Two named traps, both live in this codebase,
both avoided here:

- `adminApi` never rejects. It resolves `{data, error}`, and ~21 call sites in
  `src/` ignore `error` entirely. Every mutation here reads it.
- A PostgREST UPDATE that RLS narrows to zero rows returns **no error**.
  `api/sourcing/upgrade-membership.js` has reported `{success:true}` for writes
  that touched nothing since it was written. So every mutation asks for the row
  back with `.select('id,role,status')` and treats an empty array as failure.
  Local state is patched from what the server returned, never from what I sent.

**No "suspend", against the tab's own placeholder text.** That placeholder
promised "approval, role and suspension controls" — but it was written by an
agent, not by Patrik, and `directory_members.status` is a plain text column with
no CHECK constraint whose only understood values are pending / approved /
rejected (`migrations/006_sourcing_members.sql:13`). Writing `'suspended'` would
succeed at the DB and then be invisible to every gate in the app, all of which
test for `'approved'`. That is a silently locked-out user with no trace.
Revoking sets `'rejected'`, which every gate already understands, and the button
says "Revoke access" because that is what it does.

What lost: a role dropdown per row. It reads as a form in a table and invites
accidental changes on a destructive field. A single explicit "Make admin" /
"Remove admin" button states the outcome instead of the mechanism.

Filtering happens in the browser off one fetch. The roster is 70 rows and every
filter is a field test, so a refetch per tab click would be latency for nothing —
and every count comes from the same array, which is why they cannot disagree.

## measured

`design_spacing_check.py src/styles/osv3-profile.css --strict`:

```
  distinct spacing values : 9  [1.0, 2.0, 4.0, 8.0, 12.0, 16.0, 24.0, 32.0, 48.0]
  gap ranks (used >1x)    : [4.0, 8.0, 12.0, 16.0, 24.0, 32.0]  span 8.0x, top value 32% of gaps
  distinct font sizes     : 7  [11.0, 12.0, 13.0, 16.0, 20.0, 28.0, 40.0]
  hierarchy ratio (max/min): 3.64
  lazy neutrals           : none
  RESULT: PASS (floor cleared on every machine-checkable item)
```

Still 7 font sizes — this screen introduced no new size.

Orphan-class scan (the defect that caused today's other fire):

```
before this screen : ORPHANS 60
after this screen  : ORPHANS 60
AdminUsers.jsx orphans: []
AdminTools.jsx orphans: []
```

12 classes added to the markup, 12 defined in the stylesheet **in the same
commit**. That was the whole point.

`npx vite build` → `✓ built in 1.65s`, no errors.

## uncertain

**I have never seen this screen run against the real database.** Everything above
is a static harness reproducing the DOM the component emits. `/admin-tools`
requires a signed-in admin session I cannot get locally, so the entire data path
— the `adminRequest` call, the tenant scoping, the shape of what comes back — is
verified by reading `adminApi.js` and `tablePolicy.js`, not by watching it work.
**The single most likely failure is that my `.select()` on update does not
return what I think it does**, in which case every successful approval would
report the zero-row failure message. That would be loud rather than silent, which
is the right direction to fail in, but it would still be wrong.

**I did not test the tenant-scoping behaviour at all.** The server resolves the
caller's tenant reach and filters. A platform admin over multiple tenants and a
single-tenant admin will see different rosters, and I have exercised neither. The
runbook also notes all five live admin accounts are platform admins, so the
narrower case may be entirely untested in production too.

**`formatRelative` on `created_at` is unverified for old rows.** I reused it from
`adminStats.js` without checking its output past a few months. "3 months ago" in
my harness is my own string, not the function's.

**I did not render this at phone width.** I wrote the stacking rules into the 760
block by analogy with the edit form and did not screenshot them. I flagged the
same gap on the edit form earlier today, went and shot it, and found the harness
was silently rendering at desktop width the whole time — so I have direct
evidence from this session that reasoning about a breakpoint without looking is
unreliable. I am naming it rather than claiming it.

**The empty-state copy for "nobody is pending" is optimistic.** It reads as
success ("every account has been dealt with"), but it renders identically when
the fetch returns a partial list. I do not distinguish those.

## would_change

- Sign in and drive it: approve a real pending account, force a failure by
  targeting a row outside the caller's tenant, confirm the zero-row branch fires.
  That closes the biggest hole above.
- Screenshot at 390px.
- Paginate. `.limit(1000)` is fine at 70 accounts and silently wrong at 1,100 —
  and it would be wrong with no visible symptom, which is the bad kind.
- Show *which* tenant a member belongs to. A platform admin looking at 70 rows
  across several organizations currently cannot tell them apart.
- The `.osv3p-table th` specificity bug (headers on `align:right` columns sit
  left) is real on the dashboard's Recent Organizations table too. I scoped my
  fix rather than change a table that is pixel-matched to its reference PNG.
  Someone should make that call deliberately.

## risk

If the data path is wrong, the tab shows the "cannot read the account list"
state or reports failure on every action. Visible immediately, affects no data,
and the legacy Members section still works — it is one click away under
"Management panel" and I did not touch it. That is the deliberate safety net:
this screen is additive, and nothing was removed on the strength of it.

The genuinely dangerous action here is **Make admin**. It grants platform
privileges, it is one click with no confirmation step, and it sits in a row next
to Approve. I judged a confirmation dialog as friction on a screen whose whole
job is fast triage — but I am aware that is the decision most likely to be wrong,
and the blast radius of a mis-click is a user with admin rights nobody intended.
It is at least visible and reversible in the same row.

Not deployed at time of signing.
