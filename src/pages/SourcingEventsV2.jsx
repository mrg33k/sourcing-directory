// SourcingEventsV2.jsx
// Space OS v3 — Community/Events page reskin
// Light shell with white event cards, date chips, and clean layout

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import './osv3-events.css';

const TENANT_SLUG_V2 = 'space-rising-v2';
const TENANT_DB_LOOKUP_SLUG = 'space-rising';

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

function getDayNum(dateStr) {
  const d = parseDate(dateStr);
  return d ? d.getDate() : null;
}

function getMonthAbbr(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({ listing, companies }) {
  const company = companies[listing.company_id];
  const loc = listing.event_location || (listing.virtual_url ? 'Virtual' : '');
  const dayNum = getDayNum(listing.event_date);
  const monthAbbr = getMonthAbbr(listing.event_date);
  return (
    <Link to={`/events/${listing.id}`} className="osv3-event-card">
      <div className="osv3-event-card__date-chip">
        <div className="osv3-event-card__month">{monthAbbr}</div>
        <div className="osv3-event-card__day">{dayNum}</div>
      </div>
      <div className="osv3-event-card__body">
        <div className="osv3-event-card__title">{listing.title}</div>
        <div className="osv3-event-card__meta">
          {[listing.organizer, loc].filter(Boolean).join(' · ')}
          {listing.event_type && <span className="osv3-event-card__pill">{listing.event_type}</span>}
        </div>
      </div>
      <svg className="osv3-event-card__arrow" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="osv3-page osv3-events-page">
      {/* Page Header */}
      <div className="osv3-page-header">
        <div className="osv3-page-header__content">
          <h2 className="osv3-page-header__title">Community</h2>
          <p className="osv3-page-header__sub">Events, meetups, and forums across the ecosystem</p>
        </div>
        <Link to="/events/post" className="osv3-btn osv3-btn--primary">
          Post an Event
        </Link>
      </div>

      {/* Events List */}
      <div className="osv3-events-list">
        {!supabase && (
          <div className="osv3-empty-state">Supabase not configured</div>
        )}

        {loading && supabase && (
          <div className="osv3-loading">Loading events...</div>
        )}

        {!loading && listings.length === 0 && (
          <div className="osv3-empty-state">No upcoming events posted yet.</div>
        )}

        {!loading && listings.length > 0 && (
          listings.map((listing) => (
            <EventCard key={listing.id} listing={listing} companies={companies} />
          ))
        )}
      </div>
    </div>
  );
}

export default function SourcingEventsV2() {
  return <SourcingEventsV2Inner />;
}
