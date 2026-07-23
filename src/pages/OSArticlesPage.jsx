/**
 * OSArticlesPage — Articles section built on OSMagazinePage engine
 *
 * Data: directory_listings WHERE category = 'article', tenant = 'space-rising'
 * Column map: title, author_name → byline, cover_image_url → cover,
 *   description → body/summary, vertical → topic, created_at → publish date
 *
 * Cards link to /articles/:id — detail page fixed separately in SourcingListingV2.
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

function initials(title = '') {
  const parts = title.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PILLS = [
  { label: 'All', value: 'all' },
  { label: 'Infrastructure', value: 'Infrastructure' },
  { label: 'Mobility', value: 'Mobility' },
  { label: 'Intelligence', value: 'Intelligence' },
  { label: 'Life Sciences', value: 'Life Sciences' },
  { label: 'Defense', value: 'Defense' },
];

/* ------------------------------------------------------------------ */
/* ArticleMediaSlot — hero LEFT panel                                    */
/* With cover: real photo + overlay.                                     */
/* Without cover: rich fallback — headline set large over deep gradient  */
/* so the slot is NEVER an empty rectangle.                             */
function ArticleMediaSlot({ featured }) {
  const hasCover = !!(featured?.cover_image_url);
  return (
    <div className="osv3-art-media">
      {hasCover ? (
        <>
          <img
            src={featured.cover_image_url}
            alt=""
            className="osv3-art-media-img"
            aria-hidden="true"
          />
          <div className="osv3-art-media-overlay" />
        </>
      ) : (
        /* Rich no-cover fallback: headline + topic + author over deep gradient */
        <div className="osv3-art-media-fallback">
          <div className="osv3-art-media-fallback-stars" aria-hidden="true" />
          <div className="osv3-art-media-fallback-inner">
            {featured?.vertical && (
              <div className="osv3-art-media-fallback-topic">{featured.vertical}</div>
            )}
            {featured?.title && (
              <div className="osv3-art-media-fallback-headline">{featured.title}</div>
            )}
            {featured?.author_name && (
              <div className="osv3-art-media-fallback-author">By {featured.author_name}</div>
            )}
          </div>
        </div>
      )}
      <div className="osv3-art-media-badge">FEATURED ARTICLE</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ArticleCard — grid card renderer; links to /articles/:id            */
function ArticleCard({ item, onOpen }) {
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
            <span className="osv3-art-card-cover-init">{initials(item.title)}</span>
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
          <span className="osv3-art-card-read">Read &rarr;</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OSArticlesPage — top-level page component                            */
function OSArticlesPage() {
  const navigate = useNavigate();
  const { get } = useSiteContentBySlug(TENANT_DB_LOOKUP_SLUG);
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadArticles = useCallback(async () => {
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
        .eq('category', 'article')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (tenantData?.id) qb = qb.eq('tenant_id', tenantData.id);

      const { data, error } = await qb.limit(50);
      if (!error && data) setArticles(data);
    } catch (_) {
      /* silently degrade */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  /* filter by vertical */
  const filtered = activeFilter === 'all'
    ? articles
    : articles.filter(a =>
        (a.vertical || '').toLowerCase().includes(activeFilter.toLowerCase())
      );

  /* featured = first article with cover_image_url, else first overall */
  const featured =
    articles.find(a => a.cover_image_url) || articles[0] || null;

  const featDate = featured ? fmtDate(featured.created_at) : null;

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Intelligence Hub / Articles"
      pageTitle={get('articles', 'page_title', 'Articles')}
      pageSubtitle={get('articles', 'page_subtitle', 'Research, analysis, and commentary from Arizona\'s space intelligence network.')}
      addLabel="Post an Article"
      onAdd={() => navigate('/admin/listings?category=article')}

      featuredItem={featured}
      mediaSlot={featured ? <ArticleMediaSlot featured={featured} /> : null}
      featureEyebrow="INTELLIGENCE · ARTICLES"
      featureTitle={featured?.title || ''}
      featureHost={featured?.author_name || ''}
      featureHostTag="Author"
      featureDesc={
        featured?.description
          ? featured.description.slice(0, 260) +
            (featured.description.length > 260 ? '...' : '')
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
              onClick={() => navigate(`/articles/${featured.id}`)}
            >
              Read Article
            </button>
            <button
              className="osv3-mag-btn-ghost"
              type="button"
              onClick={() => navigate('/admin/listings?category=article')}
            >
              + Add Article
            </button>
          </>
        ) : null
      }

      pills={PILLS}
      activeFilter={activeFilter}
      onFilter={setActiveFilter}
      items={filtered}
      cardRenderer={(item, i) => (
        <ArticleCard
          key={item.id || i}
          item={item}
          index={i}
          onOpen={id => navigate(`/articles/${id}`)}
        />
      )}
      isLoading={isLoading}
      sectionLabel="ALL ARTICLES"
    />
  );
}

export default OSArticlesPage;
