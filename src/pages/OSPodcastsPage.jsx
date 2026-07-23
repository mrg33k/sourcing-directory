/**
 * OSPodcastsPage — Podcasts section built on OSMagazinePage engine
 *
 * Data: directory_listings WHERE category = 'podcast', tenant = 'space-rising'
 * Column map: title → episode title, author_name → host/guest,
 *   cover_image_url/image_url → cover, virtual_url/apply_url → link,
 *   description → show notes, vertical → tag, created_at → date,
 *   location → duration (stored in location col, no DDL change)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import OSMagazinePage from './OSMagazinePage.jsx';
import './osv3-magazine.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

/* waveform heights for the hero media slot (20 bars) */
const WAVE_HEIGHTS = [32, 58, 80, 46, 70, 94, 52, 78, 38, 66, 88, 44, 62, 30, 72, 50, 84, 40, 60, 34];

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
  { label: 'Interviews', value: 'Interview' },
  { label: 'Market Intel', value: 'Market Intel' },
  { label: 'News', value: 'News' },
];

/* ------------------------------------------------------------------ */
/* PodcastMediaSlot — hero LEFT panel (starfield + orbital + waveform) */
function PodcastMediaSlot({ onPlay, url }) {
  const handleClick = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else if (onPlay) onPlay();
  };
  return (
    <div className="osv3-pod-media" onClick={handleClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}>
      {/* orbital rings */}
      <div className="osv3-pod-orbit" />
      <div className="osv3-pod-orbit-two" />

      {/* center play */}
      <div className="osv3-pod-cover-play">
        <span className="osv3-pod-tri" />
      </div>

      {/* NEW badge */}
      <div className="osv3-pod-badge">NEW</div>

      {/* waveform strip */}
      <div className="osv3-pod-wave">
        {WAVE_HEIGHTS.map((h, i) => (
          <i key={i} style={{ height: h + 'px' }} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EpisodeCard — grid card renderer */
function EpisodeCard({ item, index }) {
  const covClass = COV[index % COV.length];
  const link = item.virtual_url || item.apply_url;
  const duration = item.location; /* stored in location col */

  const handleClick = () => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="osv3-ep-card" onClick={handleClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}>
      <div className={`osv3-ep-cover ${covClass}`}>
        <div className="osv3-ep-ring" />
        <div className="osv3-ep-init">{initials(item.title)}</div>
        {item.vertical && (
          <div className="osv3-ep-cat">{item.vertical}</div>
        )}
        {duration && (
          <div className="osv3-ep-dur">{duration}</div>
        )}
        <div className="osv3-ep-play">
          <span className="osv3-ep-tri" />
        </div>
      </div>
      <div className="osv3-ep-body">
        <h3 className="osv3-ep-title">{item.title}</h3>
        {item.author_name && (
          <div className="osv3-ep-host">{item.author_name}</div>
        )}
        <div className="osv3-ep-foot">
          <span className="osv3-ep-date">{fmtDate(item.created_at)}</span>
          {link && (
            <span className="osv3-ep-listen">
              <span className="osv3-ep-listen-tri" />
              Listen
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OSPodcastsPage — top-level page component */
function OSPodcastsPage() {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadEpisodes = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      /* step 1: resolve tenant */
      const { data: tenantData } = await supabase
        .from('directory_tenants')
        .select('id')
        .eq('slug', TENANT_DB_LOOKUP_SLUG)
        .single();

      /* step 2: fetch podcast listings */
      let qb = supabase
        .from('directory_listings')
        .select('*')
        .eq('category', 'podcast')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (tenantData?.id) qb = qb.eq('tenant_id', tenantData.id);

      const { data, error } = await qb.limit(50);
      if (!error && data) setEpisodes(data);
    } catch (_) {
      /* silently degrade — empty state handled */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadEpisodes(); }, [loadEpisodes]);

  /* filter */
  const filtered = activeFilter === 'all'
    ? episodes
    : episodes.filter(e =>
        (e.vertical || '').toLowerCase().includes(activeFilter.toLowerCase())
      );

  /* featured = first episode */
  const featured = episodes[0] || null;
  /* grid = remaining (skip featured when rendering all episodes) */
  const gridItems = filtered;

  /* feature computed fields */
  const featLink = featured
    ? (featured.virtual_url || featured.apply_url)
    : null;
  const featDuration = featured ? featured.location : null;
  const featDate = featured ? fmtDate(featured.created_at) : null;

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Intelligence Hub / Podcasts"
      pageTitle="Podcasts"
      pageSubtitle="Conversations, briefings, and market intelligence from Arizona's space economy. Listen in."
      addLabel="Add Episode"
      onAdd={() => navigate('/admin/listings?category=podcast')}

      /* feature */
      featuredItem={featured}
      mediaSlot={
        featured
          ? <PodcastMediaSlot url={featLink} />
          : null
      }
      featureEyebrow="FEATURED EPISODE"
      featureTitle={featured?.title || ''}
      featureHost={featured?.author_name || ''}
      featureHostTag="Host"
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
                Listen Now
              </a>
            )}
            <button className="osv3-mag-btn-ghost" type="button"
              onClick={() => navigate('/admin/listings?category=podcast')}>
              + Add Episode
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
        <EpisodeCard key={item.id || i} item={item} index={i} />
      )}
      isLoading={isLoading}
      sectionLabel="ALL EPISODES"
    />
  );
}

export default OSPodcastsPage;
