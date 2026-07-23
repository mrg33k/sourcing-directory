/**
 * OSDiscoveryPage — Discovery / Whitepapers section built on OSMagazinePage engine
 *
 * Data: directory_listings WHERE category = 'whitepaper', tenant = 'space-rising'
 * Featured: first with cover_image_url, else first overall
 * Cards link to /discovery/:id (detail via SourcingListingV2 kind=whitepaper)
 * Featured CTA: apply_url || virtual_url → external link; else /discovery/:id
 *
 * Media slot: real cover img OR starfield fallback
 *   (vertical pill, headline, author over deep gradient)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import OSMagazinePage from './OSMagazinePage.jsx';
import './osv3-magazine.css';
import { useSiteContentBySlug } from '../hooks/useSiteContent.js';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function externalHref(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `https://${url}`;
}

const PILLS = [
  { label: 'All', value: 'all' },
  { label: 'Policy', value: 'Policy' },
  { label: 'Technology', value: 'Technology' },
  { label: 'Market', value: 'Market' },
  { label: 'Defense', value: 'Defense' },
];

/* ------------------------------------------------------------------ */
/* DiscoveryMediaSlot — hero LEFT panel                                 */
/* With cover: real photo + overlay.                                    */
/* Without cover: starfield fallback — vertical pill, headline, author  */
/* so the slot is NEVER an empty rectangle.                             */
function DiscoveryMediaSlot({ featured }) {
  const hasCover = !!(featured?.cover_image_url);

  if (hasCover) {
    return (
      <div className="osv3-disc-media">
        <img
          src={featured.cover_image_url}
          alt=""
          className="osv3-disc-media-img"
          aria-hidden="true"
        />
        <div className="osv3-disc-media-overlay" />
        {featured?.vertical && (
          <div className="osv3-disc-media-badge">{featured.vertical}</div>
        )}
      </div>
    );
  }

  /* Starfield fallback */
  return (
    <div className="osv3-disc-media-fallback">
      <div className="osv3-disc-media-fallback-stars" aria-hidden="true" />
      <div className="osv3-disc-media-fallback-inner">
        {featured?.vertical && (
          <div className="osv3-disc-media-fallback-topic">{featured.vertical}</div>
        )}
        {featured?.title && (
          <div className="osv3-disc-media-fallback-headline">{featured.title}</div>
        )}
        {featured?.author_name && (
          <div className="osv3-disc-media-fallback-author">By {featured.author_name}</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DiscoveryCard — grid card renderer; links to /discovery/:id          */
/* Reuses .osv3-art-card CSS (same visual structure as articles)        */
function DiscoveryCard({ item, onOpen }) {
  const hasCover = !!(item.cover_image_url);
  const dateStr = fmtDate(item.created_at);

  return (
    <div
      className="osv3-art-card"
      onClick={() => onOpen(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen(item.id)}
    >
      <div className="osv3-art-card-cover">
        {hasCover ? (
          <img
            src={item.cover_image_url}
            alt=""
            className="osv3-art-card-cover-img"
          />
        ) : (
          <div className="osv3-art-card-cover-fallback">
            <span className="osv3-art-card-cover-init osv3-disc-card-icon">&#128196;</span>
          </div>
        )}
        {item.vertical && (
          <div className="osv3-art-card-tag">{item.vertical}</div>
        )}
      </div>
      <div className="osv3-art-card-body">
        <h3 className="osv3-art-card-title">{item.title}</h3>
        {item.description && (
          <p className="osv3-art-card-desc">{item.description}</p>
        )}
        <div className="osv3-art-card-foot">
          <span className="osv3-art-card-byline">
            {item.author_name ? `By ${item.author_name}` : ''}
            {item.author_name && dateStr ? ' · ' : ''}
            {dateStr}
          </span>
          <span className="osv3-art-card-read">
            {item.apply_url ? 'Download' : 'View'} &rarr;
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OSDiscoveryPage — top-level page component                           */
function OSDiscoveryPage() {
  const navigate = useNavigate();
  const { get } = useSiteContentBySlug(TENANT_DB_LOOKUP_SLUG);
  const [papers, setPapers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadPapers = useCallback(async () => {
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
        .eq('category', 'whitepaper')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (tenantData?.id) qb = qb.eq('tenant_id', tenantData.id);

      const { data, error } = await qb.limit(50);
      if (!error && data) setPapers(data);
    } catch (_) {
      /* silently degrade */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadPapers(); }, [loadPapers]);

  /* filter by vertical (pill value matches item.vertical) */
  const filtered = activeFilter === 'all'
    ? papers
    : papers.filter(p =>
        (p.vertical || '').toLowerCase().includes(activeFilter.toLowerCase())
      );

  /* featured: first with cover, else first overall */
  const featured = papers.find(p => p.cover_image_url) || papers[0] || null;
  const featDate = featured ? fmtDate(featured.created_at) : null;

  /* card click: navigate to detail page */
  const handleCardOpen = (id) => navigate(`/discovery/${id}`);

  /* featured CTA: open document if available, else detail page */
  const featuredDocUrl = featured
    ? externalHref(featured.apply_url || featured.virtual_url)
    : null;

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Intelligence Hub / Discovery"
      pageTitle={get('discovery', 'page_title', 'Discovery')}
      pageSubtitle={get('discovery', 'page_subtitle', 'Whitepapers, research, and technical documents from Arizona\'s space ecosystem.')}
      addLabel="Submit Whitepaper"
      onAdd={() => navigate('/admin/listings?category=whitepaper')}

      featuredItem={featured}
      mediaSlot={featured ? <DiscoveryMediaSlot featured={featured} /> : null}
      featureEyebrow="FEATURED WHITEPAPER"
      featureTitle={featured?.title || ''}
      featureHost={featured?.author_name || ''}
      featureHostTag={featured?.author_name ? 'Author' : ''}
      featureDesc={
        featured?.description
          ? featured.description.slice(0, 280) +
            (featured.description.length > 280 ? '...' : '')
          : ''
      }
      featureMeta={[
        ...(featured?.vertical ? [{ label: 'Topic', value: featured.vertical }] : []),
        ...(featDate ? [{ label: 'Published', value: featDate }] : []),
      ]}
      featureActions={
        featured ? (
          <>
            <button
              className="osv3-mag-btn-play"
              type="button"
              onClick={() => {
                if (featuredDocUrl) {
                  window.open(featuredDocUrl, '_blank', 'noopener,noreferrer');
                } else {
                  navigate(`/discovery/${featured.id}`);
                }
              }}
            >
              {featuredDocUrl ? 'Download' : 'View Whitepaper'}
            </button>
            <button
              className="osv3-mag-btn-ghost"
              type="button"
              onClick={() => navigate('/admin/listings?category=whitepaper')}
            >
              + Submit Whitepaper
            </button>
          </>
        ) : null
      }

      pills={PILLS}
      activeFilter={activeFilter}
      onFilter={setActiveFilter}
      items={filtered}
      cardRenderer={(item, i) => (
        <DiscoveryCard
          key={item.id || i}
          item={item}
          onOpen={handleCardOpen}
        />
      )}
      isLoading={isLoading}
      sectionLabel="ALL WHITEPAPERS"
    />
  );
}

export default OSDiscoveryPage;
