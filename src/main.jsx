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

// Redirect any legacy prefix (/space-rising, /space-rising-v2) to the clean
// /spaceos URL, preserving the rest of the path + query + hash. Navigate's `to`
// can't interpolate splat params directly, so we read them here.
function ToSpaceOS() {
  const rest = useParams()['*'] || ''
  const { search, hash } = useLocation()
  return <Navigate to={'/spaceos' + (rest ? '/' + rest : '') + search + hash} replace />
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
// Deal Bank R6 (Round A) — investor signup form (public, no auth)
const SourcingDealBankInvestorSignup = lazy(() => import('./pages/SourcingDealBankInvestorSignup.jsx'))
// Deal Bank R7 (Round B) — company form to add listing (gated to directory companies)
const SourcingDealBankAddListing = lazy(() => import('./pages/SourcingDealBankAddListing.jsx'))
const SourcingMembershipV2 = lazy(() => import('./pages/SourcingMembershipV2.jsx'))
const SourcingSignupV2 = lazy(() => import('./pages/SourcingSignupV2.jsx'))
const SourcingCompanyV2 = lazy(() => import('./pages/SourcingCompanyV2.jsx'))
const SourcingSignupComplete = lazy(() => import('./pages/SourcingSignupComplete.jsx'))
const SourcingArticlesV2 = lazy(() => import('./pages/SourcingArticlesV2.jsx'))
// Discovery — community whitepaper library (modeled on Articles).
const SourcingDiscoveryV2 = lazy(() => import('./pages/SourcingDiscoveryV2.jsx'))
const SourcingDiscoveryPostV2 = lazy(() => import('./pages/SourcingDiscoveryPostV2.jsx'))
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
// space-rising:website:blueprint — Arizona Space Blueprint™ campaign landing page.
const SRWBlueprintV2 = lazy(() => import('./pages/srw/SRWBlueprintV2.jsx'))
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
          {/* Home is the root URL (clean-urls, 2026-06-18). The marketing home
              renders directly at "/", no /srw-v2 hop. The bare /srw-v2 route below
              redirects back to "/" so the old marketing URL never rots. V1 routes
              (/srw, /space-rising) stay as redirects for legacy deep-link compat. */}
          <Route path="/" element={<SRWHomeV2 />} />
          {/* Legacy V1 utility pages retired (2026-06-05) → Space OS. No V1 surface. */}
          <Route path="/signup" element={<Navigate to="/spaceos/signup" replace />} />
          <Route path="/about" element={<Navigate to="/srw-v2/about" replace />} />
          <Route path="/create" element={<Navigate to="/spaceos" replace />} />
          {/* Admin stays — internal tooling, not a public surface. */}
          <Route path="/admin" element={<SourcingAdmin />} />
          <Route path="/admin/new" element={<SourcingAdmin />} />
          <Route path="/admin/settings/:tenantSlug" element={<SourcingAdmin />} />
          {/* Space Rising Website (SRW) V1 → V2 redirects. V2 is production. */}
          <Route path="/srw" element={<Navigate to="/" replace />} />
          <Route path="/srw/spaceos" element={<Navigate to="/srw-v2/spaceos" replace />} />
          <Route path="/srw/space-congress" element={<Navigate to="/srw-v2/space-congress" replace />} />
          <Route path="/srw/arizona" element={<Navigate to="/srw-v2/arizona" replace />} />
          <Route path="/srw/about" element={<Navigate to="/srw-v2/about" replace />} />
          <Route path="/srw/partnerships" element={<Navigate to="/" replace />} />
          <Route path="/srw/events" element={<Navigate to="/srw-v2/events" replace />} />
          <Route path="/srw/media" element={<Navigate to="/srw-v2/media" replace />} />
          <Route path="/srw/sign-up" element={<Navigate to="/srw-v2/sign-up" replace />} />
          {/* Nat Geo Uplift V2 clones — placed before tenant catch-all.
              Bare /srw-v2 redirects to the root home; its subpages stay live. */}
          <Route path="/srw-v2" element={<Navigate to="/" replace />} />
          {/* R6 — SRW marketing sub-pages */}
          <Route path="/srw-v2/about" element={<SRWAboutV2 />} />
          <Route path="/srw-v2/spaceos" element={<SRWSpaceOSV2 />} />
          <Route path="/srw-v2/arizona" element={<SRWArizonaV2 />} />
          <Route path="/srw-v2/space-congress" element={<SRWSpaceCongressV2 />} />
          {/* Partnerships hidden 2026-06-21 (Taryn): no official partners yet. Redirect home. */}
          <Route path="/srw-v2/partnerships" element={<Navigate to="/" replace />} />
          <Route path="/srw-v2/events" element={<SRWEventsV2 />} />
          <Route path="/srw-v2/media" element={<SRWMediaV2 />} />
          <Route path="/srw-v2/sign-up" element={<SRWSignUpV2 />} />
          <Route path="/srw-v2/blueprint" element={<SRWBlueprintV2 />} />
          {/* Short alias: /blueprint */}
          <Route path="/blueprint" element={<Navigate to="/srw-v2/blueprint" replace />} />
          {/* SpaceOS canonical surface — the ONE public prefix now. Internal nav
              links all point here (canonical-link flip done 2026-06-18); the legacy
              /space-rising-v2/* and /space-rising/* paths below 301-redirect in.
              :slug stays LAST so static segments win. */}
          <Route path="/spaceos" element={<SourcingDirectoryV2 />} />
          <Route path="/spaceos/jobs" element={<SourcingJobsV2 />} />
          <Route path="/spaceos/events" element={<SourcingEventsV2 />} />
          <Route path="/spaceos/reports" element={<SourcingReportsV2 />} />
          <Route path="/spaceos/marketplace" element={<SourcingMarketplaceV2 />} />
          <Route path="/spaceos/deal-bank" element={<SourcingDealBankV2 />} />
          <Route path="/spaceos/deal-bank/investments/add" element={<SourcingDealBankAddListing />} />
          <Route path="/spaceos/deal-bank/investments/:slug" element={<SourcingDealBankInvestmentProfile />} />
          <Route path="/spaceos/deal-bank/investors/signup" element={<SourcingDealBankInvestorSignup />} />
          <Route path="/spaceos/deal-bank/investors/:slug" element={<SourcingDealBankInvestorProfile />} />
          <Route path="/spaceos/membership" element={<SourcingMembershipV2 />} />
          <Route path="/spaceos/signup" element={<SourcingSignupV2 />} />
          <Route path="/spaceos/signup/complete" element={<SourcingSignupComplete />} />
          <Route path="/spaceos/articles" element={<SourcingArticlesV2 />} />
          <Route path="/spaceos/discovery" element={<SourcingDiscoveryV2 />} />
          <Route path="/spaceos/grants" element={<SourcingGrantsV2 />} />
          <Route path="/spaceos/login" element={<SourcingLoginV2 />} />
          <Route path="/spaceos/portal" element={<SourcingPortalV2 />} />
          <Route path="/spaceos/jobs/post" element={<SourcingJobsPostV2 />} />
          <Route path="/spaceos/events/post" element={<SourcingEventsPostV2 />} />
          <Route path="/spaceos/marketplace/post" element={<SourcingMarketplacePostV2 />} />
          <Route path="/spaceos/articles/post" element={<SourcingArticlesPostV2 />} />
          <Route path="/spaceos/discovery/post" element={<SourcingDiscoveryPostV2 />} />
          <Route path="/spaceos/jobs/:id" element={<SourcingListingV2 kind="job" />} />
          <Route path="/spaceos/events/:id" element={<SourcingListingV2 kind="event" />} />
          <Route path="/spaceos/marketplace/:id" element={<SourcingListingV2 kind="marketplace" />} />
          <Route path="/spaceos/reports/:id" element={<SourcingReportDetailV2 />} />
          <Route path="/spaceos/:slug" element={<SourcingCompanyV2 />} />

          {/* Legacy URL cleanup (2026-06-18): /space-rising-v2/* 301-redirects to
              the clean /spaceos/* surface above. Same render components live under
              /spaceos, so nothing is lost; old shared links + bookmarks forward
              automatically. The splat preserves the rest of the path + query + hash.
              Server-side 301s are also set in vercel.json for direct hits + SEO. */}
          <Route path="/space-rising-v2/*" element={<ToSpaceOS />} />
          {/* Legacy /space-rising/* (V1) → clean /spaceos/*. One splat covers the
              bare path, every sub-page, and company /:slug profiles. */}
          <Route path="/space-rising/*" element={<ToSpaceOS />} />
          {/* Catch-all → Space OS directory. Every unmatched path (unknown/typo slug,
              retired V1 tenant directories) lands on /spaceos — no V1, no 404.
              Tenant company DATA stays in the DB; only old browse surfaces are gone. */}
          <Route path="*" element={<Navigate to="/spaceos" replace />} />
        </Routes>
        </PageTransition>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)
