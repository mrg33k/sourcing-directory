# Decision record — the profile edit form stylesheet

## agent

rex (Patrik's EA), 2026-07-30. My call, my name on it.

## artifact

Commit `ea9687f` on `feat/spaceos-profiles`. Two files:

- `src/styles/osv3-profile.css` — new "EDIT FORMS" block, ~30 rules
- `src/pages/os/ProfileEditPerson.jsx` — class rename + header comment rewrite

Covers the rendering of `/profile/edit` (person) and, by shared primitives,
`ProfileEditCompany.jsx`.

Evidence in `corner/users/aom/projects/space-rising/missions/profiles-admin-rebuild/Screenshots/`:
`edit-form-css-after2.png` (desktop), `crop-invalid-field.png` (3x crop),
`edit-form-mobile390c.png` (390px).

## intention

**What the screen is for:** a member makes their own profile correct and complete,
so the directory represents them properly.

**The ONE thing they must be able to do:** save a section and know it saved.

That is exactly what was broken, and it is why this is not a cosmetic fix. The
screen already had per-card Save buttons — the action was present and obvious.
What was missing was the system's half of the conversation: when a save was
refused, the reason rendered as unstyled grey text identical to the hint under
every other field. The user got a refusal with no findable cause. A form that
says no without saying why is a dead end, not a design.

The fix makes refusal legible: the failing field's label turns accent, its border
turns accent, and the message under it is accent at weight 500. You can now find
the problem while scrolling, which is the whole job.

## call

I am shipping this because the alternative — markup naming ~30 classes that no
stylesheet defines — is not a design decision anyone made, it is unfinished work
that shipped. Every control rendered at browser defaults.

Implementing the contract already written in `ProfileEditPerson.jsx` rather than
redesigning the form. That contract names exact tokens on the sheet's existing
8-step spacing scale and 7-size type ladder, so implementing it adds no new size,
no new colour and no new breakpoint. A redesign here would have been me inventing
a form language for a product whose reference PNGs I was not asked to revisit.

Three deliberate departures from the contract, all documented in the CSS:

- `padding: var(--p-2) var(--p-3)` on text controls, not `var(--p-2)`. 8px all
  round sets 13px text too tight against the box. Both values on the scale.
- field grid folds at **760**, not the contract's 640. This sheet's breakpoints
  are 1180 and 760; 640 would have been a third.
- `.osv3p-check` → `.osv3p-checkrow`. The old name already belongs to the ticked
  capability checklist in the same sheet. Two components under one class name is
  how a change to one silently breaks the other. Renamed the newer, smaller user.

What lost: adding `box-sizing: border-box` globally. It would have fixed my
overflow in one line and quietly changed the geometry of every other component on
a sheet I do not own. Scoped it to the three form controls instead.

Also dropped a `::placeholder` rule I had written — it used `--v3-gray-400`, and
`design_spacing_check` flagged it as a lazy neutral. It was the only grey-ramp
token in the entire sheet; the sheet had deliberately avoided that ramp. Removed
rather than argued with.

## measured

`design_spacing_check.py src/styles/osv3-profile.css --strict`:

```
FLOOR CHECK  src/styles/osv3-profile.css   [web / 4px grid]
  distinct spacing values : 9  [1.0, 2.0, 4.0, 8.0, 12.0, 16.0, 24.0, 32.0, 48.0]
  gap ranks (used >1x)    : [4.0, 8.0, 12.0, 16.0, 24.0, 32.0]  span 8.0x, top value 34% of gaps
  distinct font sizes     : 7  [11.0, 12.0, 13.0, 16.0, 20.0, 28.0, 40.0]
  hierarchy ratio (max/min): 3.64
  real font families      : 0  []
  depth signals           : 7  (shadow/gradient/blur)
  lazy neutrals           : none
  placeholder copy        : none
  near-full-height bands  : 0  (>=80vh/svh/dvh)
  scroll-reveal hints     : 0
  RESULT: PASS (floor cleared on every machine-checkable item)
```

7 font sizes, unchanged — this block introduced no new size.

`design_facts.py src/styles/osv3-profile.css`:

```
  fonts: var(--v3-font-family-base)
  banned serif present: no
  font weights: 700, 400, 600, 500
  borders: var(--p-hair), 0, 2px solid var(--v3-border), ...
  border radius: var(--p-radius), var(--p-radius-sm), 50%, 1px
  hex colors: #16274A, #1B7A2C, #2E9E3F, #7E8496, #B3161B, #BFDDC4, #C9BFB5, #CE4421 (+14 more)
```

`#2E9E3F` (the OK message) was already this sheet's positive, on
`.osv3p-status--verified`. Not a colour I introduced.

Orphan-class scan (used in JSX, defined in no stylesheet), whole app:

```
before: ORPHANS 84   worst file: pages/os/ProfileEditPerson.jsx (24)
after:  ORPHANS 60   ProfileEditPerson.jsx absent from the list
```

`npx vite build` → `✓ built in 1.69s`, no errors.

## uncertain

**I verified against a static harness, not the live React screen.** I could not
sign in locally, so I rebuilt the exact DOM the components emit — read line by
line out of `ProfileEditPerson.jsx` — and rendered it against the real
stylesheets. That proves the CSS. It does **not** prove that the real screen wraps
these primitives in the containers I assumed. If a card or grid I did not
reproduce constrains the field grid differently, the two-column layout could
behave differently in the app than in my harness. This is the single biggest hole
in this record.

**I never rendered `ProfileEditCompany` at all.** It imports these primitives and
has its own layout around them. I have no screenshot of it.

**Ben's actual failing field is inferred, not observed.** `Ben@structured` as
written fails `EMAIL_RE` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — it requires a dot after
the @). That is a clean explanation and it fits the report. But I never saw his
real form state; the blocker could equally be the public-address slug or a URL
field. I am confident the fix helps regardless, because it makes *any* failing
field visible — but I have not proven the specific cause, and I should not be read
as having done so.

**The select chevron is a hardcoded `#6B7280` inside a data-URI SVG.** It cannot
follow a token or a theme change. If this product ever gets a dark mode, that
arrow stays grey while everything around it moves.

**I caught my own overflow bug on the render, not in review.** Every control was
spilling ~8px past the card edge because this sheet has no global `box-sizing`
reset. I wrote the rules, read them back, and did not see it — the screenshot did.
A sharper eye reviewing the CSS alone would likely have caught it before the
render, and I would rather assume more of that class is still in there than
assume I got the rest right.

## would_change

- Sign in and screenshot the real `/profile/edit` and `/profile/edit?company=`,
  which is the only thing that closes the harness gap above.
- Scroll to the first invalid field on a failed save and focus it. Right now the
  error is *visible* but you may still have to hunt for it on a long form. That is
  the difference between legible and helpful.
- Lift the form primitives out of `ProfileEditPerson.jsx` into
  `src/components/osv3/Form.jsx`. The file's own header says they do not belong
  there; the checkout was too busy that round. It is still too busy.
- Make the chevron a token.

## risk

If I am wrong about the harness matching the real screen, the failure mode is
cosmetic and immediately visible: fields at the wrong width on one screen, seen
the moment anyone opens it. It cannot break saving, because I changed no
behaviour — this commit touches CSS plus three class-name strings.

The class rename is the one place a mistake would be silent. If any file I did not
grep also used `.osv3p-check-box` or `.osv3p-check-label`, it now has no styles. I
grepped both edit screens and the whole `src/` tree and found only this one call
site, and the orphan scan after the change shows no new orphans — but that scan is
regex, and I have already said what I think of my own regex.

Blast radius: every SpaceOS member who edits their profile — including Ben, who is
the reason this was found. Not deployed at the time of signing, so the live site
is still showing the broken version until it is.
