/**
 * OSVideosPage — Videos section built on OSMagazinePage engine
 *
 * Data: directory_listings WHERE category = 'video', tenant = 'space-rising'
 * Column map: title → video title, author_name → source/outlet,
 *   cover_image_url → thumbnail (fallback gradient), virtual_url/apply_url → watch URL,
 *   description → video description, vertical → category tag,
 *   location → duration, created_at → date
 *
 * Pattern: mirrors OSPodcastsPage (podcast=audio, video=video)
 * v3 tokens: #000C20 navy / #FEFDFD content bg / #CE4421 rust accent
 * Roboto only — no serif, no system-ui
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import OSMagazinePage from './OSMagazinePage.jsx';
import './osv3-magazine.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

/* cover gradient variants cycle */
const COV = ['osv3-cov-a', 'osv3-cov-b', 'osv3-cov-c', 'osv3-cov-d'];

/* format ISO date to "Mon YYYY" */
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/* two-letter initials from a title */
function initials(title = '') {
  const parts = title.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* filter pill definitions */
const PILLS = [
  { label: 'All', value: 'all' },
  { label: 'Space Congress', value: 'Space Congress' },
  { label: 'Market Intel', value: 'Market Intel' },
  { label: 'News', value: 'News' },
];

/* ------------------------------------------------------------------ */
/* VideoMediaSlot — hero LEFT panel (cinematic starfield + play) */
function VideoMediaSlot({ onPlay, url }) {
  const handleClick = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else if (onPlay) onPlay();
  };
  return (
    <div className="osv3-vid-media" onClick={handleClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}>
      {/* scan lines for cinematic feel */}
      <div className="osv3-vid-scanlines" aria-hidden="true" />

      {/* orbital rings */}
      <div className="osv3-vid-orbit" />
      <div className="osv3-vid-orbit-two" />

      {/* center play button */}
      <div className="osv3-vid-play-ring">
        <span className="osv3-vid-play-tri" />
      </div>

      {/* WATCH badge */}
      <div className="osv3-vid-badge">WATCH</div>

      {/* film strip bottom decoration */}
      <div className="osv3-vid-filmstrip" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="osv3-vid-frame" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VideoCard — grid card renderer */
function VideoCard({ item, index }) {
  const covClass = COV[index % COV.length];
  const link = item.virtual_url || item.apply_url;
  const duration = item.location;
  const thumbnail = item.cover_image_url || item.image_url;

  const handleClick = () => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="osv3-vid-card" onClick={handleClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}>
      <div className={`osv3-vid-thumb ${thumbnail ? 'osv3-vid-thumb-img' : covClass}`}
        style={thumbnail ? { backgroundImage: `url(${thumbnail})` } : undefined}>
        {!thumbnail && (
          <>
            <div className="osv3-vid-ring" />
            <div className="osv3-vid-init">{initials(item.title)}</div>
          </>
        )}
        {item.vertical && (
          <div className="osv3-vid-cat">{item.vertical}</div>
        )}
        {duration && (
          <div className="osv3-vid-dur">{duration}</div>
        )}
        <div className="osv3-vid-play-btn">
          <span className="osv3-vid-tri" />
        </div>
      </div>
      <div className="osv3-vid-body">
        <h3 className="osv3-vid-title">{item.title}</h3>
        {item.author_name && (
          <div className="osv3-vid-source">{item.author_name}</div>
        )}
        <div className="osv3-vid-foot">
          <span className="osv3-vid-date">{fmtDate(item.created_at)}</span>
          {link && (
            <span className="osv3-vid-watch">
              <span className="osv3-vid-watch-tri" />
              Watch
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OSVideosPage — top-level page component */
function OSVideosPage() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadVideos = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      /* step 1: resolve tenant */
      const { data: tenantData } = await supabase
        .from('directory_tenants')
        .select('id')
        .eq('slug', TENANT_DB_LOOKUP_SLUG)
        .single();

      /* step 2: fetch video listings */
      let qb = supabase
        .from('directory_listings')
        .select('*')
        .eq('category', 'video')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (tenantData?.id) qb = qb.eq('tenant_id', tenantData.id);

      const { data, error } = await qb.limit(50);
      if (!error && data) setVideos(data);
    } catch (_) {
      /* silently degrade */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  /* filter */
  const filtered = activeFilter === 'all'
    ? videos
    : videos.filter(v =>
        (v.vertical || '').toLowerCase().includes(activeFilter.toLowerCase())
      );

  /* featured = first video */
  const featured = videos[0] || null;
  /* grid = all filtered videos */
  const gridItems = filtered;

  /* feature computed fields */
  const featLink = featured ? (featured.virtual_url || featured.apply_url) : null;
  const featDuration = featured ? featured.location : null;
  const featDate = featured ? fmtDate(featured.created_at) : null;

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Intelligence Hub / Videos"
      pageTitle="Videos"
      pageSubtitle="Arizona's space story on film. Sessions, news coverage, and interviews from across the ecosystem."
      addLabel="Add Video"
      onAdd={() => navigate('/admin/listings?category=video')}

      /* feature */
      featuredItem={featured}
      mediaSlot={
        featured
          ? <VideoMediaSlot url={featLink} />
          : null
      }
      featureEyebrow="FEATURED VIDEO"
      featureTitle={featured?.title || ''}
      featureHost={featured?.author_name || ''}
      featureHostTag="Source"
      featureDesc={featured?.description
        ? featured.description.slice(0, 220) + (featured.description.length > 220 ? '...' : '')
        : ''}
      featureMeta={[
        ...(featDuration ? [{ label: 'Duration', value: featDuration }] : []),
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
                <span className="osv3-mag-tri" />
                Watch Now
              </a>
            )}
            <button className="osv3-mag-btn-ghost" type="button"
              onClick={() => navigate('/admin/listings?category=video')}>
              + Add Video
            </button>
          </>
        ) : null
      }

      /* grid */
      pills={PILLS}
      activeFilter={activeFilter}
      onFilter={setActiveFilter}
      items={gridItems}
      cardRenderer={(item, i) => (
        <VideoCard key={item.id || i} item={item} index={i} />
      )}
      isLoading={isLoading}
      sectionLabel="ALL VIDEOS"
    />
  );
}

export default OSVideosPage;
