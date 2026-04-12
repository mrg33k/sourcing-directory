# Sourcing Directory - Project Context

## What This Is
Multi-tenant business directory for Arizona's advanced industries. Two directories live here:
- **Space Rising** (space/aerospace) -- slug: `space-rising`
- **S3C Arizona** (semiconductor) -- slug: `s3c-semiconductor`

Live at: https://sourcing.directory

## Tech Stack
- **Frontend:** React + Vite (SPA, client-side routing)
- **Backend:** Vercel serverless functions (`/api/sourcing/*`)
- **Database:** Supabase (PostgreSQL) -- DEDICATED PROJECT, not shared with Corner/AOM
- **Email:** Resend API (transactional emails)
- **Deploy:** Vercel (`vercel --prod` from repo root)
- **Auth:** Supabase Auth (email/password)

## Supabase Project (DEDICATED -- NOT shared with Corner/AOM)
- **Project ref:** `kzzvjtthknsozktmpvak`
- **URL:** `https://kzzvjtthknsozktmpvak.supabase.co`
- **DB password:** `zj3B35zXuKzmQ7F4`
- **DB connection:** `postgresql://postgres:zj3B35zXuKzmQ7F4@db.kzzvjtthknsozktmpvak.supabase.co:5432/postgres`
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6enZqdHRoa25zb3prdG1wdmFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NzQwMTEsImV4cCI6MjA5MTI1MDAxMX0.GgxauYExjOFU1Us7PH1j7b-lXH4aga3Qbs2xwuPXA3I`
- **Service role key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6enZqdHRoa25zb3prdG1wdmFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY3NDAxMSwiZXhwIjoyMDkxMjUwMDExfQ.yGfEFCLjqn_NtDbELcevG6CGdSSUGHQOkuDb_D3HfvQ`
- **Publishable key:** `sb_publishable_yQCgAqVBhbzC1nKvDTtPcA_xeING6zn`
- **Site URL (auth):** `https://sourcing.directory` -- MUST stay this. Never localhost.
- **HARD RULE:** This is a SEPARATE Supabase project from Corner/AOM. Never share. Never point sourcing env vars at the Corner DB.

## Key Environment Variables (all set in Vercel)
| Variable | Where Used | What It Does |
|----------|-----------|--------------|
| `VITE_SUPABASE_URL` | Frontend (browser) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend (browser) | Supabase anon/public key |
| `SUPABASE_URL` | API functions (server) | Same Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | API functions (server) | Full admin access to Supabase |
| `RESEND_API_KEY` | API functions (server) | Sends emails via Resend |
| `RESEND_FROM_ADDRESS` | API functions (server) | Defaults to `noreply@sourcing.directory` |
| `VITE_SOURCING_ADMIN_KEY` | Frontend (browser) | Admin panel access key |
| `ANTHROPIC_API_KEY` | API functions (server) | Powers Scout AI search |
| `SETUP_SECRET` | API functions (server) | Protects `/api/sourcing/admin-setup` one-time bootstrap endpoint |

Old Corner/AOM project (DO NOT USE): `mcngatprgluexjjcqpkp` -- sourcing data was migrated OFF this on 2026-04-08

## File Map

### Frontend Pages (`src/pages/`)
| File | Route | What It Does |
|------|-------|-------------|
| `SourcingLanding.jsx` | `/` | Directory chooser (lists all tenants) |
| `SourcingDirectory.jsx` | `/:tenantSlug` | Main directory browse (search, filters, company cards) |
| `SourcingProfile.jsx` | `/:tenantSlug/:slug` | Individual company profile |
| `SourcingOrg.jsx` | `/:tenantSlug/org/:slug` | Organization page |
| `SourcingJobs.jsx` | `/:tenantSlug/jobs` | Job listings |
| `SourcingJobsPost.jsx` | `/:tenantSlug/jobs/post` | Post a job (paid members only) |
| `SourcingEvents.jsx` | `/:tenantSlug/events` | Events listing |
| `SourcingEventsPost.jsx` | `/:tenantSlug/events/post` | Post an event (paid members only) |
| `SourcingArticles.jsx` | `/:tenantSlug/articles` | Articles feed |
| `SourcingArticlesPost.jsx` | `/:tenantSlug/articles/post` | Post an article (paid members only) |
| `SourcingMarketplace.jsx` | `/:tenantSlug/marketplace` | Equipment marketplace |
| `SourcingMarketplacePost.jsx` | `/:tenantSlug/marketplace/post` | Post a listing (paid members only) |
| `SourcingGrants.jsx` | `/:tenantSlug/grants` | Grants (free access) |
| `SourcingReports.jsx` | `/:tenantSlug/reports` | Reports listing + download (uses directory_reports table + RAG server) |
| `SourcingMembership.jsx` | `/:tenantSlug/membership` | Membership tiers + pricing |
| `SourcingCheckout.jsx` | `/:tenantSlug/checkout` | Membership checkout (pre-Stripe) |
| `SourcingSignup.jsx` | `/:tenantSlug/signup` | Company signup (3-step wizard) |
| `SourcingLogin.jsx` | `/:tenantSlug/login` | Login + password reset |
| `SourcingPortal.jsx` | `/:tenantSlug/portal` | Member dashboard |
| `SourcingSettings.jsx` | `/:tenantSlug/settings` | Account settings |
| `SourcingAdmin.jsx` | `/admin` | Admin moderation panel (2900 lines, 12 tabs -- needs component split before major edits) |
| `SourcingAbout.jsx` | `/about` | About page |
| `SourcingCreate.jsx` | `/create` | Create a new directory |
| `SourcingTheme.jsx` | (shared) | Theme system (dark/light), design tokens, tenant context |
| `sourcingAnalytics.js` | (shared) | Event tracking |

### API Endpoints (`api/sourcing/`)
| File | Method | What It Does |
|------|--------|-------------|
| `signup.js` | POST | Creates auth user + company + member + certs |
| `welcome-email.js` | POST | Sends branded welcome email via Resend |
| `reset-email.js` | POST | Sends password reset email via Resend |
| `tenants.js` | GET | Lists all directory tenants |
| `agent.js` | POST | Scout AI search (Anthropic-powered) |
| `run-migration.js` | POST | Runs SQL migrations against Supabase |

### Email Templates
- Welcome email: `api/sourcing/welcome-email.js` (lines 8-120, inline HTML)
- Reset email: `api/sourcing/reset-email.js` (lines 12-130, inline HTML)
- Both send from: `noreply@sourcing.directory` via Resend
- Both have branded HTML with AOM header, card layout, CTA buttons
- CRITICAL: All links must point to `sourcing.directory`, never `localhost`

### Supabase Tables (key ones)
| Table | Purpose |
|-------|---------|
| `directory_tenants` | Tenant directories (Space Rising, S3C) |
| `directory_companies` | All listed companies |
| `directory_members` | User-company associations |
| `directory_organizations` | Parent orgs within tenants |
| `directory_certifications` | Company certifications |
| `directory_jobs` | Job listings |
| `directory_events` | Events |
| `directory_articles` | Articles |
| `directory_marketplace` | Marketplace listings |
| `directory_grants` | Grant opportunities |
| `directory_reports` | Reports with file downloads (title, description, file_url, tenant_id, category, access) |

### Reports & File Downloads
- Reports are stored in `directory_reports` table with a `file_url` column
- Files are uploaded to the RAG server at `rag.aheadofmarket.com` and stored on disk at `~/Documents/Corner/files/shared:sourcing/`
- Filename format on disk: `{uuid}-{Original File Name With Spaces}.ext`
- Download URL format: `https://rag.aheadofmarket.com/files/shared:sourcing/{uuid}-{filename}`
- **CRITICAL:** Filenames on disk have SPACES. URLs must use `encodeURIComponent()` so spaces become `%20`. The RAG server also has a dash-to-space fallback for legacy URLs.
- The download URL builder is in `SourcingReports.jsx` function `getReportDownloadUrl()`
- Report categories: "Quarterly Intelligence", "Economic Development", "Government Affairs", "Acquisitions & Contracts"
- Access levels: "free" (anyone) or "member" (paid members only)
- **The RAG server is in the AOM-EA repo (scripts/rag-server.py), NOT this repo.** Changes to the RAG server require an `aom-internal` project task.

### API Endpoints for Reports (`api/sourcing/`)
| File | Method | What It Does |
|------|--------|-------------|
| `upload-report.js` | POST | Upload a report file to RAG server |
| `download-report.js` | GET | CSV export of directory data (NOT report file download) |
| `admin-reports.js` | POST/DELETE | CRUD for report records in directory_reports table |
| `delete-blank-reports.js` | POST | Clean up empty/placeholder report records |
| `lib/reportAccess.js` | -- | Shared logic for report access control |

### Branding
| Tenant | Accent | Font | Logo |
|--------|--------|------|------|
| Space Rising | `#E5451F` | Oswald | `/images/space-rising/logo-white.png` |
| S3C Arizona | `#A0522D` (updating) | Barlow Condensed | `/images/s3c/logo.png` |

Brand config lives in `TENANT_BRANDS` object in `SourcingLanding.jsx` (lines 19-35).

### Design References
- Tim Struck's Space Rising comp: `mockups/references/SR-Guide-Tim-Struck.jpg`
- Primary redesign reference: `mockups/references/PRIMARY-REFERENCE.jpg`
- Static HTML concepts: `public/v01/` through `public/v07/`

## Membership Model
- Free tier: directory listing, view content, grants access
- Paid tier: post articles/jobs/events/marketplace, analytics, VIP events
- Pricing: $1,000/seat (1-4), $850/seat (5-14), $700/seat (15-49), custom (50+)
- Posting is gated via `MembershipGate` component on all post pages
- Stripe integration: NOT YET BUILT

## Deploy
```bash
cd /Users/aom-inhouse/Documents/Dev/sourcing-directory
vercel --prod
```

## Admin
- Admin panel at `/admin`
- Requires Supabase user with `app_metadata.role = 'admin'` (set via service role key)
- Manages: companies (approve/reject), all content moderation, reports, analytics
- **Ben (super_admin):** `ben@arsenalgpa.com` / `TempPass123!` -- Arsenal Government and Public Affairs, Space Rising tenant. MUST change password.
- Patrik's admin account: `patrik@aom.com` (bootstrapped 2026-04-08, change password after first login)
- To bootstrap a new admin: `SETUP_SECRET=... ADMIN_PASSWORD=... BASE_URL=https://sourcing.directory ./scripts/create-admin.sh`
- Or promote existing user directly: `api/sourcing/admin-setup` POST with `x-setup-secret` header

## What Works (verified 2026-04-08)
- Signup flow: 3-step wizard (industry > company info > account)
- Article posting: submit > pending > admin approves/rejects
- Membership gate: free users see upsell prompt on post pages
- Reports: pulls from `directory_reports` table (8 seeded, falls back to placeholders if empty)
- Admin: dropdown nav on mobile, all 11 tabs accessible
- Email: welcome + reset emails send via Resend, all links point to sourcing.directory

## What's NOT Built Yet
- Stripe payment integration (checkout page exists but no processor)
- Per-seat pricing backend (pricing tiers display but don't enforce)
- Grants data (seed migration failed, 0 grants)
- Storage bucket for report file uploads
- Auto-select company for logged-in users on post forms
- S3C branding (logo + style guide)

## Design References
- Tim Struck's Space Rising comp: `mockups/references/SR-Guide-Tim-Struck.jpg` and `~/Downloads/SR-Guide.jpg`
- Ben's membership doc: `~/Downloads/Space Rising Collective [Membership_Consortium] (1).docx`
- Primary redesign reference: `mockups/references/PRIMARY-REFERENCE.jpg`
