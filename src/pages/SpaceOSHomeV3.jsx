import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import './SpaceOSHomeV3.css'

const SpaceOSHomeV3 = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tenant, setTenant] = useState(null)
  const [reports, setReports] = useState([])
  const [events, setEvents] = useState([])
  const [jobs, setJobs] = useState([])
  const [funding, setFunding] = useState([])
  const [loading, setLoading] = useState(true)

  // Resolve tenant
  useEffect(() => {
    const resolveTenant = async () => {
      const { data } = await supabase
        .from('directory_tenants')
        .select('*')
        .eq('slug', 'space-rising')
        .single()

      if (data) {
        setTenant(data)
      }
    }

    resolveTenant()
  }, [])

  // Load data
  useEffect(() => {
    if (!tenant) return

    const loadData = async () => {
      setLoading(true)

      // Reports (global, not tenant-scoped; featured + latest)
      const { data: reportsData } = await supabase
        .from('directory_reports')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(10)

      // Events (tenant-scoped, active, UPCOMING only, soonest first)
      const todayISO = new Date().toISOString().slice(0, 10)
      const { data: eventsData } = await supabase
        .from('directory_listings')
        .select('*, company:company_id(id, name, logo_url)')
        .eq('category', 'event')
        .eq('status', 'active')
        .eq('tenant_id', tenant.id)
        .gte('event_date', todayISO)
        .order('event_date', { ascending: true })
        .limit(6)

      // Jobs (tenant-scoped, active, newest first)
      const { data: jobsData } = await supabase
        .from('directory_listings')
        .select('*, company:company_id(id, name, logo_url)')
        .eq('category', 'job')
        .eq('status', 'active')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(6)

      // Essential data is in — render immediately. The dashboard must never block
      // on a slow/dead external call.
      setReports(reportsData || [])
      setEvents(eventsData || [])
      setJobs(jobsData || [])
      setLoading(false)

      // Funding (external AOM API) — non-blocking, with a hard timeout. If it is
      // slow or down, the column simply stays empty (real-data-or-hidden).
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 6000)
        const res = await fetch('https://www.aheadofmarket.com/api/deal-bank/completed', { signal: ctrl.signal })
        clearTimeout(timer)
        const fundingData = await res.json()
        setFunding(fundingData.rounds?.slice(0, 6) || [])
      } catch (err) {
        console.error('Funding fetch failed (non-blocking):', err)
        setFunding([])
      }
    }

    loadData()
  }, [tenant])

  // Featured = the 2026 Arizona Space Blueprint. FREE to read — the goal right now is
  // capturing users, not charging (Tim redline 2026-07-14; Patrik unpaywalled the
  // Blueprint 2026-07-09). CTA reads "Read the Blueprint" and opens the real report.
  const blueprintRow = reports.find(r => /blueprint/i.test(r.title || '')) || null
  const featuredReport = {
    title: '2026 Arizona Space Blueprint',
    eyebrow: 'Space Rising / Flagship Report',
    description: 'The strategic plan for Arizona\'s space economy — market trends, investment insight, and the opportunities shaping the future of space. Free to read.',
    cover: '/v2-assets/blueprint-cover.png',
    membersOnly: false,
    reportId: blueprintRow?.id || null,
    file_url: blueprintRow?.file_url || null,
  }
  const latestReports = reports.slice(0, 4)
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  const missions = [
    { title: 'Ecosystem', color: '#8B5CF6', exploreHref: '/ecosystem', links: [
      { label: 'Companies', href: '/directory', real: true },
      { label: 'Organizations', href: '#', real: false },
      { label: 'People', href: '#', real: false },
    ]},
    { title: 'Intelligence', color: '#3B82F6', exploreHref: '/intelligence', links: [
      { label: 'Reports', href: '/reports', real: true },
      { label: 'Articles', href: '/articles', real: true },
      { label: 'Discovery', href: '/discovery', real: true },
      { label: 'News', href: '#', real: false },
      { label: 'Podcasts', href: '/podcasts', real: true },
      { label: 'Videos', href: '#', real: false },
    ]},
    { title: 'Opportunities', color: '#F97316', exploreHref: '/opportunities', links: [
      { label: 'RFPs', href: '#', real: false, future: true },
      { label: 'Grants', href: '/grants', real: true },
      { label: 'Dealbank', href: '/deal-bank', real: true },
    ]},
    { title: 'Careers', color: '#FBBF24', exploreHref: '/careers', links: [
      { label: 'Jobs', href: '/careers', real: true },
      { label: 'Internships', href: '#', real: false },
    ]},
    { title: 'Marketplace', color: '#14B8A6', exploreHref: '/marketplace', links: [
      { label: 'Equipment', href: '/marketplace', real: true },
      { label: 'Services', href: '/marketplace', real: true },
      { label: 'Products', href: '/marketplace', real: true },
    ]},
    { title: 'Community', color: '#EC4899', exploreHref: '/community', links: [
      { label: 'Events', href: '/community', real: true },
      { label: 'Forums', href: '#', real: false, future: true },
    ]},
    { title: 'Learning', color: '#06B6D4', exploreHref: '/learning', links: [
      { label: 'Coursera for Space', href: '/learning', real: true, future: true },
    ]},
    { title: 'My Library', color: '#6366F1', exploreHref: '/library', links: [
      { label: 'Saved Items', href: '/library', real: true },
      { label: 'Follows', href: '/library', real: true },
    ]},
  ]

  // Mission icons = Tim's 23 delivered icons. All 8 cards now in one family.
  // Mapping mirrors the sidebar TIM_NAV in OSLayoutV3: same section = same Tim icon.
  const TIM_ICON = {
    'Ecosystem':  'outreach',
    'Intelligence': 'intelligence',
    'Opportunities': 'economic-dev',
    'Careers':    'workforce-dev',
    'Marketplace': 'commercial',
    'Community':  'partnership',
    'Learning':   'academia',
    'My Library': 'reports',  // saved documents/report library → reports
  }
  const renderMissionIcon = (title) => {
    const file = TIM_ICON[title]
    if (file) {
      return <img src={`/v2-assets/tim-icons/${file}.png`} alt="" className="osv3-mission-tim-icon" />
    }
    return null
  }

  if (loading) {
    return <div className="osv3-home">Loading...</div>
  }

  return (
    <div className="osv3-home">
      <div className="osv3-home-wrapper">
        {/* Welcome Section */}
        <section className="osv3-welcome-section">
          <h1 className="osv3-welcome-header">
            {user ? `Welcome back, ${userName}` : 'Welcome to Space OS'}
          </h1>
          <p className="osv3-welcome-subheader">Here's what's happening in your space ecosystem.</p>
        </section>

        {/* Mission Cards */}
        <section>
          <div className="osv3-eyebrow-section">
            <div className="osv3-eyebrow">Explore by Mission</div>
            <a className="osv3-view-all-link" href="#/missions">View all missions →</a>
          </div>

          <div className="osv3-mission-grid">
            {missions.map((mission) => (
              <div key={mission.title} className="osv3-mission-card">
                <div className="osv3-mission-card-icon" style={{ backgroundColor: mission.color }}>
                  {renderMissionIcon(mission.title)}
                </div>
                <h3 className="osv3-mission-card-title">{mission.title}</h3>
                <div className="osv3-mission-card-links">
                  {mission.links.map((link) => (
                    <div key={link.label}>
                      {link.real ? (
                        <a href={link.href} className="osv3-mission-card-link">
                          {link.label}
                          {link.future && <span className="osv3-future-tag">Future</span>}
                        </a>
                      ) : (
                        <span className={`osv3-mission-card-link ${!link.real ? 'osv3-mission-card-link-muted' : ''}`}>
                          {link.label}
                          {link.future && <span className="osv3-future-tag">Future</span>}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <a href={mission.exploreHref} className="osv3-mission-card-footer-link">
                  Explore {mission.title} →
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Report (compact, left) + Latest Reports (right) — one row, per reference */}
        {(featuredReport || latestReports.length > 0) && (
          <section className="osv3-reports-section">
            {featuredReport && (
              <div className="osv3-featured-col">
                <h2 className="osv3-section-heading">Featured Report</h2>
                <div
                  className="osv3-featured-report-card"
                  onClick={() => {
                    if (featuredReport.membersOnly) { navigate('/membership'); return }
                    if (featuredReport.reportId) { navigate(`/reports/${featuredReport.reportId}`); return }
                    if (featuredReport.file_url) { window.open(featuredReport.file_url, '_blank'); return }
                    navigate('/reports')
                  }}
                >
                  {featuredReport.cover && (
                    <div
                      className="osv3-featured-cover"
                      style={{ backgroundImage: `url(${featuredReport.cover})` }}
                    ></div>
                  )}
                  <div className="osv3-featured-report-content">
                    <div className="osv3-featured-report-eyebrow">{featuredReport.eyebrow || featuredReport.category}</div>
                    <h3 className="osv3-featured-report-title">{featuredReport.title}</h3>
                    <p className="osv3-featured-report-desc">
                      {featuredReport.description || 'Insights and research on Arizona\'s space economy.'}
                    </p>
                    <button className="osv3-featured-report-btn" type="button">
                      {featuredReport.membersOnly ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8, verticalAlign: '-2px' }}>
                            <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                          </svg>
                          Unlock with Membership
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8, verticalAlign: '-2px' }}>
                            <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H9a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H2z"/><path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H15a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h7z"/>
                          </svg>
                          Read the Blueprint
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {latestReports.length > 0 && (
              <div className="osv3-latest-col">
                <div className="osv3-section-heading-row">
                  <h2 className="osv3-section-heading">Latest Reports</h2>
                  <a className="osv3-column-header-action" href="/reports">View all</a>
                </div>
                <div className="osv3-reports-scroll">
                  {latestReports.map((report) => (
                    <a
                      key={report.id}
                      href={report.id ? `/reports/${report.id}` : '/reports'}
                      className="osv3-report-card"
                    >
                      <div className="osv3-report-image">
                        <div className="osv3-report-image-eyebrow">SPACE RISING / REPORT</div>
                        <div className="osv3-report-image-title">{report.title}</div>
                      </div>
                      <div className="osv3-report-card-body">
                        <div className="osv3-report-card-meta">
                          {report.published_at ? new Date(report.published_at).toLocaleDateString() : 'Recent'}
                        </div>
                        <svg className="osv3-report-bookmark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z"/></svg>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Bottom Columns */}
        <section style={{ marginTop: '48px' }}>
          <div className="osv3-bottom-columns">
            {/* Upcoming Events */}
            {events.length > 0 && (
              <div className="osv3-column">
                <div className="osv3-column-header">
                  <span>Upcoming Events</span>
                  <a className="osv3-column-header-action" href="/community">View all</a>
                </div>
                {events.map((event) => {
                  const eventDate = event.event_date ? new Date(event.event_date) : null
                  const monthAbbrev = eventDate ? eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : 'TBA'
                  const day = eventDate ? eventDate.getDate() : ''
                  return (
                    <div key={event.id} className="osv3-list-item">
                      <div className="osv3-event-date-chip">
                        <div className="osv3-event-date-month">{monthAbbrev}</div>
                        <div className="osv3-event-date-day">{day}</div>
                      </div>
                      <div>
                        <div className="osv3-list-item-title">{event.title}</div>
                        <div className="osv3-list-item-meta">
                          <span>{event.event_location || 'TBA'}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Recent Funding */}
            {funding.length > 0 && (
              <div className="osv3-column">
                <div className="osv3-column-header">
                  <span>Recent Funding Rounds</span>
                  <a className="osv3-column-header-action" href="/deal-bank">View all</a>
                </div>
                {funding.map((round, idx) => (
                  <div key={idx} className="osv3-list-item">
                    <div className="osv3-list-item-title">{round.company}</div>
                    <div className="osv3-list-item-meta">
                      <span>${round.amount_usd_m}M</span>
                      <span>{round.round}</span>
                      <span>{round.date ? new Date(round.date).toLocaleDateString() : 'recently'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Jobs */}
            {jobs.length > 0 && (
              <div className="osv3-column">
                <div className="osv3-column-header">
                  <span>Jobs</span>
                  <a className="osv3-column-header-action" href="/careers">View all</a>
                </div>
                {jobs.map((job) => (
                  <div key={job.id} className="osv3-list-item">
                    <div className="osv3-list-item-title">{job.title}</div>
                    <div className="osv3-list-item-meta">
                      <span>{job.company?.name || 'Company'}</span>
                      <span>{job.location || 'Remote'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Spacer */}
        <div style={{ height: '48px' }}></div>
      </div>
    </div>
  )
}

export default SpaceOSHomeV3
