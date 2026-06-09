import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SourcingNav } from './SourcingMarketplace.jsx';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

// Round-stage filter chips
const STAGE_FILTERS = [
  { key: 'all',       label: 'All Rounds' },
  { key: 'pre-seed',  label: 'Pre-Seed' },
  { key: 'seed',      label: 'Seed' },
  { key: 'series-a',  label: 'Series A' },
  { key: 'series-b',  label: 'Series B' },
  { key: 'series-c',  label: 'Series C' },
  { key: 'series-d+', label: 'Series D+' },
  { key: 'growth',    label: 'Growth / Other' },
];

const STAGE_COLORS = {
  'pre-seed':  { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.4)', text: '#94A3B8' },
  'seed':      { bg: 'rgba(168,133,96,0.14)',  border: 'rgba(212,184,150,0.4)', text: '#D4B896' },
  'series-a':  { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.4)',   text: '#86EFAC' },
  'series-b':  { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.4)',  text: '#93C5FD' },
  'series-c':  { bg: 'rgba(168,85,247,0.12)',  border: 'rgba(168,85,247,0.4)',  text: '#D8B4FE' },
  'series-d+': { bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.4)',  text: '#F9A8D4' },
  'growth':    { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.4)',  text: '#FCD34D' },
};

function classifyStage(round) {
  if (!round) return 'growth';
  const r = round.toLowerCase();
  if (r.includes('pre-seed') || r.startsWith('pre seed')) return 'pre-seed';
  if (r.startsWith('seed')) return 'seed';
  if (r.startsWith('series a')) return 'series-a';
  if (r.startsWith('series b')) return 'series-b';
  if (r.startsWith('series c')) return 'series-c';
  if (r.startsWith('series d') || r.startsWith('series e') || r.startsWith('series f') || r.startsWith('series g')) return 'series-d+';
  return 'growth';
}

const LETTER_PALETTES = [
  { bg: 'rgba(229,69,31,0.18)',  fg: '#F0A882' },
  { bg: 'rgba(59,130,246,0.18)', fg: '#93C5FD' },
  { bg: 'rgba(168,85,247,0.18)', fg: '#D8B4FE' },
  { bg: 'rgba(34,197,94,0.18)',  fg: '#86EFAC' },
  { bg: 'rgba(245,158,11,0.18)', fg: '#FCD34D' },
  { bg: 'rgba(236,72,153,0.18)', fg: '#F9A8D4' },
  { bg: 'rgba(20,184,166,0.18)', fg: '#5EEAD4' },
];
function letterPalette(s) {
  if (!s) return LETTER_PALETTES[0];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return LETTER_PALETTES[Math.abs(h) % LETTER_PALETTES.length];
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

// Extract a short headline ("$450M", "$1.2B", "$5M") from a longer amount string
// so the row stays clean. Long descriptors ("$450M total ($300M equity + $155M debt)")
// move to the expanded body.
function amountHeadline(amountStr, amountUsdM) {
  if (typeof amountUsdM === 'number') {
    if (amountUsdM >= 1000) {
      const b = amountUsdM / 1000;
      return `$${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B`;
    }
    if (amountUsdM > 0) {
      return `$${amountUsdM % 1 === 0 ? amountUsdM.toFixed(0) : amountUsdM.toFixed(1)}M`;
    }
  }
  if (!amountStr) return null;
  // Pull the first "$NNM" or "$NN.NB" pattern out of the string
  const m = String(amountStr).match(/\$\s*[\d.,]+\s*[MBKmbk]/);
  if (m) return m[0].replace(/\s+/g, '');
  // Otherwise return first ~10 chars
  const trimmed = String(amountStr).trim();
  return trimmed.length > 12 ? trimmed.slice(0, 10) + '…' : trimmed;
}

// Is the amount string longer than its headline? If so, the descriptor belongs in the expanded body.
function hasAmountDescriptor(amountStr, headline) {
  if (!amountStr || !headline) return false;
  const a = String(amountStr).trim();
  return a !== headline && a.length > headline.length + 1;
}

function StageBadge({ round, V }) {
  const stage = classifyStage(round);
  const c = STAGE_COLORS[stage] || STAGE_COLORS['growth'];
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: 10, fontWeight: 700, fontFamily: V.mono,
      padding: '2px 7px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      whiteSpace: 'nowrap',
    }}>
      {round || 'Round'}
    </span>
  );
}

function DealRow({ deal, V, expanded, onToggle }) {
  const pal = letterPalette(deal.company);
  const letter = (deal.company || '?').trim().charAt(0).toUpperCase();
  const dateStr = formatDate(deal.date);
  const headline = amountHeadline(deal.amount_raised, deal.amount_usd_m);
  const showDescriptor = hasAmountDescriptor(deal.amount_raised, headline);

  return (
    <div
      onClick={onToggle}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      role="button" tabIndex={0}
      aria-expanded={expanded}
      className="db-row"
      style={{
        background: expanded ? V.card2 : V.card,
        border: `1px solid ${expanded ? V.accentBrd : V.border}`,
        borderRadius: 12,
        padding: '16px 18px',
        cursor: 'pointer',
        transition: 'border-color .15s, background .15s',
      }}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.borderColor = V.accentBrd; }}
      onMouseLeave={e => { if (!expanded) e.currentTarget.style.borderColor = V.border; }}
    >
      <div className="db-row-grid" style={{ display: 'grid', gap: 16, alignItems: 'center' }}>
        <div className="db-row-avatar" style={{
          width: 52, height: 52, borderRadius: 12,
          background: pal.bg, color: pal.fg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: V.syne || V.heading || 'Oswald, sans-serif',
          fontSize: 22, fontWeight: 700,
          flexShrink: 0,
        }}>{letter}</div>

        <div className="db-row-mid" style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 17, fontWeight: 700,
            fontFamily: V.syne || V.heading || 'Oswald, sans-serif',
            color: V.heading || V.text,
            lineHeight: 1.2, marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{deal.company}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StageBadge round={deal.round} V={V} />
            {deal.segment && (
              <span style={{
                fontSize: 11, color: V.muted,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${V.border}`,
                padding: '2px 8px', borderRadius: 3,
                letterSpacing: '0.02em',
              }}>{deal.segment}</span>
            )}
            {dateStr && (
              <span style={{ fontSize: 12, color: V.muted, fontFamily: V.mono }}>{dateStr}</span>
            )}
          </div>
        </div>

        <div className="db-row-right" style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="db-amount" style={{
            fontFamily: V.syne || V.heading || 'Oswald, sans-serif',
            fontWeight: 700, color: V.accent,
            lineHeight: 1, whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
          }}>{headline || '—'}</div>
          {deal.region && (
            <div style={{ fontSize: 11, color: V.muted, marginTop: 5, fontFamily: V.mono }}>{deal.region}</div>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{
          marginTop: 14, paddingTop: 14,
          borderTop: `1px solid ${V.border}`,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {showDescriptor && (
            <div style={{
              fontSize: 13, color: V.text, lineHeight: 1.45,
              fontFamily: V.mono,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: V.muted,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                marginRight: 8,
              }}>Amount</span>
              {deal.amount_raised}
            </div>
          )}
          {deal.short_description && (
            <div style={{ fontSize: 14, color: V.text, lineHeight: 1.55 }}>{deal.short_description}</div>
          )}
          {deal.investors && (
            <div style={{ fontSize: 12, color: V.muted, lineHeight: 1.55 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: V.text,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                fontFamily: V.mono, marginBottom: 4,
              }}>Investors</div>
              {deal.investors}
            </div>
          )}
          {deal.notes && !deal.short_description && (
            <div style={{ fontSize: 13, color: V.muted, lineHeight: 1.55, fontStyle: 'italic' }}>{deal.notes}</div>
          )}
          {deal.source_url && (
            <a
              href={deal.source_url}
              target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700,
                color: V.accent, textDecoration: 'none',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                fontFamily: V.mono,
              }}
            >
              {deal.source ? `${deal.source} ↗` : 'View source ↗'}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inner Component ──────────────────────────────────────────────────────────
function SourcingDealBankInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { tenant, tenantSlug, loading: tenantLoading } = useTenant();

  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  // Fetch from the AOM-EA-managed API (single source of truth for completed-rounds data).
  // CORS-enabled, public read. Returns up to 1000 rows ordered by amount_usd_m desc.
  useEffect(() => {
    document.title = 'Deal Bank — Space Rising Interactive';
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch('https://www.aheadofmarket.com/api/deal-bank/completed');
        if (!r.ok) throw new Error(`API ${r.status}`);
        const j = await r.json();
        if (!cancelled) setDeals(Array.isArray(j.rounds) ? j.rounds : []);
      } catch (err) {
        console.error('Deal Bank fetch error:', err);
        if (!cancelled) setDeals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter(d => {
      if (stage !== 'all' && classifyStage(d.round) !== stage) return false;
      if (!q) return true;
      return (
        (d.company || '').toLowerCase().includes(q) ||
        (d.round || '').toLowerCase().includes(q) ||
        (d.segment || '').toLowerCase().includes(q) ||
        (d.short_description || '').toLowerCase().includes(q) ||
        (d.investors || '').toLowerCase().includes(q) ||
        (d.notes || '').toLowerCase().includes(q)
      );
    });
  }, [deals, search, stage]);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--tx)' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        /* Default grid: avatar + content + amount */
        .db-row-grid { grid-template-columns: 52px 1fr auto; }
        .db-amount { font-size: 24px; }
        /* Mobile: drop amount to its own row under the content, reduce font */
        @media (max-width: 640px) {
          .db-row-grid {
            grid-template-columns: 44px 1fr;
            grid-template-areas: "avatar mid" "amount amount";
            row-gap: 10px;
          }
          .db-row-avatar { grid-area: avatar; width: 44px; height: 44px; font-size: 18px; border-radius: 10px; }
          .db-row-mid { grid-area: mid; }
          .db-row-right { grid-area: amount; text-align: left; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
          .db-amount { font-size: 20px; }
          /* Tighter horizontal padding on small screens */
          .db-section-pad { padding-left: 16px !important; padding-right: 16px !important; }
        }
      `}</style>

      <SourcingNav
        active="deal-bank"
        tenantSlug={tenantSlug}
        tenantName={tenant?.nav_label || tenant?.name}
        features={tenant?.features}
        brandColor={tenant?.brand_color}
      />

      {/* v10 Hero */}
      <div className="browse-hero" style={{ minHeight: 200 }}>
        <div
          className="browse-hero-bg"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1446776709462-d6b525c57bd3?w=1200&q=80')" }}
        />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content">
          <Link
            to={tenantSlug ? `/${tenantSlug}` : '/'}
            className="browse-back"
            style={{ textDecoration: 'none' }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <div className="browse-title">Deal Bank</div>
          <div className="browse-sub">
            {filtered.length > 0 && !loading
              ? `${deals.length}+ closed space funding rounds. Pre-seed through growth.`
              : 'Closed space funding rounds. Pre-seed through growth, curated by the Space Rising team.'}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="db-section-pad" style={{ padding: '0 24px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company, segment, investors, round..."
            style={{
              width: '100%',
              background: V.card2, border: `1px solid ${V.border}`,
              color: V.text, borderRadius: 8, padding: '10px 42px 10px 14px',
              fontSize: 14, fontFamily: V.space, outline: 'none',
            }}
          />
          <div style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            color: V.muted,
          }}>
            {loading
              ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${V.dim}`, borderTop: `2px solid ${V.accent}`, animation: 'spin 0.8s linear infinite' }} />
              : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            }
          </div>
        </div>

        {/* Round-stage filter chips */}
        <div className="chips" style={{ paddingBottom: 4 }}>
          {STAGE_FILTERS.map(s => (
            <div
              key={s.key}
              className={`chip ${stage === s.key ? 'on' : ''}`}
              onClick={() => setStage(s.key)}
              role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStage(s.key); } }}
            >
              {s.label}
            </div>
          ))}
        </div>

        {/* Count */}
        <div style={{
          marginTop: 16, marginBottom: 12,
          fontSize: 11, color: V.muted, fontFamily: V.mono,
          textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700,
        }}>
          {loading
            ? 'Loading rounds…'
            : (
              <>
                <span style={{ color: V.text }}>{filtered.length}</span>{' '}
                {filtered.length === 1 ? 'round' : 'rounds'}
                {(search || stage !== 'all') ? ' matching' : ''}
                {deals.length !== filtered.length ? ` of ${deals.length} total` : ''}
              </>
            )
          }
        </div>
      </div>

      {/* List */}
      <div className="db-section-pad" style={{ padding: '0 24px 60px', maxWidth: 960, margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{
                height: 80, background: V.card, border: `1px solid ${V.border}`,
                borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: '60px 24px', textAlign: 'center',
            color: V.muted, fontSize: 14,
          }}>
            No rounds match these filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(d => {
              const id = d.id || `${d.company}-${d.round}-${d.date}`;
              return (
                <DealRow
                  key={id}
                  deal={d}
                  V={V}
                  expanded={expandedId === id}
                  onToggle={() => setExpandedId(expandedId === id ? null : id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SourcingDealBank() {
  return (
    <SourcingThemeProvider>
      <SourcingDealBankInner />
    </SourcingThemeProvider>
  );
}
