# V10 Wire-Up Brief for Bobby

## What This Is
Take the v10 static prototype at `public/v10/index.html` and apply its design to the existing React pages. This is a RESKIN, not a rebuild. All existing functions (signup, login, article post, admin CRUD, membership gate, Supabase queries) stay exactly as they are. You're changing the CSS and HTML structure to match v10.

## The Golden Rule
Screenshot v10 at `https://sourcing.directory/v10/`, screenshot your work, compare. No visual difference allowed. If it doesn't match, fix it before moving on.

## Production Repo
`/Users/aom-inhouse/Documents/Dev/sourcing-directory/`

## Deploy
`cd /Users/aom-inhouse/Documents/Dev/sourcing-directory && vercel --prod`

## Supabase (DEDICATED PROJECT -- not Corner/AOM)
- URL: `https://kzzvjtthknsozktmpvak.supabase.co`
- Anon key: in Vercel env vars (VITE_SUPABASE_ANON_KEY)
- Service role: in Vercel env vars (SUPABASE_SERVICE_ROLE_KEY)

## V10 Design System (CSS Variables)
```css
--bg: #06060A;
--s1: #0E0E14;
--s2: #15151E;
--s3: #1C1C28;
--bd: rgba(255,255,255,0.06);
--bd2: rgba(255,255,255,0.1);
--tx: #F0F0F5;
--tx2: rgba(240,240,245,0.55);
--tx3: rgba(240,240,245,0.25);
--cyan: #22D3EE;
--violet: #A78BFA;
--emerald: #34D399;
--amber: #FBBF24;
--r: 16px;
--r-sm: 10px;
--nav-h: 72px;
Font: Inter (https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap)
```

## Key Design Patterns from V10
1. **Bottom nav** (Home, Directory, Search, More) replaces current dropdown nav
2. **Full-bleed hero images** on every major screen
3. **Screen transitions** -- opacity + translateY, not page reloads (React Router already handles this)
4. **Bottom sheet** for More menu
5. **Chips** for filters (horizontal scroll, `overflow-x:auto`)
6. **Company cards** -- list style with logo initial, name, location, cert badges
7. **Stats grid** -- 2x2 or 3-col grid for numbers
8. **Profile tabs** -- About/Certifications/Contact

## Rounds

### Round 1: Shell + Navigation
- Replace SourcingNav (in SourcingMarketplace.jsx) with v10 bottom nav
- Replace SourcingLanding.jsx with v10 home screen
- Add More menu bottom sheet component
- Add Inter font to index.html
- Apply CSS variables globally
**Files:** index.html, SourcingMarketplace.jsx (SourcingNav), SourcingLanding.jsx, new BottomNav component
**QA:** Home screen matches v10. Bottom nav works. More menu opens/closes.

### Round 2: Directory Browse
- SourcingDirectory.jsx gets v10 browse layout
- Full-bleed hero per tenant (Space Rising = rocket, S3C = semiconductor)
- Section chips row (Companies, Jobs, Events, Reports, Marketplace, Membership)
- Filter chips for verticals
- Company list cards match v10 style
**Files:** SourcingDirectory.jsx
**QA:** Click directory from home, see full-bleed hero, companies load, chips work.

### Round 3: Company Profile
- SourcingProfile.jsx gets v10 profile layout
- Hero with vertical-specific background image
- Logo + name + tier badge
- Stats grid (Employees, Founded, Certs)
- Tabbed content (About, Certifications, Contact)
- Request Information + Share Profile CTAs
**Files:** SourcingProfile.jsx
**QA:** Click company, profile loads with hero, stats, tabs switch, contact info shows.

### Round 4: Jobs + Events + Articles
- SourcingJobs.jsx, SourcingEvents.jsx, SourcingArticles.jsx get v10 layout
- Full-bleed heroes
- Card styles match v10 (job cards with salary, event cards with date pills, article cards)
**Files:** SourcingJobs.jsx, SourcingEvents.jsx, SourcingArticles.jsx
**QA:** Each page loads, data shows, cards match v10.

### Round 5: Reports + Marketplace + Grants
- SourcingReports.jsx, SourcingMarketplace.jsx, SourcingGrants.jsx get v10 layout
- Full-bleed heroes, card styles
**Files:** SourcingReports.jsx, SourcingMarketplace.jsx (main component, not SourcingNav), SourcingGrants.jsx
**QA:** Each page loads, data shows.

### Round 6: Forms (Login, Signup, Post pages)
- SourcingLogin.jsx gets v10 login layout (earth hero + card)
- SourcingSignup.jsx gets v10 signup layout (nebula hero + form)
- SourcingArticlesPost.jsx, SourcingJobsPost.jsx, SourcingEventsPost.jsx, SourcingMarketplacePost.jsx keep MembershipGate but get v10 form styling
**Files:** SourcingLogin.jsx, SourcingSignup.jsx, all *Post.jsx files
**QA:** Login works, signup works, post forms work with membership gating.

### Round 7: Membership + Settings + Portal + Admin
- SourcingMembership.jsx gets v10 pricing layout
- SourcingPortal.jsx, SourcingSettings.jsx get v10 styling
- SourcingAdmin.jsx gets v10 admin layout (stats grid, tabs, pending review cards)
**Files:** SourcingMembership.jsx, SourcingPortal.jsx, SourcingSettings.jsx, SourcingAdmin.jsx
**QA:** Admin login works, pending articles show, approve/reject works. Membership page matches v10.

## QA Checklist (Every Round)
1. `vercel --prod` from sourcing-directory repo
2. `python3 scripts/verify-page.py "https://sourcing.directory/[page]" --screenshot`
3. Read the screenshot
4. Compare to v10 screenshot at same screen
5. Mobile width (390px) -- does it match?
6. No horizontal overflow
7. All existing functions still work (forms submit, data loads, etc.)

## What NOT To Do
- Don't rebuild Supabase queries
- Don't change any API endpoints
- Don't modify database schema
- Don't change auth logic
- Don't add new features
- Don't change file names or routes
- If it works in the current site, it must work after the reskin
