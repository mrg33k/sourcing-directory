import React, { lazy, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import './v10.css'
import './osv3-tokens.css'

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

// Redirect /spaceos/* to clean OS routes (e.g., /spaceos/directory → /directory)
function ToCleanOSRoute() {
  const rest = useParams()['*'] || ''
  const { search, hash } = useLocation()
  // Map /spaceos/X to /X
  return <Navigate to={'/' + (rest || '') + search + hash} replace />
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

// Space OS v3 — new shell + home + hub pages (foundation build)
const OSLayoutV3 = lazy(() => import('./pages/OSLayoutV3.jsx'))
const SpaceOSHomeV3 = lazy(() => import('./pages/SpaceOSHomeV3.jsx'))
const OSEcosystemHub = lazy(() => import('./pages/OSHubPages.jsx').then(m => ({ default: m.OSEcosystemHub })))
const OSIntelligenceHub = lazy(() => import('./pages/OSHubPages.jsx').then(m => ({ default: m.OSIntelligenceHub })))
const OSOpportunitiesHub = lazy(() => import('./pages/OSHubPages.jsx').then(m => ({ default: m.OSOpportunitiesHub })))
const OSLearningHub = lazy(() => import('./pages/OSHubPages.jsx').then(m => ({ default: m.OSLearningHub })))
const OSLibraryHub = lazy(() => import('./pages/OSHubPages.jsx').then(m => ({ default: m.OSLibraryHub })))
const OSPodcastsPage = lazy(() => import('./pages/OSPodcastsPage.jsx'))
const OSEventsPage = lazy(() => import('./pages/OSEventsPage.jsx'))
const OSJobsPage = lazy(() => import('./pages/OSJobsPage.jsx'))
const OSArticlesPage = lazy(() => import('./pages/OSArticlesPage.jsx'))
const OSReportsPage = lazy(() => import('./pages/OSReportsPage.jsx'))
const OSDiscoveryPage = lazy(() => import('./pages/OSDiscoveryPage.jsx'))

const Loading = () => (
  <div style={{ minHeight: '100dvh', background: 'var(--bg, #06060A)' }} />
)

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <PageTransition>
        <Routes>
          {/* ===== SPACE OS V3 SHELL (foundation) ===== */}
          {/* The v3 layout wraps all OS pages. "/" is the OS home. */}
          <Route element={<Suspense fallback={<Loading />}><OSLayoutV3 /></Suspense>}>
            <Route path="/" element={<SpaceOSHomeV3 />} />
            <Route path="/directory" element={<SourcingDirectoryV2 />} />
            <Route path="/ecosystem" element={<OSEcosystemHub />} />
            <Route path="/intelligence" element={<OSIntelligenceHub />} />
            <Route path="/opportunities" element={<OSOpportunitiesHub />} />
            <Route path="/careers" element={<OSJobsPage />} />
            <Route path="/jobs" element={<OSJobsPage />} />
            <Route path="/marketplace" element={<SourcingMarketplaceV2 />} />
            <Route path="/community" element={<OSEventsPage />} />
            <Route path="/events" element={<OSEventsPage />} />
            <Route path="/reports" element={<OSReportsPage />} />
            <Route path="/articles" element={<OSArticlesPage />} />
            <Route path="/grants" element={<SourcingGrantsV2 />} />
            <Route path="/deal-bank" element={<SourcingDealBankV2 />} />
            <Route path="/deal-bank/investments/add" element={<SourcingDealBankAddListing />} />
            <Route path="/deal-bank/investments/:slug" element={<SourcingDealBankInvestmentProfile />} />
            <Route path="/deal-bank/investors/signup" element={<SourcingDealBankInvestorSignup />} />
            <Route path="/deal-bank/investors/:slug" element={<SourcingDealBankInvestorProfile />} />
            <Route path="/podcasts" element={<OSPodcastsPage />} />
            <Route path="/learning" element={<OSLearningHub />} />
            <Route path="/library" element={<OSLibraryHub />} />
            <Route path="/membership" element={<SourcingMembershipV2 />} />
            <Route path="/login" element={<SourcingLoginV2 />} />
            <Route path="/signup" element={<SourcingSignupV2 />} />
            <Route path="/signup/complete" element={<SourcingSignupComplete />} />
            <Route path="/portal" element={<SourcingPortalV2 />} />
            <Route path="/jobs/post" element={<SourcingJobsPostV2 />} />
            <Route path="/events/post" element={<SourcingEventsPostV2 />} />
            <Route path="/marketplace/post" element={<SourcingMarketplacePostV2 />} />
            <Route path="/articles/post" element={<SourcingArticlesPostV2 />} />
            <Route path="/discovery" element={<OSDiscoveryPage />} />
            <Route path="/discovery/:id" element={<SourcingListingV2 kind="whitepaper" />} />
            <Route path="/discovery/post" element={<SourcingDiscoveryPostV2 />} />
            <Route path="/jobs/:id" element={<SourcingListingV2 kind="job" />} />
            <Route path="/events/:id" element={<SourcingListingV2 kind="event" />} />
            <Route path="/marketplace/:id" element={<SourcingListingV2 kind="marketplace" />} />
            <Route path="/articles/:id" element={<SourcingListingV2 kind="article" />} />
            <Route path="/reports/:id" element={<SourcingReportDetailV2 />} />
            <Route path="/company/:slug" element={<SourcingCompanyV2 />} />
            <Route path="/:slug" element={<SourcingCompanyV2 />} />
          </Route>

          {/* ===== MARKETING PAGES (outside v3 shell) ===== */}
          <Route path="/srw" element={<Navigate to="/srw-v2" replace />} />
          <Route path="/srw/spaceos" element={<Navigate to="/srw-v2/spaceos" replace />} />
          <Route path="/srw/space-congress" element={<Navigate to="/srw-v2/space-congress" replace />} />
          <Route path="/srw/arizona" element={<Navigate to="/srw-v2/arizona" replace />} />
          <Route path="/srw/about" element={<Navigate to="/srw-v2/about" replace />} />
          <Route path="/srw/partnerships" element={<Navigate to="/srw-v2" replace />} />
          <Route path="/srw/events" element={<Navigate to="/srw-v2/events" replace />} />
          <Route path="/srw/media" element={<Navigate to="/srw-v2/media" replace />} />
          <Route path="/srw/sign-up" element={<Navigate to="/srw-v2/sign-up" replace />} />
          <Route path="/srw-v2" element={<SRWHomeV2 />} />
          <Route path="/srw-v2/about" element={<SRWAboutV2 />} />
          <Route path="/srw-v2/spaceos" element={<SRWSpaceOSV2 />} />
          <Route path="/srw-v2/arizona" element={<SRWArizonaV2 />} />
          <Route path="/srw-v2/space-congress" element={<SRWSpaceCongressV2 />} />
          <Route path="/srw-v2/partnerships" element={<Navigate to="/srw-v2" replace />} />
          <Route path="/srw-v2/events" element={<SRWEventsV2 />} />
          <Route path="/srw-v2/media" element={<SRWMediaV2 />} />
          <Route path="/srw-v2/sign-up" element={<SRWSignUpV2 />} />
          <Route path="/srw-v2/blueprint" element={<SRWBlueprintV2 />} />
          <Route path="/blueprint" element={<Navigate to="/srw-v2/blueprint" replace />} />

          {/* ===== ADMIN (outside v3 shell) ===== */}
          <Route path="/admin" element={<SourcingAdmin />} />
          <Route path="/admin/new" element={<SourcingAdmin />} />
          <Route path="/admin/settings/:tenantSlug" element={<SourcingAdmin />} />

          {/* ===== LEGACY REDIRECTS ===== */}
          {/* /spaceos/* → clean OS routes (e.g., /spaceos/directory → /directory) */}
          <Route path="/spaceos" element={<Navigate to="/directory" replace />} />
          <Route path="/spaceos/*" element={<ToCleanOSRoute />} />
          {/* /space-rising/* (V1) → clean routes via /spaceos redirect */}
          <Route path="/space-rising/*" element={<ToSpaceOS />} />
          {/* /space-rising-v2/* → /spaceos/* → clean routes */}
          <Route path="/space-rising-v2/*" element={<ToSpaceOS />} />

          {/* ===== CATCH-ALL ===== */}
          {/* Unmatched paths → OS home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </PageTransition>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)
