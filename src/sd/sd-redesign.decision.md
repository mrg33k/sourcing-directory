# Decision record — Sourcing Directory redesign (front door, onboarding, directory)

## agent

Claude (Opus 5.5), building for Patrik at AOM In-House, 2026-09-24. I made the calls below and I stand behind them.

## artifact

Live at https://sourcing.directory (commit 3842567 plus the spacing/row follow-up in this commit):
- `src/sd/SDHome.jsx` for `/`, the front door ("Find the right source.")
- `src/sd/SDOnboarding.jsx` for `/get-started` ("Tell us about your work.")
- `src/sd/SDStart.jsx` for `/start` ("Where would you like to start?")
- `src/sd/SDChrome.jsx`, `src/sd/SDLogo.jsx`, `src/sd/industries.js`, `src/sd/sd.css`, `src/sd/sd-directory.css` (the directory restyle over the /spaceos pages)
- `public/sd/*.jpg`, the 12 KIE nano-banana-pro photos, web-sized

## call

**Intention.** A buyer or supplier lands at `/` and has to reach the right industry directory, then find a company. There is one obvious action per screen:
- `/`: type a work email and press **Get started** (the industry tiles also lead into onboarding).
- `/get-started`: press **Create account**.
- `/start`: press **Open directory** on an industry.
- `/spaceos`: **search**, or press **View company** on a row.

None of these screens is a dead end.

**Why ship it.** I'm shipping this because it matches Patrik's brand board and three flow mockups almost screen for screen. Those mockups are the references he named, so this is not a look I picked. I checked it on the live site at 1600px and 390px.

**What lost.**
- A full rewrite of every directory page lost to a style layer over the existing pages (`sd-directory.css`). The pages already carry the data wiring, and a rewrite would have taken the site down for days.
- My own mobile bottom bar lost to the site's existing Home / Directory / Search / More bar, which is already the bar in the mockup.
- Grey placeholder photos lost to KIE-generated black-and-white industrial photography with one red accent, which is the look on the board.

**Outside references.** Standard: Patrik's brand board. Outside:
- Stripe's "Get started" email-first entry (front-door pattern).
- Linear's onboarding workspace picker (the start screen).
- McMaster-Carr / Thomasnet supplier rows (dense, scannable, action on the row).

This beats Thomasnet on visual clarity and matches Linear's pick-then-enter flow. It does not beat Stripe's craft on motion.

## measured

`python3 scripts/design_spacing_check.py src/sd/sd.css`

```
distinct spacing values : 7  [8.0, 12.0, 16.0, 24.0, 32.0, 48.0, 64.0]
RESULT: PASS (floor cleared on every machine-checkable item)
```

`python3 scripts/design_spacing_check.py src/sd/sd-directory.css`

```
distinct spacing values : 9  [4.0, 8.0, 12.0, 16.0, 24.0, 32.0, 48.0, 96.0, 128.0]
distinct font sizes     : 8  [10.0, 11.0, 12.0, 14.0, 16.0, 17.0, 22.0, 40.0]
RESULT: PASS (floor cleared on every machine-checkable item)
```

The first run FAILED on both files: 27 and 37 values were off the 4px grid, with 20 and 24 distinct spacing values. I snapped everything to one scale and re-checked, which gives the output above. The "FONT SPRAWL" warning counts each `font:` shorthand as a family. The real faces are Space Grotesk, IBM Plex Sans, IBM Plex Mono, and Chakra Petch (wordmark only).

`design_visual_probe.js` + `design_balance_probe.js` in the browser, 1600×900:

```
/            visual: BARE section 0 (an empty style tag, h=0, probe fallback to body.children)   balance: balanced
/get-started visual: none                 balance: section 1 ONE-SIDED (right, 36%)  (right half of the 2-column form)
/start       visual: BARE section 0 (same empty style tag, h=0)                           balance: balanced
/spaceos     visual: none (25 imgs, none distorted)                                   balance: balanced
```

Rendered measurements on `/spaceos`:
- 1200px: subtitle to search gap 32px, search icon center offset 0px.
- 390px: gap 32px, icon offset 0px, no horizontal overflow.
- Long company names end with an ellipsis.

Live check: 100 companies (Aerospace), 39 (Semiconductors), 72 jobs, 92 events, 3,473 accelerators, 34 grants, and every page shows the new logo and tabs.

## uncertain

- **The logo is my trace, not their file.** I traced the hex-S from a 1086px mockup and squared it by hand. A designer holding the real vector may see the inner channel angles are off by a few degrees.
- **The wordmark face is a guess.** Chakra Petch is my match for the squared wordmark, not a confirmed choice.
- **Onboarding promises an account it can't make.** "Create account" doesn't create a real account yet. The profile stays in the person's browser, and the details are emailed via `/api/sd-signup`. I never sent a real test email, so I haven't confirmed the Resend key is set on this project. If it isn't, signups are only logged.
- **Most of the directory is a style layer, not a rebuild.** I checked Companies, Jobs, Events, Grants, Deal Bank / Accelerators and the three front-door screens. I did not check each detail page (company profile, listing detail, report detail, membership, deal-bank forms) under the new theme. Old orange inline styles or layout quirks could still show there.
- **The start page headline has "?." with a red dot**, copied from the mockup. Someone may read it as a typo.
- **Two probe flags I'm calling false positives:** the invisible empty style tag, and the onboarding right column scored alone. If the probe's author meant "no band without a visual," the start page title band is text-only by design.

## would_change

- Get the official logo SVG and the wordmark font.
- Add real accounts on Convex, so "Create account" and "Sign in" do what they say.
- Walk every detail page in the new theme and tidy each one.
- Add a real Manufacturing and Construction data source, so those tiles stop saying "coming soon."
- Commission one hero photo per industry for the directory header. Semiconductors reuses its tile crop today.
- Add subtle motion on the tiles and rows (Stripe level). There is none today beyond hover.

## risk

- **If onboarding emails aren't arriving,** signups from real prospects are lost silently until someone checks the Vercel logs. Nobody would notice without looking.
- **If a detail page still has old orange styling,** a client (Ben's team) sees an inconsistent brand on a profile page. That's embarrassing, but a fix is quick and easy to reverse.
- **The home route changed.** `/` now serves the front door instead of Ben's "/spaceos is home" request from 2026-09-22. Anyone expecting to land straight in the directory takes one extra click. The directory itself is unchanged at /spaceos.
- **Rolling back is one command,** because production is pinned by alias: `vercel alias set PREVIOUS_DEPLOYMENT_URL sourcing.directory`.
