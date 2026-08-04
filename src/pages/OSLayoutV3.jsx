import React, { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAdmin } from '../hooks/useAdmin.js'
import { getViewerContext } from '../lib/profileWrite.js'
import { supabase } from '../lib/supabase'
import './OSLayoutV3.css'

// Tim's 23 delivered icons — one consistent family across the entire shell.
// Sidebar: white PNGs, opacity-treated (0.75 inactive, 1 active).
// Topbar: same white PNGs, filter: brightness(0) inverts to dark for the light topbar.
const TIM_NAV = {
  home:          'base',          // headquarters / home base
  directory:     'industry',      // sector/industry listings
  ecosystem:     'outreach',      // ecosystem connections
  blueprint:     'arizona',       // the Arizona Space Action Blueprint
  intelligence:  'intelligence',  // exact match
  opportunities: 'economic-dev',  // exact match
  careers:       'workforce-dev', // exact match
  marketplace:   'commercial',    // exact match
  community:     'partnership',   // exact match
  learning:      'academia',      // exact match
  library:       'reports',       // saved documents / report library
}
// Admin nav only — hidden in production (isAdmin always false); line SVGs are fine here
const S = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' }
const ADMIN_ICON = {
  requests: <svg {...S}><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/></svg>,
  uploads: <svg {...S}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></svg>,
  settings: <svg {...S}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L16.5 3h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L5.6 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z"/></svg>,
}
const PRIMARY_NAV = [
  { to: '/', key: 'home', label: 'Home', end: true },
  { to: '/directory', key: 'directory', label: 'Directory' },
  { to: '/ecosystem', key: 'ecosystem', label: 'Ecosystem' },
  { to: '/blueprint', key: 'blueprint', label: 'Blueprint' },
  { to: '/intelligence', key: 'intelligence', label: 'Intelligence' },
  { to: '/opportunities', key: 'opportunities', label: 'Opportunities' },
  { to: '/careers', key: 'careers', label: 'Careers' },
  { to: '/marketplace', key: 'marketplace', label: 'Marketplace' },
  { to: '/community', key: 'community', label: 'Community' },
  { to: '/learning', key: 'learning', label: 'Learning' },
  { to: '/library', key: 'library', label: 'My Library' },
]
// One entry, not three: /admin-tools opens on the stats dashboard (Patrik
// 2026-07-29, "stats should be the first tab admins see") and the legacy
// management panel is linked from its header. The old three-item list pointed
// at /admin/requests and /admin/uploads — routes that were never registered.
const ADMIN_NAV = [
  { to: '/admin-tools', key: 'settings', label: 'Admin Tools' },
]

// Avatar-menu icons. Same stroke family as ADMIN_ICON, sized for a menu row.
const M = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' }
const MENU_ICON = {
  view: <svg {...M}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/></svg>,
  edit: <svg {...M}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>,
  admin: <svg {...M}><path d="M12 3l7 3v5c0 4.4-3 8.2-7 9.5C8 19.2 5 15.4 5 11V6z"/></svg>,
  signout: <svg {...M}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>,
  signin: <svg {...M}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>,
  signup: <svg {...M}><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.3 3.1-5.5 7-5.5 1.2 0 2.3.2 3.3.6"/><path d="M19 8v6M16 11h6"/></svg>,
}

// MY SPACEOS — the member area. Word-only rows (no icons), which is exactly how
// the design separates "your stuff" from the ecosystem nav above it.
// `badge` names the counter key; a count of 0 renders NO badge rather than a
// grey zero, and nothing here invents a number it does not have.
const MY_SPACEOS_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/profile', label: 'Profile' },
  { to: '/connections', label: 'Connections' },
  { to: '/saved', label: 'Saved' },
  { to: '/messages', label: 'Messages', badge: 'messages' },
  { to: '/notifications', label: 'Notifications', badge: 'notifications' },
]

const OSLayoutV3 = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isAdmin } = useAdmin()
  const [personSlug, setPersonSlug] = useState(null)
  const [userName, setUserName] = useState('')
  const [userInitials, setUserInitials] = useState('?')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showTopbarMenu, setShowTopbarMenu] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  // Sidebar counters. Start at zero and stay at zero until something real
  // feeds them — a hardcoded "1" next to Messages is a lie the whole shell
  // then tells on every page.
  const [navCounts] = useState({ messages: 0, notifications: 0 })

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

  // The signed-in user's own person profile, if one exists. "View profile" in
  // the avatar menus goes straight to /people/<slug> when it does — the page a
  // member actually shows other people — and to /profile (the get-started
  // screen) when it does not.
  useEffect(() => {
    let cancelled = false
    if (!user) { setPersonSlug(null); return undefined }
    getViewerContext().then(({ data }) => {
      if (!cancelled) setPersonSlug(data?.personSlug || null)
    })
    return () => { cancelled = true }
  }, [user])

  // Close whichever avatar menu is open on outside click or Escape. Without
  // this, an opened menu sat there until the user happened to click the chip
  // again — half of what made the old dropdown feel broken.
  const chipRef = useRef(null)
  const topbarRef = useRef(null)
  useEffect(() => {
    const onPress = (e) => {
      if (chipRef.current && !chipRef.current.contains(e.target)) setShowUserMenu(false)
      if (topbarRef.current && !topbarRef.current.contains(e.target)) setShowTopbarMenu(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { setShowUserMenu(false); setShowTopbarMenu(false); setNavOpen(false) }
    }
    document.addEventListener('mousedown', onPress)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPress)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

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
      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture
      if (avatarUrl) {
        return (
          <img
            src={avatarUrl}
            alt={userName}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
          />
        )
      }
      /* Elite monogram fallback: bold initials in Roboto */
      return (
        <span style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: '13px',
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '0.05em',
          lineHeight: 1,
          userSelect: 'none',
        }}>
          {userInitials}
        </span>
      )
    }
    /* Guest: clean person icon */
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(255,255,255,0.85)' }}>
        <circle cx="12" cy="8" r="3.5" fill="currentColor" />
        <path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" fill="currentColor" fillOpacity="0.55" />
      </svg>
    )
  }

  // ONE menu, rendered from both avatars. The signed-in menu is the profile's
  // front door (view, edit, admin for admins, sign out); the guest menu is the
  // way in. `extraClass` picks direction + surface: the sidebar chip opens
  // UPWARD on the navy surface, the topbar opens downward on the light one.
  const renderUserMenu = (close, extraClass) => {
    const go = (to) => { close(); navigate(to) }
    return (
      <div className={`osv3-user-menu ${extraClass}`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        {user ? (
          <>
            <div className="osv3-user-menu-head">
              <div className="osv3-user-menu-name">{userName}</div>
              <div className="osv3-user-menu-email">{user.email}</div>
            </div>
            <div className="osv3-user-menu-sep"></div>
            <button className="osv3-user-menu-item" onClick={() => go(personSlug ? `/people/${personSlug}` : '/profile')}>
              {MENU_ICON.view} View profile
            </button>
            <button className="osv3-user-menu-item" onClick={() => go('/profile/edit')}>
              {MENU_ICON.edit} Edit profile
            </button>
            {isAdmin && (
              <button className="osv3-user-menu-item" onClick={() => go('/admin-tools')}>
                {MENU_ICON.admin} Admin Tools
              </button>
            )}
            <div className="osv3-user-menu-sep"></div>
            <button className="osv3-user-menu-item osv3-user-menu-item--quiet" onClick={() => { close(); handleSignOut() }}>
              {MENU_ICON.signout} Sign out
            </button>
          </>
        ) : (
          <>
            <div className="osv3-user-menu-head">
              <div className="osv3-user-menu-name">You're browsing as a guest</div>
              <div className="osv3-user-menu-email">Sign in to publish your profile</div>
            </div>
            <div className="osv3-user-menu-sep"></div>
            <button className="osv3-user-menu-item" onClick={() => go('/login')}>
              {MENU_ICON.signin} Sign in
            </button>
            <button className="osv3-user-menu-item" onClick={() => go('/signup')}>
              {MENU_ICON.signup} Create account
            </button>
          </>
        )}
      </div>
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
          {/* Logo exits the OS to the Space Rising marketing home (Tim redline 2026-07-14) */}
          <a href="https://spacerising.org/" aria-label="Space Rising home" style={{ display: 'inline-flex' }}>
            <img src="/v2-assets/logos/space-rising-logo-white.png" alt="Space Rising" className="osv3-sidebar-logo-img" />
          </a>
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
              <img src={`/v2-assets/tim-icons/${TIM_NAV[item.key]}.png`} alt="" className="osv3-nav-tim-icon" />
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
                  <span className="osv3-nav-icon">{ADMIN_ICON[item.key]}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </>
        )}

        {/* MY SPACEOS — the member area */}
        <div className="osv3-group-header">My SpaceOS</div>
        <nav className="osv3-nav-section osv3-subnav-section">
          {MY_SPACEOS_NAV.map((item) => {
            const count = item.badge ? navCounts[item.badge] : 0
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setNavOpen(false)}
                className={({ isActive }) => `osv3-subnav-item ${isActive ? 'osv3-subnav-item-active' : ''}`}
              >
                <span className="osv3-subnav-label">{item.label}</span>
                {count > 0 && <span className="osv3-nav-badge">{count}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* Add Profile — carries the margin-bottom:auto the promo card used to
            own. That single declaration is what pushes the user chip to the
            bottom of the sidebar; drop it and the chip floats up mid-column. */}
        <button
          type="button"
          className="osv3-add-profile"
          onClick={() => { setNavOpen(false); navigate('/add-profile') }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          Add Profile
        </button>

        {/* User Chip */}
        <div className="osv3-user-chip" ref={chipRef} onClick={() => setShowUserMenu(!showUserMenu)}>
          <div className={`osv3-avatar ${!user ? 'osv3-avatar-guest' : ''}`}>
            {renderAvatar()}
          </div>
          <div className="osv3-user-name">{user ? userName : 'Sign in'}</div>
          <span className={`osv3-chevron ${showUserMenu ? 'osv3-chevron--open' : ''}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </span>

          {showUserMenu && renderUserMenu(() => setShowUserMenu(false), 'osv3-user-menu--up')}
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
            <img src="/v2-assets/tim-icons/search.png" alt="" className="osv3-search-tim-icon" />
            <input
              className="osv3-search-input"
              type="text"
              placeholder="Search the ecosystem, companies, people, reports, and more…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <div className="osv3-topbar-actions">
            {/* Dead icon buttons removed — "outreach.png" and "communication.png" had no onClick;
                a dead button is worse than no button. Avatar sits cleanly at right. */}
            <div
              className={`osv3-topbar-avatar ${!user ? 'osv3-avatar-guest' : ''}`}
              ref={topbarRef}
              onClick={() => setShowTopbarMenu(!showTopbarMenu)}
              onKeyDown={e => e.key === 'Enter' && setShowTopbarMenu(!showTopbarMenu)}
              role="button"
              tabIndex={0}
              aria-label={user ? `Account menu for ${userName}` : 'Sign in'}
              style={{ cursor: 'pointer', position: 'relative' }}
            >
              {renderAvatar()}
              {showTopbarMenu && renderUserMenu(() => setShowTopbarMenu(false), 'osv3-user-menu--down osv3-user-menu--light')}
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
