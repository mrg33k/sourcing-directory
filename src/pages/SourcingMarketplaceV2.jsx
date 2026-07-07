// SourcingMarketplaceV2.jsx
// Space OS v3 — Marketplace page (magazine pattern with feature hero + editorial grid)

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import './osv3-marketplace.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';
const CATEGORIES = ['equipment', 'services', 'products'];

// Asset rotation array (deterministic per listing ID)
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

function formatPrice(price) {
  if (!price) return null;
  if (price >= 1000) return `$${(price / 1000).toFixed(price % 1000 === 0 ? 0 : 1)}k`;
  return `$${price.toLocaleString()}`;
}

function formatPosted(dateStr) {
  if (!dateStr) return '';
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days === 0) return 'Today';
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

function getImageForListing(listing, index) {
  // Deterministic + diverse: hash the full id string (+ index) so cards don't
  // repeat the same photo. charCodeAt(0) alone collided across most listings.
  const s = (listing.id ? String(listing.id) : '') + ':' + index;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `/v2-assets/${ASSET_POOL[h % ASSET_POOL.length]}`;
}

function getCategoryIcon(category) {
  const icons = {
    equipment: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M2 12h20M6 6l12 12M18 6l-12 12" />
      </svg>
    ),
    services: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M16 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM23 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    ),
    products: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4M9 2h6M6 6h12M9 6v12M15 6v12" />
      </svg>
    ),
  };
  return icons[category] || null;
}

function SourcingMarketplaceV2Inner() {
  useSRWTitle('Space Marketplace | Space OS');

  const [tenant, setTenant] = useState(null);
  const [listings, setListings] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('equipment');
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
    if (!supabase) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let qb = supabase
          .from('directory_listings')
          .select('*')
          .eq('category', selectedCategory)
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
        const { data, error } = await qb.limit(100);
        if (error) throw error;
        if (cancelled) return;
        setListings(data || []);
        if (data && data.length > 0) {
          const companyIds = [...new Set(data.map((l) => l.company_id).filter(Boolean))];
          if (companyIds.length > 0) {
            const { data: compData } = await supabase
              .from('directory_companies').select('*').in('id', companyIds);
            const map = {};
            (compData || []).forEach((c) => { map[c.id] = c; });
            if (!cancelled) setCompanies(map);
          }
        }
      } catch (err) {
        console.error('MarketplaceV2 fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant, selectedCategory]);

  const filtered = useMemo(() => {
    if (!searchInput.trim()) return listings;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return listings.filter((l) => {
      const company = companies[l.company_id];
      const haystack = [
        l.title, l.description, l.condition, l.item_type, company?.name, company?.city,
      ].filter(Boolean).join(' ').toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [listings, companies, searchInput]);

  // Split listings: feature (first) + grid (rest)
  const featureListing = filtered.length > 0 ? filtered[0] : null;
  const gridListings = filtered.length > 1 ? filtered.slice(1) : [];

  return (
    <div className="osv3-marketplace-page">
      {/* Page Header: "Marketplace" + Subtitle */}
      <div className="osv3-marketplace-header">
        <div>
          <h1 className="osv3-marketplace-page-title">Marketplace</h1>
          <p className="osv3-marketplace-page-subtitle">Equipment, services, and products across the space ecosystem.</p>
        </div>
      </div>

      {/* No Supabase Error */}
      {!supabase && (
        <div className="osv3-marketplace-error">
          Supabase not configured
        </div>
      )}

      {/* Category Filters */}
      {supabase && (
        <div className="osv3-marketplace-filters">
          <div className="osv3-filter-pills">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                className={`osv3-filter-pill ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory(category);
                  setSearchInput('');
                }}
                aria-pressed={selectedCategory === category}
              >
                <span className="osv3-filter-icon">{getCategoryIcon(category)}</span>
                <span className="osv3-filter-label">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </span>
              </button>
            ))}
          </div>
          <Link to="/marketplace/post" className="osv3-primary-btn">
            Post a Listing →
          </Link>
        </div>
      )}

      {/* Loading State */}
      {loading && supabase && (
        <>
          {/* Feature Hero Skeleton */}
          <div className="osv3-magazine-feature-skeleton" />
          {/* Grid Skeletons */}
          <div className="osv3-marketplace-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="osv3-listing-card osv3-listing-card-skeleton">
                <div className="osv3-listing-card-image-skeleton" />
                <div className="osv3-listing-card-content">
                  <div className="osv3-listing-card-skeleton-line" />
                  <div className="osv3-listing-card-skeleton-line-short" />
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
              to={`/marketplace/${featureListing.id}`}
              className="osv3-magazine-feature-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <img
                src={getImageForListing(featureListing, 0)}
                alt={featureListing.title}
                className="osv3-magazine-feature-image"
                loading="eager"
              />
              <div className="osv3-magazine-feature-overlay" />
              <div className="osv3-magazine-feature-content">
                <div className="osv3-magazine-feature-kicker">{selectedCategory}</div>
                <h2 className="osv3-magazine-feature-headline">{featureListing.title}</h2>
                <p className="osv3-magazine-feature-deck">
                  {companies[featureListing.company_id]?.name || 'Seller'} · {formatPrice(featureListing.price) || 'Price TBD'} · {featureListing.condition || 'Condition TBD'}
                </p>
                <button
                  className="osv3-magazine-feature-button"
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                >
                  View Listing →
                </button>
              </div>
            </Link>
          )}

          {/* EDITORIAL GRID (Tier 2) */}
          {gridListings.length > 0 && (
            <>
              <div className="osv3-magazine-section-header">
                <div className="osv3-magazine-section-eyebrow">Available Listings</div>
                <Link to="#" className="osv3-magazine-section-link">See all →</Link>
              </div>
              <div className="osv3-marketplace-grid">
                {gridListings.map((listing, idx) => {
                  const company = companies[listing.company_id];
                  const price = formatPrice(listing.price);
                  return (
                    <Link
                      key={listing.id}
                      to={`/marketplace/${listing.id}`}
                      className="osv3-listing-card"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      {/* Card Image (3:2) */}
                      <div className="osv3-listing-card-image-wrapper">
                        <img
                          src={getImageForListing(listing, idx + 1)}
                          alt={listing.title}
                          className="osv3-listing-card-image"
                          loading="lazy"
                        />
                      </div>

                      {/* Card Content */}
                      <div className="osv3-listing-card-content">
                        <div className="osv3-listing-card-kicker">{selectedCategory}</div>
                        <h3 className="osv3-listing-card-headline">{listing.title}</h3>
                        <p className="osv3-listing-card-deck">{listing.condition || 'Condition TBD'}</p>
                        <div className="osv3-listing-card-meta">
                          {[company?.name || 'Seller', price].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty State */}
          {filtered.length === 0 && (
            <div className="osv3-marketplace-empty">
              {searchInput ? `No listings match "${searchInput}"` : 'No listings posted yet.'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SourcingMarketplaceV2() {
  return <SourcingMarketplaceV2Inner />;
}
