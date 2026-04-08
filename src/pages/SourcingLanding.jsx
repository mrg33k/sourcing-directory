import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider } from './SourcingTheme.jsx';
import { SourcingNav } from './SourcingMarketplace.jsx';

// ─── Industry background images ──────────────────────────────────────────────
const VERTICAL_IMAGES = {
  semiconductor: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80',
  space:         'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=800&q=80',
  default:       'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80',
};
function getVerticalImage(vertical) {
  return VERTICAL_IMAGES[vertical] || VERTICAL_IMAGES.default;
}

const TENANT_THEMES = {
  'space-rising': 'space',
  's3c-semiconductor': 'semi',
};
const PRIORITY_SLUGS = ['space-rising', 's3c-semiconductor'];

// ─── Inner component ──────────────────────────────────────────────────────────
function SourcingLandingInner() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = 'sourcing.directory | Find Your Supply Chain Partner';
  }, []);

  useEffect(() => {
    async function loadTenants() {
      try {
        try {
          const res = await fetch('/api/sourcing/tenants');
          if (res.ok) {
            const data = await res.json();
            const prio = (t) => { const i = PRIORITY_SLUGS.indexOf(t.slug); return i >= 0 ? i : 999; };
            setTenants([...data].sort((a, b) =>
              prio(a) - prio(b) || (a.sort_order ?? 99) - (b.sort_order ?? 99) || (a.name || '').localeCompare(b.name || '')
            ));
            setLoading(false);
            return;
          }
        } catch { /* fall through */ }
        if (supabase) {
          const { data: tenantRows } = await supabase
            .from('directory_tenants').select('*').eq('status', 'active')
            .order('sort_order', { ascending: true, nullsFirst: false });
          const results = [];
          for (const t of (tenantRows || [])) {
            const { count } = await supabase
              .from('directory_companies').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id);
            results.push({ ...t, company_count: count || 0 });
          }
          setTenants(results);
        }
      } catch (err) { console.error('Failed to load tenants:', err); }
      finally { setLoading(false); }
    }
    loadTenants();
  }, []);

  // Fuzzy match: find the best tenant for this query, or search all
  function doSearch() {
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim().toLowerCase();

    // Keywords that map to specific tenants
    const TENANT_KEYWORDS = {
      'space-rising': ['space', 'aerospace', 'rocket', 'satellite', 'launch', 'orbit', 'nasa', 'defense', 'missile', 'payload', 'leo', 'meo'],
      's3c-semiconductor': ['semi', 'semiconductor', 'chip', 'wafer', 'fab', 'conductor', 'silicon', 'intel', 'tsmc', 'microchip', 'circuit', 'electronics', 'foundry'],
    };

    // Check if query matches a tenant's keywords
    let bestTenant = null;
    for (const tenant of tenants) {
      const keywords = TENANT_KEYWORDS[tenant.slug] || [];
      const tenantName = (tenant.name || '').toLowerCase();
      const tenantVertical = (tenant.vertical || '').toLowerCase();
      if (
        tenantName.includes(q) ||
        tenantVertical.includes(q) ||
        keywords.some(kw => q.includes(kw) || kw.includes(q))
      ) {
        bestTenant = tenant;
        break;
      }
    }

    // If no keyword match, search across ALL tenants (no tenant filter)
    const target = bestTenant || tenants[0];
    if (target) navigate(`/${target.slug}?q=${encodeURIComponent(searchQuery)}`);
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Hero -- uses .home-hero from v10.css */}
      <div className="home-hero">
        <div className="home-hero-content">
          <div className="home-badge">
            <div className="home-badge-dot" />
            Arizona Advanced Industries
          </div>
          <div className="home-title">Find your <em>supply chain</em> partner</div>
          <div className="home-sub">Verified suppliers, certified companies, and industry events in one place.</div>
        </div>
      </div>

      {/* Search */}
      <div className="home-search">
        <input
          className="home-search-input"
          type="text"
          placeholder="Search companies, industries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
        />
        <button className="home-search-btn" onClick={doSearch}>
          <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </button>
      </div>

      {/* Section header */}
      <div className="sec-hdr">
        <div className="sec-title">Directories</div>
        <div className="sec-count">{loading ? '' : `${tenants.length} directories`}</div>
      </div>

      {/* Directory cards */}
      <div className="dir-cards">
        {loading ? (
          [1, 2].map(i => (
            <div key={i} className="dir-card">
              <div className="skel" style={{ minHeight: 200, width: '100%' }} />
            </div>
          ))
        ) : tenants.length > 0 ? (
          tenants.map(tenant => {
            const cls = TENANT_THEMES[tenant.slug] || 'semi';
            return (
              <Link key={tenant.id} to={`/${tenant.slug}`} className={`dir-card ${cls}`}>
                <div className="dir-card-bg" />
                <div className="dir-card-overlay" />
                <div className="dir-card-body">
                  <div className="dir-card-tag">{tenant.vertical || tenant.slug}</div>
                  <div className="dir-card-name">{tenant.nav_label || tenant.name}</div>
                  <div className="dir-card-desc">
                    {(tenant.hero_text || tenant.description || '').substring(0, 100)}
                    {(tenant.hero_text || tenant.description || '').length > 100 ? '...' : ''}
                  </div>
                  <div className="dir-card-foot">
                    <div className="dir-card-count">
                      <div className="dir-card-count-num">{tenant.company_count || '--'}</div>
                      <div className="dir-card-count-label">companies</div>
                    </div>
                    <div className="dir-card-arrow">
                      <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="empty-state">
            <svg width="32" height="32" fill="none" stroke="var(--tx3)" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            <div style={{ fontSize: 14, color: 'var(--tx3)' }}>No directories yet</div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <SourcingNav active="home" />
    </div>
  );
}

// ─── Exports ─────────────────────────────────────────────────────────────────
export { VERTICAL_IMAGES, getVerticalImage };

export default function SourcingLanding() {
  return (
    <SourcingThemeProvider>
      <SourcingLandingInner />
    </SourcingThemeProvider>
  );
}
