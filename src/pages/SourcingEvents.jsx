import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingNav } from './SourcingMarketplace.jsx';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

const VERTICALS = [
  { key: 'all',           label: 'All Industries',   color: '#9ca3af' },
  { key: 'semiconductor', label: 'Semiconductor',     color: '#29B6F6' },
  { key: 'space',         label: 'Space & Aerospace', color: '#7C3AED' },
  { key: 'biotech',       label: 'Biotech',           color: '#22C55E' },
  { key: 'defense',       label: 'Defense',           color: '#EF4444' },
];

const EVENT_TYPES = [
  { key: 'all',         label: 'All Events' },
  { key: 'conference',  label: 'Conference' },
  { key: 'meetup',      label: 'Meetup' },
  { key: 'webinar',     label: 'Webinar' },
  { key: 'workshop',    label: 'Workshop' },
  { key: 'expo',        label: 'Expo' },
];

const EVENT_TYPE_COLORS = {
  conference: { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.4)',  text: '#6ee7b7' },
  meetup:     { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.4)',   text: '#86EFAC' },
  webinar:    { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.4)',  text: '#93C5FD' },
  workshop:   { bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.4)',  text: '#C4B5FD' },
  expo:       { bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.4)',   text: '#FDE68A' },
};

function EventTypeBadge({ eventType, V }) {
  if (!eventType) return null;
  const c = EVENT_TYPE_COLORS[eventType] || { bg: 'rgba(138,132,124,0.1)', border: 'rgba(138,132,124,0.4)', text: '#8A847C' };
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: 10, fontWeight: 700, fontFamily: V.mono,
      padding: '2px 7px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {eventType}
    </span>
  );
}

function formatEventDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatEventTime(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

function DatePill({ dateStr, V }) {
  if (!dateStr) return (
    <div style={{
      width: 52, flexShrink: 0,
      background: V.card2, border: `1px solid ${V.border}`,
      borderRadius: 8, padding: '8px 0', textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: V.dim, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.06em' }}>TBD</div>
    </div>
  );
  const d = new Date(dateStr);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  const isUpcoming = d > new Date();

  return (
    <div style={{
      width: 52, flexShrink: 0,
      background: isUpcoming ? V.accentDim : V.card2,
      border: `1px solid ${isUpcoming ? V.accentBrd : V.border}`,
      borderRadius: 8, padding: '8px 0', textAlign: 'center',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, fontFamily: V.mono, color: isUpcoming ? V.accent : V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {month}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: V.syne, color: isUpcoming ? V.text : V.muted, lineHeight: 1.1 }}>
        {day}
      </div>
    </div>
  );
}

function EventCard({ listing, company, onClick, V }) {
  const [hovered, setHovered] = useState(false);
  const isPast = listing.event_date && new Date(listing.event_date) < new Date();

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? V.cardHov : V.card,
        border: `1px solid ${hovered ? V.borderHov : V.border}`,
        borderRadius: 10, padding: '16px 18px',
        cursor: 'pointer', transition: 'all 0.15s ease',
        display: 'flex', gap: 14, alignItems: 'flex-start',
        opacity: isPast ? 0.65 : 1,
        boxShadow: hovered ? `0 0 0 1px ${V.accent}20` : 'none',
      }}
    >
      <DatePill dateStr={listing.event_date} V={V} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.text, lineHeight: 1.25, marginBottom: 4 }}>
          {listing.title}
        </div>
        <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 8 }}>
          {listing.organizer || company?.name}
          {listing.event_location && ` · ${listing.event_location}`}
          {!listing.event_location && listing.virtual_url && ' · Virtual'}
        </div>
        {listing.description && (
          <div style={{
            fontSize: 12, color: V.dim, fontFamily: V.space, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            marginBottom: 8,
          }}>
            {listing.description}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <EventTypeBadge eventType={listing.event_type} V={V} />
          {listing.virtual_url && !listing.event_location && (
            <span style={{
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
              color: V.blue, fontSize: 10, fontFamily: V.mono,
              padding: '2px 7px', borderRadius: 3, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Virtual</span>
          )}
          {listing.event_date && (
            <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>{formatEventTime(listing.event_date)}</span>
          )}
          {isPast && <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, marginLeft: 'auto' }}>Past event</span>}
        </div>
      </div>
    </div>
  );
}

function CalendarView({ listings, onSelectListing, V }) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventsByDay = useMemo(() => {
    const map = {};
    listings.forEach(l => {
      if (!l.event_date) return;
      const d = new Date(l.event_date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(l);
      }
    });
    return map;
  }, [listings, year, month]);

  const today = new Date();
  let cells = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${V.border}` }}>
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ background: 'none', border: 'none', color: V.muted, cursor: 'pointer', padding: '4px 8px', fontSize: 16 }}>‹</button>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.text }}>
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} style={{ background: 'none', border: 'none', color: V.muted, cursor: 'pointer', padding: '4px 8px', fontSize: 16 }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${V.border}` }}>
        {DOW.map(d => (
          <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 10, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: wi < weeks.length - 1 ? `1px solid ${V.border}` : 'none' }}>
          {week.map((day, di) => {
            const isToday = day && today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
            const events = day ? (eventsByDay[day] || []) : [];
            return (
              <div key={di} style={{
                minHeight: 64, padding: '6px',
                borderRight: di < 6 ? `1px solid ${V.border}` : 'none',
                background: isToday ? V.accentDim : 'transparent',
              }}>
                {day && (
                  <>
                    <div style={{ fontSize: 12, fontFamily: V.mono, fontWeight: isToday ? 800 : 500, color: isToday ? V.accent : V.dim, marginBottom: 4 }}>
                      {day}
                    </div>
                    {events.map((ev, ei) => (
                      <div key={ei} onClick={() => onSelectListing(ev)} style={{
                        background: V.accent, borderRadius: 3,
                        padding: '2px 5px', marginBottom: 2,
                        fontSize: 9, fontFamily: V.space, fontWeight: 700,
                        color: '#fff', cursor: 'pointer',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {ev.title}
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function EventModal({ listing, company, onClose, V }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const isVirtual = listing.virtual_url && !listing.event_location;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: V.card, border: `1px solid ${V.border}`,
        borderRadius: 12, maxWidth: 600, width: '100%',
        maxHeight: '85vh', overflow: 'auto', padding: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: V.syne, color: V.text, margin: 0, lineHeight: 1.2 }}>{listing.title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: V.muted, cursor: 'pointer', fontSize: 20, flexShrink: 0, padding: 0 }}>×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <EventTypeBadge eventType={listing.event_type} V={V} />
          {isVirtual && (
            <span style={{
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
              color: V.blue, fontSize: 10, fontFamily: V.mono,
              padding: '2px 7px', borderRadius: 3, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Virtual</span>
          )}
        </div>

        <div style={{ background: V.card2, border: `1px solid ${V.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {listing.event_date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>📅</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: V.space, color: V.text }}>{formatEventDate(listing.event_date)}</div>
                  <div style={{ fontSize: 12, color: V.muted, fontFamily: V.mono }}>
                    {formatEventTime(listing.event_date)}{listing.event_end_date && ` – ${formatEventTime(listing.event_end_date)}`}
                  </div>
                </div>
              </div>
            )}
            {(listing.event_location || listing.virtual_url) && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{isVirtual ? '💻' : '📍'}</span>
                <div>
                  {listing.event_location && <div style={{ fontSize: 14, fontWeight: 600, fontFamily: V.space, color: V.text }}>{listing.event_location}</div>}
                  {listing.virtual_url && (
                    <a href={listing.virtual_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: V.blue, fontFamily: V.space, textDecoration: 'none' }}>Join Online</a>
                  )}
                </div>
              </div>
            )}
            {listing.organizer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>👤</span>
                <span style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>Organized by {listing.organizer}</span>
              </div>
            )}
          </div>
        </div>

        {listing.description && (
          <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, lineHeight: 1.8, margin: '0 0 24px', whiteSpace: 'pre-wrap' }}>{listing.description}</p>
        )}

        {listing.contact_email && (
          <a href={`mailto:${listing.contact_email}?subject=RSVP: ${encodeURIComponent(listing.title)}`} style={{
            display: 'block', width: '100%', boxSizing: 'border-box',
            background: V.accent, color: '#fff', textDecoration: 'none',
            borderRadius: 8, padding: '12px', fontSize: 14,
            fontWeight: 700, fontFamily: V.space, textAlign: 'center',
          }}>
            RSVP / Register
          </a>
        )}
      </div>
    </div>
  );
}

function SourcingEventsInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { tenant, tenantSlug, loading: tenantLoading } = useTenant();

  const [listings, setListings] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [vertical, setVertical] = useState('all');
  const [eventType, setEventType] = useState('all');
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [virtualFilter, setVirtualFilter] = useState('all'); // 'all' | 'virtual' | 'inperson'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchListings = useCallback(async (q, v, et, upcoming, virtFilt, dFrom, dTo) => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    try {
      let qb = supabase
        .from('directory_listings')
        .select('*')
        .eq('category', 'event')
        .eq('status', 'active')
        .order('event_date', { ascending: true });

      if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
      if (v && v !== 'all') qb = qb.eq('vertical', v);
      if (et && et !== 'all') qb = qb.eq('event_type', et);
      if (upcoming && !dFrom) qb = qb.gte('event_date', new Date().toISOString());
      if (dFrom) qb = qb.gte('event_date', new Date(dFrom).toISOString());
      if (dTo) qb = qb.lte('event_date', new Date(dTo + 'T23:59:59').toISOString());
      if (virtFilt === 'virtual') qb = qb.not('virtual_url', 'is', null);
      if (virtFilt === 'inperson') qb = qb.not('event_location', 'is', null);
      if (q && q.trim()) qb = qb.or(`title.ilike.%${q}%,description.ilike.%${q}%,event_location.ilike.%${q}%,organizer.ilike.%${q}%`);

      const { data, error } = await qb.limit(100);
      if (error) throw error;
      setListings(data || []);

      if (data && data.length > 0) {
        const companyIds = [...new Set(data.map(l => l.company_id))];
        const { data: compData } = await supabase.from('directory_companies').select('*').in('id', companyIds);
        const map = {};
        (compData || []).forEach(c => { map[c.id] = c; });
        setCompanies(map);
      } else {
        setCompanies({});
      }
    } catch (err) {
      console.error('Events fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (tenantSlug && tenantLoading) return;
    fetchListings(query, vertical, eventType, upcomingOnly, virtualFilter, dateFrom, dateTo);
  }, [query, vertical, eventType, upcomingOnly, virtualFilter, dateFrom, dateTo, fetchListings]);

  const handleSearch = () => setQuery(searchInput.trim());

  const activeFilterCount = [
    vertical !== 'all',
    eventType !== 'all',
    !upcomingOnly,
    virtualFilter !== 'all',
    dateFrom !== '',
    dateTo !== '',
  ].filter(Boolean).length;

  const inputStyle = {
    background: V.card2, border: `1px solid ${V.border}`,
    color: V.text, borderRadius: 6, padding: '7px 10px',
    fontSize: 12, fontFamily: V.space, outline: 'none',
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
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        @media (min-width: 640px) { .events-filters-panel { display: flex !important; } .events-filters-toggle { display: none !important; } }
      `}</style>

      <SourcingNav active="events" tenantSlug={tenantSlug} tenantName={tenant?.nav_label || tenant?.name} features={tenant?.features} brandColor={tenant?.brand_color} />

      <div style={{ padding: '40px 24px 28px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.accent, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
          Event Listings
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, fontFamily: V.syne, color: V.heading, margin: '0 0 6px', lineHeight: 1.15 }}>
              Industry Events
            </h1>
            <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, margin: 0 }}>
              Conferences, meetups, and webinars for Arizona's advanced industries.
            </p>
          </div>
          <Link to={`${tenantSlug ? `/${tenantSlug}` : '/'}/events/post`} style={{
            background: V.accent, color: '#fff', textDecoration: 'none',
            borderRadius: 7, padding: '9px 18px', fontSize: 13,
            fontWeight: 700, fontFamily: V.space, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            + Post an Event
          </Link>
        </div>

        {/* Search row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search events, organizers, locations..."
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
          <div style={{ display: 'flex', background: V.card, border: `1px solid ${V.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {[{ key: 'list', icon: '☰' }, { key: 'calendar', icon: '▦' }].map(mode => (
              <button key={mode.key} onClick={() => setViewMode(mode.key)} style={{
                background: viewMode === mode.key ? V.accentDim : 'transparent',
                border: 'none', color: viewMode === mode.key ? V.accent : V.dim,
                padding: '0 14px', fontSize: 16, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {mode.icon}
              </button>
            ))}
          </div>
          {/* Mobile filters toggle */}
          <button
            className="events-filters-toggle"
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
          className="events-filters-panel"
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
                fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>
                {v.label}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: V.border }} />

          {/* Row 2: Event type */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Type</span>
            {EVENT_TYPES.map(et => (
              <button key={et.key} onClick={() => setEventType(et.key)} style={{
                background: eventType === et.key ? V.accentDim : 'transparent',
                border: `1px solid ${eventType === et.key ? V.accentBrd : V.border}`,
                color: eventType === et.key ? V.accent : V.muted,
                borderRadius: 6, padding: '5px 11px', fontSize: 12,
                fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>
                {et.label}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: V.border }} />

          {/* Row 3: Timing + Format + Date range */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Upcoming toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Timing</span>
              <button onClick={() => setUpcomingOnly(u => !u)} style={{
                background: upcomingOnly ? V.accentDim : 'transparent',
                border: `1px solid ${upcomingOnly ? V.accentBrd : V.border}`,
                color: upcomingOnly ? V.accent : V.muted,
                borderRadius: 6, padding: '5px 11px', fontSize: 12,
                fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>
                Upcoming Only
              </button>
            </div>

            {/* Virtual filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Format</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ key: 'all', label: 'All' }, { key: 'inperson', label: 'In-person' }, { key: 'virtual', label: 'Virtual' }].map(opt => (
                  <button key={opt.key} onClick={() => setVirtualFilter(opt.key)} style={{
                    background: virtualFilter === opt.key ? 'rgba(59,130,246,0.12)' : 'transparent',
                    border: `1px solid ${virtualFilter === opt.key ? 'rgba(59,130,246,0.5)' : V.border}`,
                    color: virtualFilter === opt.key ? '#93C5FD' : V.muted,
                    borderRadius: 6, padding: '5px 11px', fontSize: 12,
                    fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date Range</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{ ...inputStyle, width: 140 }}
                />
                <span style={{ color: V.dim, fontSize: 12, fontFamily: V.mono, flexShrink: 0 }}>–</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{ ...inputStyle, width: 140 }}
                />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{
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
                setVertical('all'); setEventType('all'); setUpcomingOnly(true);
                setVirtualFilter('all'); setDateFrom(''); setDateTo('');
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

      <div style={{ padding: '0 24px 60px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space, marginBottom: 16 }}>
          {loading ? 'Loading...' : (
            <>
              <span style={{ color: V.text, fontWeight: 600 }}>{listings.length}</span>
              {' '}event{listings.length !== 1 ? 's' : ''}
              {query && <> for <span style={{ color: V.accent }}>"{query}"</span></>}
            </>
          )}
        </div>

        {!supabase && (
          <div style={{ background: V.accentDim, border: `1px solid ${V.accentBrd}`, borderRadius: 8, padding: '20px 24px', textAlign: 'center' }}>
            <div style={{ color: V.accent, fontFamily: V.mono, fontSize: 13, marginBottom: 8 }}>Supabase not configured</div>
            <div style={{ color: V.muted, fontFamily: V.space, fontSize: 12 }}>Run migrations 001 + 002 in Supabase SQL editor to activate.</div>
          </div>
        )}

        {loading && supabase && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, height: 110, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {!loading && listings.length > 0 && viewMode === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {listings.map(listing => (
              <EventCard key={listing.id} listing={listing} company={companies[listing.company_id]} onClick={() => setSelected(listing)} V={V} />
            ))}
          </div>
        )}

        {!loading && viewMode === 'calendar' && (
          <CalendarView listings={listings} onSelectListing={setSelected} V={V} />
        )}

        {!loading && supabase && listings.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 12,
          }}>
            <svg width="56" height="56" fill="none" stroke={V.dim} strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16, opacity: 0.5 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 8 }}>No events found</div>
            <div style={{ fontSize: 14, color: V.muted, fontFamily: V.space, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
              {query ? `No results for "${query}". Try different filters.` : upcomingOnly ? 'No upcoming events scheduled. Try showing past events too.' : 'No events posted yet. Conferences, meetups, and expos will appear here.'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {upcomingOnly && (
                <button onClick={() => setUpcomingOnly(false)} style={{
                  background: 'transparent', color: V.muted, textDecoration: 'none',
                  border: `1px solid ${V.border}`, borderRadius: 7, padding: '10px 20px', fontSize: 13,
                  fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
                }}>
                  Show All Events
                </button>
              )}
              <Link to={`${tenantSlug ? `/${tenantSlug}` : '/'}/events/post`} style={{
                background: V.accent, color: '#fff', textDecoration: 'none',
                borderRadius: 7, padding: '10px 20px', fontSize: 13,
                fontWeight: 700, fontFamily: V.space, display: 'inline-block',
              }}>
                Post an Event
              </Link>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <EventModal listing={selected} company={companies[selected.company_id]} onClose={() => setSelected(null)} V={V} />
      )}
    </div>
  );
}

export default function SourcingEvents() {
  return (
    <SourcingThemeProvider>
      <SourcingEventsInner />
    </SourcingThemeProvider>
  );
}
