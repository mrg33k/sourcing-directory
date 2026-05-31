// SourcingEventsV2.jsx
// nat-geo-uplift R5b — Events page in the V2 list-pattern.

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import { V2ChipNav } from './V2ChipNav.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';
const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SourcingEventsV2Inner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);

  const [tenant, setTenant] = useState(null);
  const [listings, setListings] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

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
    if (!supabase) {
      setLoading(false);
      return;
    }
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
        const { data, error } = await qb.limit(100);
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
            (compData || []).forEach((c) => {
              map[c.id] = c;
            });
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
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  const filtered = useMemo(() => {
    if (!searchInput.trim()) return listings;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return listings.filter((l) => {
      const company = companies[l.company_id];
      const haystack = [
        l.title,
        l.description,
        l.event_location,
        l.event_type,
        l.organizer,
        company?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [listings, companies, searchInput]);

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

      <div
        className="browse-hero"
        style={{ '--page-hero-bg': "url('/v2-assets/starfield-dense.png')" }}
      >
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
            <img
              src="/images/space-rising/logo-white.png"
              alt="Space Rising"
              className="tenant-hero-logo"
            />
          </div>
          <div className="browse-title">Upcoming Events.</div>
          <div className="browse-sub">
            Industry meetups, summits, and showcases across Arizona&rsquo;s space sector.
          </div>
        </div>
      </div>

      <div className="browse-search">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
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

      <div className="sec-hdr">
        <div className="sec-title">
          {loading ? 'Loading...' : `${filtered.length} Event${filtered.length === 1 ? '' : 's'}.`}
        </div>
        <div className="sec-count">
          <Link to="/space-rising-v2/events/post" style={{ textDecoration: 'none', color: 'var(--cyan)', fontSize: 12, fontWeight: 600 }}>
            + Post an Event
          </Link>
        </div>
      </div>

      <div className="co-list">
        {!supabase && (
          <div style={{ padding: '24px 20px', border: '1px solid rgba(232,162,58,0.32)', background: 'rgba(232,162,58,0.10)', borderRadius: 10, color: '#E8A23A', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 13, textAlign: 'center' }}>
            Supabase not configured
          </div>
        )}

        {loading && supabase && (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 84, borderRadius: 10, background: 'rgba(18,20,28,0.40)', border: '1px solid rgba(232,228,218,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </>
        )}

        {!loading && filtered.map((listing) => {
          const company = companies[listing.company_id];
          const date = formatEventDate(listing.event_date);
          const loc = listing.event_location || (listing.virtual_url ? 'Virtual' : '');
          const isPast = listing.event_date && new Date(listing.event_date) < new Date();
          return (
            <Link
              key={listing.id}
              to={`/space-rising-v2/events/${listing.id}`}
              className="co-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="co-body">
                {company?.slug ? (
                  <img className="co-mono-logo" src={`/v2-assets/logos/${company.slug}-white.png`} alt="" aria-hidden="true" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : null}
                <div className="co-name">{listing.title}</div>
                <div className="co-loc">
                  {[listing.organizer || company?.name, loc, date].filter(Boolean).join(' · ')}
                </div>
                <div className="co-badges">
                  {listing.event_type && <span className="co-badge cert">{listing.event_type}</span>}
                  {listing.virtual_url && !listing.event_location && <span className="co-badge cert">Virtual</span>}
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

        {!loading && supabase && filtered.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: 'rgba(232,228,218,0.55)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {searchInput ? `No events match "${searchInput}"` : 'No events posted yet.'}
          </div>
        )}
      </div>
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
