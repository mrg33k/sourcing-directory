/**
 * OSMarketplacePage — Marketplace built on OSMagazinePage engine
 *
 * Data: directory_listings WHERE category IN ('equipment','services','products')
 * Real photos via image_url; designed fallback when absent.
 * Filter pills: All / Equipment / Services / Products
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import OSMagazinePage from './OSMagazinePage.jsx';
import './osv3-magazine.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

const PILLS = [
  { label: 'All', value: 'all' },
  { label: 'Equipment', value: 'equipment' },
  { label: 'Services', value: 'services' },
  { label: 'Products', value: 'products' },
];

function fmt$(price) {
  if (price === null || price === undefined || price === '') return null;
  return '$' + Number(price).toLocaleString();
}

function initials(title = '') {
  const parts = title.trim().split(/\s+/).filter(p => /[a-zA-Z]/.test(p));
  if (!parts.length) return 'MK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ------------------------------------------------------------------
   MarketMediaSlot — hero left panel
   Real photo when image_url present; starfield orbital fallback otherwise. */
function MarketMediaSlot({ item }) {
  const hasPhoto = !!(item?.image_url);
  return (
    <div className="osv3-mkt-media">
      {hasPhoto ? (
        <>
          <img src={item.image_url} alt="" className="osv3-mkt-media-img" aria-hidden="true" />
          <div className="osv3-mkt-media-overlay" />
        </>
      ) : (
        <div className="osv3-mkt-media-fallback">
          <div className="osv3-mkt-fallback-stars" aria-hidden="true" />
          <div className="osv3-mkt-fallback-inner">
            {item?.category && (
              <div className="osv3-mkt-fallback-cat">{item.category.toUpperCase()}</div>
            )}
            <div className="osv3-mkt-fallback-init">{initials(item?.title || '')}</div>
          </div>
        </div>
      )}
      <div className="osv3-mkt-media-badge">FEATURED LISTING</div>
    </div>
  );
}

/* ------------------------------------------------------------------
   MarketCard — grid card renderer */
function MarketCard({ item, onOpen }) {
  const hasPhoto = !!(item.image_url);
  const price = fmt$(item.price);

  return (
    <div
      className="osv3-mkt-card"
      onClick={() => onOpen(item)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen(item)}
    >
      <div className="osv3-mkt-card-photo">
        {hasPhoto ? (
          <img src={item.image_url} alt="" className="osv3-mkt-card-photo-img" />
        ) : (
          <div className="osv3-mkt-card-photo-fallback">
            <span className="osv3-mkt-card-photo-init">{initials(item.title)}</span>
          </div>
        )}
        {item.category && (
          <div className="osv3-mkt-card-cat">{item.category}</div>
        )}
      </div>
      <div className="osv3-mkt-card-body">
        <h3 className="osv3-mkt-card-title">{item.title}</h3>
        {item.description && (
          <p className="osv3-mkt-card-desc">{item.description}</p>
        )}
        <div className="osv3-mkt-card-foot">
          {price && <span className="osv3-mkt-card-price">{price}</span>}
          {item.condition && <span className="osv3-mkt-card-cond">{item.condition}</span>}
          <span className="osv3-mkt-card-link">View &rarr;</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   OSMarketplacePage — top-level page component */
function OSMarketplacePage() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadListings = useCallback(async () => {
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
        .in('category', ['equipment', 'services', 'products'])
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (tenantData?.id) qb = qb.eq('tenant_id', tenantData.id);

      const { data, error } = await qb.limit(60);
      if (!error && data) setListings(data);
    } catch (_) { /* silently degrade */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadListings(); }, [loadListings]);

  const filtered = activeFilter === 'all'
    ? listings
    : listings.filter(l => l.category === activeFilter);

  /* featured = first listing with a photo, else first overall */
  const featured = listings.find(l => l.image_url) || listings[0] || null;
  const featPrice = featured ? fmt$(featured.price) : null;

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Marketplace"
      pageTitle="Marketplace"
      pageSubtitle="Equipment, services, and products from Arizona's space economy."
      addLabel="Add Listing"
      onAdd={() => navigate('/admin/listings?category=equipment')}

      featuredItem={featured}
      mediaSlot={featured ? <MarketMediaSlot item={featured} /> : null}
      featureEyebrow="MARKETPLACE · FEATURED"
      featureTitle={featured?.title || ''}
      featureHost={''}
      featureDesc={
        featured?.description
          ? featured.description.slice(0, 260) +
            (featured.description.length > 260 ? '...' : '')
          : ''
      }
      featureMeta={[
        ...(featured?.category ? [{ label: 'Category', value: featured.category }] : []),
        ...(featPrice ? [{ label: 'Price', value: featPrice }] : []),
        ...(featured?.condition ? [{ label: 'Condition', value: featured.condition }] : []),
        ...(featured?.vertical ? [{ label: 'Type', value: featured.vertical }] : []),
      ]}
      featureActions={
        featured ? (
          <>
            <button
              className="osv3-mag-btn-play"
              type="button"
              onClick={() => navigate(`/marketplace/${featured.id}`)}
            >
              View Listing
            </button>
            <button
              className="osv3-mag-btn-ghost"
              type="button"
              onClick={() => navigate('/admin/listings?category=equipment')}
            >
              + Add Listing
            </button>
          </>
        ) : null
      }

      pills={PILLS}
      activeFilter={activeFilter}
      onFilter={setActiveFilter}
      items={filtered}
      cardRenderer={(item, i) => (
        <MarketCard
          key={item.id || i}
          item={item}
          onOpen={itm => navigate(`/marketplace/${itm.id}`)}
        />
      )}
      isLoading={isLoading}
      sectionLabel="ALL LISTINGS"
    />
  );
}

export default OSMarketplacePage;
