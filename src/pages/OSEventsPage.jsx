/**
 * OSEventsPage — Events section built on OSMagazinePage engine
 *
 * Data: directory_listings WHERE category = 'event', tenant = 'space-rising'
 * Column map: event_date, event_location, event_type, organizer,
 *   virtual_url / apply_url → register link, title, description, vertical
 *
 * FIX: today uses new Date() — not the old hardcoded '2026-07-06'
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import OSMagazinePage from './OSMagazinePage.jsx';
import './osv3-magazine.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

/* ------------------------------------------------------------------ */
/* Date helpers                                                          */
function parseEventDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    year: d.getFullYear(),
    raw: d,
  };
}

function fmtDateShort(iso) {
  const p = parseEventDate(iso);
  if (!p) return '';
  return `${p.month} ${p.day}, ${p.year}`;
}

/* ------------------------------------------------------------------ */
/* Filter pills                                                          */
const PILLS = [
  { label: 'All', value: 'all' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Past Events', value: 'past' },
];

/* ------------------------------------------------------------------ */
/* EventMediaSlot — hero LEFT panel (navy + date chip + starfield)      */
function EventMediaSlot({ featured }) {
  const dp = featured ? parseEventDate(featured.event_date) : null;
  const loc = featured?.event_location || '';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const isUpcoming = dp && dp.raw >= now;

  return (
    <div className="osv3-evt-media">
      <div className="osv3-evt-media-badge">
        {isUpcoming ? 'UPCOMING' : 'FEATURED EVENT'}
      </div>
      <div className="osv3-evt-media-inner">
        {dp ? (
          <div className="osv3-evt-date-chip">
            <span className="osv3-evt-date-month">{dp.month}</span>
            <span className="osv3-evt-date-day">{dp.day}</span>
            <span className="osv3-evt-date-year">{dp.year}</span>
          </div>
        ) : (
          <div className="osv3-evt-date-chip">
            <span className="osv3-evt-date-month">TBD</span>
            <span className="osv3-evt-date-day">--</span>
          </div>
        )}
        {loc && <div className="osv3-evt-media-loc">{loc}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EventCard — grid card renderer                                        */
function EventCard({ item }) {
  const dp = parseEventDate(item.event_date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const isPast = dp && dp.raw < now;
  const link = item.virtual_url || item.apply_url;

  const handleClick = () => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="osv3-evt-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
    >
      <div className="osv3-evt-card-thumb">
        {dp && (
          <div className="osv3-evt-card-date">
            <span className="osv3-evt-card-date-month">{dp.month}</span>
            <span className="osv3-evt-card-date-day">{dp.day}</span>
          </div>
        )}
        {item.event_type && (
          <div className="osv3-evt-card-type">{item.event_type}</div>
        )}
        {isPast && (
          <div className="osv3-evt-card-past">Past</div>
        )}
      </div>
      <div className="osv3-evt-card-body">
        <h3 className="osv3-evt-card-title">{item.title}</h3>
        <div className="osv3-evt-card-meta">
          {item.event_location && <span>{item.event_location}</span>}
          {dp && <span>{fmtDateShort(item.event_date)}</span>}
        </div>
        <div className="osv3-evt-card-foot">
          <span className="osv3-evt-card-org">{item.organizer || ''}</span>
          {link && (
            <span className="osv3-evt-card-cta">
              {isPast ? 'View Details' : 'Register'} &rarr;
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OSEventsPage — top-level page component                              */
function OSEventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadEvents = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data: tenantData } = await supabase
        .from('directory_tenants')
        .select('id')
        .eq('slug', TENANT_DB_LOOKUP_SLUG)
        .single();

      let qb = supabase
        .from('directory_listings')
        .select('*')
        .eq('category', 'event')
        .eq('status', 'active')
        .order('event_date', { ascending: true });

      if (tenantData?.id) qb = qb.eq('tenant_id', tenantData.id);

      const { data, error } = await qb.limit(100);
      if (!error && data) setEvents(data);
    } catch (_) {
      /* silently degrade — empty state handled */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  /* upcoming / past split — uses real today, never hardcoded */
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const upcoming = events.filter(e => e.event_date && new Date(e.event_date) >= now);
  const past = events.filter(e => !e.event_date || new Date(e.event_date) < now);

  /* featured = next upcoming event; fallback to first overall */
  const featured = upcoming[0] || events[0] || null;

  /* grid items by active filter */
  let filtered;
  if (activeFilter === 'upcoming') filtered = upcoming;
  else if (activeFilter === 'past') filtered = [...past].reverse();
  else filtered = [...upcoming, ...past];

  const featLink = featured ? (featured.virtual_url || featured.apply_url) : null;
  const featDp = featured ? parseEventDate(featured.event_date) : null;
  const featNow = new Date();
  featNow.setHours(0, 0, 0, 0);
  const featIsUpcoming = featDp && featDp.raw >= featNow;

  const sectionLabel =
    activeFilter === 'upcoming' ? 'UPCOMING'
    : activeFilter === 'past' ? 'PAST EVENTS'
    : 'ALL EVENTS';

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Community Hub / Events"
      pageTitle="Events"
      pageSubtitle="Space industry events, meetups, and conferences shaping Arizona's space economy."
      addLabel="Add Event"
      onAdd={() => navigate('/admin/listings?category=event')}

      featuredItem={featured}
      mediaSlot={featured ? <EventMediaSlot featured={featured} /> : null}
      featureEyebrow="COMMUNITY · EVENTS"
      featureTitle={featured?.title || ''}
      featureHost={featured?.organizer || ''}
      featureHostTag="Organizer"
      featureDesc={
        featured?.description
          ? featured.description.slice(0, 220) +
            (featured.description.length > 220 ? '...' : '')
          : ''
      }
      featureMeta={[
        ...(featDp
          ? [{ label: 'Date', value: fmtDateShort(featured?.event_date) }]
          : []),
        ...(featured?.event_location
          ? [{ label: 'Location', value: featured.event_location }]
          : []),
        ...(featured?.event_type
          ? [{ label: 'Type', value: featured.event_type }]
          : []),
        { label: 'Status', value: featIsUpcoming ? 'Upcoming' : 'Past Event' },
      ]}
      featureActions={
        featured ? (
          <>
            {featLink && (
              <a
                href={featLink}
                target="_blank"
                rel="noopener noreferrer"
                className="osv3-mag-btn-play"
              >
                {featIsUpcoming ? 'Register Now' : 'View Event'}
              </a>
            )}
            <button
              className="osv3-mag-btn-ghost"
              type="button"
              onClick={() => navigate('/admin/listings?category=event')}
            >
              + Add Event
            </button>
          </>
        ) : null
      }

      pills={PILLS}
      activeFilter={activeFilter}
      onFilter={setActiveFilter}
      items={filtered}
      cardRenderer={(item, i) => (
        <EventCard key={item.id || i} item={item} index={i} />
      )}
      isLoading={isLoading}
      sectionLabel={sectionLabel}
    />
  );
}

export default OSEventsPage;
