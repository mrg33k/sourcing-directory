# Decision record — OSLayoutV3 avatar menus + admin-lands-on-stats (2026-07-29)

## agent

rex

## artifact

`src/pages/OSLayoutV3.jsx` + `src/pages/OSLayoutV3.css` (avatar/account menus, admin
sidebar entry), `src/main.jsx` (/admin → /admin-tools, legacy panel at /admin/panel),
`src/pages/os/AdminTools.jsx` (header ButtonRow + unbuilt-tab pointer),
`src/pages/os/OSMyProfile.jsx` (/profile forwards to own person page),
`src/styles/osv3-profile.css` (pagehead btn-row runs horizontal).
Commits `30cd6cd` + `0693ca8` on `feat/spaceos-profiles`. Live on os.spacerising.org
via deploy `sourcing-directory-8sedcl7am`.

## call

I am shipping this because all three of Patrik's asks now do the thing on the live
domain, and the screen is designed around one action each. The account menu exists so
a member can reach THEIR profile from anywhere in the shell — View profile / Edit
profile are the first two rows, sign-out is quiet at the bottom, guests get the way
in (Sign in / Create account). /admin exists so an admin sees the platform — it now
opens on the live stats dashboard, first tab, with the legacy management panel one
labeled click away (header + every unbuilt tab), so no working flow was orphaned.
The alternative for /admin was replacing the legacy panel wholesale; it lost because
its management flows (add company, uploads, tenant settings) exist nowhere else yet.
The dropdown was rebuilt up-opening on the 4px scale because the old one dropped
BELOW a chip stuck to the viewport bottom — the cramped feeling was the menu pressed
against the screen edge, not the padding.

## measured

design_spacing_check on the authored avatar-menu CSS (extracted section + the two
type sizes, rendered standalone):

    FLOOR CHECK  avatar-menu-authored.html   [web / 4px grid]
      distinct spacing values : [4.0, 8.0, 12.0, 16.0]   (all on-grid)
      distinct font sizes     : 2  [12.0, 13.0]
      real font families      : 1  ['roboto']
      depth signals           : 2  (shadow/gradient/blur)
      RESULT: PASS (floor cleared on every machine-checkable item)
        ! WEAK HIERARCHY: largest text is only 1.08x the smallest (want >= 1.5x)
      -> the hierarchy note is the page-hero heuristic; a dropdown menu has no
         hero size by design. Weight (600 name / 400 email / 500 items) carries
         the hierarchy, confirmed in the close-up crop.

design_spacing_check on the FULL OSLayoutV3.css for context: RESULT: FAIL —
off-grid 6, 10, 38px + 11 distinct values. All three predate this round
(git log -L: lines 37/59 committed 2026-07-06/08; 38px is the search-input
offset commented as "16px icon + 12px left + spacing"). This shell was
pixel-matched to Tim's redlines; resnapping his values to the linter grid is a
design decision I am NOT smuggling into a menu round — logged for the redline
owner instead.

design_facts.py on OSLayoutV3.css (post-fix):

    fonts: var(--v3-font-family-base) · banned serif present: no
    font weights: 500, 700, 600 · borders: 1px solid rgba(255,255,255,0.14), 1px solid var(--v3-border)
    border radius: 6px, 10px, 8px, 50% · padding: 8px 12px, 12px 16px, 4px ...

Live computed-style probe (Playwright, os.spacerising.org, after `0693ca8`):

    item font: Roboto | email weight: 400 | name weight: 600 | icon: {'w': 16, 'h': 16}
    menu: pad 4px, radius 8px, border 1px solid rgb(215,222,226), shadow 2-stop
    item: pad 8px 12px, gap 8px, 13px/500 · head: pad 8px 12px · sep: #E7EBEE
    chip menu: bg rgb(4,24,47), border rgba(255,255,255,0.14), same 4/8/12 scale

All menu spacing values sit on the 4px grid: 4, 8, 12, 16. Two menu font sizes
(13/12). Live route probe: `/admin` → `https://os.spacerising.org/admin-tools`
(redirect confirmed), root innerHTML 18787 chars, profile page 13276 chars.
The SAME probe run before `0693ca8` returned `item font: Arial` and
`email weight: 700` — the fix is measured, not assumed.

## uncertain

- The signed-in menu (name/email head, View profile, Edit profile, Admin Tools,
  Sign out) has never been LOOKED at with a real session — I verified it in code and
  verified the guest states visually. Patrik signing in is the first real render.
  If user_metadata has no full_name, the head shows an email-prefix name I did not
  preview.
- The Arial leak means every OTHER button in this shell inherits UA font too; I fixed
  my menu and did not audit the rest of the shell for the same defect.
- The chip menu overlays the nav above it; at its top edge the covered "Saved" row
  peeks out beside the menu (visible in the full-page shot). I judged it acceptable
  overlay behavior; a sharper eye might call it visual noise and want a backdrop.
- Mobile: the drawer sidebar chip menu at 390px was not re-screenshotted after the
  redesign.
- "Management panel" naming: admins have called it "/admin" for months; the redirect
  plus rename might read as the panel being gone for a beat.

## would_change

- Wire real avatar images + a proper focus trap and arrow-key navigation in the menu
  (it closes on Escape and outside click, but is not a full ARIA menu).
- Sweep the shell for other UA-font leaks on buttons and pin `font-family: inherit`
  globally for form controls.
- Fold the legacy panel's working flows into the Users/Organizations tabs so
  /admin/panel can retire and Admin Tools stops needing a door to its predecessor.

## risk

If I am wrong about the /admin redirect, the 5 admins land on stats and have to find
one extra click to do their actual management work — annoying, visible to admins
only, reversible by re-pointing one route (or `vercel alias set
sourcing-directory-d95yfhlob-aheads-projects-d2a4c70f.vercel.app os.spacerising.org`
for a full rollback). If the signed-in menu renders wrong it is on every page's
topbar for every member — the highest-traffic surface in the shell — which is why
its unverified state is named above rather than assumed fine.
