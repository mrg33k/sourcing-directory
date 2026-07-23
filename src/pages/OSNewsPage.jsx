/**
 * OSNewsPage — News section built on OSMagazinePage engine
 *
 * Data: directory_listings WHERE category = 'news', tenant = 'space-rising'
 * Column map:
 *   title       → headline
 *   author_name → outlet / source name
 *   virtual_url → article URL (opens externally)
 *   description → blurb / dek
 *   vertical    → topic tag (Space Congress, Aerospace, Policy, Local, ...)
 *   event_date  → publication date (created_at used as fallback)
 *
 * v3 tokens: #000C20 navy / #FEFDFD content bg / #CE4421 rust accent
 * Roboto only — no serif, no system-ui
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import OSMagazinePage from './OSMagazinePage.jsx';
import './osv3-magazine.css';
import { useSiteContentBySlug } from '../hooks/useSiteContent.js';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

/* gradient cycle for cards without images */
const COV = ['osv3-cov-a', 'osv3-cov-b', 'osv3-cov-c', 'osv3-cov-d'];

/* format ISO date to "Month D, YYYY" */
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/* format ISO to short "Mon D" for cards */
function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* two-letter initials from a name or headline */
function initials(str = '') {
  const parts = str.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* pill definitions */
const PILLS = [
  { label: 'All', value: 'all' },
  { label: 'Space Congress', value: 'Space Congress' },
  { label: 'Aerospace', value: 'Aerospace' },
  { label: 'Policy', value: 'Policy' },
  { label: 'Local', value: 'Local' },
];

/* ------------------------------------------------------------------ */
/* NewsMediaSlot — hero LEFT panel                                     */
/* Signal/broadcast aesthetic: concentric rings + LIVE badge           */
function NewsMediaSlot({ outlet }) {
  return (
    <div className="osv3-news-media">
      {/* orbital rings */}
      <div className="osv3-news-ring-a" aria-hidden="true" />
      <div className="osv3-news-ring-b" aria-hidden="true" />
      <div className="osv3-news-ring-c" aria-hidden="true" />

      {/* center signal dot */}
      <div className="osv3-news-dot" aria-hidden="true" />

      {/* LIVE badge */}
      <div className="osv3-news-badge">LIVE</div>

      {/* outlet label bottom-left */}
      {outlet && (
        <div className="osv3-news-outlet-label">{outlet}</div>
      )}

      {/* ticker strip */}
      <div className="osv3-news-ticker" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="osv3-news-tick" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* NewsCard — grid card renderer */
function NewsCard({ item, index }) {
  const covClass = COV[index % COV.length];
  const link = item.virtual_url || item.apply_url;
  const displayDate = item.event_date || item.created_at;

  const handleClick = () => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="osv3-news-card"
      onClick={handleClick}
      role={link ? 'button' : undefined}
      tabIndex={link ? 0 : undefined}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
    >
      {/* top color bar = outlet accent */}
      <div className={`osv3-news-card-bar ${covClass}`} />

      <div className="osv3-news-card-body">
        {/* outlet + topic row */}
        <div className="osv3-news-meta-row">
          {item.author_name && (
            <span className="osv3-news-source">{item.author_name}</span>
          )}
          {item.vertical && (
            <span className="osv3-news-topic">{item.vertical}</span>
          )}
        </div>

        {/* headline */}
        <h3 className="osv3-news-headline">{item.title}</h3>

        {/* blurb */}
        {item.description && (
          <p className="osv3-news-blurb">
            {item.description.slice(0, 160)}
            {item.description.length > 160 ? '...' : ''}
          </p>
        )}

        {/* footer */}
        <div className="osv3-news-foot">
          {displayDate && (
            <span className="osv3-news-date">{fmtDateShort(displayDate)}</span>
          )}
          {link && (
            <span className="osv3-news-read">
              Read story
              <span className="osv3-news-arrow"> →</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OSNewsPage — top-level page component */
function OSNewsPage() {
  const navigate = useNavigate();
  const { get } = useSiteContentBySlug(TENANT_DB_LOOKUP_SLUG);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadItems = useCallback(async () => {
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
        .eq('category', 'news')
        .eq('status', 'active')
        .order('event_date', { ascending: false, nullsFirst: false });

      if (tenantData?.id) qb = qb.eq('tenant_id', tenantData.id);

      const { data, error } = await qb.limit(50);
      if (!error && data) setItems(data);
    } catch (_) {
      /* silently degrade */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = activeFilter === 'all'
    ? items
    : items.filter(v =>
        (v.vertical || '').toLowerCase().includes(activeFilter.toLowerCase()) ||
        (v.title || '').toLowerCase().includes(activeFilter.toLowerCase())
      );

  /* featured = first item (most recent by event_date) */
  const featured = items[0] || null;
  const featLink = featured ? (featured.virtual_url || featured.apply_url) : null;
  const featDate = featured
    ? fmtDate(featured.event_date || featured.created_at)
    : null;

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Intelligence Hub / News"
      pageTitle={get('news', 'page_title', 'News')}
      pageSubtitle={get('news', 'page_subtitle', 'Real-time Arizona space coverage from KTAR, AZPBS, FOX 10, and local outlets tracking the ecosystem.')}
      addLabel="Add Story"
      onAdd={() => navigate('/admin/listings?category=news')}

      /* feature */
      featuredItem={featured}
      mediaSlot={
        featured
          ? <NewsMediaSlot outlet={featured.author_name} />
          : null
      }
      featureEyebrow="FEATURED STORY"
      featureTitle={featured?.title || ''}
      featureHost={featured?.author_name || ''}
      featureHostTag="Outlet"
      featureDesc={featured?.description
        ? featured.description.slice(0, 240) + (featured.description.length > 240 ? '...' : '')
        : ''}
      featureMeta={[
        ...(featured?.vertical ? [{ label: 'Topic', value: featured.vertical }] : []),
        ...(featDate ? [{ label: 'Published', value: featDate }] : []),
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
                Read Story
              </a>
            )}
            <button
              className="osv3-mag-btn-ghost"
              type="button"
              onClick={() => navigate('/admin/listings?category=news')}
            >
              + Add Story
            </button>
          </>
        ) : null
      }

      /* grid */
      pills={PILLS}
      activeFilter={activeFilter}
      onFilter={setActiveFilter}
      items={filtered}
      cardRenderer={(item, i) => (
        <NewsCard key={item.id || i} item={item} index={i} />
      )}
      isLoading={isLoading}
      sectionLabel="ALL NEWS"
    />
  );
}

export default OSNewsPage;
