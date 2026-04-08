# v10 Brief: sourcing.directory Redesign

## Direction
Full-bleed imagery meets app-native UI. Not a website -- an app you happen to open in a browser.

## Primary Reference
`mockups/references/v10-reference-app-ui.jpg` -- meditation app with atmospheric full-bleed imagery, large editorial type over photos, rounded card sections, icon grid nav. THIS IS THE FEEL.

## Secondary References
- `mockups/references/SR-Guide-Tim-Struck.jpg` -- Tim Struck's Space Rising comp. Use as a guide, NOT the bible. We should be cooler than what Tim made. Take the space imagery direction but elevate it.
- `mockups/references/PRIMARY-REFERENCE.jpg` -- earlier design direction
- v09 prototype at `public/v09/` -- bottom nav, Inter font, cyan accent, list layout. Good bones, needs the imagery layer.

## What Patrik Said
- Every directory needs a cool image in the background where the black is now
- Full-bleed feel -- scrollable on mobile, easily seen on desktop
- Strong image, text, and search on directory landing. No personalized greeting for now.
- Tech vibrant backgrounds, not muted/organic. The reference feel is right for homepage.
- Keep the menu accessible (v09 bottom nav is good, or accessible dropdown)
- Other pages (jobs, events, articles, membership, reports, signup, admin) need to be noted and designed for

## Pages to Design

### Homepage (directory chooser)
- Full-bleed atmospheric background
- "Find your supply chain partner" or similar
- Directory cards with their own themed backgrounds:
  - Space Rising: space/satellite/earth imagery, violet/purple tones
  - S3C Arizona: semiconductor fab/chip imagery, cyan/blue tones
- Search bar prominent
- Clean, not cluttered

### Directory Landing (e.g. /space-rising)
- Full-bleed hero with directory-specific imagery (satellite for space, fab for semi)
- Directory name large over the image
- Search bar overlaid or just below hero
- Filter chips (All, Semiconductor, Space & Aerospace)
- Company list/cards below
- v09 list style is clean for the company cards -- keep that pattern

### Other Pages (need design notes, not full mockups yet)
- Jobs, Events, Articles, Marketplace -- consistent page header treatment
- Reports -- card grid with category badges
- Membership -- pricing table (already clean)
- Signup -- wizard flow (already works)
- Admin -- functional, doesn't need to match public site exactly
- Company profile -- needs the most love after directory landing

## Tech Constraints
- React + Vite, inline styles (no CSS framework yet)
- All pages exist and work -- this is a reskin, not a rebuild
- v09 CSS variables are a good starting point for the design system
- Bottom nav from v09 is proven to work on mobile
- Current nav is dropdown menu -- works but not as polished as bottom nav

## Color System (from v09, adjust as needed)
- `--bg: #09090D` (near black)
- `--cyan: #22D3EE` (semiconductor accent)
- `--violet: #A78BFA` (space accent)
- `--emerald: #34D399` (success/active)
- `--amber: #FBBF24` (featured/warning)
- Inter font family

## Deliverable
Static HTML prototype (like v09) at `public/v10/`. One page per screen. Steffen builds the visual, Bobby wires it into the live React app.

## Priority
High. Ben debuts this to Space Congress contacts April 29. Needs to look like a serious platform, not a side project.
