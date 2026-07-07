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

      // Funding (from AOM external API)
      try {
        const res = await fetch('https://www.aheadofmarket.com/api/deal-bank/completed')
        const fundingData = await res.json()
        setFunding(fundingData.rounds?.slice(0, 6) || [])
      } catch (err) {
        console.error('Funding fetch failed:', err)
        setFunding([])
      }

      setReports(reportsData || [])
      setEvents(eventsData || [])
      setJobs(jobsData || [])
      setLoading(false)
    }

    loadData()
  }, [tenant])

  // Featured = the 2026 Arizona Space Blueprint. It is a PAID product: the cover is
  // public marketing, but the high-res PDF sits behind the paywall — "View Report"
  // sends non-members to membership, never the file. (Tim, 2026-07-07.)
  const featuredReport = {
    title: '2026 Arizona Space Blueprint',
    eyebrow: 'Space Rising / Flagship Report',
    description: 'The strategic plan for Arizona\'s space economy — market trends, investment insight, and the opportunities shaping the future of space. Members only.',
    cover: '/v2-assets/blueprint-cover.png',
    membersOnly: true,
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
      { label: 'Podcasts', href: '#', real: false },
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

  // SVG icon renderers by mission title
  const renderMissionIcon = (title) => {
    const svgProps = { width: '32', height: '32', viewBox: '0 0 32 32', fill: 'none', stroke: 'white', strokeWidth: '1.5' }
    switch(title) {
      case 'Ecosystem':
        return <svg {...svgProps}><rect x="4" y="8" width="6" height="10" rx="0.5"/><rect x="13" y="6" width="6" height="12" rx="0.5"/><rect x="22" y="10" width="6" height="8" rx="0.5"/><line x1="7" y1="20" x2="25" y2="20"/></svg>
      case 'Intelligence':
        return <svg {...svgProps}><circle cx="16" cy="11" r="5"/><path d="M10 22c0-3.314 2.686-6 6-6s6 2.686 6 6"/><path d="M8 16h16"/></svg>
      case 'Opportunities':
        return <svg {...svgProps}><path d="M16 4l3.536 7.071h7.778l-6.293 4.572 2.404 7.714L16 22.785l-6.425 4.572 2.404-7.714-6.293-4.572h7.778L16 4z"/></svg>
      case 'Careers':
        return <svg {...svgProps}><rect x="6" y="10" width="20" height="14" rx="1"/><path d="M10 10V8c0-1.105.895-2 2-2h8c1.105 0 2 .895 2 2v2"/><line x1="6" y1="16" x2="26" y2="16"/></svg>
      case 'Marketplace':
        return <svg {...svgProps}><path d="M6 8l2 12c.2 1.1 1.2 2 2.3 2h12.4c1.1 0 2.1-.9 2.3-2l2-12"/><line x1="10" y1="8" x2="10" y2="4"/><line x1="22" y1="8" x2="22" y2="4"/><path d="M8 8h16"/><circle cx="14" cy="22" r="1.5"/><circle cx="22" cy="22" r="1.5"/></svg>
      case 'Community':
        return <svg {...svgProps}><circle cx="10" cy="9" r="3"/><circle cx="22" cy="9" r="3"/><path d="M4 20c0-3.314 2.686-6 6-6s6 2.686 6 6"/><path d="M16 20c0-3.314 2.686-6 6-6s6 2.686 6 6"/></svg>
      case 'Learning':
        return <svg {...svgProps}><path d="M5 10l11-5 11 5v8c0 4.97-5.04 9-11 9s-11-4.03-11-9v-8z"/><path d="M16 14v6m-3-3h6"/></svg>
      case 'My Library':
        return <svg {...svgProps}><path d="M9 5v22c0 1.105.895 2 2 2h10c1.105 0 2-.895 2-2V5"/><path d="M16 10l2.5 4h-5z"/><line x1="12" y1="20" x2="20" y2="20"/></svg>
      default:
        return null
    }
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
                    if (featuredReport.file_url) { window.open(featuredReport.file_url, '_blank') }
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
                      ) : 'View Report'}
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
