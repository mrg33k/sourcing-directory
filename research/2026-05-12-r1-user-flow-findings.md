---
date: 2026-05-12
mission: sourcing:user-flow-audit
round: R1
status: all findings fixed (commit 34cceb2)
---

# User-Flow Audit Findings — sourcing.directory

## Punch List (scan in 30 seconds)

| # | Area | Severity | Summary |
|---|------|----------|---------|
| F-01 | Articles | **blocker** | ArticleCard clicks to non-existent `/articles/<uuid>` route → blank page |
| F-02 | Articles | **blocker** | Even if route existed, link drops tenant context → 404 |
| F-03 | Articles | **blocker** | "View Profile" in article modal links `/<slug>` — missing tenantSlug prefix |
| F-04 | Admin | annoyance | "Back to Directory" links to `/sourcing` (broken) instead of `/` |
| F-05 | Article post | annoyance | Button says "Publish Article" but articles go to pending queue, not live |
| F-06 | Signup | **blocker** | No auto sign-in after signup — user must log in manually after completing wizard |
| F-07 | Login | polish | Duplicate "Forgot password?" link in login form |
| F-08 | Password reset | **blocker** | Reset email fallback URL hardcodes `/space-rising/login` — breaks S3C users |
| F-09 | Portal | annoyance | No "Post an Article" CTA on member dashboard |
| F-10 | Portal | annoyance | No Settings link in portal header (Sign Out present, Settings missing) |
| F-11 | Admin | annoyance | No way to set owner email when adding a company — owner must self-signup |
| F-12 | Admin | polish | Naming: `pendingArticles`/`ArticlesSection` doesn't reflect mixed content types |

4 blockers, 4 annoyances, 2 polish items, plus 2 blockers above — all fixed in one commit.

---

## Detailed Findings

### F-01 — ArticleCard click routes to non-existent route
- **Area:** Article feed (`/:tenantSlug/articles`)
- **File:** `src/pages/SourcingArticles.jsx` — `ArticleCard` component (pre-fix ~line 51)
- **Symptom:** Clicking any article card navigates to `/articles/<uuid>`, a route that doesn't exist in React Router config. User lands on blank page.
- **Severity:** blocker
- **Fix:** Replace `<Link to="/articles/...">` with `onClick` that sets `selected` state and opens the inline article modal.

### F-02 — ArticleCard click drops tenant prefix
- **Area:** Article feed
- **File:** `src/pages/SourcingArticles.jsx` — `ArticleCard` (pre-fix ~line 51)
- **Symptom:** The `/articles/<uuid>` route also lacked the `/:tenantSlug` prefix, so even a valid route would break navigation context.
- **Severity:** blocker
- **Fix:** Combined with F-01 — modal pattern avoids routing entirely.

### F-03 — "View Profile" link in article modal missing tenantSlug
- **Area:** Article modal (`ArticleView`)
- **File:** `src/pages/SourcingArticles.jsx` — `ArticleView` component (~line 228 pre-fix)
- **Symptom:** "View Profile" linked to `/<companySlug>` instead of `/:tenantSlug/<companySlug>`. Navigating clicked through to 404.
- **Severity:** blocker
- **Fix:** Pass `tenantSlug` prop into `ArticleView`; build link as `` `/${tenantSlug}/${company.slug}` ``.

### F-04 — Admin "Back to Directory" broken link
- **Area:** Admin panel header (`/admin`)
- **File:** `src/pages/SourcingAdmin.jsx` (~line 837 pre-fix)
- **Symptom:** "Back to Directory" `<Link to="/sourcing">` navigates to a non-existent route.
- **Severity:** annoyance
- **Fix:** Change `to="/sourcing"` → `to="/"`.

### F-05 — "Publish Article" button — misleading label
- **Area:** Article post form (`/:tenantSlug/articles/post`)
- **File:** `src/pages/SourcingArticlesPost.jsx` (~lines 378–381)
- **Symptom:** Submit button reads "Publish Article" but submitted articles go into the pending review queue, not live. Misleads contributors into thinking their article is immediately live.
- **Severity:** annoyance
- **Fix:** Rename button to "Submit for Review".

### F-06 — No auto sign-in after signup
- **Area:** Signup wizard (`/:tenantSlug/signup`)
- **File:** `src/pages/SourcingSignup.jsx` (~line 137)
- **Symptom:** After completing the 3-step signup, the success screen displays but the user is not authenticated. They must navigate to login and sign in manually.
- **Severity:** blocker
- **Fix:** Call `supabase.auth.signInWithPassword({ email, password })` immediately after successful account creation.

### F-07 — Duplicate "Forgot password?" link
- **Area:** Login form (`/:tenantSlug/login`)
- **File:** `src/pages/SourcingLogin.jsx` (~lines 350–353 pre-fix)
- **Symptom:** "Forgot password?" appears twice — once below the password field (correct location, shows inline reset form) and again below the sign-in button.
- **Severity:** polish
- **Fix:** Remove the second trigger (the one below the sign-in button).

### F-08 — Password reset email hardcodes space-rising tenant in fallback URL
- **Area:** Password reset API
- **File:** `api/sourcing/reset-email.js:133`
- **Symptom:** When `redirect_to` is not provided, the reset email links to `https://sourcing.directory/space-rising/login`. S3C users clicking the link land on Space Rising's login page, not their own.
- **Severity:** blocker
- **Fix:** Change fallback to `https://sourcing.directory` (directory root — lets user navigate to their own tenant).

### F-09 — No "Post an Article" CTA in member portal
- **Area:** Member portal (`/:tenantSlug/portal`)
- **File:** `src/pages/SourcingPortal.jsx` (~line 290 pre-fix)
- **Symptom:** Dashboard header has only a Sign Out button. No quick action to post an article; member must know the `/articles/post` URL.
- **Severity:** annoyance
- **Fix:** Add "+ Post an Article" quick-action link button in the portal header area.

### F-10 — No Settings link in portal header
- **Area:** Member portal
- **File:** `src/pages/SourcingPortal.jsx` (~line 290 pre-fix)
- **Symptom:** Portal header has Sign Out but no link to account settings, making settings discovery non-obvious.
- **Severity:** annoyance
- **Fix:** Add "Settings" link button next to Sign Out.

### F-11 — Admin Add Company has no owner email field
- **Area:** Admin panel → Add Company tab
- **File:** `src/pages/admin/AddCompanySection.jsx` + `api/sourcing/admin-setup.js`
- **Symptom:** When admin adds a company on behalf of a new member, there's no way to create a login account for the owner. Owner must self-signup after the fact, creating a friction gap in the admin-assisted onboarding flow.
- **Severity:** annoyance
- **Fix:** Add optional Owner Email field to the Add Company form. On submit, if email provided, call `api/sourcing/admin-setup` in `mode=member` to create an auth user + `directory_members` row (additive only — no existing records modified).

### F-12 — Admin section naming mismatches content scope
- **Area:** Admin panel
- **Files:** `src/pages/SourcingAdmin.jsx`, `src/pages/admin/ArticlesSection.jsx` (now `PendingContentSection.jsx`)
- **Symptom:** Variable names `pendingArticles`, `articleCompanyMap` and component `ArticlesSection` imply articles-only, but the section handles all pending content (jobs, events, marketplace listings). Confusing for future devs.
- **Severity:** polish
- **Fix:** Rename to `pendingContent`, `pendingContentCompanyMap`, `PendingContentSection`.

---

## Resolution

All 12 findings fixed in a single commit: `34cceb2` (`fix(user-flow): fix all 12 audit findings [cb87a06d]`, 2026-05-12).
