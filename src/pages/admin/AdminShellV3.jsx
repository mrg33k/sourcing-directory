import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import '../OSLayoutV3.css';

// ─── Icon helpers (line-SVGs for utility items — matches OSLayoutV3's ADMIN_ICON style) ─
const S = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICON = {
  tag:          <svg {...S}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  audit:        <svg {...S}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  actions:      <svg {...S}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  settings:     <svg {...S}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L16.5 3h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L5.6 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z"/></svg>,
  siteContent:  <svg {...S}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
};

// ─── Admin nav roster: 5 groups (spec §2.1) ──────────────────────────────────
// Tim PNGs for content-domain items, line-SVGs for utility items.
const ADMIN_NAV = [
  {
    group: 'OVERVIEW',
    items: [
      { key: 'stats',     label: 'Dashboard',      icon: 'tim', src: '/v2-assets/tim-icons/base.png' },
    ],
  },
  {
    group: 'DIRECTORY',
    items: [
      { key: 'companies', label: 'Companies',       icon: 'tim', src: '/v2-assets/tim-icons/industry.png' },
      { key: 'orgs',      label: 'Organizations',   icon: 'tim', src: '/v2-assets/tim-icons/partnership.png' },
    ],
  },
  {
    group: 'CONTENT',
    items: [
      { key: 'listings',  label: 'Listings',        icon: 'tim', src: '/v2-assets/tim-icons/space-mission.png' },
      { key: 'reports',   label: 'Reports',         icon: 'tim', src: '/v2-assets/tim-icons/reports.png' },
      // globalOnly: the deal_bank_* tables are marked globalOnly in
      // api/sourcing/lib/tablePolicy.js. A tenant admin 403s on every read, and
      // DealBankSection swallows that into `.data || []`, so the screen renders three
      // empty lists and buttons that do nothing. See NAV VISIBILITY below.
      { key: 'deal-bank', label: 'Deal Bank',       icon: 'tim', src: '/v2-assets/tim-icons/commercial.png', globalOnly: true },
      { key: 'tags',         label: 'Tags',            icon: 'svg', svg: ICON.tag },
      { key: 'site-content', label: 'Site Content',    icon: 'svg', svg: ICON.siteContent },
    ],
  },
  {
    group: 'PEOPLE',
    items: [
      { key: 'members',   label: 'Member Reviews',  icon: 'tim', src: '/v2-assets/tim-icons/millitary-personel.png' },
      { key: 'articles',  label: 'Content Review',  icon: 'tim', src: '/v2-assets/tim-icons/governance.png' },
      { key: 'messages',  label: 'Messages',        icon: 'tim', src: '/v2-assets/tim-icons/communication.png' },
      { key: 'tickets',   label: 'Tickets',         icon: 'tim', src: '/v2-assets/tim-icons/outreach.png' },
    ],
  },
  {
    group: 'INSIGHTS',
    items: [
      { key: 'analytics', label: 'Analytics',       icon: 'tim', src: '/v2-assets/tim-icons/intelligence.png' },
      { key: 'audit',     label: 'Audit Log',       icon: 'svg', svg: ICON.audit },
    ],
  },
];

// Bottom-anchored SETTINGS group (below the spacer divider)
const SETTINGS_NAV = [
  { key: 'actions',  label: 'Quick Actions', icon: 'svg', svg: ICON.actions },
  { key: 'settings', label: 'Settings',      icon: 'svg', svg: ICON.settings },
];

// ─── AdminShellV3 ─────────────────────────────────────────────────────────────
export default function AdminShellV3({
  children,
  activeTab,
  setActiveTab,
  handleLogout,
  tenants,
  selectedTenantId,
  setSelectedTenantId,
  isGlobalAdmin,
  // False only while SourcingAdmin is still resolving the signed-in admin's scope.
  // Defaults to true so a caller that does not thread it through behaves as before.
  adminScopeResolved = true,
  selectedTenant,
  currentUserEmail,
  // badge counts
  pendingCompanyCount,
  pendingMemberCount,
  pendingContentCount,
  newMessageCount,
  // Add Content modal control
  onAddContent,
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const initials = currentUserEmail
    ? currentUserEmail.split('@')[0].slice(0, 2).toUpperCase()
    : 'AD';

  // Badge map — keyed by tab key
  const badges = {
    companies: pendingCompanyCount || 0,
    members:   pendingMemberCount  || 0,
    articles:  pendingContentCount || 0,
    messages:  newMessageCount     || 0,
    'deal-bank': 0, // deal-bank gets the "attention" treatment but no count
  };

  // ─── NAV VISIBILITY ────────────────────────────────────────────────────────
  // This sidebar IS the navigation the admin clicks — SourcingAdmin's TABS array is
  // dead code that nothing renders, so gating an item there hid nothing. A globalOnly
  // item is offered only to a global admin.
  //
  // The `!adminScopeResolved` term is deliberate. isGlobalAdmin starts false and only
  // becomes meaningful once the tenant/scope load finishes, so filtering on it while it
  // is still unresolved would blink Deal Bank out of a real platform admin's sidebar on
  // every page load. Unresolved means "not known yet", not "no". A tenant admin sees the
  // item for that first moment and, if they click it, lands on the explanation card
  // SourcingAdmin renders — never on a dead screen.
  const canSeeNavItem = (item) => !item.globalOnly || isGlobalAdmin || !adminScopeResolved;

  const visibleNav = ADMIN_NAV
    .map(group => ({ ...group, items: group.items.filter(canSeeNavItem) }))
    .filter(group => group.items.length > 0);
  const visibleSettingsNav = SETTINGS_NAV.filter(canSeeNavItem);

  // Breadcrumb resolves against the FULL roster, not the visible one: a hidden tab can
  // still be the active tab, and the breadcrumb must name where the admin actually is.
  const allItems = [...ADMIN_NAV.flatMap(g => g.items), ...SETTINGS_NAV];
  const activeItem = allItems.find(i => i.key === activeTab);
  const activeGroup = ADMIN_NAV.find(g => g.items.some(i => i.key === activeTab))?.group || 'SETTINGS';

  const renderNavItem = (item) => {
    const isActive = item.key === activeTab;
    const badge = badges[item.key];
    return (
      <button
        key={item.key}
        onClick={() => { setActiveTab(item.key); setNavOpen(false); }}
        className={`osv3-nav-item${isActive ? ' osv3-nav-item-active' : ''}`}
        style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', position: 'relative', cursor: 'pointer' }}
      >
        {item.icon === 'tim' ? (
          <img src={item.src} alt="" className="osv3-nav-tim-icon" />
        ) : (
          <span className="osv3-nav-icon">{item.svg}</span>
        )}
        <span style={{ flex: 1 }}>{item.label}</span>
        {badge > 0 && (
          <span style={{
            background: 'rgba(206,68,33,0.85)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 9,
            minWidth: 18,
            textAlign: 'center',
            lineHeight: '16px',
            flexShrink: 0,
          }}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="osv3 osv3-shell" style={{ minHeight: '100dvh' }}>
      {/* Mobile drawer backdrop */}
      <div
        className={`osv3-nav-overlay ${navOpen ? 'osv3-nav-overlay-open' : ''}`}
        onClick={() => setNavOpen(false)}
      />

      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <aside className={`osv3-sidebar ${navOpen ? 'osv3-sidebar-open' : ''}`}>
        {/* Wordmark */}
        <div className="osv3-sidebar-logo">
          <a href="https://spacerising.org/" aria-label="Space Rising home" style={{ display: 'inline-flex' }}>
            <img src="/v2-assets/logos/space-rising-logo-white.png" alt="Space Rising" className="osv3-sidebar-logo-img" />
          </a>
        </div>

        {/* + Add Content rust primary CTA */}
        <button
          onClick={onAddContent}
          style={{
            display: 'block',
            width: '100%',
            background: '#CE4421',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '10px 14px',
            fontFamily: 'var(--v3-font-family-base)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center',
            marginBottom: 20,
            transition: 'background 150ms ease-out',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#B33A1A'}
          onMouseLeave={e => e.currentTarget.style.background = '#CE4421'}
        >
          + Add Content
        </button>

        {/* Nav groups: OVERVIEW → INSIGHTS */}
        {visibleNav.map((group, gi) => (
          <React.Fragment key={group.group}>
            {gi > 0 && <div className="osv3-sidebar-divider" />}
            <div className="osv3-admin-section-header">{group.group}</div>
            <nav className="osv3-nav-section" style={{ marginBottom: 0 }}>
              {group.items.map(renderNavItem)}
            </nav>
          </React.Fragment>
        ))}

        {/* Spacer pushes SETTINGS to bottom */}
        <div style={{ flex: 1 }} />

        {/* SETTINGS group — bottom-anchored */}
        <div className="osv3-sidebar-divider" style={{ marginTop: 16 }} />
        <div className="osv3-admin-section-header">SETTINGS</div>
        <nav className="osv3-nav-section" style={{ marginBottom: 0 }}>
          {visibleSettingsNav.map(renderNavItem)}
        </nav>

        {/* User chip */}
        <div
          className="osv3-user-chip"
          style={{ marginTop: 12 }}
          onClick={() => setShowUserMenu(v => !v)}
        >
          <div
            className="osv3-avatar"
            style={{ background: 'linear-gradient(135deg, #CE4421, #B33A1A)' }}
          >
            {initials}
          </div>
          <div className="osv3-user-name">{currentUserEmail || 'Admin'}</div>
          <span className="osv3-chevron">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </span>
          {showUserMenu && (
            <div className="osv3-user-menu">
              <button
                className="osv3-user-menu-item"
                onClick={(e) => { e.stopPropagation(); setShowUserMenu(false); handleLogout(); }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTAINER ───────────────────────────────────────── */}
      <div className="osv3-main-container">
        {/* Sticky top bar */}
        <header className="osv3-topbar">
          {/* Hamburger (mobile) */}
          <button
            type="button"
            className="osv3-hamburger"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 13, color: '#6B7280', fontFamily: 'var(--v3-font-family-base)', whiteSpace: 'nowrap' }}>
              {activeGroup}
            </span>
            <span style={{ color: '#D7DEE2', fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#010B13', fontFamily: 'var(--v3-font-family-base)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeItem?.label || 'Dashboard'}
            </span>
          </div>

          {/* Right cluster */}
          <div className="osv3-topbar-actions">
            {/* Tenant switcher */}
            {tenants && tenants.length > 0 && (isGlobalAdmin || tenants.length > 1) && (
              <select
                value={selectedTenantId || ''}
                onChange={e => setSelectedTenantId(e.target.value || null)}
                style={{
                  background: '#FFFFFF',
                  border: `1px solid ${selectedTenantId ? 'rgba(206,68,33,0.35)' : '#D7DEE2'}`,
                  color: selectedTenantId ? '#CE4421' : '#6B7280',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 13,
                  fontFamily: 'var(--v3-font-family-base)',
                  cursor: 'pointer',
                  outline: 'none',
                  maxWidth: 200,
                }}
              >
                {isGlobalAdmin && <option value="">All Directories</option>}
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {/* View live site */}
            {selectedTenant && (
              <Link
                to={`/${selectedTenant.slug}`}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #D7DEE2',
                  color: '#2E2E2E',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'var(--v3-font-family-base)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                View live site ↗
              </Link>
            )}
            {/* Avatar (topbar duplicate) */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #CE4421, #B33A1A)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13,
                color: '#fff',
                flexShrink: 0,
                cursor: 'pointer',
              }}
              onClick={() => setShowUserMenu(v => !v)}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* Scrolling content area */}
        <div className="osv3-content">
          {children}
        </div>
      </div>
    </div>
  );
}
