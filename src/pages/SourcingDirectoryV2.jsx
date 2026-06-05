import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingNav } from './SourcingMarketplace.jsx';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import { V2ChipNav } from './V2ChipNav.jsx';
import { trackEvent } from './sourcingAnalytics.js';
import { getVerticalImage } from './SourcingLanding.jsx';
import '../space-rising-theme-v2.css';

// V2 (nat-geo-uplift) — same component, scoped to the cloned theme. URL slug
// "space-rising-v2" drives the data-tenant attribute (so the V2 theme matches)
// but tenant DB lookups + tenant-API hits still resolve against the real
// "space-rising" row in directory_tenants.
const TENANT_DB_LOOKUP_SLUG = 'space-rising';

// ─── Scout Answer Card (streaming AI response) ───────────────────────────────
function ScoutAnswerCard({ text, streaming, V }) {
  if (!text && !streaming) return null;
  return (
    <div style={{
      background: 'rgba(16,185,129,0.07)',
      border: `1px solid rgba(16,185,129,0.3)`,
      borderRadius: 10,
      padding: '14px 18px',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: text ? 10 : 0 }}>
        <div style={{
          background: 'rgba(16,185,129,0.15)',
          border: '1px solid rgba(16,185,129,0.35)',
          borderRadius: 5, padding: '3px 8px',
          fontSize: 10, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
          color: '#10b981', letterSpacing: '0.1em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Scout · AI Answer
        </div>
        {streaming && (
          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(16,185,129,0.3)', borderTop: '2px solid #10b981', animation: 'spin 0.8s linear infinite' }} />
        )}
      </div>
      {text && (
        <div style={{ fontSize: 13, color: V.text, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {text}
          {streaming && <span style={{ display: 'inline-block', width: 2, height: 14, background: '#10b981', marginLeft: 2, verticalAlign: 'middle', animation: 'pulse 1s ease-in-out infinite' }} />}
        </div>
      )}
    </div>
  );
}

// ─── Vertical config ──────────────────────────────────────────────────────────
const VERTICALS = [
  { key: 'all',           label: 'All Industries',  color: '#9ca3af' },
  { key: 'semiconductor', label: 'Semiconductor',    color: '#29B6F6' },
  { key: 'space',         label: 'Space & Aerospace',color: '#7C3AED' },
];

const VERTICAL_CERTS = {
  semiconductor: ['ISO 9001', 'ISO 14001', 'ISO 45001', 'ITAR Registered', 'AS9100D', 'ANSI/ESD S20.20', 'AEC-Q100', 'IPC-7711/7721'],
  space:         ['AS9100D', 'AS9120B', 'ITAR Registered', 'ISO 9001', 'MIL-STD-810', 'NADCAP', 'FAA FAR Part 145', 'DoD Secret Cleared'],
};

// AZ city → county mapping (mirrors api/filter-options/counties.js)
const CITY_TO_COUNTY = {
  'Phoenix': 'Maricopa', 'Chandler': 'Maricopa', 'Tempe': 'Maricopa',
  'Mesa': 'Maricopa', 'Scottsdale': 'Maricopa', 'Gilbert': 'Maricopa',
  'Glendale': 'Maricopa', 'Peoria': 'Maricopa', 'Surprise': 'Maricopa',
  'Avondale': 'Maricopa', 'Goodyear': 'Maricopa', 'Buckeye': 'Maricopa',
  'Queen Creek': 'Maricopa', 'Tolleson': 'Maricopa', 'El Mirage': 'Maricopa',
  'Sun City': 'Maricopa', 'Youngtown': 'Maricopa',
  'Tucson': 'Pima', 'Sahuarita': 'Pima', 'Marana': 'Pima', 'Oro Valley': 'Pima',
  'South Tucson': 'Pima',
  'Casa Grande': 'Pinal', 'Coolidge': 'Pinal', 'Florence': 'Pinal',
  'Prescott': 'Yavapai', 'Prescott Valley': 'Yavapai', 'Cottonwood': 'Yavapai',
  'Flagstaff': 'Coconino', 'Sedona': 'Coconino',
  'Kingman': 'Mohave', 'Bullhead City': 'Mohave', 'Lake Havasu City': 'Mohave',
  'Yuma': 'Yuma', 'Sierra Vista': 'Cochise', 'Douglas': 'Cochise',
  'Nogales': 'Santa Cruz',
};

// Industry subsector → keywords to match against company name + description
const SUBSECTOR_KEYWORDS = {
  'Avionics & Flight Controls': ['avionics', 'flight control', 'flight controls', 'guidance', 'navigation'],
  'Defense Systems': ['defense', 'missile', 'weapons', 'precision', 'itar', 'c4isr', 'military', 'tactical'],
  'High-Altitude & Stratospheric': ['stratospheric', 'high-altitude', 'balloon', 'near space', 'airship'],
  'Life Support & Thermal': ['life support', 'thermal control', 'environmental control', 'crewed spacecraft'],
  'Satellite Systems': ['satellite', 'cubesat', 'smallsat', 'orbital', 'james webb'],
  'Space Communications': ['space communication', 'space communications', 'sensor', 'sensors', 'space electronics'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function verticalColor(v) {
  return VERTICALS.find(x => x.key === v)?.color || '#9ca3af';
}

function VerticalBadge({ vertical, V }) {
  const color = verticalColor(vertical);
  const label = VERTICALS.find(x => x.key === vertical)?.label || vertical;
  return (
    <span style={{
      background: `${color}18`,
      border: `1px solid ${color}50`,
      color,
      fontSize: 10, fontWeight: 700, fontFamily: V.mono,
      padding: '2px 7px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function TierBadge({ tier, V }) {
  const colors = {
    enterprise: { bg: `${V.accent}18`, border: V.accent, text: V.accent },
    pro:        { bg: 'rgba(59,130,246,0.12)', border: '#3B82F6', text: '#93C5FD' },
    basic:      { bg: 'rgba(34,197,94,0.12)', border: '#22C55E', text: '#86EFAC' },
    free:       { bg: 'rgba(138,132,124,0.1)', border: '#8A847C', text: '#8A847C' },
  };
  const c = colors[tier] || colors.free;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: 10, fontWeight: 700, fontFamily: V.mono,
      padding: '2px 7px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {tier}
    </span>
  );
}

function CertPill({ name, V }) {
  return (
    <span style={{
      background: V.accentDim,
      border: `1px solid ${V.accentBrd}`,
      color: V.muted, fontSize: 11, fontFamily: V.mono,
      padding: '2px 8px', borderRadius: 4,
    }}>
      {name}
    </span>
  );
}

// ─── Company Card (v10 co-card list style) ──────────────────────────────────
const LOGO_PALETTES = [
  { bg: '#0D1428', fg: '#60A5FA' }, { bg: '#1E1145', fg: '#A78BFA' },
  { bg: '#0d2818', fg: '#34D399' }, { bg: '#2D0A0A', fg: '#FB7185' },
  { bg: '#062028', fg: '#38BDF8' }, { bg: '#2D1B06', fg: '#FBBF24' },
];
function logoPalette(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return LOGO_PALETTES[h % LOGO_PALETTES.length];
}

function CompanyCard({ company, certs, V, tenantSlug, isFavorite, onToggleFavorite, reviewStat }) {
  const topCerts = (certs || []).slice(0, 3);
  const pal = logoPalette(company.name);
  const isGovCompany = company.source === 'arsenal' || company.source === 'government';

  return (
    <Link
      to={tenantSlug ? `/${tenantSlug}/${company.slug}` : `/${company.slug}`}
      className="co-card"
    >
      {/* Logo */}
      <div className="co-logo" style={{ background: pal.bg, color: pal.fg }}>
        {company.logo_url
          ? <img src={company.logo_url} alt="" style={{ width: 44, height: 44, borderRadius: 'var(--r-sm)', objectFit: 'contain' }} />
          : company.name.charAt(0)
        }
      </div>
      {/* Body */}
      <div className="co-body">
        {/* R4c (nat-geo-uplift): small monogram logo above the name. White-on-dark
            variant generated by scripts/fetch-company-logos.py — graceful fallback if missing. */}
        <img
          className="co-mono-logo"
          src={`/v2-assets/logos/${company.slug}-white.png`}
          alt=""
          aria-hidden="true"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="co-name" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          {company.name}
          {isGovCompany && (
            <span style={{
              background: '#1e40af',
              color: 'white',
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              marginLeft: 6,
            }}>
              Gov
            </span>
          )}
          <span style={{
            backgroundColor: '#e0e7ff',
            color: '#4338ca',
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '4px',
            marginLeft: '6px',
          }}>
            {company.grants?.length || 0}
          </span>
        </div>
        <div className="co-loc">{[company.city, company.state].filter(Boolean).join(', ')}</div>
        {(company.featured || topCerts.length > 0) && (
          <div className="co-badges">
            {company.featured && <span className="co-badge feat">Featured</span>}
            {topCerts.map(c => <span key={c.id} className="co-badge cert">{c.cert_name}</span>)}
            {certs.length > 3 && <span className="co-badge cert">+{certs.length - 3}</span>}
          </div>
        )}
      </div>
      {/* Arrow */}
      <div className="co-arrow">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </Link>
  );
}

// ─── AI Summary Card ──────────────────────────────────────────────────────────
function AiSummaryCard({ aiResult, onSuggestionClick, V }) {
  if (!aiResult) return null;
  const { summary, filters_applied, suggestion } = aiResult;

  const filterChips = [];
  if (filters_applied.vertical) {
    const vInfo = VERTICALS.find(v => v.key === filters_applied.vertical);
    if (vInfo) filterChips.push({ label: vInfo.label, color: vInfo.color });
  }
  if (filters_applied.employee_range) {
    filterChips.push({ label: `${filters_applied.employee_range} employees`, color: V.blue });
  }
  if (filters_applied.certifications && filters_applied.certifications.length > 0) {
    filters_applied.certifications.forEach(c => {
      filterChips.push({ label: c, color: '#f59e0b' });
    });
  }
  if (filters_applied.location) {
    filterChips.push({ label: filters_applied.location, color: '#a78bfa' });
  }

  return (
    <div style={{
      background: 'rgba(16,185,129,0.07)',
      border: `1px solid rgba(16,185,129,0.3)`,
      borderRadius: 10,
      padding: '14px 18px',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          background: 'rgba(16,185,129,0.15)',
          border: '1px solid rgba(16,185,129,0.35)',
          borderRadius: 5,
          padding: '3px 8px',
          fontSize: 10, fontWeight: 800, fontFamily: V.mono,
          color: '#10b981', letterSpacing: '0.1em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Scout · AI Search
        </div>
        <div style={{
          marginLeft: 'auto',
          fontSize: 9, fontWeight: 700, fontFamily: V.mono,
          color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          powered by <span style={{ color: '#f97316', fontWeight: 800 }}>CORNER</span>
        </div>
        <div style={{ fontSize: 13, color: V.text, fontFamily: V.space, lineHeight: 1.4 }}>
          {summary}
        </div>
      </div>

      {filterChips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: suggestion ? 8 : 0 }}>
          <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, alignSelf: 'center' }}>Filters:</span>
          {filterChips.map((chip, i) => (
            <span key={i} style={{
              background: `${chip.color}15`,
              border: `1px solid ${chip.color}40`,
              color: chip.color,
              fontSize: 11, fontFamily: V.mono, fontWeight: 600,
              padding: '2px 7px', borderRadius: 4,
            }}>
              {chip.label}
            </span>
          ))}
        </div>
      )}

      {suggestion && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
          <span style={{ fontSize: 12, color: V.dim, fontFamily: V.space }}>
            {suggestion.startsWith('Try:') ? (
              <>
                Try:{' '}
                <button
                  onClick={() => onSuggestionClick(suggestion.replace(/^Try:\s*[""]?/, '').replace(/[""]$/, ''))}
                  style={{
                    background: 'none', border: 'none', color: '#10b981',
                    fontSize: 12, fontFamily: V.space, cursor: 'pointer',
                    textDecoration: 'underline', padding: 0,
                  }}
                >
                  {suggestion.replace(/^Try:\s*[""]?/, '').replace(/[""]$/, '')}
                </button>
              </>
            ) : suggestion}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────────
// EVERY search goes through Scout. No gate. No trigger words.
function SearchBar({ value, onChange, onSearch, loading, aiLoading, V }) {
  const handleKey = (e) => {
    if (e.key === 'Enter') onSearch();
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder='Search: "space", "ITAR", "Intel", or "ITAR certified companies in Scottsdale"...'
            style={{
              width: '100%', boxSizing: 'border-box',
              background: V.card2,
              border: `1px solid ${value ? 'rgba(16,185,129,0.5)' : V.border}`,
              color: V.text, borderRadius: 8, padding: '12px 46px 12px 16px',
              fontSize: 14, fontFamily: V.space, outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
          <div style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            color: V.muted, pointerEvents: 'none',
          }}>
            {(loading || aiLoading) ? (
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${V.dim}`, borderTop: `2px solid ${V.accent}`, animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            )}
          </div>
        </div>
        <button
          onClick={onSearch}
          style={{
            background: V.accent, border: 'none', color: '#fff',
            borderRadius: 8, padding: '0 20px', fontSize: 14,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Search
        </button>
      </div>
      {value && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, color: '#10b981', fontFamily: V.mono,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Scout is ready — understands any search
        </div>
      )}
    </div>
  );
}

// ─── Inner component ──────────────────────────────────────────────────────────
function SourcingDirectoryInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  // V2 route is static (/space-rising-v2), so useParams() doesn't supply a
  // tenantSlug. Hardcode it so the data-tenant attribute is set, the
  // isSpaceRising branch fires, and the V2 theme CSS scoping matches.
  const tenantSlug = 'space-rising-v2';

  // Tenant state
  const [tenant, setTenant] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(!!tenantSlug);

  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState([]);
  const [certs, setCerts] = useState({});
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [vertical, setVertical] = useState(searchParams.get('v') || 'all');
  const [selectedCerts, setSelectedCerts] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  // For AI search results, we store companies separately so certs are already embedded
  const [aiCompanies, setAiCompanies] = useState(null);
  // Scout agent streaming answer (shown above the grid)
  const [scoutAnswer, setScoutAnswer] = useState('');
  const [scoutStreaming, setScoutStreaming] = useState(false);
  const scoutAbortRef = useRef(null);

  // Favorites (localStorage)
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sourcing_favorites') || '[]'); } catch { return []; }
  });
  const [showSaved, setShowSaved] = useState(false);

  // Map toggle
  const [showMap, setShowMap] = useState(false);

  // County filter
  const [selectedCounties, setSelectedCounties] = useState(() => {
    const c = searchParams.get('county');
    return c ? c.split(',').filter(Boolean) : [];
  });
  const [availableCounties, setAvailableCounties] = useState([]);

  // Industry subsector filter
  const [selectedSubsectors, setSelectedSubsectors] = useState(() => {
    const s = searchParams.get('industry_subsector');
    return s ? s.split(',').filter(Boolean) : [];
  });
  const [availableSubsectors, setAvailableSubsectors] = useState([]);

  // Welcome modal -- shows once per session after 3.5s
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (!tenantSlug) return;
    const key = `sourcing_welcomed_${tenantSlug}`;
    if (sessionStorage.getItem(key)) return;
    const timer = setTimeout(() => {
      setShowWelcome(true);
      sessionStorage.setItem(key, '1');
    }, 3500);
    return () => clearTimeout(timer);
  }, [tenantSlug]);

  // Reviews map: company slug -> { avg, count }
  const [reviewStats, setReviewStats] = useState({});

  // Reports from directory_reports table (tenant-scoped)
  const [reports, setReports] = useState([]);

  // Auth session and admin flag (for report upload UI)
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // Per-report upload tracking
  const [uploadingReportId, setUploadingReportId] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // ─── Tenant brand tokens (Space Rising + S3C) ──────────────────────────────
  const tenantBrand = useMemo(() => {
    if (!tenant) return null;
    if (tenant.slug === 'space-rising') return {
      headingFont: "'Oswald', sans-serif",
      bodyFont: "'Inter', sans-serif",
      accent: '#f44611',
      bg: 'transparent',
      surface: 'rgba(6,10,28,0.72)',
      surface2: 'rgba(6,10,28,0.80)',
      fontImport: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Inter:wght@400;500;600&display=swap',
    };
    if (tenant.slug === 's3c-semiconductor') return {
      headingFont: "'Barlow Condensed', sans-serif",
      bodyFont: "'Inter', sans-serif",
      accent: '#A0522D',
      bg: '#0D1B2E',
      surface: '#1E2D42',
      surface2: '#2C3442',
      fontImport: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Inter:wght@400;500;600&display=swap',
    };
    return null;
  }, [tenant]);

  // Inject tenant font when brand requires a custom typeface
  useEffect(() => {
    if (!tenantBrand?.fontImport) return;
    const id = 'tenant-brand-font';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = tenantBrand.fontImport;
      document.head.appendChild(link);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [tenantBrand]);

  // Frontend display-name override. DB row stays as-is; we relabel for UI only.
  // Add a slug here when a tenant wants a different public name than what's in the DB.
  const applyDisplayOverride = (data) => {
    if (!data) return data;
    if (data.slug === 'space-rising') {
      // polish-directory-1: per Patrik 2026-05-31 "it should be called space os."
      // The directory IS SpaceOS — same product, same surface. Rebranded from
      // "Space Rising Interactive" to "SpaceOS" on both the hero title and the
      // nav label so the page tells the user what it IS.
      return { ...data, name: 'SpaceOS', nav_label: 'SpaceOS' };
    }
    return data;
  };

  // Fetch tenant info
  useEffect(() => {
    if (!tenantSlug) { setTenantLoading(false); return; }
    async function loadTenant() {
      try {
        // Try API first
        try {
          const res = await fetch(`/api/sourcing/tenants?slug=${TENANT_DB_LOOKUP_SLUG}`);
          if (res.ok) {
            const data = await res.json();
            setTenant(applyDisplayOverride(data));
            setTenantLoading(false);
            trackEvent(data.id, 'page_view', { path: window.location.pathname });
            return;
          }
        } catch { /* fall through */ }
        // Direct Supabase
        if (supabase) {
          const { data } = await supabase.from('directory_tenants').select('*').eq('slug', TENANT_DB_LOOKUP_SLUG).single();
          if (data) {
            setTenant(applyDisplayOverride(data));
            trackEvent(data.id, 'page_view', { path: window.location.pathname });
          }
        }
      } catch (err) { console.error('Tenant fetch error:', err); }
      finally { setTenantLoading(false); }
    }
    loadTenant();
  }, [tenantSlug]);

  // SEO meta tags
  useEffect(() => {
    const setMeta = (attr, key, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };

    if (tenant) {
      document.title = `${tenant.name} | Sourcing Directory`;
      setMeta('name', 'description', tenant.hero_text || tenant.description);
      setMeta('property', 'og:title', `${tenant.name} | Sourcing Directory`);
      setMeta('property', 'og:description', tenant.hero_text || tenant.description);
    } else if (!tenantSlug) {
      document.title = 'Sourcing Directory | Find Certified Suppliers';
      setMeta('name', 'description', 'Verified supplier directories for Arizona\'s advanced industries. Find certified companies, explore job boards, marketplaces, and events.');
    }

    return () => { document.title = 'Sourcing Directory | Find Certified Suppliers'; };
  }, [tenant, tenantSlug]);

  const fetchCompanies = useCallback(async (q, v) => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    setFetchError(false);
    try {
      let qb = supabase
        .from('directory_companies')
        .select('*')
        .eq('status', 'active')
        .order('featured', { ascending: false })
        .order('membership_tier', { ascending: true })
        .order('name', { ascending: true });

      // Scope to tenant if available
      if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);

      if (v && v !== 'all') qb = qb.eq('vertical', v);
      if (q && q.trim()) {
        // Broad fuzzy search across all text fields
        const words = q.split(/\s+/).filter(Boolean);
        if (words.length === 1) {
          // Single word: match against name, description, city, state, vertical, slug
          qb = qb.or(`name.ilike.%${q}%,description.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%,vertical.ilike.%${q}%,slug.ilike.%${q}%`);
        } else {
          // Multi-word: match if ANY word appears in name or description
          const orClauses = words.flatMap(w => [`name.ilike.%${w}%`, `description.ilike.%${w}%`, `city.ilike.%${w}%`]);
          qb = qb.or(orClauses.join(','));
        }
      }

      const { data: companies, error } = await qb.limit(100);
      if (error) throw error;

      setCompanies(companies || []);

      if (companies && companies.length > 0) {
        const ids = companies.map(c => c.id);
        const { data: certsData } = await supabase
          .from('directory_certifications')
          .select('*')
          .in('company_id', ids);

        const certsMap = {};
        (certsData || []).forEach(cert => {
          if (!certsMap[cert.company_id]) certsMap[cert.company_id] = [];
          certsMap[cert.company_id].push(cert);
        });
        setCerts(certsMap);
      } else {
        setCerts({});
      }
    } catch (err) {
      console.error('Sourcing directory fetch error:', err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    // Wait for tenant to load if we have a slug, then fetch
    if (tenantSlug && tenantLoading) return;
    if (aiCompanies === null) {
      fetchCompanies(query, vertical);
    }
  }, [query, vertical, fetchCompanies, aiCompanies, tenantLoading, tenantSlug]);

  // Call Scout agent via SSE and stream the text answer
  const callScoutAgent = useCallback(async (q) => {
    // Cancel any in-flight request
    if (scoutAbortRef.current) scoutAbortRef.current = false;
    const token = {};
    scoutAbortRef.current = token;

    setScoutAnswer('');
    setScoutStreaming(true);

    try {
      const res = await fetch('/api/sourcing/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, mode: 'scout', tenantId: tenant?.id || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (token !== scoutAbortRef.current) break; // aborted
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text') {
              setScoutAnswer(prev => prev + event.text);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (token === scoutAbortRef.current) {
        setScoutAnswer(`Scout couldn't search right now. Results below are from the directory.`);
      }
    } finally {
      if (token === scoutAbortRef.current) setScoutStreaming(false);
    }
  }, []);

  const handleSearch = async () => {
    const q = searchInput.trim();
    if (!q) {
      // Clear all search state and reset
      setAiResult(null);
      setAiCompanies(null);
      setScoutAnswer('');
      setScoutStreaming(false);
      setQuery('');
      setSearchParams({});
      return;
    }

    const params = {};
    if (q) params.q = q;
    if (vertical !== 'all') params.v = vertical;
    if (selectedCounties.length > 0) params.county = selectedCounties.join(',');
    if (selectedSubsectors.length > 0) params.industry_subsector = selectedSubsectors.join(',');
    setSearchParams(params);

    // Run Scout agent (streaming text answer) + standard grid in parallel
    setAiResult(null);
    setAiCompanies(null);
    callScoutAgent(q); // fire and forget -- streams into scoutAnswer
    setQuery(q);
    fetchCompanies(q, vertical);

    // Track search
    if (tenant?.id) trackEvent(tenant.id, 'search', { query: q, vertical });
  };

  const handleSuggestionClick = (suggestionQuery) => {
    setSearchInput(suggestionQuery);
    setTimeout(() => {
      const q = suggestionQuery.trim();
      setAiResult(null);
      setAiCompanies(null);
      callScoutAgent(q);
      setQuery(q);
      fetchCompanies(q, vertical);
    }, 0);
  };

  const handleVerticalChange = (v) => {
    // Clear AI state when changing vertical
    setAiResult(null);
    setAiCompanies(null);
    setVertical(v);
    const params = {};
    if (searchInput) params.q = searchInput;
    if (v !== 'all') params.v = v;
    if (selectedCounties.length > 0) params.county = selectedCounties.join(',');
    if (selectedSubsectors.length > 0) params.industry_subsector = selectedSubsectors.join(',');
    setSearchParams(params);
    setScoutAnswer('');
    setScoutStreaming(false);
  };

  const filteredCompanies = useMemo(() => {
    // Use AI results if available, otherwise use standard fetch results
    let source = aiCompanies !== null ? aiCompanies : companies;

    // R4l (nat-geo-uplift) — chip-driven fuzzy live search.
    // As the user types, filter the loaded set in-memory across every meaningful
    // field. Whitespace splits into AND-terms (every word must appear somewhere
    // in the haystack). No backend call required for the typed-as-you-go path;
    // pressing Enter still fires the deeper Supabase + Scout search via
    // handleSearch() for results beyond the loaded 100.
    if (searchInput.trim() && aiCompanies === null) {
      const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
      source = source.filter(c => {
        const companyCerts = (certs[c.id] || []).map(cert => cert.cert_name || '').join(' ');
        const haystack = [
          c.name,
          c.description,
          c.city,
          c.state,
          c.vertical,
          c.industry_subsector,
          c.slug,
          companyCerts,
        ].filter(Boolean).join(' ').toLowerCase();
        return terms.every(t => haystack.includes(t));
      });
    }

    if (showSaved) source = source.filter(c => favorites.includes(c.slug));
    if (selectedCerts.length > 0) {
      source = source.filter(c => {
        const companyCerts = (certs[c.id] || []).map(cert => cert.cert_name);
        return selectedCerts.every(sc => companyCerts.includes(sc));
      });
    }
    if (selectedCounties.length > 0) {
      source = source.filter(c => {
        const county = CITY_TO_COUNTY[c.city];
        return county && selectedCounties.includes(county);
      });
    }
    if (selectedSubsectors.length > 0) {
      source = source.filter(c => {
        const haystack = `${c.name} ${c.description || ''}`.toLowerCase();
        return selectedSubsectors.some(subsector => {
          const keywords = SUBSECTOR_KEYWORDS[subsector] || [];
          return keywords.some(kw => haystack.includes(kw.toLowerCase()));
        });
      });
    }
    return source;
  }, [companies, aiCompanies, certs, selectedCerts, selectedCounties, selectedSubsectors, showSaved, favorites, searchInput]);

  const availableCerts = VERTICAL_CERTS[vertical] || [];

  const toggleCert = (cert) => {
    setSelectedCerts(prev =>
      prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]
    );
  };

  const toggleFavorite = useCallback((slug, e) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug];
      try { localStorage.setItem('sourcing_favorites', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const handleCountyChange = useCallback((county) => {
    setSelectedCounties(prev => {
      const next = prev.includes(county)
        ? prev.filter(c => c !== county)
        : [...prev, county];
      const params = {};
      if (searchInput) params.q = searchInput;
      if (vertical !== 'all') params.v = vertical;
      if (next.length > 0) params.county = next.join(',');
      if (selectedSubsectors.length > 0) params.industry_subsector = selectedSubsectors.join(',');
      setSearchParams(params);
      return next;
    });
  }, [searchInput, vertical, selectedSubsectors, setSearchParams]);

  const handleSubsectorChange = useCallback((subsector) => {
    setSelectedSubsectors(prev => {
      const next = prev.includes(subsector)
        ? prev.filter(s => s !== subsector)
        : [...prev, subsector];
      const params = {};
      if (searchInput) params.q = searchInput;
      if (vertical !== 'all') params.v = vertical;
      if (selectedCounties.length > 0) params.county = selectedCounties.join(',');
      if (next.length > 0) params.industry_subsector = next.join(',');
      setSearchParams(params);
      return next;
    });
  }, [searchInput, vertical, selectedCounties, setSearchParams]);

  // Fetch reports for tenant
  useEffect(() => {
    if (!supabase || !tenant?.id) { setReports([]); return; }
    supabase
      .from('directory_reports')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('published_at', { ascending: false })
      .then(({ data }) => { setReports(data || []); });
  }, [tenant?.id]);

  // Auth state — detect admin for report upload UI
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setIsAdmin(s?.user?.app_metadata?.role === 'admin');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setIsAdmin(s?.user?.app_metadata?.role === 'admin');
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch available counties for filter (tenant-scoped)
  useEffect(() => {
    const qs = tenant?.id ? `?tenant_id=${tenant.id}` : '';
    fetch(`/api/filter-options/counties${qs}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.counties) setAvailableCounties(data.counties); })
      .catch(() => {});
  }, [tenant?.id]);

  // Fetch available industry subsectors for filter
  useEffect(() => {
    fetch('/api/filter-options/industry-subsectors')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.subsectors) setAvailableSubsectors(data.subsectors); })
      .catch(() => {});
  }, []);

  // Fetch review stats for visible companies
  useEffect(() => {
    if (!supabase || companies.length === 0) return;
    const ids = companies.map(c => c.id);
    supabase.from('directory_reviews')
      .select('company_id, rating')
      .in('company_id', ids)
      .eq('status', 'approved')
      .then(({ data }) => {
        if (!data) return;
        const stats = {};
        data.forEach(r => {
          if (!stats[r.company_id]) stats[r.company_id] = { sum: 0, count: 0 };
          stats[r.company_id].sum += r.rating;
          stats[r.company_id].count++;
        });
        Object.keys(stats).forEach(id => {
          stats[id].avg = stats[id].sum / stats[id].count;
        });
        setReviewStats(stats);
      });
  }, [companies]);

  // Upload a PDF document to Supabase Storage and save the URL to the report record.
  // Only callable by admin users (guarded both here and in the API).
  const handleReportUpload = useCallback(async (reportId, file) => {
    if (!session || !isAdmin || !file) return;
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF files are supported');
      return;
    }
    if (file.size > 52428800) {
      setUploadError('File too large — maximum size is 50 MB');
      return;
    }
    setUploadingReportId(reportId);
    setUploadError(null);
    try {
      // Step 1: Get a signed upload URL from the API (uses service role to create bucket + signed URL)
      const initRes = await fetch('/api/sourcing/upload-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'get-url',
          report_id: reportId,
          filename: file.name,
          content_type: file.type || 'application/pdf',
        }),
      });
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get upload URL');
      }
      const { path, token: uploadToken, publicUrl } = await initRes.json();

      // Step 2: Upload file directly to Supabase Storage using the signed URL
      const { error: uploadErr } = await supabase.storage
        .from('sourcing-reports')
        .uploadToSignedUrl(path, uploadToken, file, {
          contentType: file.type || 'application/pdf',
        });
      if (uploadErr) throw uploadErr;

      // Step 3: Persist the public URL to directory_reports.file_url
      const saveRes = await fetch('/api/sourcing/upload-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'save-url',
          report_id: reportId,
          file_url: publicUrl,
        }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save file URL');
      }

      // Step 4: Update local state so the download link appears immediately
      setReports(prev =>
        prev.map(r => r.id === reportId ? { ...r, file_url: publicUrl } : r)
      );
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploadingReportId(null);
    }
  }, [session, isAdmin]);

  // V2 fix: treat the cloned slug as space-rising so the orange-accent CSS-var
  // overrides + theme styling apply identically to V1. The data-tenant attr
  // below still carries the raw slug so the V2 theme file matches it.
  const isSpaceRising = tenantSlug === 'space-rising' || tenantSlug === 'space-rising-v2';

  return (
    <div
      data-tenant={tenantSlug}
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--tx)',
        position: 'relative',
        // R2 (nat-geo-uplift): Space Grotesk display+body (matches the SR
        // wordmark), JetBrains Mono stays for chrome. Palette = locked
        // Nat-Geo-uplift tokens.
        fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
        ...(isSpaceRising && {
          // R2 palette: deep ink ground (#0B0B0D), warm bone body (#E8E4DA),
          // single warm amber accent (#E8A23A) — replaces the V1 orange.
          '--bg': 'transparent',
          '--tx': '#E8E4DA',
          '--tx2': 'rgba(232,228,218,0.60)',
          '--tx3': 'rgba(232,228,218,0.25)',
          '--s1': 'rgba(11,11,13,0.72)',
          '--s2': 'rgba(11,11,13,0.82)',
          '--s3': 'rgba(11,11,13,0.92)',
          '--bd': 'rgba(232,228,218,0.10)',
          '--bd2': 'rgba(232,228,218,0.16)',
          '--cyan': '#E8A23A',
          '--cyan-dim': 'rgba(232,162,58,0.10)',
          '--cyan-brd': 'rgba(232,162,58,0.32)',
        }),
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
      `}</style>

      <SourcingNav
        active="directory"
        tenantSlug={tenantSlug}
        tenantName={tenant?.nav_label || tenant?.name}
        features={tenant?.features}
        brandColor={tenant?.brand_color}
      />

      {/* v10 Browse Hero -- with tenant brand
          polish-srw-cleanup (2026-05-31): back button + tenant logo now share
          a TOP ROW above the eyebrow / title / sub. Logo is no longer
          absolute-positioned in the corner — it sits in the toprow with the
          back button. CSS picks up the new .browse-hero-toprow + sizes the
          .tenant-hero-logo larger (~2× previous). */}
      <div className="browse-hero" style={tenant ? { minHeight: 280 } : { minHeight: 200 }}>
        <div className="browse-hero-bg" style={{ backgroundImage: `url(${tenant ? getVerticalImage(tenant.vertical) : 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80'})` }} />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <div className="browse-hero-toprow">
            <Link to="/" className="browse-back" style={{ textDecoration: 'none' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
              Back
            </Link>
            {tenant?.slug === 'space-rising' && (
              <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
            )}
            {tenant?.slug === 's3c-semiconductor' && (
              <img src="/images/s3c/logo.png" alt="S3C" className="tenant-hero-logo" />
            )}
          </div>
          <div className="browse-title" style={tenantBrand ? {
            fontFamily: tenantBrand.headingFont,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          } : {}}>
            {tenant?.name || 'Find Certified Suppliers'}
          </div>
          <div className="browse-sub">{tenant?.hero_text || "Verified companies, certifications, and capabilities in one place."}</div>
        </div>
      </div>

      {/* v10 Search — R4l: live fuzzy filter on type; AI runs invisibly in
          the background on Enter. No aiLoading spinner in the user-facing UX
          per Patrik 2026-05-30: "AI stuff can be happening in the background;
          we know they're searching, not having a conversation right now." */}
      <div className="browse-search">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder='Search companies, certifications...'
          aria-label="Search companies"
          autoComplete="off"
          spellCheck="false"
        />
        {loading && <div className="spinner" />}
      </div>

      {/* v10 Section Chips -- branded accent if tenant has one */}
      <style>{tenantBrand ? `
        .chip.on { border-color: ${tenantBrand.accent}40 !important; background: ${tenantBrand.accent}12 !important; color: ${tenantBrand.accent} !important; }
      ` : ''}</style>
      <V2ChipNav active="companies" />

      {/* Vertical filter chips */}
      <div className="chips">
        {VERTICALS.map(v => (
          <div
            key={v.key}
            className={`chip ${!showSaved && vertical === v.key ? 'on' : ''}`}
            onClick={() => { handleVerticalChange(v.key); setShowSaved(false); }}
          >
            {v.label}
          </div>
        ))}
        <div
          className={`chip ${showSaved ? 'on' : ''}`}
          onClick={() => setShowSaved(s => !s)}
          style={showSaved ? { borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#EF4444' } : {}}
        >
          {showSaved ? '♥' : '♡'} Saved {favorites.length > 0 ? `(${favorites.length})` : ''}
        </div>
      </div>

      {/* Cert Filters */}
      {showFilters && availableCerts.length > 0 && (
        <div style={{ padding: '14px 24px', maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 8, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, color: V.muted, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontWeight: 700 }}>
              Filter by Certification
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {availableCerts.map(cert => (
                <button
                  key={cert}
                  onClick={() => toggleCert(cert)}
                  style={{
                    background: selectedCerts.includes(cert) ? V.accentDim : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedCerts.includes(cert) ? V.accentBrd : V.border}`,
                    color: selectedCerts.includes(cert) ? V.accent : V.muted,
                    borderRadius: 4, padding: '5px 10px', fontSize: 11,
                    fontFamily: V.mono, cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  {selectedCerts.includes(cert) && '✓ '}{cert}
                </button>
              ))}
            </div>
            {selectedCerts.length > 0 && (
              <button
                onClick={() => setSelectedCerts([])}
                style={{
                  marginTop: 10, background: 'none', border: 'none',
                  color: V.accent, fontSize: 12, fontFamily: V.space,
                  cursor: 'pointer', padding: 0,
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* County Filter */}
      {availableCounties.length > 0 && (
        <div style={{ padding: '0 24px 14px', maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 8, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, color: V.muted, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontWeight: 700 }}>
              Filter by County
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {availableCounties.map(county => (
                <button
                  key={county}
                  onClick={() => handleCountyChange(county)}
                  style={{
                    background: selectedCounties.includes(county) ? V.accentDim : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedCounties.includes(county) ? V.accentBrd : V.border}`,
                    color: selectedCounties.includes(county) ? V.accent : V.muted,
                    borderRadius: 4, padding: '5px 10px', fontSize: 11,
                    fontFamily: V.mono, cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  {selectedCounties.includes(county) && '✓ '}{county} County
                </button>
              ))}
            </div>
            {selectedCounties.length > 0 && (
              <button
                onClick={() => {
                  setSelectedCounties([]);
                  const params = {};
                  if (searchInput) params.q = searchInput;
                  if (vertical !== 'all') params.v = vertical;
                  setSearchParams(params);
                }}
                style={{
                  marginTop: 10, background: 'none', border: 'none',
                  color: V.accent, fontSize: 12, fontFamily: V.space,
                  cursor: 'pointer', padding: 0,
                }}
              >
                Clear county filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Industry Subsector Filter */}
      {availableSubsectors.length > 0 && (
        <div style={{ padding: '0 24px 14px', maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 8, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, color: V.muted, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontWeight: 700 }}>
              Filter by Industry Subsector
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {availableSubsectors.map(subsector => (
                <button
                  key={subsector}
                  onClick={() => handleSubsectorChange(subsector)}
                  style={{
                    background: selectedSubsectors.includes(subsector) ? V.accentDim : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedSubsectors.includes(subsector) ? V.accentBrd : V.border}`,
                    color: selectedSubsectors.includes(subsector) ? V.accent : V.muted,
                    borderRadius: 4, padding: '5px 10px', fontSize: 11,
                    fontFamily: V.mono, cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  {selectedSubsectors.includes(subsector) && '✓ '}{subsector}
                </button>
              ))}
            </div>
            {selectedSubsectors.length > 0 && (
              <button
                onClick={() => {
                  setSelectedSubsectors([]);
                  const params = {};
                  if (searchInput) params.q = searchInput;
                  if (vertical !== 'all') params.v = vertical;
                  if (selectedCounties.length > 0) params.county = selectedCounties.join(',');
                  setSearchParams(params);
                }}
                style={{
                  marginTop: 10, background: 'none', border: 'none',
                  color: V.accent, fontSize: 12, fontFamily: V.space,
                  cursor: 'pointer', padding: 0,
                }}
              >
                Clear subsector filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      <div style={{ padding: '0 0 80px' }}>
        {/* Scout AI Answer */}
        {(scoutAnswer || scoutStreaming) && (
          <div style={{ padding: '12px 20px' }}>
            <ScoutAnswerCard text={scoutAnswer} streaming={scoutStreaming} V={V} />
          </div>
        )}

        {/* Section header */}
        <div className="sec-hdr">
          <div className="sec-title">
            {loading ? 'Searching...' : `${filteredCompanies.length} Companies`}
            {query && !loading && <span style={{ color: 'var(--cyan)', fontWeight: 400 }}> for "{query}"</span>}
          </div>
          <div className="sec-count">
            <Link to={tenantSlug ? `/${tenantSlug}/membership` : '/membership'} style={{ textDecoration: 'none', color: 'var(--cyan)', fontSize: 12, fontWeight: 600 }}>
              + Add Company
            </Link>
          </div>
        </div>

        {!supabase && (
          <div style={{
            background: V.accentDim, border: `1px solid ${V.accentBrd}`,
            borderRadius: 8, padding: '20px 24px', textAlign: 'center',
          }}>
            <div style={{ color: V.accent, fontFamily: V.mono, fontSize: 13, marginBottom: 8 }}>
              Supabase not configured
            </div>
            <div style={{ color: V.muted, fontFamily: V.space, fontSize: 12 }}>
              Run the migration (migrations/001_sourcing_directory.sql) in the Supabase SQL editor to activate this directory.
            </div>
          </div>
        )}

        {fetchError && (
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 8, padding: '40px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 8 }}>
              No listings yet
            </div>
            <div style={{ color: V.muted, fontFamily: V.space, fontSize: 13 }}>
              The directory is coming soon. Check back shortly.
            </div>
          </div>
        )}

        {(loading && supabase && !fetchError && !aiLoading) && (
          <div className="co-list">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="co-card" style={{ pointerEvents: 'none' }}>
                <div className="skel" style={{ width: 44, height: 44, borderRadius: 'var(--r-sm)', flexShrink: 0 }} />
                <div className="co-body">
                  <div className="skel" style={{ height: 14, width: '60%', marginBottom: 6 }} />
                  <div className="skel" style={{ height: 10, width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Map view */}
        {showMap && !loading && filteredCompanies.length > 0 && (() => {
          const mapsKey = typeof window !== 'undefined' ? (import.meta.env?.VITE_GOOGLE_MAPS_KEY || '') : '';
          const forMap = filteredCompanies.filter(c => c.city && c.state).slice(0, 20);
          if (!mapsKey || forMap.length === 0) {
            return (
              <div style={{
                background: V.card, border: `1px solid ${V.border}`,
                borderRadius: 10, padding: '40px 24px', textAlign: 'center',
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📍</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 6 }}>
                  {forMap.length === 0 ? 'No locations to show' : 'Map view unavailable'}
                </div>
                <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space }}>
                  {forMap.length === 0 ? 'None of the visible companies have location data.' : 'Set VITE_GOOGLE_MAPS_KEY to enable the map view.'}
                </div>
                {forMap.length > 0 && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {forMap.slice(0, 5).map(c => (
                      <div key={c.id} style={{ fontSize: 12, color: V.muted, fontFamily: V.space }}>
                        📍 {c.name} -- {[c.city, c.state].filter(Boolean).join(', ')}
                      </div>
                    ))}
                    {forMap.length > 5 && <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>+{forMap.length - 5} more</div>}
                  </div>
                )}
              </div>
            );
          }
          const markers = forMap.map(c => `markers=label:${encodeURIComponent(c.name.charAt(0))}|${encodeURIComponent(`${c.city},${c.state}`)}`).join('&');
          const center = forMap[0] ? `${forMap[0].city},${forMap[0].state}` : 'Phoenix,AZ';
          const src = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(center)}&zoom=8&size=900x400&maptype=roadmap&${markers}&key=${mapsKey}`;
          return (
            <div style={{ marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: `1px solid ${V.border}` }}>
              <img src={src} alt="Companies map" style={{ width: '100%', display: 'block' }} />
            </div>
          );
        })()}

        {!loading && filteredCompanies.length > 0 && (
          <div className="co-list">
            {filteredCompanies.map(company => (
              <CompanyCard
                key={company.id}
                company={company}
                certs={certs[company.id] || []}
                V={V}
                tenantSlug={tenantSlug}
                isFavorite={favorites.includes(company.slug)}
                onToggleFavorite={toggleFavorite}
                reviewStat={reviewStats[company.id]}
              />
            ))}
          </div>
        )}

        {!loading && supabase && filteredCompanies.length === 0 && (
          <div className="empty-state">
            <svg width="32" height="32" fill="none" stroke="var(--tx3)" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>
              {showSaved ? 'No saved companies yet' : 'No companies found'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--tx2)' }}>
              {showSaved
                ? 'Tap the heart on any listing to save it.'
                : (query ? `No results for "${query}".` : 'No companies in this vertical yet.')}
            </div>
          </div>
        )}

        {/* Reports / Resources section -- shown when tenant has reports */}
        {reports.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted,
              letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14,
            }}>
              Resources & Reports
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reports.map(report => (
                <div
                  key={report.id}
                  style={{
                    background: V.card,
                    border: `1px solid ${V.border}`,
                    borderRadius: 8,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 7, flexShrink: 0,
                    background: V.accentDim, border: `1px solid ${V.accentBrd}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="16" height="16" fill="none" stroke={V.accent} strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 14, fontWeight: 600, fontFamily: V.space, color: V.text,
                      }}>
                        {report.title}
                      </span>
                      {report.category && (
                        <span style={{
                          background: 'rgba(255,255,255,0.06)', border: `1px solid ${V.border}`,
                          color: V.muted, fontSize: 10, fontFamily: V.mono, fontWeight: 600,
                          padding: '2px 7px', borderRadius: 3,
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                        }}>
                          {report.category}
                        </span>
                      )}
                      <span style={{
                        background: report.access === 'free' ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)',
                        border: `1px solid ${report.access === 'free' ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}`,
                        color: report.access === 'free' ? '#86EFAC' : '#93C5FD',
                        fontSize: 10, fontFamily: V.mono, fontWeight: 700,
                        padding: '2px 7px', borderRadius: 3,
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                      }}>
                        {report.access === 'free' ? 'Free' : 'Member'}
                      </span>
                    </div>
                    {report.description && (
                      <div style={{
                        fontSize: 13, color: V.muted, fontFamily: V.space, lineHeight: 1.5,
                      }}>
                        {report.description}
                      </div>
                    )}
                  </div>

                  {/* Download link */}
                  {report.file_url && (
                    <a
                      href={report.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flexShrink: 0,
                        background: V.accentDim, border: `1px solid ${V.accentBrd}`,
                        color: V.accent, borderRadius: 6,
                        padding: '6px 12px', fontSize: 11,
                        fontWeight: 700, fontFamily: V.mono,
                        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download
                    </a>
                  )}

                  {/* Admin upload button — only visible to admins */}
                  {isAdmin && (
                    <label style={{
                      flexShrink: 0,
                      background: 'transparent',
                      border: `1px solid ${V.border}`,
                      color: uploadingReportId === report.id ? V.muted : V.muted,
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: V.mono,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: uploadingReportId === report.id ? 'not-allowed' : 'pointer',
                      opacity: uploadingReportId === report.id ? 0.6 : 1,
                      whiteSpace: 'nowrap',
                    }}>
                      {uploadingReportId === report.id ? (
                        <>
                          <div style={{
                            width: 10, height: 10,
                            border: '2px solid currentColor',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                          }} />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          Upload PDF
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        style={{ display: 'none' }}
                        disabled={uploadingReportId === report.id}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleReportUpload(report.id, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>

            {/* Upload error banner — shown inline below the cards */}
            {uploadError && isAdmin && (
              <div style={{
                marginTop: 10,
                padding: '8px 12px',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: 6,
                color: '#f87171',
                fontSize: 12,
                fontFamily: V.mono,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}>
                <span>{uploadError}</span>
                <button
                  onClick={() => setUploadError(null)}
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Made by AOM footer */}
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, padding: '12px 0 16px', margin: 0, letterSpacing: '0.02em' }}>
        Made by <a href="https://www.aom-inhouse.com" target="_blank" rel="noopener noreferrer" style={{ color: '#f44611', textDecoration: 'underline', textUnderlineOffset: '2px', fontWeight: 700 }}>AOM</a>
      </p>

      {/* Welcome modal */}
      {showWelcome && (
        <>
          <div
            onClick={() => setShowWelcome(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              zIndex: 300, animation: 'fadeIn 0.2s',
            }}
          />
          <div style={{
            position: 'fixed', bottom: 'var(--nav-h, 72px)', left: '50%',
            width: '100%', maxWidth: 480, zIndex: 301,
            background: '#0E0E14', borderTop: '1px solid var(--bd2)',
            borderRadius: '20px 20px 0 0', overflow: 'hidden',
            transform: 'translate(-50%, 0)',
            animation: 'slideUpCenter 0.35s cubic-bezier(0.16,1,0.3,1) both',
            willChange: 'transform',
            boxShadow: '0 -12px 32px rgba(0,0,0,0.45)',
          }}>
            <style>{`
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes slideUpCenter {
                from { transform: translate(-50%, 100%); }
                to   { transform: translate(-50%, 0); }
              }
            `}</style>
            {/* polish-directory-2-join-cta — quieter editorial redesign.
                Was: full-bleed bg image + glassy "Free and paid listings"
                pill badge + 22px/900 "Join {tenant}" title + heavy orange
                "Sign Up Free" button + dim "Maybe later" link. Heavy +
                forced-upgrade feel.
                Now: deep cool-ink ground with subtle bottom amber accent,
                mono-caps "MEMBERSHIP" eyebrow + amber-period title in
                Space Grotesk 300, line-style copy, line-style amber
                Sign-up CTA, mono-caps "Maybe later" with chevron right. */}
            {/* Editorial header strip — quieter than the previous bg image */}
            <div style={{
              height: 64, position: 'relative',
              borderBottom: '1px solid rgba(232,228,218,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 11, fontWeight: 600, letterSpacing: '0.22em',
                color: '#EE7C25', textTransform: 'uppercase',
              }}>
                Membership
              </div>
            </div>
            {/* Content */}
            <div style={{ padding: '28px 28px max(env(safe-area-inset-bottom),28px)', textAlign: 'left' }}>
              <div style={{
                fontFamily: "'Space Grotesk', 'Hanken Grotesk', sans-serif",
                fontSize: 28, fontWeight: 300, color: '#E8E4DA',
                letterSpacing: '-0.01em', lineHeight: 1.12, marginBottom: 12,
              }}>
                Join {tenant?.nav_label || tenant?.name || 'the directory'}<span style={{ color: '#EE7C25' }}>.</span>
              </div>
              <div style={{
                fontFamily: "'Space Grotesk', 'Hanken Grotesk', sans-serif",
                fontSize: 14, fontWeight: 300, lineHeight: 1.55,
                color: 'rgba(232,228,218,0.62)', marginBottom: 28,
              }}>
                Get found by procurement teams, contractors, and partners in {tenant?.name || 'the directory'}.
              </div>
              <Link
                to={tenantSlug ? `/${tenantSlug}/membership` : '/membership'}
                onClick={() => setShowWelcome(false)}
                style={{
                  display: 'block', textDecoration: 'none', textAlign: 'center',
                  padding: '14px 24px', marginBottom: 14,
                  background: 'transparent', color: '#EE7C25',
                  border: '1px solid #EE7C25',
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  transition: 'background 0.2s, color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#EE7C25';
                  e.currentTarget.style.color = '#0B0B0D';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#EE7C25';
                }}
              >
                Sign up free →
              </Link>
              <button
                onClick={() => setShowWelcome(false)}
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(232,228,218,0.45)',
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  cursor: 'pointer', padding: '10px 0', width: '100%',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(232,228,218,0.85)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(232,228,218,0.45)'; }}
              >
                Maybe later
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function SourcingDirectoryV2() {
  return (
    <SourcingThemeProvider>
      <SourcingDirectoryInner />
    </SourcingThemeProvider>
  );
}
