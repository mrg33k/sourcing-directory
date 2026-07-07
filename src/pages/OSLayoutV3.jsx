import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import './OSLayoutV3.css'

const OSLayoutV3 = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [userName, setUserName] = useState('')
  const [userInitials, setUserInitials] = useState('?')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)

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
      {/* SIDEBAR */}
      <aside className="osv3-sidebar">
        <div className="osv3-sidebar-logo">
          SPACE<br/>RISING
        </div>

        {/* Primary Nav */}
        <nav className="osv3-nav-section">
          <NavLink
            to="/"
            className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
          >
            <div className="osv3-nav-icon">🏠</div>
            Home
          </NavLink>
          <NavLink
            to="/directory"
            className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
          >
            <div className="osv3-nav-icon">📋</div>
            Directory
          </NavLink>
          <NavLink
            to="/ecosystem"
            className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
          >
            <div className="osv3-nav-icon">🌐</div>
            Ecosystem
          </NavLink>
          <NavLink
            to="/intelligence"
            className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
          >
            <div className="osv3-nav-icon">🧠</div>
            Intelligence
          </NavLink>
          <NavLink
            to="/opportunities"
            className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
          >
            <div className="osv3-nav-icon">⭐</div>
            Opportunities
          </NavLink>
          <NavLink
            to="/careers"
            className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
          >
            <div className="osv3-nav-icon">💼</div>
            Careers
          </NavLink>
          <NavLink
            to="/marketplace"
            className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
          >
            <div className="osv3-nav-icon">🛍️</div>
            Marketplace
          </NavLink>
          <NavLink
            to="/community"
            className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
          >
            <div className="osv3-nav-icon">👥</div>
            Community
          </NavLink>
          <NavLink
            to="/learning"
            className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
          >
            <div className="osv3-nav-icon">📚</div>
            Learning
          </NavLink>
          <NavLink
            to="/library"
            className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
          >
            <div className="osv3-nav-icon">❤️</div>
            My Library
          </NavLink>
        </nav>

        <div className="osv3-sidebar-divider"></div>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="osv3-admin-section-header">Admin</div>
            <nav className="osv3-nav-section">
              <NavLink
                to="/admin/requests"
                className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
              >
                <div className="osv3-nav-icon">📄</div>
                Data Requests
              </NavLink>
              <NavLink
                to="/admin/uploads"
                className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
              >
                <div className="osv3-nav-icon">⬆️</div>
                Uploads
              </NavLink>
              <NavLink
                to="/admin/settings/space-rising"
                className={({ isActive }) => `osv3-nav-item ${isActive ? 'osv3-nav-item-active' : ''}`}
              >
                <div className="osv3-nav-icon">⚙️</div>
                Settings
              </NavLink>
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
          <div className="osv3-chevron">⌄</div>

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
            <div className="osv3-icon-btn">
              🔔
              <div className="osv3-notification-badge"></div>
            </div>
            <div className="osv3-icon-btn">💬</div>
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
