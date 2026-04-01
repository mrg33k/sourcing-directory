import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingNav } from './SourcingMarketplace.jsx';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

const GRANT_TYPES = [
  { key: 'all',       label: 'All Types' },
  { key: 'federal',   label: 'Federal' },
  { key: 'state',     label: 'State' },
  { key: 'private',   label: 'Private' },
  { key: 'nonprofit', label: 'Nonprofit' },
  { key: 'local',     label: 'Local' },
];

const SIZE_TIERS = [
  { key: 'all',  label: 'Any Size',     min: null,    max: null },
  { key: 'sm',   label: 'Under $25k',   min: null,    max: 25000 },
  { key: 'md',   label: '$25k – $250k', min: 25000,   max: 250000 },
  { key: 'lg',   label: '$250k+',       min: 250000,  max: null },
];

const TYPE_COLORS = {
  federal:   { bg: 'rgba(41,182,246,0.1)',  border: 'rgba(41,182,246,0.4)',  text: '#29B6F6' },
  state:     { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.4)',   text: '#4ADE80' },
  private:   { bg: 'rgba(168,85,247,0.1)',  border: 'rgba(168,85,247,0.4)',  text: '#C084FC' },
  nonprofit: { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.4)',  text: '#FCD34D' },
  local:     { bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.4)',  text: '#FB923C' },
};

function formatAmount(min, max) {
  const fmt = (n) => {
    if (!n && n !== 0) return null;
    if (n >= 1000000) return `$${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return `$${n.toLocaleString()}`;
  };
  const lo = fmt(min);
  const hi = fmt(max);
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return `${lo}+`;
  if (hi) return `Up to ${hi}`;
  return 'Amount TBD';
}

function TypeBadge({ grantType, V }) {
  const c = TYPE_COLORS[grantType];
  if (!c) return null;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: 10, fontWeight: 700, fontFamily: V.mono,
      padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase',
      letterSpacing: '0.08em', whiteSpace: 'nowrap',
    }}>
      {grantType}
    </span>
  );
}

function DeadlineBadge({ deadline, V }) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const daysLeft = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const urgent = daysLeft <= 30;
  const expired = daysLeft < 0;
  const col = expired ? '#6B7280' : urgent ? '#EF4444' : V.muted;

  return (
    <span style={{ fontSize: 11, color: col, fontFamily: V.mono, display: 'flex', alignItems: 'center', gap: 4 }}>
      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      {expired ? 'Closed' : label}
      {!expired && urgent && <span style={{ color: '#EF4444' }}> ({daysLeft}d left)</span>}
    </span>
  );
}

// ─── Grant Card ───────────────────────────────────────────────────────────────
function GrantCard({ grant, V }) {
  const [hovered, setHovered] = useState(false);
  const excerpt = grant.description
    ? grant.description.slice(0, 160) + (grant.description.length > 160 ? '…' : '')
    : '';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? V.cardHov : V.card,
        border: `1px solid ${hovered ? V.accentBrd : V.border}`,
        borderRadius: 10, padding: '20px 22px',
        cursor: 'default', transition: 'all 0.15s ease',
        display: 'flex', flexDirection: 'column', gap: 12,
        boxShadow: hovered ? `0 0 0 1px ${V.accent}20` : 'none',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16, fontWeight: 700, fontFamily: V.syne, color: V.heading,
            lineHeight: 1.3, marginBottom: 4,
          }}>
            {grant.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <TypeBadge grantType={grant.grant_type} V={V} />
            <DeadlineBadge deadline={grant.deadline} V={V} />
          </div>
        </div>
        <div style={{
          flexShrink: 0, textAlign: 'right',
          background: `${V.accent}12`, border: `1px solid ${V.accentBrd}`,
          borderRadius: 8, padding: '8px 14px',
        }}>
          <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            Award
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, fontFamily: V.syne, color: V.accent, whiteSpace: 'nowrap' }}>
            {formatAmount(grant.grant_amount_min, grant.grant_amount_max)}
          </div>
        </div>
      </div>

      {/* Description */}
      {excerpt && (
        <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space, lineHeight: 1.6 }}>
          {excerpt}
        </div>
      )}

      {/* Eligibility */}
      {grant.eligibility_criteria && (
        <div style={{
          background: V.card2, border: `1px solid ${V.border}`,
          borderRadius: 6, padding: '10px 12px',
        }}>
          <div style={{ fontSize: 10, color: V.dim, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Eligibility
          </div>
          <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, lineHeight: 1.5 }}>
            {grant.eligibility_criteria.slice(0, 180)}{grant.eligibility_criteria.length > 180 ? '…' : ''}
          </div>
        </div>
      )}

      {/* CTA */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
        {grant.application_url ? (
          <a
            href={grant.application_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: V.accent, color: '#fff', textDecoration: 'none',
              borderRadius: 7, padding: '8px 18px', fontSize: 13,
              fontWeight: 700, fontFamily: V.space,
            }}
          >
            Apply Now
          </a>
        ) : (
          <span style={{ fontSize: 12, color: V.dim, fontFamily: V.mono }}>
            Contact for details
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Article Strip (horizontal scroll) ───────────────────────────────────────
function GrantArticleCard({ article, V }) {
  const [hovered, setHovered] = useState(false);
  const date = new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <Link
      to={`/articles/${article.id}`}
      style={{ textDecoration: 'none', flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: 220, background: hovered ? V.cardHov : V.card,
        border: `1px solid ${hovered ? V.accentBrd : V.border}`,
        borderRadius: 10, overflow: 'hidden',
        transition: 'all 0.15s ease',
      }}>
        {article.cover_image_url ? (
          <div style={{ width: '100%', height: 120, overflow: 'hidden' }}>
            <img
              src={article.cover_image_url}
              alt={article.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ) : (
          <div style={{
            width: '100%', height: 120,
            background: `${V.accent}12`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" fill="none" stroke={V.accent} strokeWidth="1.5" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
        )}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: V.syne, color: V.heading, lineHeight: 1.3, marginBottom: 6,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {article.title}
          </div>
          <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>{date}</div>
        </div>
      </div>
    </Link>
  );
}

// ─── Inner Component ──────────────────────────────────────────────────────────
function SourcingGrantsInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { tenant, tenantSlug, loading: tenantLoading } = useTenant();

  const [grants, setGrants] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [grantType, setGrantType] = useState('all');
  const [sizeTier, setSizeTier] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Fetch grant articles (tagged 'grants')
  const fetchArticles = useCallback(async () => {
    if (!supabase) { setArticlesLoading(false); return; }
    setArticlesLoading(true);
    try {
      let qb = supabase
        .from('directory_listings')
        .select('id, title, cover_image_url, created_at, tags')
        .eq('category', 'article')
        .eq('status', 'active')
        .contains('tags', ['grants'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
      const { data, error } = await qb;
      if (error) throw error;
      setArticles(data || []);
    } catch (err) {
      console.error('Grant articles fetch error:', err);
    } finally {
      setArticlesLoading(false);
    }
  }, [tenant]);

  // Fetch grants database
  const fetchGrants = useCallback(async (q, gt, tier) => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    try {
      let qb = supabase
        .from('directory_listings')
        .select('*')
        .eq('category', 'grant')
        .eq('status', 'active')
        .order('deadline', { ascending: true, nullsFirst: false });

      if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
      if (gt && gt !== 'all') qb = qb.eq('grant_type', gt);
      if (q && q.trim()) qb = qb.or(`title.ilike.%${q}%,description.ilike.%${q}%`);

      // Size tier: filter by amount range
      const tierConfig = SIZE_TIERS.find(s => s.key === tier);
      if (tierConfig) {
        if (tierConfig.min !== null) qb = qb.gte('grant_amount_max', tierConfig.min);
        if (tierConfig.max !== null) qb = qb.lte('grant_amount_min', tierConfig.max);
      }

      const { data, error } = await qb.limit(50);
      if (error) throw error;
      setGrants(data || []);
    } catch (err) {
      console.error('Grants fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (tenantSlug && tenantLoading) return;
    fetchArticles();
    fetchGrants(query, grantType, sizeTier);
  }, [query, grantType, sizeTier, fetchArticles, fetchGrants, tenantLoading, tenantSlug]);

  const handleSearch = () => setQuery(searchInput.trim());

  const activeFilterCount = [
    grantType !== 'all',
    sizeTier !== 'all',
  ].filter(Boolean).length;

  return (
    <div style={{ minHeight: '100vh', background: V.bg, color: V.text }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        * { box-sizing: border-box; }
        a { color: inherit; }
        input::placeholder { color: ${V.dim}; }
        input:focus { border-color: ${V.accentBrd} !important; box-shadow: 0 0 0 2px ${V.accentDim}; }
        .grants-articles-strip::-webkit-scrollbar { display: none; }
        @media (min-width: 640px) { .grants-filters-panel { display: flex !important; } .grants-filters-toggle { display: none !important; } }
      `}</style>

      <SourcingNav active="grants" tenantSlug={tenantSlug} tenantName={tenant?.nav_label || tenant?.name} features={tenant?.features} brandColor={tenant?.brand_color} />

      {/* Hero */}
      <div style={{ padding: '40px 24px 28px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.accent, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
          Grants Database
        </div>
        <h1 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, fontFamily: V.syne, color: V.heading, margin: '0 0 8px', lineHeight: 1.15 }}>
          Funding & Grants
        </h1>
        <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, margin: 0 }}>
          Federal, state, and private grants for Arizona's advanced technology companies.
        </p>
      </div>

      {/* Grant Articles Strip */}
      {(articlesLoading || articles.length > 0) && (
        <div style={{ padding: '0 24px 32px', maxWidth: 960, margin: '0 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: V.mono, color: V.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Latest Grant News
          </div>
          <div
            className="grants-articles-strip"
            style={{
              display: 'flex', gap: 12, overflowX: 'auto',
              paddingBottom: 8, scrollbarWidth: 'none', msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {articlesLoading
              ? [1, 2, 3, 4].map(i => (
                  <div key={i} style={{
                    width: 220, height: 200, flexShrink: 0,
                    background: V.card, border: `1px solid ${V.border}`,
                    borderRadius: 10, animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                ))
              : articles.map(a => <GrantArticleCard key={a.id} article={a} V={V} />)
            }
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: V.border, maxWidth: 960, margin: '0 auto 28px', padding: '0 24px' }}>
        <div style={{ height: 1, background: V.border }} />
      </div>

      {/* Search + Filters */}
      <div style={{ padding: '0 24px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search grants by name or description..."
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
          <button
            className="grants-filters-toggle"
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
          className="grants-filters-panel"
          style={{
            display: filtersOpen ? 'flex' : 'none',
            flexDirection: 'column', gap: 12,
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, padding: '16px 18px', marginBottom: 16,
          }}
        >
          {/* Grant Type */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0, minWidth: 52 }}>Type</span>
            {GRANT_TYPES.map(gt => {
              const isActive = grantType === gt.key;
              return (
                <button key={gt.key} onClick={() => setGrantType(gt.key)} style={{
                  background: isActive ? V.accentDim : 'transparent',
                  border: `1px solid ${isActive ? V.accentBrd : V.border}`,
                  color: isActive ? V.accent : V.muted,
                  borderRadius: 6, padding: '5px 11px', fontSize: 12,
                  fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}>
                  {gt.label}
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: V.border }} />

          {/* Size Tier */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0, minWidth: 52 }}>Size</span>
            {SIZE_TIERS.map(s => {
              const isActive = sizeTier === s.key;
              return (
                <button key={s.key} onClick={() => setSizeTier(s.key)} style={{
                  background: isActive ? V.accentDim : 'transparent',
                  border: `1px solid ${isActive ? V.accentBrd : V.border}`,
                  color: isActive ? V.accent : V.muted,
                  borderRadius: 6, padding: '5px 11px', fontSize: 12,
                  fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}>
                  {s.label}
                </button>
              );
            })}
          </div>

          {activeFilterCount > 0 && (
            <>
              <div style={{ height: 1, background: V.border }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => { setGrantType('all'); setSizeTier('all'); }} style={{
                  background: 'transparent', border: `1px solid ${V.border}`,
                  color: V.muted, borderRadius: 6, padding: '5px 11px', fontSize: 12,
                  fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
                }}>
                  Clear all
                </button>
              </div>
            </>
          )}
        </div>

        {/* Results count */}
        <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space, marginBottom: 16 }}>
          {loading ? 'Loading...' : (
            <>
              <span style={{ color: V.text, fontWeight: 600 }}>{grants.length}</span>
              {' '}grant{grants.length !== 1 ? 's' : ''}
              {query && <> matching <span style={{ color: V.accent }}>"{query}"</span></>}
            </>
          )}
        </div>
      </div>

      {/* Grants List */}
      <div style={{ padding: '0 24px 60px', maxWidth: 960, margin: '0 auto' }}>
        {!supabase && (
          <div style={{ background: V.accentDim, border: `1px solid ${V.accentBrd}`, borderRadius: 8, padding: '20px 24px', textAlign: 'center' }}>
            <div style={{ color: V.accent, fontFamily: V.mono, fontSize: 13, marginBottom: 8 }}>Supabase not configured</div>
            <div style={{ color: V.muted, fontFamily: V.space, fontSize: 12 }}>Run migration 010_grants.sql in Supabase SQL editor to activate.</div>
          </div>
        )}

        {loading && supabase && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, height: 160, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {!loading && grants.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {grants.map(grant => <GrantCard key={grant.id} grant={grant} V={V} />)}
          </div>
        )}

        {!loading && supabase && grants.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 12,
          }}>
            <svg width="48" height="48" fill="none" stroke={V.dim} strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16, opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
              No grants found
            </div>
            <div style={{ fontSize: 14, color: V.muted, fontFamily: V.space, maxWidth: 360, margin: '0 auto' }}>
              {query
                ? `No results for "${query}". Try different keywords or clear your filters.`
                : 'No grants match your current filters. Try adjusting the type or size tier.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SourcingGrants() {
  return (
    <SourcingThemeProvider>
      <SourcingGrantsInner />
    </SourcingThemeProvider>
  );
}
