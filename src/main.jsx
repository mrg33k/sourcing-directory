import React, { lazy, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import './v10.css'

// Fade wrapper -- fades in on every route change
function PageTransition({ children }) {
  const location = useLocation()
  const [visible, setVisible] = useState(true)
  const [displayLocation, setDisplayLocation] = useState(location)

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setVisible(false)
      const t = setTimeout(() => {
        setDisplayLocation(location)
        setVisible(true)
        window.scrollTo(0, 0)
      }, 150)
      return () => clearTimeout(t)
    }
  }, [location, displayLocation])

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.15s ease',
      minHeight: '100dvh',
    }}>
      {children}
    </div>
  )
}

// Redirect wrapper for /space-rising/:slug → /space-rising-v2/:slug.
// Needed because Navigate's `to` prop can't interpolate route params directly.
function SpaceRisingCompanyRedirect() {
  const { slug } = useParams()
  return <Navigate to={'/space-rising-v2/' + slug} replace />
}

// Lazy-load all pages
const SourcingAbout = lazy(() => import('./pages/SourcingAbout.jsx'))
const SourcingAdmin = lazy(() => import('./pages/SourcingAdmin.jsx'))
const SourcingDirectory = lazy(() => import('./pages/SourcingDirectory.jsx'))
const SourcingLogin = lazy(() => import('./pages/SourcingLogin.jsx'))
const SourcingPortal = lazy(() => import('./pages/SourcingPortal.jsx'))
const SourcingSignup = lazy(() => import('./pages/SourcingSignup.jsx'))
const SourcingJobs = lazy(() => import('./pages/SourcingJobs.jsx'))
const SourcingJobsPost = lazy(() => import('./pages/SourcingJobsPost.jsx'))
const SourcingMarketplace = lazy(() => import('./pages/SourcingMarketplace.jsx'))
const SourcingMarketplacePost = lazy(() => import('./pages/SourcingMarketplacePost.jsx'))
const SourcingEvents = lazy(() => import('./pages/SourcingEvents.jsx'))
const SourcingEventsPost = lazy(() => import('./pages/SourcingEventsPost.jsx'))
const SourcingArticles = lazy(() => import('./pages/SourcingArticles.jsx'))
const SourcingArticlesPost = lazy(() => import('./pages/SourcingArticlesPost.jsx'))
const SourcingGrants = lazy(() => import('./pages/SourcingGrants.jsx'))
const SourcingDealBank = lazy(() => import('./pages/SourcingDealBank.jsx'))
const SourcingMembership = lazy(() => import('./pages/SourcingMembership.jsx'))
const SourcingReports = lazy(() => import('./pages/SourcingReports.jsx'))
const SourcingOrg = lazy(() => import('./pages/SourcingOrg.jsx'))
const SourcingCheckout = lazy(() => import('./pages/SourcingCheckout.jsx'))
const SourcingSettings = lazy(() => import('./pages/SourcingSettings.jsx'))
const SourcingProfile = lazy(() => import('./pages/SourcingProfile.jsx'))
const SourcingCreate = lazy(() => import('./pages/SourcingCreate.jsx'))
const GlobalSignup = lazy(() => import('./pages/GlobalSignup.jsx'))

// Space Rising Website (SRW) V1 — all /srw/* routes now redirect to /srw-v2.
// V1 component imports retired; V2 sibling clones below are the live pages.

// Nat Geo Uplift — V2 sibling clones for the visual-system uplift mission.
// Pixel-equivalent to V1 at R1; diverges starting R2 (type + palette).
// Mission: aom:space-rising:website:nat-geo-uplift.
const SRWHomeV2 = lazy(() => import('./pages/srw/SRWHomeV2.jsx'))
const SourcingDirectoryV2 = lazy(() => import('./pages/SourcingDirectoryV2.jsx'))
const SourcingJobsV2 = lazy(() => import('./pages/SourcingJobsV2.jsx'))
const SourcingEventsV2 = lazy(() => import('./pages/SourcingEventsV2.jsx'))
const SourcingReportsV2 = lazy(() => import('./pages/SourcingReportsV2.jsx'))
const SourcingMarketplaceV2 = lazy(() => import('./pages/SourcingMarketplaceV2.jsx'))
const SourcingDealBankV2 = lazy(() => import('./pages/SourcingDealBankV2.jsx'))
// Deal Bank R7b/c — profile pages for the Investments + Investors lanes.
const SourcingDealBankInvestmentProfile = lazy(() => import('./pages/SourcingDealBankInvestmentProfile.jsx'))
const SourcingDealBankInvestorProfile = lazy(() => import('./pages/SourcingDealBankInvestorProfile.jsx'))
const SourcingMembershipV2 = lazy(() => import('./pages/SourcingMembershipV2.jsx'))
const SourcingSignupV2 = lazy(() => import('./pages/SourcingSignupV2.jsx'))
const SourcingCompanyV2 = lazy(() => import('./pages/SourcingCompanyV2.jsx'))
const SourcingSignupComplete = lazy(() => import('./pages/SourcingSignupComplete.jsx'))
const SourcingArticlesV2 = lazy(() => import('./pages/SourcingArticlesV2.jsx'))
const SourcingGrantsV2 = lazy(() => import('./pages/SourcingGrantsV2.jsx'))
const SourcingLoginV2 = lazy(() => import('./pages/SourcingLoginV2.jsx'))
// R6 (nat-geo-uplift) — SRW marketing sub-pages cloned to V2.
const SRWAboutV2 = lazy(() => import('./pages/srw/SRWAboutV2.jsx'))
const SRWSpaceOSV2 = lazy(() => import('./pages/srw/SRWSpaceOSV2.jsx'))
const SRWArizonaV2 = lazy(() => import('./pages/srw/SRWArizonaV2.jsx'))
const SRWSpaceCongressV2 = lazy(() => import('./pages/srw/SRWSpaceCongressV2.jsx'))
const SRWPartnershipsV2 = lazy(() => import('./pages/srw/SRWPartnershipsV2.jsx'))
const SRWEventsV2 = lazy(() => import('./pages/srw/SRWEventsV2.jsx'))
const SRWMediaV2 = lazy(() => import('./pages/srw/SRWMediaV2.jsx'))
const SRWSignUpV2 = lazy(() => import('./pages/srw/SRWSignUpV2.jsx'))
// nat-geo-uplift — V2 post forms (Jobs / Events / Marketplace / Articles).
// Replaces the Navigate-to-V1 redirects that broke V2 immersion.
const SourcingJobsPostV2 = lazy(() => import('./pages/SourcingJobsPostV2.jsx'))
const SourcingEventsPostV2 = lazy(() => import('./pages/SourcingEventsPostV2.jsx'))
const SourcingMarketplacePostV2 = lazy(() => import('./pages/SourcingMarketplacePostV2.jsx'))
const SourcingArticlesPostV2 = lazy(() => import('./pages/SourcingArticlesPostV2.jsx'))
// nat-geo-uplift — V2 member portal. Replaces Navigate-to-V1 redirect.
const SourcingPortalV2 = lazy(() => import('./pages/SourcingPortalV2.jsx'))
// 2026-06-05 — detail pages so listing/report cards open a real page instead of
// bouncing to the directory (no matching detail route existed before).
const SourcingListingV2 = lazy(() => import('./pages/SourcingListingV2.jsx'))
const SourcingReportDetailV2 = lazy(() => import('./pages/SourcingReportDetailV2.jsx'))

const Loading = () => (
  <div style={{ minHeight: '100dvh', background: 'var(--bg, #06060A)' }} />
)

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <PageTransition>
        <Routes>
          {/* Global */}
          {/* R10 (nat-geo-uplift) — Swap shipped 2026-05-31. Root now lands on
              the V2 Space Rising marketing site. V1 routes (/srw, /space-rising)
              stay live as archive for rollback + legacy deep-link compat. */}
          <Route path="/" element={<Navigate to="/srw-v2" replace />} />
          {/* Legacy V1 utility pages retired (2026-06-05) → Space OS V2. No V1 surface. */}
          <Route path="/signup" element={<Navigate to="/space-rising-v2/signup" replace />} />
          <Route path="/about" element={<Navigate to="/srw-v2/about" replace />} />
          <Route path="/create" element={<Navigate to="/space-rising-v2" replace />} />
          {/* Admin stays — internal tooling, not a public surface. */}
          <Route path="/admin" element={<SourcingAdmin />} />
          <Route path="/admin/new" element={<SourcingAdmin />} />
          <Route path="/admin/settings/:tenantSlug" element={<SourcingAdmin />} />
          {/* Space Rising Website (SRW) V1 → V2 redirects. V2 is production. */}
          <Route path="/srw" element={<Navigate to="/srw-v2" replace />} />
          <Route path="/srw/spaceos" element={<Navigate to="/srw-v2/spaceos" replace />} />
          <Route path="/srw/space-congress" element={<Navigate to="/srw-v2/space-congress" replace />} />
          <Route path="/srw/arizona" element={<Navigate to="/srw-v2/arizona" replace />} />
          <Route path="/srw/about" element={<Navigate to="/srw-v2/about" replace />} />
          <Route path="/srw/partnerships" element={<Navigate to="/srw-v2/partnerships" replace />} />
          <Route path="/srw/events" element={<Navigate to="/srw-v2/events" replace />} />
          <Route path="/srw/media" element={<Navigate to="/srw-v2/media" replace />} />
          <Route path="/srw/sign-up" element={<Navigate to="/srw-v2/sign-up" replace />} />
          {/* Nat Geo Uplift V2 clones — placed before tenant catch-all */}
          <Route path="/srw-v2" element={<SRWHomeV2 />} />
          {/* R6 — SRW marketing sub-pages */}
          <Route path="/srw-v2/about" element={<SRWAboutV2 />} />
          <Route path="/srw-v2/spaceos" element={<SRWSpaceOSV2 />} />
          <Route path="/srw-v2/arizona" element={<SRWArizonaV2 />} />
          <Route path="/srw-v2/space-congress" element={<SRWSpaceCongressV2 />} />
          <Route path="/srw-v2/partnerships" element={<SRWPartnershipsV2 />} />
          <Route path="/srw-v2/events" element={<SRWEventsV2 />} />
          <Route path="/srw-v2/media" element={<SRWMediaV2 />} />
          <Route path="/srw-v2/sign-up" element={<SRWSignUpV2 />} />
          <Route path="/space-rising-v2" element={<SourcingDirectoryV2 />} />
          <Route path="/space-rising-v2/jobs" element={<SourcingJobsV2 />} />
          <Route path="/space-rising-v2/events" element={<SourcingEventsV2 />} />
          <Route path="/space-rising-v2/reports" element={<SourcingReportsV2 />} />
          <Route path="/space-rising-v2/marketplace" element={<SourcingMarketplaceV2 />} />
          <Route path="/space-rising-v2/deal-bank" element={<SourcingDealBankV2 />} />
          {/* Deal Bank R7b/c — Investments + Investors profile pages. Three
              segments deep so they win over /space-rising-v2/:slug (2 segs)
              and over /space-rising-v2/deal-bank (literal, also 2 segs). */}
          <Route path="/space-rising-v2/deal-bank/investments/:slug" element={<SourcingDealBankInvestmentProfile />} />
          <Route path="/space-rising-v2/deal-bank/investors/:slug" element={<SourcingDealBankInvestorProfile />} />
          <Route path="/space-rising-v2/membership" element={<SourcingMembershipV2 />} />
          <Route path="/space-rising-v2/signup" element={<SourcingSignupV2 />} />
          {/* R5i — Square checkout return URL. Must be above the :slug catch-all. */}
          <Route path="/space-rising-v2/signup/complete" element={<SourcingSignupComplete />} />
          {/* Articles + Grants — V2 skinned, list-pattern (parity with Jobs/Events). */}
          <Route path="/space-rising-v2/articles" element={<SourcingArticlesV2 />} />
          <Route path="/space-rising-v2/grants" element={<SourcingGrantsV2 />} />
          {/* Login — V2 skinned (replaces previous Navigate-redirect to V1). */}
          <Route path="/space-rising-v2/login" element={<SourcingLoginV2 />} />
          {/* Portal V2 — full V2 skin (no more redirect to V1). */}
          <Route path="/space-rising-v2/portal" element={<SourcingPortalV2 />} />
          {/* nat-geo-uplift — V2 post forms live; Navigate redirects to V1 retired. */}
          <Route path="/space-rising-v2/jobs/post" element={<SourcingJobsPostV2 />} />
          <Route path="/space-rising-v2/events/post" element={<SourcingEventsPostV2 />} />
          <Route path="/space-rising-v2/marketplace/post" element={<SourcingMarketplacePostV2 />} />
          <Route path="/space-rising-v2/articles/post" element={<SourcingArticlesPostV2 />} />
          {/* 2026-06-05 — listing + report detail pages. Two segments, so they rank
              above the single-segment /:slug company route and never collide. */}
          <Route path="/space-rising-v2/jobs/:id" element={<SourcingListingV2 kind="job" />} />
          <Route path="/space-rising-v2/events/:id" element={<SourcingListingV2 kind="event" />} />
          <Route path="/space-rising-v2/marketplace/:id" element={<SourcingListingV2 kind="marketplace" />} />
          <Route path="/space-rising-v2/reports/:id" element={<SourcingReportDetailV2 />} />
          {/* R5j — Company profile. MUST be the last /space-rising-v2/* route so static segments above win. */}
          <Route path="/space-rising-v2/:slug" element={<SourcingCompanyV2 />} />
          {/* Space Rising V1 → V2 redirects — specific routes win over /:tenantSlug catch-all.
              Remaining V1-only routes: /checkout (Square return URL), /:slug company profiles
              that fall through to SpaceRisingCompanyRedirect. */}
          <Route path="/space-rising" element={<Navigate to="/space-rising-v2" replace />} />
          <Route path="/space-rising/login" element={<Navigate to="/space-rising-v2/login" replace />} />
          <Route path="/space-rising/signup" element={<Navigate to="/space-rising-v2/signup" replace />} />
          <Route path="/space-rising/jobs" element={<Navigate to="/space-rising-v2/jobs" replace />} />
          <Route path="/space-rising/events" element={<Navigate to="/space-rising-v2/events" replace />} />
          <Route path="/space-rising/marketplace" element={<Navigate to="/space-rising-v2/marketplace" replace />} />
          <Route path="/space-rising/articles" element={<Navigate to="/space-rising-v2/articles" replace />} />
          <Route path="/space-rising/grants" element={<Navigate to="/space-rising-v2/grants" replace />} />
          <Route path="/space-rising/deal-bank" element={<Navigate to="/space-rising-v2/deal-bank" replace />} />
          <Route path="/space-rising/membership" element={<Navigate to="/space-rising-v2/membership" replace />} />
          <Route path="/space-rising/reports" element={<Navigate to="/space-rising-v2/reports" replace />} />
          <Route path="/space-rising/reports/:reportId" element={<Navigate to="/space-rising-v2/reports" replace />} />
          {/* nat-geo-uplift: V1 portal → V2 portal. V1 post forms → V2 equivalents. Settings → V2 home. */}
          <Route path="/space-rising/portal" element={<Navigate to="/space-rising-v2/portal" replace />} />
          <Route path="/space-rising/jobs/post" element={<Navigate to="/space-rising-v2/jobs/post" replace />} />
          <Route path="/space-rising/events/post" element={<Navigate to="/space-rising-v2/events/post" replace />} />
          <Route path="/space-rising/marketplace/post" element={<Navigate to="/space-rising-v2/marketplace/post" replace />} />
          <Route path="/space-rising/articles/post" element={<Navigate to="/space-rising-v2/articles/post" replace />} />
          <Route path="/space-rising/settings" element={<Navigate to="/space-rising-v2" replace />} />
          <Route path="/space-rising-v2/settings" element={<Navigate to="/space-rising-v2" replace />} />
          {/* Legacy V1 checkout retired (2026-06-05). Paid signup now uses Stripe
              checkout-session and returns to /space-rising-v2/signup/complete. */}
          <Route path="/space-rising/checkout" element={<Navigate to="/space-rising-v2" replace />} />
          {/* Company profile catch-all — any other /space-rising/<slug> redirects to V2. */}
          <Route path="/space-rising/:slug" element={<SpaceRisingCompanyRedirect />} />
          {/* Legacy multi-tenant V1 routes retired (2026-06-05). spacerising.org is
              Space-Rising-only now. The old /:tenantSlug V1 directories
              (s3c-semiconductor, az-biotech, az-defense) and ANY unknown/typo slug
              fall through to the catch-all below and redirect to the Space OS V2
              directory. Tenant company DATA stays in the DB; only the V1 browse
              surface is removed. Per Patrik 2026-06-05: "no page shows v1." */}
          {/* Catch-all → Space OS V2 directory. With the /:tenantSlug V1 block gone,
              EVERY unmatched path (1, 2, or 3+ segments) lands here — no V1, no 404. */}
          <Route path="*" element={<Navigate to="/space-rising-v2" replace />} />
        </Routes>
        </PageTransition>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)
