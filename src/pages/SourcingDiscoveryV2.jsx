// SourcingDiscoveryV2.jsx
// Space OS v3 — Discovery page (magazine pattern: feature hero + editorial grid)
// Data: directory_listings where category='whitepaper'

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import '../osv3-tokens.css';
import '../pages/OSLayoutV3.css';
import './osv3-discovery.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

// Asset rotation array (deterministic per listing ID, matching Reports pattern)
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

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getImageForListing(listing, index) {
  // Deterministic + diverse: hash the full id string (+ index) so cards don't
  // repeat the same photo. Matches Reports pattern.
  const s = (listing.id ? String(listing.id) : '') + ':' + index;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `/v2-assets/${ASSET_POOL[h % ASSET_POOL.length]}`;
}

function SourcingDiscoveryV2Inner() {
  useSRWTitle('Discovery | Space OS');

  const [tenant, setTenant] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  // Load SR tenant row
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

  // Load active whitepapers
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
          .eq('category', 'whitepaper')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
        const { data, error } = await qb.limit(100);
        if (error) throw error;
        if (cancelled) return;
        setListings(data || []);
      } catch (err) {
        console.error('DiscoveryV2 fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant]);

  const filteredListings = useMemo(() => {
    if (!searchInput.trim()) return listings;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return listings.filter((l) => {
      const haystack = [
        l.title, l.description, l.excerpt, l.vertical, l.organizer,
        Array.isArray(l.tags) ? l.tags.join(' ') : '',
      ].filter(Boolean).join(' ').toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [listings, searchInput]);

  // Split listings: feature (first) + grid (rest)
  const featureListing = filteredListings.length > 0 ? filteredListings[0] : null;
  const gridListings = filteredListings.length > 1 ? filteredListings.slice(1) : [];

  return (
    <div className="osv3-discovery-page">
      {/* Page Header: "Discovery" + Subtitle */}
      <div className="osv3-discovery-header">
        <div>
          <h1 className="osv3-discovery-page-title">Discovery</h1>
          <p className="osv3-discovery-page-subtitle">Research and white papers from across the space industry.</p>
        </div>
        <Link to="/discovery/post" className="osv3-discovery-cta">
          + Post a Whitepaper
        </Link>
      </div>

      {/* No Supabase Error */}
      {!supabase && (
        <div className="osv3-discovery-error">
          Supabase not configured
        </div>
      )}

      {/* Search Bar */}
      <div className="osv3-discovery-search-bar">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search whitepapers, topics, authors..."
          aria-label="Search whitepapers"
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      {/* Loading State */}
      {loading && supabase && (
        <>
          {/* Feature Hero Skeleton */}
          <div className="osv3-magazine-feature-skeleton" />
          {/* Grid Skeletons */}
          <div className="osv3-discovery-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="osv3-discovery-card osv3-discovery-card-skeleton">
                <div className="osv3-discovery-card-image-skeleton" />
                <div className="osv3-discovery-card-content">
                  <div className="osv3-discovery-card-skeleton-line" />
                  <div className="osv3-discovery-card-skeleton-line-short" />
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
          {featureListing && (
            <Link
              to={`/discovery/${featureListing.id}`}
              className="osv3-magazine-feature-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <img
                src={featureListing.cover_image_url || getImageForListing(featureListing, 0)}
                alt={featureListing.title}
                className="osv3-magazine-feature-image"
                loading="eager"
              />
              <div className="osv3-magazine-feature-overlay" />
              <div className="osv3-magazine-feature-content">
                <div className="osv3-magazine-feature-kicker">{featureListing.tags?.[0] || 'Whitepaper'}</div>
                <h2 className="osv3-magazine-feature-headline">{featureListing.title}</h2>
                <p className="osv3-magazine-feature-deck">{featureListing.organizer || 'Space Rising'} · {formatDate(featureListing.created_at)}</p>
                <button
                  className="osv3-magazine-feature-button"
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                >
                  View Whitepaper →
                </button>
              </div>
            </Link>
          )}

          {/* EDITORIAL GRID (Tier 2) */}
          {gridListings.length > 0 && (
            <>
              <div className="osv3-magazine-section-header">
                <div className="osv3-magazine-section-eyebrow">Latest Papers</div>
              </div>
              <div className="osv3-discovery-grid">
                {gridListings.map((listing, idx) => {
                  const date = formatDate(listing.created_at);
                  const hasPDF = listing.apply_url ? true : false;
                  return (
                    <Link
                      key={listing.id}
                      to={`/discovery/${listing.id}`}
                      className="osv3-discovery-card"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      {/* Card Image (3:2) */}
                      <div className="osv3-discovery-card-image-wrapper">
                        <img
                          src={listing.cover_image_url || getImageForListing(listing, idx + 1)}
                          alt={listing.title}
                          className="osv3-discovery-card-image"
                          loading="lazy"
                        />
                      </div>

                      {/* Card Content */}
                      <div className="osv3-discovery-card-content">
                        <div className="osv3-discovery-card-kicker">{listing.tags?.[0] || 'Paper'}</div>
                        <h3 className="osv3-discovery-card-headline">{listing.title}</h3>
                        <p className="osv3-discovery-card-deck">{listing.organizer || 'Space Rising'} · {date}</p>
                        {hasPDF && (
                          <div className="osv3-discovery-card-pills">
                            <span className="osv3-discovery-card-pill osv3-pill-pdf">PDF</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty State */}
          {filteredListings.length === 0 && (
            <div className="osv3-discovery-empty">
              {searchInput ? `No whitepapers match "${searchInput}"` : 'No whitepapers posted yet.'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SourcingDiscoveryV2() {
  return <SourcingDiscoveryV2Inner />;
}
