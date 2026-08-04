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
const OSMarketplacePage = lazy(() => import('./pages/OSMarketplacePage.jsx'))
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
// RETIRED as a route target 2026-07-28 — no <Route> renders this any more. It
// is kept imported, and the file is kept on disk, as the one-line rollback for
// the company-route switch below. Do NOT point a route back at it without
// reading that comment first: this page reads directory_companies with
// select('*'), and the public-read policy on that table still exposes fourteen
// membership_*/stripe_*/paid_* columns to anon.
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
const OSVideosPage = lazy(() => import('./pages/OSVideosPage.jsx'))
const OSOrganizationsPage = lazy(() => import('./pages/OSOrganizationsPage.jsx'))
const OSEventsPage = lazy(() => import('./pages/OSEventsPage.jsx'))
const OSJobsPage = lazy(() => import('./pages/OSJobsPage.jsx'))
const OSArticlesPage = lazy(() => import('./pages/OSArticlesPage.jsx'))
const OSReportsPage = lazy(() => import('./pages/OSReportsPage.jsx'))
const OSDiscoveryPage = lazy(() => import('./pages/OSDiscoveryPage.jsx'))
const OSNewsPage = lazy(() => import('./pages/OSNewsPage.jsx'))
const OSPeoplePage = lazy(() => import('./pages/OSPeoplePage.jsx'))
const OSRFPsPage = lazy(() => import('./pages/OSRFPsPage.jsx'))
const OSGrantsPage = lazy(() => import('./pages/OSGrantsPage.jsx'))
const OSBlueprint = lazy(() => import('./pages/os/OSBlueprint.jsx'))

// Space OS v3 — MY SPACEOS: the person/company profile screens and the
// member-area pages the sidebar's new nav group points at.
// Every one of these MUST be declared above the "/:slug" catch-all below;
// a route registered after it renders the company page instead, and the
// failure looks like a bounce, not a 404.
const OSPersonProfile = lazy(() => import('./pages/os/OSPersonProfile.jsx'))
const OSCompanyProfile = lazy(() => import('./pages/os/OSCompanyProfile.jsx'))
const OSMyProfile = lazy(() => import('./pages/os/OSMyProfile.jsx'))
const OSProfileEdit = lazy(() => import('./pages/os/OSProfileEdit.jsx'))
const OSDashboard = lazy(() => import('./pages/os/OSDashboard.jsx'))
const OSConnections = lazy(() => import('./pages/os/OSConnections.jsx'))
const OSSaved = lazy(() => import('./pages/os/OSSaved.jsx'))
const OSMessages = lazy(() => import('./pages/os/OSMessages.jsx'))
const OSNotifications = lazy(() => import('./pages/os/OSNotifications.jsx'))
const OSAddProfile = lazy(() => import('./pages/os/OSAddProfile.jsx'))
// Third screen of the rebuild, now the REAL admin surface (Patrik 2026-07-29:
// "stats should be the first tab admins see"). Imported straight from
// AdminTools.jsx per the shim's own retirement note. /admin-tools is guarded;
// /admin-tools/_preview stays open — it renders the same live aggregates a
// visitor could already count from public pages, and holds no admin controls.
const OSAdminTools = lazy(() => import('./pages/os/AdminTools.jsx'))

// Admin route guard. Lazy on purpose — it pulls in the Supabase client, and
// eager-importing it here would drag that chunk into the entry bundle for every
// visitor to the home page. Only /admin/* ever loads it.
//
// DEFENCE IN DEPTH, NOT SECURITY: this keeps an honest signed-in non-admin (a
// brand-new `pending` signup, for instance) from rendering the admin panel. It
// does not stop anyone willing to edit their own JavaScript, and it does nothing
// about the service-role key currently shipping in the public bundle. The real
// fix is the server-side authorization check plus key rotation
// (docs/security/key-rotation-runbook.md). See src/hooks/useAdmin.js.
const RequireAdmin = lazy(() => import('./components/RequireAdmin.jsx'))

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
            <Route path="/marketplace" element={<OSMarketplacePage />} />
            <Route path="/community" element={<OSEventsPage />} />
            <Route path="/events" element={<OSEventsPage />} />
            <Route path="/reports" element={<OSReportsPage />} />
            <Route path="/blueprint" element={<OSBlueprint />} />
            <Route path="/articles" element={<OSArticlesPage />} />
            <Route path="/grants" element={<OSGrantsPage />} />
            <Route path="/deal-bank" element={<SourcingDealBankV2 />} />
            <Route path="/deal-bank/investments/add" element={<SourcingDealBankAddListing />} />
            <Route path="/deal-bank/investments/:slug" element={<SourcingDealBankInvestmentProfile />} />
            <Route path="/deal-bank/investors/signup" element={<SourcingDealBankInvestorSignup />} />
            <Route path="/deal-bank/investors/:slug" element={<SourcingDealBankInvestorProfile />} />
            <Route path="/podcasts" element={<OSPodcastsPage />} />
            <Route path="/videos" element={<OSVideosPage />} />
            <Route path="/organizations" element={<OSOrganizationsPage />} />
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
            <Route path="/news" element={<OSNewsPage />} />
            <Route path="/people" element={<OSPeoplePage />} />
            <Route path="/rfps" element={<OSRFPsPage />} />
            <Route path="/jobs/:id" element={<SourcingListingV2 kind="job" />} />
            <Route path="/events/:id" element={<SourcingListingV2 kind="event" />} />
            <Route path="/marketplace/:id" element={<SourcingListingV2 kind="marketplace" />} />
            <Route path="/articles/:id" element={<SourcingListingV2 kind="article" />} />
            <Route path="/reports/:id" element={<SourcingReportDetailV2 />} />

            {/* ===== MY SPACEOS =====
                Declared HERE, above "/:slug". That bare single-segment route
                swallows anything registered after it and renders the company
                page, which reads as a bounce rather than a 404. Keep this
                block above it. */}
            {/* The two _preview routes are LITERAL, so they hand the slug in as
                a prop — a literal path has no :slug param to read. */}
            <Route path="/people/_preview" element={<OSPersonProfile slug="_preview" />} />
            <Route path="/people/:slug" element={<OSPersonProfile />} />
            <Route path="/company/_preview" element={<OSCompanyProfile slug="_preview" />} />
            <Route path="/profile" element={<OSMyProfile />} />
            <Route path="/profile/edit" element={<OSProfileEdit />} />
            <Route path="/dashboard" element={<OSDashboard />} />
            <Route path="/connections" element={<OSConnections />} />
            <Route path="/saved" element={<OSSaved />} />
            <Route path="/messages" element={<OSMessages />} />
            <Route path="/notifications" element={<OSNotifications />} />
            <Route path="/add-profile" element={<OSAddProfile />} />
            <Route path="/admin-tools" element={<RequireAdmin><OSAdminTools /></RequireAdmin>} />
            <Route path="/admin-tools/_preview" element={<OSAdminTools />} />

            {/* ===== COMPANY PROFILE =====
                Both of these render the SAME screen, and they are the LAST two
                routes in the shell on purpose. Keep them last, and keep every
                new route ABOVE them: "/:slug" matches any single segment, so a
                route added underneath it renders the company page instead of
                itself, which reads as a bounce rather than a 404.

                Switched off SourcingCompanyV2 2026-07-28 (Patrik: "switch it
                over now"). The old page did select('*') on directory_companies,
                whose public-read policy hands anon every column on that table —
                membership_tier, membership_seats, membership_paid_at,
                membership_billing, membership_expires_at, paid_seats, paid_at,
                paid_receipt_url, paid_stripe_session_id,
                paid_stripe_payment_intent_id, paid_stripe_subscription_id,
                pending_checkout_session_id, pending_checkout_seats,
                pending_checkout_at. Fourteen billing columns on a public page.
                The new screen reads get_company_profile(p_slug), which names
                its columns and returns none of them.

                "/:slug" moves WITH "/company/:slug" and is not the afterthought
                of the two: /directory links all 166 companies as "/<slug>"
                (SourcingDirectoryV2 lines 337 + 470), so it carries the real
                traffic. "/company/:slug" is only reached from the company chip
                on a listing detail page. Switching one and not the other would
                have closed the leak on the quiet URL and left it open on the
                busy one. Both resolve a slug against directory_companies with
                status='active' and show a not-found state otherwise, so nothing
                that used to render stops rendering. */}
            <Route path="/company/:slug" element={<OSCompanyProfile />} />
            <Route path="/:slug" element={<OSCompanyProfile />} />
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

          {/* ===== ADMIN (outside v3 shell) ===== */}
          {/* /admin now lands on the new Admin Tools (dashboard/stats tab
              first — Patrik 2026-07-29). The legacy management panel moved to
              /admin/panel; /admin/new and /admin/settings are untouched, and
              nothing in SourcingAdmin links back to bare /admin (verified by
              grep before the move). All guarded by RequireAdmin. */}
          <Route path="/admin" element={<Navigate to="/admin-tools" replace />} />
          <Route path="/admin/panel" element={<RequireAdmin><SourcingAdmin /></RequireAdmin>} />
          <Route path="/admin/new" element={<RequireAdmin><SourcingAdmin /></RequireAdmin>} />
          <Route path="/admin/settings/:tenantSlug" element={<RequireAdmin><SourcingAdmin /></RequireAdmin>} />

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
