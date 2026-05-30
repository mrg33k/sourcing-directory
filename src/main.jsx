import React, { lazy, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
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

// Space Rising Website (SRW) — self-contained marketing site under /srw.
// Mirrors spacerising.org; built to detach to AWS as the front door later.
const SRWHome = lazy(() => import('./pages/srw/SRWHome.jsx'))
const SRWSpaceOS = lazy(() => import('./pages/srw/SRWSpaceOS.jsx'))
const SRWSpaceCongress = lazy(() => import('./pages/srw/SRWSpaceCongress.jsx'))
const SRWArizona = lazy(() => import('./pages/srw/SRWArizona.jsx'))
const SRWAbout = lazy(() => import('./pages/srw/SRWAbout.jsx'))
const SRWPartnerships = lazy(() => import('./pages/srw/SRWPartnerships.jsx'))
const SRWEvents = lazy(() => import('./pages/srw/SRWEvents.jsx'))
const SRWMedia = lazy(() => import('./pages/srw/SRWMedia.jsx'))
const SRWSignUp = lazy(() => import('./pages/srw/SRWSignUp.jsx'))

// Nat Geo Uplift — V2 sibling clones for the visual-system uplift mission.
// Pixel-equivalent to V1 at R1; diverges starting R2 (type + palette).
// Mission: aom:space-rising:website:nat-geo-uplift.
const SRWHomeV2 = lazy(() => import('./pages/srw/SRWHomeV2.jsx'))
const SourcingDirectoryV2 = lazy(() => import('./pages/SourcingDirectoryV2.jsx'))

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
          <Route path="/" element={<Navigate to="/space-rising" replace />} />
          <Route path="/signup" element={<GlobalSignup />} />
          <Route path="/about" element={<SourcingAbout />} />
          <Route path="/admin" element={<SourcingAdmin />} />
          <Route path="/admin/new" element={<SourcingAdmin />} />
          <Route path="/admin/settings/:tenantSlug" element={<SourcingAdmin />} />
          <Route path="/create" element={<SourcingCreate />} />
          {/* Space Rising Website (SRW) — placed before tenant catch-all so static segments win */}
          <Route path="/srw" element={<SRWHome />} />
          <Route path="/srw/spaceos" element={<SRWSpaceOS />} />
          <Route path="/srw/space-congress" element={<SRWSpaceCongress />} />
          <Route path="/srw/arizona" element={<SRWArizona />} />
          <Route path="/srw/about" element={<SRWAbout />} />
          <Route path="/srw/partnerships" element={<SRWPartnerships />} />
          <Route path="/srw/events" element={<SRWEvents />} />
          <Route path="/srw/media" element={<SRWMedia />} />
          <Route path="/srw/sign-up" element={<SRWSignUp />} />
          {/* Nat Geo Uplift V2 clones — placed before tenant catch-all */}
          <Route path="/srw-v2" element={<SRWHomeV2 />} />
          <Route path="/space-rising-v2" element={<SourcingDirectoryV2 />} />
          {/* Tenant-scoped routes */}
          <Route path="/:tenantSlug" element={<SourcingDirectory />} />
          <Route path="/:tenantSlug/login" element={<SourcingLogin />} />
          <Route path="/:tenantSlug/portal" element={<SourcingPortal />} />
          <Route path="/:tenantSlug/signup" element={<SourcingSignup />} />
          <Route path="/:tenantSlug/jobs" element={<SourcingJobs />} />
          <Route path="/:tenantSlug/jobs/post" element={<SourcingJobsPost />} />
          <Route path="/:tenantSlug/marketplace" element={<SourcingMarketplace />} />
          <Route path="/:tenantSlug/marketplace/post" element={<SourcingMarketplacePost />} />
          <Route path="/:tenantSlug/events" element={<SourcingEvents />} />
          <Route path="/:tenantSlug/events/post" element={<SourcingEventsPost />} />
          <Route path="/:tenantSlug/articles" element={<SourcingArticles />} />
          <Route path="/:tenantSlug/articles/post" element={<SourcingArticlesPost />} />
          <Route path="/:tenantSlug/grants" element={<SourcingGrants />} />
          <Route path="/:tenantSlug/deal-bank" element={<SourcingDealBank />} />
          <Route path="/:tenantSlug/membership" element={<SourcingMembership />} />
          <Route path="/:tenantSlug/reports" element={<SourcingReports />} />
          <Route path="/:tenantSlug/reports/:reportId" element={<SourcingReports />} />
          <Route path="/:tenantSlug/org/:slug" element={<SourcingOrg />} />
          <Route path="/:tenantSlug/checkout" element={<SourcingCheckout />} />
          <Route path="/:tenantSlug/settings" element={<SourcingSettings />} />
          <Route path="/:tenantSlug/:slug" element={<SourcingProfile />} />
        </Routes>
        </PageTransition>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)
