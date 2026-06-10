// SourcingEventsV2.jsx
// Calendar redesign — upcoming-first, month-grouped, past events collapsed.

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import { V2ChipNav } from './V2ChipNav.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';
const TENANT_DB_LOOKUP_SLUG = 'space-rising';

// ─── date helpers ────────────────────────────────────────────────────────────

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatShortDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMonthLabel(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return 'UNDATED';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
}

function getDayNum(dateStr) {
  const d = parseDate(dateStr);
  return d ? d.getDate() : null;
}

function getDayName(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

function getMonthAbbr(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

function isToday(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function groupByMonth(events) {
  const groups = {};
  const order = [];
  events.forEach((e) => {
    const key = getMonthLabel(e.event_date);
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(e);
  });
  return { groups, order };
}

// ─── sub-components ──────────────────────────────────────────────────────────

function CalendarEventRow({ listing, companies }) {
  const company = companies[listing.company_id];
  const loc = listing.event_location || (listing.virtual_url ? 'Virtual' : '');
  const dayNum = getDayNum(listing.event_date);
  const dayName = getDayName(listing.event_date);
  const today = isToday(listing.event_date);

  return (
    <Link
      to={`/space-rising-v2/events/${listing.id}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: '1px solid rgba(232,228,218,0.07)', transition: 'background 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(232,162,58,0.05)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Date pill */}
      <div style={{ flexShrink: 0, width: 48, textAlign: 'center', padding: '6px 0', borderRadius: 8, background: today ? 'rgba(232,162,58,0.15)' : 'rgba(232,228,218,0.06)', border: today ? '1px solid rgba(232,162,58,0.40)' : '1px solid transparent' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: today ? '#E8A23A' : 'rgba(232,228,218,0.45)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>{dayName}</div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: today ? '#E8A23A' : '#E8E4DA', fontFamily: '"Space Grotesk", system-ui, sans-serif' }}>{dayNum}</div>
      </div>
      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#E8E4DA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{listing.title}</div>
        <div style={{ fontSize: 12, color: 'rgba(232,228,218,0.55)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {listing.organizer || company?.name ? <span>{listing.organizer || company?.name}</span> : null}
          {loc ? <><span style={{ opacity: 0.35 }}>·</span><span>{loc}</span></> : null}
          {listing.event_type ? <><span style={{ opacity: 0.35 }}>·</span><span style={{ textTransform: 'capitalize' }}>{listing.event_type}</span></> : null}
        </div>
      </div>
      {/* Arrow */}
      <svg width="14" height="14" fill="none" stroke="rgba(232,228,218,0.30)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

function MonthSection({ label, events, companies }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 4 }}>
      {/* Month header */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: 'none', border: 'none', borderTop: '1px solid rgba(232,228,218,0.10)', cursor: 'pointer', color: 'inherit' }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: '#E8A23A', fontFamily: 'JetBrains Mono, ui-monospace, monospace', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ flex: 1, height: 1, background: 'rgba(232,228,218,0.08)' }} />
        <span style={{ fontSize: 11, color: 'rgba(232,228,218,0.40)', fontFamily: 'JetBrains Mono, ui-monospace, monospace', whiteSpace: 'nowrap' }}>{events.length} event{events.length !== 1 ? 's' : ''}</span>
        <svg width="12" height="12" fill="none" stroke="rgba(232,228,218,0.35)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div>
          {events.map((e) => (
            <CalendarEventRow key={e.id} listing={e} companies={companies} />
          ))}
        </div>
      )}
    </div>
  );
}

function NextUpCard({ listing, companies }) {
  const company = companies[listing.company_id];
  const loc = listing.event_location || (listing.virtual_url ? 'Virtual' : '');
  const dayNum = getDayNum(listing.event_date);
  const dayName = getDayName(listing.event_date);
  const monthAbbr = getMonthAbbr(listing.event_date);
  const today = isToday(listing.event_date);

  return (
    <Link
      to={`/space-rising-v2/events/${listing.id}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'flex-start', gap: 18, padding: '18px 20px', background: 'rgba(232,162,58,0.07)', border: '1px solid rgba(232,162,58,0.28)', borderRadius: 12, transition: 'border-color 0.15s, background 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(232,162,58,0.12)'; e.currentTarget.style.borderColor = 'rgba(232,162,58,0.50)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(232,162,58,0.07)'; e.currentTarget.style.borderColor = 'rgba(232,162,58,0.28)'; }}
    >
      {/* Big date block */}
      <div style={{ flexShrink: 0, width: 56, textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#E8A23A', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>{today ? 'TODAY' : monthAbbr}</div>
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: '#E8E4DA', fontFamily: '"Space Grotesk", system-ui, sans-serif', marginTop: 2 }}>{dayNum}</div>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.10em', color: 'rgba(232,228,218,0.40)', fontFamily: 'JetBrains Mono, ui-monospace, monospace', marginTop: 2 }}>{dayName}</div>
      </div>
      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {today && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#E8A23A', fontFamily: 'JetBrains Mono, ui-monospace, monospace', marginBottom: 4 }}>HAPPENING TODAY</div>}
        <div style={{ fontSize: 15, fontWeight: 700, color: '#E8E4DA', lineHeight: 1.3 }}>{listing.title}</div>
        <div style={{ fontSize: 12, color: 'rgba(232,228,218,0.55)', marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {listing.organizer || company?.name ? <span>{listing.organizer || company?.name}</span> : null}
          {loc ? <><span style={{ opacity: 0.35 }}>·</span><span>{loc}</span></> : null}
          {listing.event_type ? <><span style={{ opacity: 0.35 }}>·</span><span style={{ textTransform: 'capitalize' }}>{listing.event_type}</span></> : null}
        </div>
      </div>
      <svg width="14" height="14" fill="none" stroke="rgba(232,162,58,0.60)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 4 }}>
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

// ─── main inner component ─────────────────────────────────────────────────────

function SourcingEventsV2Inner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);

  const [tenant, setTenant] = useState(null);
  const [listings, setListings] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [pastExpanded, setPastExpanded] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from('directory_tenants')
        .select('*')
        .eq('slug', TENANT_DB_LOOKUP_SLUG)
        .single();
      if (data) setTenant(data);
    })();
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let qb = supabase
          .from('directory_listings')
          .select('*')
          .eq('category', 'event')
          .eq('status', 'active')
          .order('event_date', { ascending: true });
        if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
        const { data, error } = await qb.limit(200);
        if (error) throw error;
        if (cancelled) return;
        setListings(data || []);
        if (data && data.length > 0) {
          const companyIds = [...new Set(data.map((l) => l.company_id).filter(Boolean))];
          if (companyIds.length > 0) {
            const { data: compData } = await supabase
              .from('directory_companies')
              .select('*')
              .in('id', companyIds);
            const map = {};
            (compData || []).forEach((c) => { map[c.id] = c; });
            if (!cancelled) setCompanies(map);
          }
        } else {
          if (!cancelled) setCompanies({});
        }
      } catch (err) {
        console.error('EventsV2 fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant]);

  // Search-filtered flat list (used when searching)
  const filtered = useMemo(() => {
    if (!searchInput.trim()) return listings;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return listings.filter((l) => {
      const company = companies[l.company_id];
      const haystack = [l.title, l.description, l.event_location, l.event_type, l.organizer, company?.name]
        .filter(Boolean).join(' ').toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [listings, companies, searchInput]);

  // Calendar split: upcoming vs past
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcomingAll = useMemo(() => listings.filter((l) => {
    const d = parseDate(l.event_date);
    return d && d >= now;
  }), [listings]);

  const pastAll = useMemo(() => listings.filter((l) => {
    const d = parseDate(l.event_date);
    return !d || d < now;
  }), [listings]);

  // Next Up: first 3 upcoming events
  const nextUp = upcomingAll.slice(0, 3);

  // Remaining upcoming grouped by month (skip the first 3)
  const remaining = upcomingAll.slice(3);
  const { groups: upcomingGroups, order: upcomingOrder } = useMemo(() => groupByMonth(remaining), [remaining]);
  const { groups: pastGroups, order: pastOrder } = useMemo(() => groupByMonth(pastAll), [pastAll]);

  const isSearching = searchInput.trim().length > 0;

  return (
    <div
      data-tenant={TENANT_SLUG_V2}
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--tx)',
        position: 'relative',
        fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
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
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
      `}</style>

      {/* Hero */}
      <div className="browse-hero" style={{ '--page-hero-bg': "url('/v2-assets/starfield-dense.png')" }}>
        <div className="browse-hero-bg" />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <div className="browse-hero-toprow">
            <Link to="/space-rising-v2" className="browse-back" style={{ textDecoration: 'none' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
            <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
          </div>
          <div className="browse-title">Upcoming Events.</div>
          <div className="browse-sub">Industry meetups, summits, and showcases across the space sector.</div>
        </div>
      </div>

      {/* Search */}
      <div className="browse-search">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search events, organizers, locations..."
          aria-label="Search events"
          autoComplete="off"
          spellCheck="false"
        />
        {loading && <div className="spinner" />}
      </div>

      <V2ChipNav active="events" />

      {/* Header row */}
      <div className="sec-hdr">
        <div className="sec-title">
          {loading ? 'Loading...' : isSearching ? `${filtered.length} result${filtered.length === 1 ? '' : 's'}.` : `${listings.length} Events.`}
        </div>
        <div className="sec-count">
          <Link to="/space-rising-v2/events/post" style={{ textDecoration: 'none', color: 'var(--cyan)', fontSize: 12, fontWeight: 600 }}>
            + Post an Event
          </Link>
        </div>
      </div>

      {/* No supabase */}
      {!supabase && (
        <div style={{ margin: '0 20px 16px', padding: '24px 20px', border: '1px solid rgba(232,162,58,0.32)', background: 'rgba(232,162,58,0.10)', borderRadius: 10, color: '#E8A23A', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 13, textAlign: 'center' }}>
          Supabase not configured
        </div>
      )}

      {/* Loading skeletons */}
      {loading && supabase && (
        <div className="co-list">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 72, borderRadius: 10, background: 'rgba(18,20,28,0.40)', border: '1px solid rgba(232,228,218,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* ── Search mode: flat list ── */}
      {!loading && isSearching && (
        <div className="co-list">
          {filtered.map((listing) => {
            const company = companies[listing.company_id];
            const date = formatShortDate(listing.event_date);
            const loc = listing.event_location || (listing.virtual_url ? 'Virtual' : '');
            const isPast = listing.event_date && parseDate(listing.event_date) < new Date();
            return (
              <Link key={listing.id} to={`/space-rising-v2/events/${listing.id}`} className="co-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="co-body">
                  {company?.slug ? <img className="co-mono-logo" src={`/v2-assets/logos/${company.slug}-white.png`} alt="" aria-hidden="true" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
                  <div className="co-name">{listing.title}</div>
                  <div className="co-loc">{[listing.organizer || company?.name, loc, date].filter(Boolean).join(' · ')}</div>
                  <div className="co-badges">
                    {listing.event_type && <span className="co-badge cert">{listing.event_type}</span>}
                    {isPast && <span className="co-badge cert">Past</span>}
                    {!isPast && date && <span className="co-badge feat">{date}</span>}
                  </div>
                </div>
                <div className="co-arrow">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: 'rgba(232,228,218,0.55)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              No events match &ldquo;{searchInput}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* ── Calendar mode ── */}
      {!loading && !isSearching && (
        <div style={{ paddingBottom: 48 }}>

          {/* Next Up section */}
          {nextUp.length > 0 && (
            <div style={{ padding: '0 20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: '#E8A23A', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>COMING UP NEXT</span>
                <span style={{ flex: 1, height: 1, background: 'rgba(232,162,58,0.20)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {nextUp.map((e) => (
                  <NextUpCard key={e.id} listing={e} companies={companies} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming month groups */}
          {upcomingOrder.map((monthLabel) => (
            <MonthSection key={monthLabel} label={monthLabel} events={upcomingGroups[monthLabel]} companies={companies} />
          ))}

          {/* No upcoming events */}
          {upcomingAll.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: 'rgba(232,228,218,0.55)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              No upcoming events posted yet.
            </div>
          )}

          {/* Past events — collapsed accordion */}
          {pastAll.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <button
                onClick={() => setPastExpanded((o) => !o)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: 'none', border: 'none', borderTop: '1px solid rgba(232,228,218,0.10)', cursor: 'pointer', color: 'inherit' }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(232,228,218,0.40)', fontFamily: 'JetBrains Mono, ui-monospace, monospace', whiteSpace: 'nowrap' }}>PAST EVENTS</span>
                <span style={{ flex: 1, height: 1, background: 'rgba(232,228,218,0.06)' }} />
                <span style={{ fontSize: 11, color: 'rgba(232,228,218,0.30)', fontFamily: 'JetBrains Mono, ui-monospace, monospace', whiteSpace: 'nowrap' }}>{pastAll.length} event{pastAll.length !== 1 ? 's' : ''}</span>
                <svg width="12" height="12" fill="none" stroke="rgba(232,228,218,0.30)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ transition: 'transform 0.2s', transform: pastExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {pastExpanded && (
                <div style={{ opacity: 0.65 }}>
                  {pastOrder.map((monthLabel) => (
                    <MonthSection key={monthLabel} label={monthLabel} events={pastGroups[monthLabel]} companies={companies} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SourcingEventsV2() {
  return (
    <SourcingThemeProvider>
      <SourcingEventsV2Inner />
    </SourcingThemeProvider>
  );
}
