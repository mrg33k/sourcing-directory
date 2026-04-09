import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingNav } from './SourcingMarketplace.jsx';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import { trackEvent } from './sourcingAnalytics.js';
import { getVerticalImage } from './SourcingLanding.jsx';

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
        <div className="co-name">{company.name}</div>
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
  const { tenantSlug } = useParams();

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

  // ─── Tenant brand tokens (Space Rising + S3C) ──────────────────────────────
  const tenantBrand = useMemo(() => {
    if (!tenant) return null;
    if (tenant.slug === 'space-rising') return {
      headingFont: "'Oswald', sans-serif",
      bodyFont: "'Inter', sans-serif",
      accent: '#E5451F',
      bg: '#080808',
      surface: '#121212',
      surface2: '#1A1A1A',
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

  // Fetch tenant info
  useEffect(() => {
    if (!tenantSlug) { setTenantLoading(false); return; }
    async function loadTenant() {
      try {
        // Try API first
        try {
          const res = await fetch(`/api/sourcing/tenants?slug=${tenantSlug}`);
          if (res.ok) {
            const data = await res.json();
            setTenant(data);
            setTenantLoading(false);
            trackEvent(data.id, 'page_view', { path: window.location.pathname });
            return;
          }
        } catch { /* fall through */ }
        // Direct Supabase
        if (supabase) {
          const { data } = await supabase.from('directory_tenants').select('*').eq('slug', tenantSlug).single();
          if (data) {
            setTenant(data);
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
    setSearchParams(params);
    setScoutAnswer('');
    setScoutStreaming(false);
  };

  const filteredCompanies = useMemo(() => {
    // Use AI results if available, otherwise use standard fetch results
    let source = aiCompanies !== null ? aiCompanies : companies;
    if (showSaved) source = source.filter(c => favorites.includes(c.slug));
    if (selectedCerts.length === 0) return source;
    return source.filter(c => {
      const companyCerts = (certs[c.id] || []).map(cert => cert.cert_name);
      return selectedCerts.every(sc => companyCerts.includes(sc));
    });
  }, [companies, aiCompanies, certs, selectedCerts, showSaved, favorites]);

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

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--tx)' }}>
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

      {/* v10 Browse Hero -- with tenant brand */}
      <div className="browse-hero" style={tenant ? { minHeight: 280 } : { minHeight: 200 }}>
        <div className="browse-hero-bg" style={{ backgroundImage: `url(${tenant ? getVerticalImage(tenant.vertical) : 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80'})` }} />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <Link to="/" className="browse-back" style={{ textDecoration: 'none' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
            Back
          </Link>
          <div className="browse-title" style={tenantBrand ? {
            fontFamily: tenantBrand.headingFont,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          } : {}}>
            {tenant?.name || 'Find Certified Suppliers'}
          </div>
          <div className="browse-sub">{tenant?.hero_text || "Verified companies, certifications, and capabilities in one place."}</div>
          {/* Tenant logo -- bottom right of hero */}
          {tenant?.slug === 'space-rising' && (
            <img src="/images/space-rising/logo-white.png" alt="Space Rising" style={{ position: 'absolute', right: 0, bottom: 0, height: 44, objectFit: 'contain', opacity: 0.7, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
          )}
          {tenant?.slug === 's3c-semiconductor' && (
            <img src="/images/s3c/logo.png" alt="S3C" style={{ position: 'absolute', right: 0, bottom: 0, height: 38, objectFit: 'contain', opacity: 0.7, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
          )}
        </div>
      </div>

      {/* v10 Search */}
      <div className="browse-search">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder='Search companies, certifications...'
          autoComplete="off"
          spellCheck="false"
        />
        {(loading || aiLoading) && <div className="spinner" />}
      </div>

      {/* v10 Section Chips -- branded accent if tenant has one */}
      <style>{tenantBrand ? `
        .chip.on { border-color: ${tenantBrand.accent}40 !important; background: ${tenantBrand.accent}12 !important; color: ${tenantBrand.accent} !important; }
      ` : ''}</style>
      <div className="chips" style={{ paddingBottom: 4 }}>
        <div className="chip on">Companies</div>
        <Link to={`/${tenantSlug}/jobs`} className="chip" style={{ textDecoration: 'none' }}>Jobs</Link>
        <Link to={`/${tenantSlug}/events`} className="chip" style={{ textDecoration: 'none' }}>Events</Link>
        <Link to={`/${tenantSlug}/reports`} className="chip" style={{ textDecoration: 'none' }}>Reports</Link>
        <Link to={`/${tenantSlug}/marketplace`} className="chip" style={{ textDecoration: 'none' }}>Marketplace</Link>
        <Link to={`/${tenantSlug}/membership`} className="chip" style={{ textDecoration: 'none' }}>Membership</Link>
      </div>

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
            <Link to={tenantSlug ? `/${tenantSlug}/signup` : '/signup'} style={{ textDecoration: 'none', color: 'var(--cyan)', fontSize: 12, fontWeight: 600 }}>
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: 480, zIndex: 301,
            background: 'var(--s1)', borderTop: '1px solid var(--bd2)',
            borderRadius: '20px 20px 0 0', overflow: 'hidden',
            animation: 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <style>{`
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>
            {/* Hero image */}
            <div style={{
              position: 'relative', height: 140, overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${tenant ? getVerticalImage(tenant.vertical) : 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&q=80'})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
              }} />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(14,14,20,0.3) 0%, rgba(14,14,20,0.7) 60%, var(--s1) 100%)',
              }} />
              <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100,
                  padding: '4px 12px 4px 8px', fontSize: 11, fontWeight: 600, color: 'var(--tx2)',
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--emerald)', boxShadow: '0 0 10px var(--emerald)' }} />
                  Free and paid listings available
                </div>
              </div>
            </div>
            {/* Content */}
            <div style={{ padding: '20px 24px max(env(safe-area-inset-bottom),24px)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '-0.03em' }}>
                List your company
              </div>
              <div style={{ fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5, maxWidth: 320, margin: '0 auto 20px' }}>
                Get found by procurement teams, contractors, and partners in {tenant?.name || 'this directory'}.
              </div>
              <Link
                to={tenantSlug ? `/${tenantSlug}/signup` : '/signup'}
                onClick={() => setShowWelcome(false)}
                className="login-btn"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 12 }}
              >
                Sign Up Free
              </Link>
              <button
                onClick={() => setShowWelcome(false)}
                style={{
                  background: 'none', border: 'none', color: 'var(--tx3)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 0', width: '100%',
                }}
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
export default function SourcingDirectory() {
  return (
    <SourcingThemeProvider>
      <SourcingDirectoryInner />
    </SourcingThemeProvider>
  );
}
