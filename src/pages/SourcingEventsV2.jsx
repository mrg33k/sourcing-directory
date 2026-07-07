// SourcingEventsV2.jsx
// Space OS v3 — Community/Events page reskin (magazine pattern)

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import './osv3-events.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

// Asset rotation array (deterministic per event ID, same pool as Reports)
const ASSET_POOL = [
  'blueprint-hero.png',
  'earth.png',
  'rocket-orbital.png',
  'bg-opp-orbital-construction.png',
  'bg-opp-lunar.png',
  'bg-opp-energy.png',
  'asteroid-close.png',
  'bg-opp-stations.png',
  'planet-red.png',
  'rocket-ascent.png',
];

function parseDate(dateStr) {
  if (!dateStr) return null;
  let d = new Date(dateStr);
  if (!Number.isNaN(d.getTime())) return d;
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    d = new Date(dateStr + 'T00:00:00Z');
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDayNum(dateStr) {
  const d = parseDate(dateStr);
  return d ? d.getDate() : null;
}

function getMonthAbbr(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

function getImageForEvent(event, index) {
  // Deterministic + diverse: hash the full id string (+ index) so cards don't
  // repeat the same photo.
  const s = (event.id ? String(event.id) : '') + ':' + index;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `/v2-assets/${ASSET_POOL[h % ASSET_POOL.length]}`;
}

// ─── GridEventCard (for editorial grid) ────────────────────────────────────────

function GridEventCard({ event, index }) {
  const dateStr = formatEventDate(event.event_date);
  const dayNum = getDayNum(event.event_date);
  const monthAbbr = getMonthAbbr(event.event_date);
  const loc = event.event_location || (event.virtual_url ? 'Virtual' : '');

  return (
    <Link
      to={`/events/${event.id}`}
      className="osv3-event-grid-card"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      {/* Card Image (3:2) */}
      <div className="osv3-event-grid-card-image-wrapper">
        <img
          src={getImageForEvent(event, index)}
          alt={event.title}
          className="osv3-event-grid-card-image"
          loading="lazy"
        />
        {/* Date chip overlay */}
        <div className="osv3-event-grid-card-date-chip">
          <div className="osv3-event-grid-card-date-month">{monthAbbr}</div>
          <div className="osv3-event-grid-card-date-day">{dayNum}</div>
        </div>
      </div>

      {/* Card Content */}
      <div className="osv3-event-grid-card-content">
        <div className="osv3-event-grid-card-kicker">{event.event_type || 'Event'}</div>
        <h3 className="osv3-event-grid-card-headline">{event.title}</h3>
        <p className="osv3-event-grid-card-deck">{loc}</p>
        <div className="osv3-event-grid-card-meta">
          {[event.organizer || 'Space Rising', dateStr].filter(Boolean).join(' · ')}
        </div>
      </div>
    </Link>
  );
}

// ─── PastEventCard (compact list) ────────────────────────────────────────────

function PastEventCard({ event }) {
  const loc = event.event_location || (event.virtual_url ? 'Virtual' : '');
  const dayNum = getDayNum(event.event_date);
  const monthAbbr = getMonthAbbr(event.event_date);

  return (
    <Link to={`/events/${event.id}`} className="osv3-event-past-card">
      <div className="osv3-event-past-card-date-chip">
        <div className="osv3-event-past-card-month">{monthAbbr}</div>
        <div className="osv3-event-past-card-day">{dayNum}</div>
      </div>
      <div className="osv3-event-past-card-body">
        <div className="osv3-event-past-card-title">{event.title}</div>
        <div className="osv3-event-past-card-meta">
          {[event.organizer, loc].filter(Boolean).join(' · ')}
        </div>
      </div>
      <svg className="osv3-event-past-card-arrow" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </Link>
  );
}


// ─── Main component ───────────────────────────────────────────────────────────

function SourcingEventsV2Inner() {
  useSRWTitle('Community | Space OS');

  const [tenant, setTenant] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
        if (!cancelled) setListings(data || []);
      } catch (err) {
        console.error('EventsV2 fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant]);

  // Filter events by search query (match title, location, organizer)
  const filteredListings = useMemo(() => {
    if (!searchQuery.trim()) return listings;
    const query = searchQuery.toLowerCase();
    const words = query.split(/\s+/).filter(Boolean);
    return listings.filter((listing) => {
      const haystack = [listing.title, listing.event_location, listing.organizer, listing.event_type]
        .filter(Boolean).join(' ').toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [listings, searchQuery]);

  // Split filtered events into upcoming and past
  const today = new Date('2026-07-06');
  today.setHours(0, 0, 0, 0);

  const upcomingEvents = useMemo(() => {
    return filteredListings.filter((listing) => {
      const eventDate = parseDate(listing.event_date);
      if (!eventDate) return true;
      const eventDateNorm = new Date(eventDate);
      eventDateNorm.setHours(0, 0, 0, 0);
      return eventDateNorm >= today;
    });
  }, [filteredListings]);

  const pastEvents = useMemo(() => {
    return filteredListings.filter((listing) => {
      const eventDate = parseDate(listing.event_date);
      if (!eventDate) return false;
      const eventDateNorm = new Date(eventDate);
      eventDateNorm.setHours(0, 0, 0, 0);
      return eventDateNorm < today;
    });
  }, [filteredListings]);

  // Magazine pattern: feature (first upcoming) + grid (rest)
  const featureEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;
  const gridEvents = upcomingEvents.length > 1 ? upcomingEvents.slice(1) : [];

  return (
    <div className="osv3-events-page">
      {/* Page Header */}
      <div className="osv3-events-header">
        <div>
          <h1 className="osv3-events-page-title">Community</h1>
          <p className="osv3-events-page-subtitle">Events, meetups, and forums across the ecosystem.</p>
        </div>
        <Link to="/events/post" className="osv3-btn osv3-btn--primary">
          Post an Event
        </Link>
      </div>

      {/* Search Input */}
      {!loading && supabase && listings.length > 0 && (
        <div className="osv3-events-search-container">
          <input
            className="osv3-events-search-input"
            type="text"
            placeholder="Search by title, location, or organizer…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* No Supabase Error */}
      {!supabase && (
        <div className="osv3-events-error">Supabase not configured</div>
      )}

      {/* Loading State */}
      {loading && supabase && (
        <>
          {/* Feature Hero Skeleton */}
          <div className="osv3-magazine-feature-skeleton" />
          {/* Grid Skeletons */}
          <div className="osv3-events-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="osv3-event-grid-card osv3-event-grid-card-skeleton">
                <div className="osv3-event-grid-card-image-skeleton" />
                <div className="osv3-event-grid-card-content">
                  <div className="osv3-event-grid-card-skeleton-line" />
                  <div className="osv3-event-grid-card-skeleton-line-short" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Content */}
      {!loading && supabase && (
        <>
          {/* FEATURE HERO (Tier 1) */}
          {featureEvent && (
            <Link
              to={`/events/${featureEvent.id}`}
              className="osv3-magazine-feature-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <img
                src={getImageForEvent(featureEvent, 0)}
                alt={featureEvent.title}
                className="osv3-magazine-feature-image"
                loading="eager"
              />
              <div className="osv3-magazine-feature-overlay" />
              <div className="osv3-magazine-feature-content">
                <div className="osv3-magazine-feature-kicker">{featureEvent.event_type || 'Upcoming Event'}</div>
                <h2 className="osv3-magazine-feature-headline">{featureEvent.title}</h2>
                <p className="osv3-magazine-feature-deck">
                  {[formatEventDate(featureEvent.event_date), featureEvent.event_location || (featureEvent.virtual_url ? 'Virtual' : ''), featureEvent.organizer].filter(Boolean).join(' · ')}
                </p>
                <button
                  className="osv3-magazine-feature-button"
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                >
                  View Event →
                </button>
              </div>
            </Link>
          )}

          {/* EDITORIAL GRID (Tier 2) */}
          {gridEvents.length > 0 && (
            <>
              <div className="osv3-magazine-section-header">
                <div className="osv3-magazine-section-eyebrow">Upcoming Events</div>
              </div>
              <div className="osv3-events-grid">
                {gridEvents.map((event, idx) => (
                  <GridEventCard key={event.id} event={event} index={idx + 1} />
                ))}
              </div>
            </>
          )}

          {/* Empty State */}
          {upcomingEvents.length === 0 && (
            <div className="osv3-events-empty">
              {searchQuery ? `No events match "${searchQuery}"` : 'No upcoming events posted yet.'}
            </div>
          )}

          {/* PAST EVENTS (Tier 3 compact) */}
          {pastEvents.length > 0 && (
            <div className="osv3-events-past-section">
              <div className="osv3-magazine-section-header">
                <div className="osv3-magazine-section-eyebrow">Past Events</div>
              </div>
              <div className="osv3-events-past-list">
                {pastEvents.map((event) => (
                  <PastEventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SourcingEventsV2() {
  return <SourcingEventsV2Inner />;
}
