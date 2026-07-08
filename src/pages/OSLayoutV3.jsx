import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import './OSLayoutV3.css'

// Clean line icons (white stroke) — no emoji in the shell.
const S = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' }
const NAV_ICON = {
  home: <svg {...S}><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>,
  directory: <svg {...S}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>,
  ecosystem: <svg {...S}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>,
  intelligence: <svg {...S}><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>,
  opportunities: <svg {...S}><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>,
  careers: <svg {...S}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>,
  marketplace: <svg {...S}><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>,
  community: <svg {...S}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.5a3 3 0 0 1 0 5.8M21 20c0-2.4-1.4-4.5-3.5-5.5"/></svg>,
  learning: <svg {...S}><path d="M3 9l9-4 9 4-9 4-9-4z"/><path d="M7 11v5c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-5"/></svg>,
  library: <svg {...S}><path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z"/></svg>,
  requests: <svg {...S}><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/></svg>,
  uploads: <svg {...S}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></svg>,
  settings: <svg {...S}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L16.5 3h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L5.6 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z"/></svg>,
}
const PRIMARY_NAV = [
  { to: '/', key: 'home', label: 'Home', end: true },
  { to: '/directory', key: 'directory', label: 'Directory' },
  { to: '/ecosystem', key: 'ecosystem', label: 'Ecosystem' },
  { to: '/intelligence', key: 'intelligence', label: 'Intelligence' },
  { to: '/opportunities', key: 'opportunities', label: 'Opportunities' },
  { to: '/careers', key: 'careers', label: 'Careers' },
  { to: '/marketplace', key: 'marketplace', label: 'Marketplace' },
  { to: '/community', key: 'community', label: 'Community' },
  { to: '/learning', key: 'learning', label: 'Learning' },
  { to: '/library', key: 'library', label: 'My Library' },
]
const ADMIN_NAV = [
  { to: '/admin/requests', key: 'requests', label: 'Data Requests' },
  { to: '/admin/uploads', key: 'uploads', label: 'Uploads' },
  { to: '/admin/settings/space-rising', key: 'settings', label: 'Settings' },
]

const OSLayoutV3 = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [userName, setUserName] = useState('')
  const [userInitials, setUserInitials] = useState('?')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    if (user) {
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      setUserName(fullName)
      const initials = fullName
        .split(' ')
        .slice(0, 2)
        .map(word => word[0].toUpperCase())
        .join('')
      setUserInitials(initials || '?')
    } else {
      setUserInitials('guest')
    }
  }, [user])

  // TODO: Check if user is admin/org member for admin section visibility
  useEffect(() => {
    if (user) {
      setIsAdmin(false) // Placeholder; real check would query directory_orgs or roles
    }
  }, [user])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/directory?q=${encodeURIComponent(searchQuery)}`)
      setSearchQuery('')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setShowUserMenu(false)
    navigate('/')
  }

  const renderAvatar = () => {
    if (user) {
      return userInitials
    }
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: '#6B7280' }}>
        <circle cx="12" cy="8" r="3.5" fill="currentColor" />
        <path d="M4 20c0-3.314 2.686-6 6-6s6 2.686 6 6v0" fill="currentColor" fillOpacity="0.6" />
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
    )
  }

  return (
    <div className="osv3 osv3-shell">
      {/* Mobile drawer backdrop */}
      <div
        className={`osv3-nav-overlay ${navOpen ? 'osv3-nav-overlay-open' : ''}`}
        onClick={() => setNavOpen(false)}
      ></div>

      {/* SIDEBAR */}
      <aside className={`osv3-sidebar ${navOpen ? 'osv3-sidebar-open' : ''}`}>
        <div className="osv3-sidebar-logo">
          <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="osv3-sidebar-logo-img" />
        </div>

        {/* Primary Nav */}
        <nav className="osv3-nav-section">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
            >
              <span className="osv3-nav-icon">{NAV_ICON[item.key]}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="osv3-sidebar-divider"></div>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="osv3-admin-section-header">Admin</div>
            <nav className="osv3-nav-section">
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setNavOpen(false)}
                  className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
                >
                  <span className="osv3-nav-icon">{NAV_ICON[item.key]}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </>
        )}

        {/* Promo Card */}
        <div className="osv3-promo-card">
          <div className="osv3-promo-card-title">Organization Membership</div>
          <div>Claim your organization and contribute to the ecosystem.</div>
          <div className="osv3-promo-card-btn" onClick={() => navigate('/membership')}>
            Learn More →
          </div>
        </div>

        {/* User Chip */}
        <div className="osv3-user-chip" onClick={() => setShowUserMenu(!showUserMenu)}>
          <div className={`osv3-avatar ${!user ? 'osv3-avatar-guest' : ''}`}>
            {renderAvatar()}
          </div>
          <div className="osv3-user-name">{user ? userName : 'Sign in'}</div>
          <span className="osv3-chevron">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </span>

          {showUserMenu && user && (
            <div className="osv3-user-menu">
              <button onClick={handleSignOut} className="osv3-user-menu-item">
                Sign Out
              </button>
            </div>
          )}

          {showUserMenu && !user && (
            <div className="osv3-user-menu">
              <button onClick={() => navigate('/login')} className="osv3-user-menu-item">
                Sign In
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="osv3-main-container">
        {/* TOPBAR */}
        <header className="osv3-topbar">
          <button
            type="button"
            className="osv3-hamburger"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>

          <form onSubmit={handleSearch} className="osv3-search-container">
            <input
              className="osv3-search-input"
              type="text"
              placeholder="Search the ecosystem, companies, people, reports, and more…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <div className="osv3-topbar-actions">
            <div className="osv3-icon-btn" aria-label="Notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
              <div className="osv3-notification-badge"></div>
            </div>
            <div className="osv3-icon-btn" aria-label="Messages">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div className={`osv3-topbar-avatar ${!user ? 'osv3-avatar-guest' : ''}`}>
              {renderAvatar()}
            </div>
          </div>
        </header>

        {/* CONTENT OUTLET */}
        <div className="osv3-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default OSLayoutV3
