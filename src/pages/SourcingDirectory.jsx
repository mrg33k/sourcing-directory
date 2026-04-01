import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { supabase } from '../dashboard/lib/supabase.js';
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
  { key: 'biotech',       label: 'Biotech',          color: '#22C55E' },
  { key: 'defense',       label: 'Defense',          color: '#EF4444' },
];

const VERTICAL_CERTS = {
  semiconductor: ['ISO 9001', 'ISO 14001', 'ISO 45001', 'ITAR Registered', 'AS9100D', 'ANSI/ESD S20.20', 'AEC-Q100', 'IPC-7711/7721'],
  space:         ['AS9100D', 'AS9120B', 'ITAR Registered', 'ISO 9001', 'MIL-STD-810', 'NADCAP', 'FAA FAR Part 145', 'DoD Secret Cleared'],
  biotech:       ['ISO 13485', 'ISO 9001', 'cGMP', 'FDA 21 CFR Part 820', 'ISO 14155', 'CE Marked', 'ICH Q10'],
  defense:       ['ITAR Registered', 'ISO 9001', 'AS9100D', 'CMMC Level 2', 'MIL-STD-810', 'DoD Secret Cleared', 'NIST 800-171'],
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

// ─── Company Card ─────────────────────────────────────────────────────────────
function CompanyCard({ company, certs, V, tenantSlug, isFavorite, onToggleFavorite, reviewStat }) {
  const [hovered, setHovered] = useState(false);
  const topCerts = (certs || []).slice(0, 3);
  const vColor = verticalColor(company.vertical);

  return (
    <Link
      to={tenantSlug ? `/sourcing/${tenantSlug}/${company.slug}` : `/sourcing/${company.slug}`}
      style={{ textDecoration: 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background: hovered ? V.cardHov : V.card,
        border: `1px solid ${hovered ? V.borderHov : V.border}`,
        borderRadius: 10,
        padding: 0,
        transition: 'all 0.15s ease',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: hovered ? `0 0 0 1px ${V.accent}20` : 'none',
        position: 'relative',
      }}>
        {/* Subtle industry accent strip at top */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, ${vColor}, ${vColor}40)`,
          opacity: hovered ? 1 : 0.6,
          transition: 'opacity 0.15s ease',
        }} />

        {/* Heart / Favorite button */}
        <button
          onClick={e => onToggleFavorite && onToggleFavorite(company.slug, e)}
          title={isFavorite ? 'Remove from saved' : 'Save company'}
          style={{
            position: 'absolute', top: 10, right: 10,
            background: isFavorite ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${isFavorite ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.1)'}`,
            color: isFavorite ? '#EF4444' : 'rgba(255,255,255,0.35)',
            borderRadius: '50%', width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 14, zIndex: 2,
            transition: 'all 0.15s ease',
          }}
        >
          {isFavorite ? '♥' : '♡'}
        </button>

        {/* Logo / Avatar area */}
        <div style={{ padding: '16px 20px 0' }}>
          {company.logo_url ? (
            <div style={{
              width: '100%', height: 64,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
              gap: 14,
            }}>
              <img
                src={company.logo_url}
                alt={company.name}
                style={{
                  maxWidth: 120, maxHeight: 56, borderRadius: 8,
                  objectFit: 'contain', background: V.card2,
                  border: `1px solid ${V.border}`,
                  padding: 6,
                }}
              />
              {company.featured && (
                <div style={{
                  background: V.accentDim, border: `1px solid ${V.accentBrd}`,
                  color: V.accent, fontSize: 9, fontWeight: 700, fontFamily: V.mono,
                  padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase',
                  letterSpacing: '0.1em', whiteSpace: 'nowrap', marginLeft: 'auto',
                }}>
                  Featured
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12,
                background: `${vColor}15`,
                border: `1px solid ${vColor}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 800, fontFamily: V.syne,
                color: vColor, flexShrink: 0,
              }}>
                {company.name.charAt(0)}
              </div>
              {company.featured && (
                <div style={{
                  background: V.accentDim, border: `1px solid ${V.accentBrd}`,
                  color: V.accent, fontSize: 9, fontWeight: 700, fontFamily: V.mono,
                  padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase',
                  letterSpacing: '0.1em', whiteSpace: 'nowrap', marginLeft: 'auto',
                }}>
                  Featured
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Name + location */}
          <div>
            <div style={{
              fontSize: 16, fontWeight: 700, fontFamily: V.syne,
              color: V.text, lineHeight: 1.2,
              overflowWrap: 'break-word', wordBreak: 'break-word',
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {company.name}
            </div>
            <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginTop: 3 }}>
              {[company.city, company.state].filter(Boolean).join(', ')}
              {company.year_founded && ` · Est. ${company.year_founded}`}
            </div>
          </div>

          {/* Description */}
          {company.description && (
            <div style={{
              fontSize: 13, color: V.muted, fontFamily: V.space,
              lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {company.description}
            </div>
          )}

          {/* Certs */}
          {topCerts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {topCerts.map(c => <CertPill key={c.id} name={c.cert_name} V={V} />)}
              {certs.length > 3 && (
                <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, alignSelf: 'center' }}>
                  +{certs.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <VerticalBadge vertical={company.vertical} V={V} />
            <TierBadge tier={company.membership_tier} V={V} />
            {company.employee_count && (
              <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                {company.employee_count} employees
              </span>
            )}
            {reviewStat && reviewStat.count > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                <span style={{ fontSize: 11, color: '#F59E0B' }}>
                  {'★'.repeat(Math.round(reviewStat.avg))}
                </span>
                <span style={{ fontSize: 10, color: V.dim, fontFamily: V.mono }}>
                  ({reviewStat.count})
                </span>
              </div>
            )}
          </div>
        </div>
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

  // Reviews map: company slug -> { avg, count }
  const [reviewStats, setReviewStats] = useState({});

  // ─── Tenant brand tokens (Space Rising + SC3) ──────────────────────────────
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
    if (tenant.slug === 'sc3-semiconductor') return {
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
        qb = qb.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
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
    <div style={{ minHeight: '100vh', background: V.bg, color: V.text, overflowX: 'hidden', maxWidth: '100vw' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        * { box-sizing: border-box; }
        a { color: inherit; }
        input::placeholder { color: ${V.dim}; }
        input:focus { border-color: ${V.accent} !important; box-shadow: 0 0 0 2px ${V.accentDim}; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <SourcingNav
        active="directory"
        tenantSlug={tenantSlug}
        tenantName={tenant?.nav_label || tenant?.name}
        features={tenant?.features}
        brandColor={tenant?.brand_color}
      />

      {/* Hero Banner with industry image */}
      {tenant ? (
        <div style={{
          position: 'relative',
          width: '100%',
          minHeight: 200,
          backgroundImage: `linear-gradient(to top, ${V.bg} 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.3) 100%), url(${getVerticalImage(tenant.vertical)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}>
          <div style={{ padding: '48px 24px 32px', maxWidth: 900, width: '100%', textAlign: 'center' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: tenant.brand_color || V.accent,
              letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10,
              textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}>
              {tenant.nav_label || tenant.name}
            </div>
            <h1 style={{
              fontSize: 'clamp(28px, 5vw, 48px)',
              fontWeight: tenant.slug === 'space-rising' ? 700 : 800,
              fontFamily: tenantBrand?.headingFont || V.syne,
              textTransform: tenantBrand ? 'uppercase' : undefined,
              letterSpacing: tenantBrand ? '0.04em' : undefined,
              color: '#fff', lineHeight: 1.15, margin: '0 0 10px',
              textShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}>
              {tenant.name}
            </h1>
            <p style={{
              fontSize: 16,
              color: 'rgba(255,255,255,0.8)',
              fontFamily: tenantBrand?.bodyFont || V.space,
              maxWidth: 580, margin: '0 auto 28px', lineHeight: 1.6,
              textShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}>
              {tenant.hero_text || "Verified companies, certifications, and capabilities in one place."}
            </p>
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              onSearch={handleSearch}
              loading={loading}
              aiLoading={aiLoading}
              V={V}
            />
          </div>
        </div>
      ) : (
        <div style={{ padding: '52px 24px 36px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.accent,
            letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14,
          }}>
            sourcing.directory -- Arizona
          </div>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, fontFamily: V.syne,
            color: V.heading, lineHeight: 1.15, margin: '0 0 14px',
          }}>
            Find Certified Suppliers & Partners
          </h1>
          <p style={{
            fontSize: 16, color: V.muted, fontFamily: V.space,
            maxWidth: 580, margin: '0 auto 32px', lineHeight: 1.6,
          }}>
            Arizona's semiconductor, space, and advanced industry directory. Verified companies, certifications, and capabilities in one place.
          </p>
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            onSearch={handleSearch}
            loading={loading}
            aiLoading={aiLoading}
            V={V}
          />
        </div>
      )}

      {/* Vertical Tabs */}
      <div style={{
        padding: '0 24px 0', maxWidth: 900, margin: '0 auto',
        display: 'flex', gap: 8,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
        className="hide-scrollbar"
      >
        {VERTICALS.map(v => (
          <button
            key={v.key}
            onClick={() => { handleVerticalChange(v.key); setShowSaved(false); }}
            style={{
              background: !showSaved && vertical === v.key ? `${v.color}20` : 'transparent',
              border: `1px solid ${!showSaved && vertical === v.key ? v.color : V.border}`,
              color: !showSaved && vertical === v.key ? v.color : V.muted,
              borderRadius: 6, padding: '7px 14px', fontSize: 12,
              fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
              whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}
          >
            {v.label}
          </button>
        ))}

        {/* Saved tab */}
        <button
          onClick={() => setShowSaved(s => !s)}
          style={{
            background: showSaved ? 'rgba(239,68,68,0.12)' : 'transparent',
            border: `1px solid ${showSaved ? 'rgba(239,68,68,0.4)' : V.border}`,
            color: showSaved ? '#EF4444' : V.muted,
            borderRadius: 6, padding: '7px 14px', fontSize: 12,
            fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
            transition: 'all 0.15s',
          }}
        >
          {showSaved ? '♥' : '♡'}
          Saved
          {favorites.length > 0 && (
            <span style={{
              background: '#EF4444', color: '#fff', borderRadius: 10,
              fontSize: 9, fontWeight: 800, padding: '1px 5px',
            }}>
              {favorites.length}
            </span>
          )}
        </button>

        <div style={{ flex: 1 }} />

        {/* Map toggle */}
        <button
          onClick={() => setShowMap(m => !m)}
          title={showMap ? 'Grid view' : 'Map view'}
          style={{
            background: showMap ? V.accentDim : 'transparent',
            border: `1px solid ${showMap ? V.accentBrd : V.border}`,
            color: showMap ? V.accent : V.muted,
            borderRadius: 6, padding: '7px 10px', fontSize: 12,
            fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'all 0.15s',
          }}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M1 6l7-4 8 4 7-4v16l-7 4-8-4-7 4V6z"/><path d="M8 2v16M16 6v16"/>
          </svg>
          Map
        </button>

        {availableCerts.length > 0 && (
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              background: showFilters ? V.accentDim : 'transparent',
              border: `1px solid ${showFilters ? V.accentBrd : V.border}`,
              color: showFilters ? V.accent : V.muted,
              borderRadius: 6, padding: '7px 14px', fontSize: 12,
              fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filters
            {selectedCerts.length > 0 && (
              <span style={{
                background: V.accent, color: '#fff', borderRadius: 10,
                fontSize: 9, fontWeight: 800, padding: '1px 5px',
              }}>
                {selectedCerts.length}
              </span>
            )}
          </button>
        )}
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
      <div style={{ padding: '20px 24px 60px', maxWidth: 900, margin: '0 auto' }}>
        {/* Scout AI Answer Card -- streaming text response above the grid */}
        <ScoutAnswerCard text={scoutAnswer} streaming={scoutStreaming} V={V} />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
            {loading ? 'Searching...' : (
              <>
                <span style={{ color: V.text, fontWeight: 600 }}>{filteredCompanies.length}</span>
                {' '}compan{filteredCompanies.length === 1 ? 'y' : 'ies'} found
                {query && <> for <span style={{ color: V.accent }}>"{query}"</span></>}
              </>
            )}
          </div>
          <Link
            to={tenantSlug ? `/sourcing/${tenantSlug}/signup` : '/sourcing/signup'}
            style={{
              fontSize: 12, color: V.muted, fontFamily: V.space,
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add your company
          </Link>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{
                background: V.card, border: `1px solid ${V.border}`,
                borderRadius: 10, padding: '18px 20px',
                display: 'flex', flexDirection: 'column', gap: 12,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: V.card2, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ height: 14, borderRadius: 4, background: V.card2, width: '65%' }} />
                    <div style={{ height: 10, borderRadius: 4, background: V.card2, width: '45%' }} />
                  </div>
                </div>
                <div style={{ height: 11, borderRadius: 4, background: V.card2, width: '100%' }} />
                <div style={{ height: 11, borderRadius: 4, background: V.card2, width: '85%' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ height: 20, borderRadius: 4, background: V.card2, width: 70 }} />
                  <div style={{ height: 20, borderRadius: 4, background: V.card2, width: 50 }} />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
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
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 12,
          }}>
            {showSaved ? (
              <div style={{ fontSize: 32, marginBottom: 12 }}>♡</div>
            ) : (
              <svg width="56" height="56" fill="none" stroke={V.dim} strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16, opacity: 0.5 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            )}
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 8 }}>
              {showSaved ? 'No saved companies yet' : 'No companies found'}
            </div>
            <div style={{ fontSize: 14, color: V.muted, fontFamily: V.space, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
              {showSaved
                ? 'Click ♡ on any listing to save it.'
                : (query ? `No results for "${query}". Try different keywords or broaden your filters.` : 'No companies in this vertical yet. Be the first to join.')}
            </div>
            <Link
              to={tenantSlug ? `/sourcing/${tenantSlug}/signup` : '/sourcing/signup'}
              style={{
                background: V.accent, color: '#fff', textDecoration: 'none',
                borderRadius: 7, padding: '10px 20px', fontSize: 13,
                fontWeight: 700, fontFamily: V.space, display: 'inline-block',
              }}
            >
              Add Your Company
            </Link>
          </div>
        )}
      </div>
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
