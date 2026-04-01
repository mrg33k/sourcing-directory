import React, { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Lazy-load all pages
const SourcingLanding = lazy(() => import('./pages/SourcingLanding.jsx'))
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
const SourcingOrg = lazy(() => import('./pages/SourcingOrg.jsx'))
const SourcingCheckout = lazy(() => import('./pages/SourcingCheckout.jsx'))
const SourcingSettings = lazy(() => import('./pages/SourcingSettings.jsx'))
const SourcingProfile = lazy(() => import('./pages/SourcingProfile.jsx'))
const SourcingCreate = lazy(() => import('./pages/SourcingCreate.jsx'))

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f1419', color: '#9ca3af', fontFamily: "'Space Grotesk', sans-serif" }}>
    Loading...
  </div>
)

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Global */}
          <Route path="/" element={<SourcingLanding />} />
          <Route path="/about" element={<SourcingAbout />} />
          <Route path="/admin" element={<SourcingAdmin />} />
          <Route path="/admin/new" element={<SourcingAdmin />} />
          <Route path="/admin/settings/:tenantSlug" element={<SourcingAdmin />} />
          <Route path="/create" element={<SourcingCreate />} />
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
          <Route path="/:tenantSlug/org/:slug" element={<SourcingOrg />} />
          <Route path="/:tenantSlug/checkout" element={<SourcingCheckout />} />
          <Route path="/:tenantSlug/settings" element={<SourcingSettings />} />
          <Route path="/:tenantSlug/:slug" element={<SourcingProfile />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)
