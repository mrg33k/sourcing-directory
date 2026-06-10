// SourcingEventsV2.jsx
// Calendar redesign — upcoming-first, month-grouped, past events collapsed.
// Design-system refactor: all styles via .sr-* classes in space-rising-theme-v2.css

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme } from './SourcingTheme.jsx';
import { V2ChipNav } from './V2ChipNav.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';
const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function parseDate(dateStr) { if (!dateStr) return null; const d = new Date(dateStr); return Number.isNaN(d.getTime()) ? null : d; }
function formatShortDate(dateStr) { const d = parseDate(dateStr); if (!d) return ''; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function getMonthLabel(dateStr) { const d = parseDate(dateStr); if (!d) return 'UNDATED'; return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase(); }
function getDayNum(dateStr) { const d = parseDate(dateStr); return d ? d.getDate() : null; }
function getDayName(dateStr) { const d = parseDate(dateStr); if (!d) return ''; return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(); }
function getMonthAbbr(dateStr) { const d = parseDate(dateStr); if (!d) return ''; return d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(); }
function isToday(dateStr) { const d = parseDate(dateStr); if (!d) return false; const now = new Date(); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate(); }
function groupByMonth(events) { const groups = {}; const order = []; events.forEach((e) => { const key = getMonthLabel(e.event_date); if (!groups[key]) { groups[key] = []; order.push(key); } groups[key].push(e); }); return { groups, order }; }

// ─── CalendarEventRow ─────────────────────────────────────────────────────────

function CalendarEventRow({ listing, companies }) {
  const company = companies[listing.company_id];
  const loc = listing.event_location || (listing.virtual_url ? 'Virtual' : '');
  const dayNum = getDayNum(listing.event_date);
  const dayName = getDayName(listing.event_date);
  const today = isToday(listing.event_date);
  return (
    <Link to={`/space-rising-v2/events/${listing.id}`} className="sr-event-row">
      <div className={`sr-event-row__datepill${today ? ' today' : ''}`}>
        <div className="sr-event-row__weekday">{dayName}</div>
        <div className="sr-event-row__daynum">{dayNum}</div>
      </div>
      <div className="sr-event-row__body">
        <div className="sr-event-row__title">{listing.title}</div>
        <div className="sr-event-row__meta">
          {listing.organizer || company?.name ? <span>{listing.organizer || company?.name}</span> : null}
          {loc ? <><span className="sr-sep">·</span><span>{loc}</span></> : null}
          {listing.event_type ? <><span className="sr-sep">·</span><span className="sr-type">{listing.event_type}</span></> : null}
        </div>
      </div>
      <svg className="sr-event-row__arrow" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

// ─── MonthSection ─────────────────────────────────────────────────────────────

function MonthSection({ label, events, companies }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="sr-month-section">
      <button onClick={() => setOpen((o) => !o)} className="sr-month-hdr">
        <span className="sr-month-hdr__label">{label}</span>
        <span className="sr-month-hdr__rule" />
        <span className="sr-month-hdr__count">{events.length} event{events.length !== 1 ? 's' : ''}</span>
        <svg className={`sr-month-hdr__chevron${open ? '' : ' closed'}`} width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div>
          {events.map((e) => <CalendarEventRow key={e.id} listing={e} companies={companies} />)}
        </div>
      )}
    </div>
  );
}

// ─── NextUpCard ───────────────────────────────────────────────────────────────

function NextUpCard({ listing, companies }) {
  const company = companies[listing.company_id];
  const loc = listing.event_location || (listing.virtual_url ? 'Virtual' : '');
  const dayNum = getDayNum(listing.event_date);
  const dayName = getDayName(listing.event_date);
  const monthAbbr = getMonthAbbr(listing.event_date);
  const today = isToday(listing.event_date);
  return (
    <Link to={`/space-rising-v2/events/${listing.id}`} className="sr-next-card">
      <div className="sr-next-card__date">
        <div className="sr-next-card__month">{today ? 'TODAY' : monthAbbr}</div>
        <div className="sr-next-card__day">{dayNum}</div>
        <div className="sr-next-card__weekday">{dayName}</div>
      </div>
      <div className="sr-next-card__body">
        {today && <div className="sr-next-card__today-badge">HAPPENING TODAY</div>}
        <div className="sr-next-card__title">{listing.title}</div>
        <div className="sr-next-card__meta">
          {listing.organizer || company?.name ? <span>{listing.organizer || company?.name}</span> : null}
          {loc ? <><span className="sr-sep">·</span><span>{loc}</span></> : null}
          {listing.event_type ? <><span className="sr-sep">·</span><span className="sr-type">{listing.event_type}</span></> : null}
        </div>
      </div>
      <svg className="sr-next-card__arrow" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

// ─── Main inner component ─────────────────────────────────────────────────────

function SourcingEventsV2Inner() {
  useSourcingTheme();

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

  // Search-filtered flat list
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

  // Next Up: first 3 upcoming events (highlighted)
  const nextUp = upcomingAll.slice(0, 3);
  // Remaining upcoming — grouped by month
  const remaining = upcomingAll.slice(3);
  const { groups: upcomingGroups, order: upcomingOrder } = useMemo(() => groupByMonth(remaining), [remaining]);
  const { groups: pastGroups, order: pastOrder } = useMemo(() => groupByMonth(pastAll), [pastAll]);

  const isSearching = searchInput.trim().length > 0;

  return (
    <div data-tenant={TENANT_SLUG_V2} style={{ minHeight: '100dvh', color: '#E8E4DA' }}>

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
          <Link to="/space-rising-v2/events/post" style={{ textDecoration: 'none', color: 'var(--srv2-orange)', fontSize: 12, fontWeight: 600 }}>
            + Post an Event
          </Link>
        </div>
      </div>

      {/* No supabase */}
      {!supabase && (
        <div className="sr-config-notice">Supabase not configured</div>
      )}

      {/* Loading skeletons */}
      {loading && supabase && (
        <div className="co-list">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="sr-skel-row" />
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
            <div className="sr-cal-empty">No events match &ldquo;{searchInput}&rdquo;</div>
          )}
        </div>
      )}

      {/* ── Calendar mode ── */}
      {!loading && !isSearching && (
        <div className="sr-events-cal">

          {/* Next Up — first 3 highlighted cards */}
          {nextUp.length > 0 && (
            <div className="sr-next-section">
              <div className="sr-next-hdr">
                <span className="sr-next-hdr__label">COMING UP NEXT</span>
                <span className="sr-next-hdr__rule" />
              </div>
              <div className="sr-next-list">
                {nextUp.map((e) => (
                  <NextUpCard key={e.id} listing={e} companies={companies} />
                ))}
              </div>
            </div>
          )}

          {/* Remaining upcoming — month groups */}
          {upcomingOrder.map((monthLabel) => (
            <MonthSection key={monthLabel} label={monthLabel} events={upcomingGroups[monthLabel]} companies={companies} />
          ))}

          {/* No upcoming */}
          {upcomingAll.length === 0 && (
            <div className="sr-cal-empty">No upcoming events posted yet.</div>
          )}

          {/* Past events — collapsed accordion */}
          {pastAll.length > 0 && (
            <div className="sr-past-section">
              <button onClick={() => setPastExpanded((o) => !o)} className="sr-past-toggle">
                <span className="sr-past-toggle__label">PAST EVENTS</span>
                <span className="sr-past-toggle__rule" />
                <span className="sr-past-toggle__count">{pastAll.length} event{pastAll.length !== 1 ? 's' : ''}</span>
                <svg className={`sr-past-toggle__chevron${pastExpanded ? '' : ' closed'}`} width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {pastExpanded && (
                <div className="sr-past-body">
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
