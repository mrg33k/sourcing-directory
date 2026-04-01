import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens, ThemeToggle, useTenant } from './SourcingTheme.jsx';

// ─── Auth state hook for nav ─────────────────────────────────────────────────
function useAuthUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription?.unsubscribe();
  }, []);
  return user;
}

// ─── Vertical / filter config ─────────────────────────────────────────────────
const VERTICALS = [
  { key: 'all',           label: 'All Industries',   color: '#9ca3af' },
  { key: 'semiconductor', label: 'Semiconductor',     color: '#29B6F6' },
  { key: 'space',         label: 'Space & Aerospace', color: '#7C3AED' },
  { key: 'biotech',       label: 'Biotech',           color: '#22C55E' },
  { key: 'defense',       label: 'Defense',           color: '#EF4444' },
];

const CONDITIONS = [
  { key: 'all',          label: 'All Conditions' },
  { key: 'new',          label: 'New' },
  { key: 'used',         label: 'Used' },
  { key: 'refurbished',  label: 'Refurbished' },
];

const PRICE_RANGES = [
  { key: 'all',    label: 'Any Price',     min: null,   max: null },
  { key: 'under5', label: 'Under $5k',     min: null,   max: 5000 },
  { key: '5-25',   label: '$5k – $25k',    min: 5000,   max: 25000 },
  { key: '25-100', label: '$25k – $100k',  min: 25000,  max: 100000 },
  { key: 'over100',label: 'Over $100k',    min: 100000, max: null },
];

const CONDITION_COLORS = {
  new:          { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.4)',   text: '#86EFAC' },
  used:         { bg: 'rgba(138,132,124,0.1)', border: 'rgba(138,132,124,0.4)', text: '#8A847C' },
  refurbished:  { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.4)',  text: '#93C5FD' },
};

// ─── Sourcing Nav ─────────────────────────────────────────────────────────────
// tenantSlug: scope links to tenant. tenantName: display name. features: which tabs to show.
// brandColor: accent override from tenant. All optional for backward compat.
export function SourcingNav({ active, tenantSlug, tenantName, features, brandColor }) {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const accent = brandColor || V.accent;
  const authUser = useAuthUser();

  const base = tenantSlug ? `/${tenantSlug}` : '/';
  const f = features || { jobs: true, marketplace: true, events: true, articles: true, signup: true };

  const allTabs = [
    { key: 'directory',   label: 'Directory',    href: base,                   show: true },
    { key: 'marketplace', label: 'Marketplace',  href: `${base}/marketplace`,  show: f.marketplace !== false },
    { key: 'jobs',        label: 'Jobs',         href: `${base}/jobs`,         show: f.jobs !== false },
    { key: 'settings',    label: 'Settings',     href: `${base}/settings`,     show: !!authUser && !!tenantSlug },
    { key: 'events',      label: 'Events',       href: `${base}/events`,       show: f.events !== false },
    { key: 'articles',    label: 'Articles',     href: `${base}/articles`,     show: f.articles !== false },
    { key: 'grants',      label: 'Grants',       href: `${base}/grants`,       show: f.grants !== false },
    { key: 'portal',      label: 'My Portal',    href: `${base}/portal`,       show: !!authUser },
    { key: 'about',       label: 'About',        href: '/about',      show: true },
  ];
  const tabs = allTabs.filter(t => t.show);

  const displayName = tenantName || 'Sourcing Directory';

  return (
    <div style={{
      borderBottom: `1px solid ${V.border}`,
      background: V.navBg,
    }}>
      <style>{`.sourcing-nav-tabs::-webkit-scrollbar { display: none; }`}</style>
      {/* Top bar */}
      <div style={{
        padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 16, height: 56,
        borderBottom: `1px solid ${V.border}`,
      }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontSize: 13, fontWeight: 800, fontFamily: V.syne,
            color: accent, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            AOM
          </span>
        </Link>
        <span style={{ color: V.dim, fontSize: 13 }}>/</span>
        <Link to="/" style={{ textDecoration: 'none', fontSize: 13, color: V.muted, fontFamily: V.space }}>
          Sourcing
        </Link>
        {tenantSlug && (
          <>
            <span style={{ color: V.dim, fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: V.text, fontFamily: V.space }}>{displayName}</span>
          </>
        )}
        <div style={{ flex: 1 }} />
        <ThemeToggle />
        {!authUser && tenantSlug && (
          <Link
            to={`${base}/login`}
            style={{
              background: 'transparent', color: V.muted, textDecoration: 'none',
              border: `1px solid ${V.border}`, borderRadius: 6, padding: '6px 14px',
              fontSize: 12, fontWeight: 600, fontFamily: V.space,
            }}
          >
            Login
          </Link>
        )}
        {f.signup !== false && (
          <Link
            to={`${base}/signup`}
            style={{
              background: accent, color: '#fff', textDecoration: 'none',
              borderRadius: 6, padding: '6px 14px', fontSize: 12,
              fontWeight: 700, fontFamily: V.space,
            }}
          >
            List Your Company
          </Link>
        )}
      </div>
      {/* Section tabs */}
      <div style={{
        padding: '0 24px',
        display: 'flex', gap: 0,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
        className="sourcing-nav-tabs"
      >
        {tabs.map(tab => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              to={tab.href}
              style={{
                textDecoration: 'none',
                padding: '12px 18px',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                fontFamily: V.space,
                color: isActive ? accent : V.muted,
                borderBottom: isActive ? `2px solid ${accent}` : '2px solid transparent',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Condition Badge ──────────────────────────────────────────────────────────
function ConditionBadge({ condition, V }) {
  if (!condition) return null;
  const c = CONDITION_COLORS[condition] || CONDITION_COLORS.used;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: 10, fontWeight: 700, fontFamily: V.mono,
      padding: '2px 7px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {condition}
    </span>
  );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────
function ListingCard({ listing, company, onClick, V }) {
  const [hovered, setHovered] = useState(false);
  const photos = Array.isArray(listing.photo_urls) ? listing.photo_urls : [];
  const hasPhoto = photos.length > 0 || listing.image_url;
  const photoSrc = photos[0] || listing.image_url;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? V.cardHov : V.card,
        border: `1px solid ${hovered ? V.borderHov : V.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: hovered ? `0 0 0 1px ${V.accent}20` : 'none',
      }}
    >
      {/* Photo */}
      <div style={{
        width: '100%', height: 160,
        background: hasPhoto ? 'transparent' : V.card2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
      }}>
        {hasPhoto ? (
          <img
            src={photoSrc}
            alt={listing.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ fontSize: 40, opacity: 0.3 }}>⚙️</div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          fontSize: 15, fontWeight: 700, fontFamily: V.syne,
          color: V.text, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {listing.title}
        </div>

        {listing.description && (
          <div style={{
            fontSize: 12, color: V.muted, fontFamily: V.space, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {listing.description}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <ConditionBadge condition={listing.condition} V={V} />
          {listing.price && (
            <span style={{ fontSize: 16, fontWeight: 800, color: V.accent, fontFamily: V.mono }}>
              ${listing.price >= 1000 ? `${(listing.price / 1000).toFixed(listing.price % 1000 === 0 ? 0 : 1)}k` : listing.price.toLocaleString()}
            </span>
          )}
        </div>

        {company && (
          <div style={{ fontSize: 11, color: V.dim, fontFamily: V.space }}>
            {company.name} · {[company.city, company.state].filter(Boolean).join(', ')}
          </div>
        )}

        <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
          {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

// ─── Listing Detail Modal ─────────────────────────────────────────────────────
function ListingModal({ listing, company, onClose, V }) {
  const photos = Array.isArray(listing.photo_urls) ? listing.photo_urls : [];
  const hasPhoto = photos.length > 0 || listing.image_url;
  const photoSrc = photos[0] || listing.image_url;

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: V.card, border: `1px solid ${V.border}`,
          borderRadius: 12, maxWidth: 640, width: '100%',
          maxHeight: '85vh', overflow: 'auto',
        }}
      >
        {hasPhoto && (
          <div style={{ width: '100%', height: 240, overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
            <img src={photoSrc} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: V.syne, color: V.text, margin: 0, lineHeight: 1.2 }}>
              {listing.title}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: V.muted, cursor: 'pointer', fontSize: 20, flexShrink: 0, padding: 0 }}>
              ×
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <ConditionBadge condition={listing.condition} V={V} />
            {listing.price && (
              <span style={{ fontSize: 22, fontWeight: 800, color: V.accent, fontFamily: V.mono }}>
                ${listing.price.toLocaleString()}
              </span>
            )}
          </div>

          {listing.description && (
            <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, lineHeight: 1.7, margin: '0 0 20px' }}>
              {listing.description}
            </p>
          )}

          {company && (
            <div style={{
              background: V.card2, border: `1px solid ${V.border}`,
              borderRadius: 8, padding: '14px 16px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>
                Seller
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 2 }}>
                {company.name}
              </div>
              <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space }}>
                {[company.city, company.state].filter(Boolean).join(', ')}
              </div>
              {company.website && (
                <a href={company.website} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: V.blue, fontFamily: V.space, textDecoration: 'none', display: 'block', marginTop: 4 }}>
                  {company.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          )}

          {listing.contact_email && (
            <a
              href={`mailto:${listing.contact_email}?subject=Inquiry: ${encodeURIComponent(listing.title)}`}
              style={{
                display: 'block', width: '100%', boxSizing: 'border-box',
                background: V.accent, color: '#fff', textDecoration: 'none',
                borderRadius: 8, padding: '12px', fontSize: 14,
                fontWeight: 700, fontFamily: V.space, textAlign: 'center',
              }}
            >
              Contact Seller
            </a>
          )}

          <div style={{ marginTop: 12, fontSize: 11, color: V.dim, fontFamily: V.mono, textAlign: 'center' }}>
            Posted {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inner component (uses theme) ─────────────────────────────────────────────
function SourcingMarketplaceInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { tenant, tenantSlug, loading: tenantLoading } = useTenant();

  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [vertical, setVertical] = useState('all');
  const [condition, setCondition] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [category, setCategory] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchListings = useCallback(async (q, v, cond, price, pMin, pMax, cat) => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    try {
      let qb = supabase
        .from('directory_listings')
        .select('*')
        .eq('category', 'equipment')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
      if (v && v !== 'all') qb = qb.eq('vertical', v);
      if (cond && cond !== 'all') qb = qb.eq('condition', cond);
      if (cat && cat.trim()) qb = qb.ilike('item_category', `%${cat.trim()}%`);

      // Custom min/max overrides preset buttons when set
      const useCustomPrice = pMin !== '' || pMax !== '';
      if (useCustomPrice) {
        if (pMin !== '' && !isNaN(Number(pMin))) qb = qb.gte('price', Number(pMin));
        if (pMax !== '' && !isNaN(Number(pMax))) qb = qb.lte('price', Number(pMax));
      } else {
        const pr = PRICE_RANGES.find(r => r.key === price);
        if (pr) {
          if (pr.min !== null) qb = qb.gte('price', pr.min);
          if (pr.max !== null) qb = qb.lte('price', pr.max);
        }
      }

      if (q && q.trim()) {
        qb = qb.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
      }

      const { data, error } = await qb.limit(100);
      if (error) throw error;
      setListings(data || []);

      if (data && data.length > 0) {
        const companyIds = [...new Set(data.map(l => l.company_id))];
        const { data: compData } = await supabase
          .from('directory_companies')
          .select('*')
          .in('id', companyIds);
        const map = {};
        (compData || []).forEach(c => { map[c.id] = c; });
        setCompanies(map);
      } else {
        setCompanies({});
      }
    } catch (err) {
      console.error('Marketplace fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (tenantSlug && tenantLoading) return;
    fetchListings(query, vertical, condition, priceRange, priceMin, priceMax, category);
  }, [query, vertical, condition, priceRange, priceMin, priceMax, category, fetchListings, tenantLoading, tenantSlug]);

  const handleSearch = () => setQuery(searchInput.trim());
  const handleCategorySearch = () => setCategory(categoryInput.trim());

  const activeFilterCount = [
    vertical !== 'all',
    condition !== 'all',
    priceRange !== 'all' || priceMin !== '' || priceMax !== '',
    category !== '',
  ].filter(Boolean).length;

  const inputStyle = {
    background: V.card2, border: `1px solid ${V.border}`,
    color: V.text, borderRadius: 6, padding: '7px 10px',
    fontSize: 12, fontFamily: V.space, outline: 'none', width: '100%',
  };

  return (
    <div style={{ minHeight: '100vh', background: V.bg, color: V.text }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        * { box-sizing: border-box; }
        a { color: inherit; }
        input::placeholder { color: ${V.dim}; }
        input:focus { border-color: ${V.accent} !important; box-shadow: 0 0 0 2px ${V.accentDim}; }
        select { appearance: none; -webkit-appearance: none; }
        select:focus { border-color: ${V.accent} !important; box-shadow: 0 0 0 2px ${V.accentDim}; outline: none; }
        @media (min-width: 640px) { .mkt-filters-panel { display: flex !important; } .mkt-filters-toggle { display: none !important; } }
      `}</style>

      <SourcingNav active="marketplace" tenantSlug={tenantSlug} tenantName={tenant?.nav_label || tenant?.name} features={tenant?.features} brandColor={tenant?.brand_color} />

      {/* Hero */}
      <div style={{ padding: '40px 24px 28px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.accent,
          letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10,
        }}>
          Equipment Marketplace
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, fontFamily: V.syne, color: V.heading, margin: '0 0 6px', lineHeight: 1.15 }}>
              Equipment, Parts & Materials
            </h1>
            <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, margin: 0 }}>
              Industrial equipment and parts from verified Arizona companies.
            </p>
          </div>
          <Link
            to={`${tenantSlug ? `/${tenantSlug}` : '/'}/marketplace/post`}
            style={{
              background: V.accent, color: '#fff', textDecoration: 'none',
              borderRadius: 7, padding: '9px 18px', fontSize: 13,
              fontWeight: 700, fontFamily: V.space, whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            + Post a Listing
          </Link>
        </div>

        {/* Search row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search equipment, parts, materials..."
              style={{
                width: '100%',
                background: V.card2, border: `1px solid ${V.border}`,
                color: V.text, borderRadius: 8, padding: '10px 42px 10px 14px',
                fontSize: 14, fontFamily: V.space, outline: 'none',
              }}
            />
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: V.muted }}>
              {loading
                ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${V.dim}`, borderTop: `2px solid ${V.accent}`, animation: 'spin 0.8s linear infinite' }} />
                : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              }
            </div>
          </div>
          <button onClick={handleSearch} style={{
            background: V.accent, border: 'none', color: '#fff',
            borderRadius: 8, padding: '0 18px', fontSize: 13,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Search
          </button>
          {/* Mobile filters toggle */}
          <button
            className="mkt-filters-toggle"
            onClick={() => setFiltersOpen(o => !o)}
            style={{
              background: activeFilterCount > 0 ? V.accentDim : V.card2,
              border: `1px solid ${activeFilterCount > 0 ? V.accentBrd : V.border}`,
              color: activeFilterCount > 0 ? V.accent : V.muted,
              borderRadius: 8, padding: '0 14px', fontSize: 13,
              fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            <span style={{ fontSize: 10 }}>{filtersOpen ? '▲' : '▼'}</span>
          </button>
        </div>

        {/* Filter panel */}
        <div
          className="mkt-filters-panel"
          style={{
            display: filtersOpen ? 'flex' : 'none',
            flexDirection: 'column', gap: 12,
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, padding: '16px 18px', marginBottom: 16,
          }}
        >
          {/* Row 1: Vertical */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Industry</span>
            {VERTICALS.map(v => (
              <button key={v.key} onClick={() => setVertical(v.key)} style={{
                background: vertical === v.key ? `${v.color}20` : 'transparent',
                border: `1px solid ${vertical === v.key ? v.color : V.border}`,
                color: vertical === v.key ? v.color : V.muted,
                borderRadius: 6, padding: '5px 11px', fontSize: 12,
                fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}>
                {v.label}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: V.border }} />

          {/* Row 2: Condition */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Condition</span>
            {CONDITIONS.map(c => (
              <button key={c.key} onClick={() => setCondition(c.key)} style={{
                background: condition === c.key ? V.accentDim : 'transparent',
                border: `1px solid ${condition === c.key ? V.accentBrd : V.border}`,
                color: condition === c.key ? V.accent : V.muted,
                borderRadius: 6, padding: '5px 11px', fontSize: 12,
                fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}>
                {c.label}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: V.border }} />

          {/* Row 3: Price + Category */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Price preset buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Price</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {PRICE_RANGES.map(r => (
                  <button key={r.key} onClick={() => { setPriceRange(r.key); setPriceMin(''); setPriceMax(''); }} style={{
                    background: priceRange === r.key && priceMin === '' && priceMax === '' ? V.accentDim : 'transparent',
                    border: `1px solid ${priceRange === r.key && priceMin === '' && priceMax === '' ? V.accentBrd : V.border}`,
                    color: priceRange === r.key && priceMin === '' && priceMax === '' ? V.accent : V.muted,
                    borderRadius: 6, padding: '5px 11px', fontSize: 12,
                    fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom price min/max */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Custom Range ($)</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="number"
                  value={priceMin}
                  onChange={e => { setPriceMin(e.target.value); setPriceRange('all'); }}
                  placeholder="Min"
                  style={{ ...inputStyle, width: 90 }}
                />
                <span style={{ color: V.dim, fontSize: 12, fontFamily: V.mono, flexShrink: 0 }}>–</span>
                <input
                  type="number"
                  value={priceMax}
                  onChange={e => { setPriceMax(e.target.value); setPriceRange('all'); }}
                  placeholder="Max"
                  style={{ ...inputStyle, width: 90 }}
                />
              </div>
            </div>

            {/* Category/type search */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Category</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="text"
                  value={categoryInput}
                  onChange={e => setCategoryInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCategorySearch()}
                  placeholder="e.g. semiconductor, pump..."
                  style={{ ...inputStyle, minWidth: 160 }}
                />
                <button onClick={handleCategorySearch} style={{
                  background: category ? V.accentDim : 'transparent',
                  border: `1px solid ${category ? V.accentBrd : V.border}`,
                  color: category ? V.accent : V.muted,
                  borderRadius: 6, padding: '5px 10px', fontSize: 11,
                  fontWeight: 700, fontFamily: V.mono, cursor: 'pointer', flexShrink: 0,
                }}>Go</button>
                {category && (
                  <button onClick={() => { setCategoryInput(''); setCategory(''); }} style={{
                    background: 'transparent', border: `1px solid ${V.border}`,
                    color: V.muted, borderRadius: 6, padding: '5px 8px', fontSize: 11,
                    fontFamily: V.mono, cursor: 'pointer', flexShrink: 0,
                  }}>×</button>
                )}
              </div>
            </div>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button onClick={() => {
                setVertical('all'); setCondition('all'); setPriceRange('all');
                setPriceMin(''); setPriceMax(''); setCategoryInput(''); setCategory('');
              }} style={{
                background: 'transparent', border: `1px solid ${V.border}`,
                color: V.muted, borderRadius: 6, padding: '5px 11px', fontSize: 12,
                fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: '0 24px 60px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
            {loading ? 'Loading...' : (
              <>
                <span style={{ color: V.text, fontWeight: 600 }}>{listings.length}</span>
                {' '}listing{listings.length !== 1 ? 's' : ''}
                {query && <> for <span style={{ color: V.accent }}>"{query}"</span></>}
              </>
            )}
          </div>
        </div>

        {!supabase && (
          <div style={{ background: V.accentDim, border: `1px solid ${V.accentBrd}`, borderRadius: 8, padding: '20px 24px', textAlign: 'center' }}>
            <div style={{ color: V.accent, fontFamily: V.mono, fontSize: 13, marginBottom: 8 }}>Supabase not configured</div>
            <div style={{ color: V.muted, fontFamily: V.space, fontSize: 12 }}>Run migration 001 + 002 in Supabase SQL editor to activate.</div>
          </div>
        )}

        {loading && supabase && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, height: 320, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {!loading && listings.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {listings.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                company={companies[listing.company_id]}
                onClick={() => setSelected(listing)}
                V={V}
              />
            ))}
          </div>
        )}

        {!loading && supabase && listings.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 12,
          }}>
            <svg width="56" height="56" fill="none" stroke={V.dim} strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16, opacity: 0.5 }}>
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 8 }}>
              No equipment listed
            </div>
            <div style={{ fontSize: 14, color: V.muted, fontFamily: V.space, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
              {query ? `No results for "${query}". Try different filters or keywords.` : 'No equipment listed yet. Buy, sell, and trade industry equipment here.'}
            </div>
            <Link
              to={`${tenantSlug ? `/${tenantSlug}` : '/'}/marketplace/post`}
              style={{
                background: V.accent, color: '#fff', textDecoration: 'none',
                borderRadius: 7, padding: '10px 20px', fontSize: 13,
                fontWeight: 700, fontFamily: V.space, display: 'inline-block',
              }}
            >
              List Equipment
            </Link>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <ListingModal
          listing={selected}
          company={companies[selected.company_id]}
          onClose={() => setSelected(null)}
          V={V}
        />
      )}
    </div>
  );
}

// ─── Main export (wrapped with theme provider) ────────────────────────────────
export default function SourcingMarketplace() {
  return (
    <SourcingThemeProvider>
      <SourcingMarketplaceInner />
    </SourcingThemeProvider>
  );
}
