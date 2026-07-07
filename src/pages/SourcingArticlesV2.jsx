// SourcingArticlesV2.jsx
// Space OS v3 — Articles page (magazine pattern with feature hero + editorial grid).
// Data: directory_listings where category='article' with real cover_image_url per article.

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import './osv3-articles.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

// Fallback image pool for articles without cover (deterministic per article ID)
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

function formatPubDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Deterministic fallback image selection (UUID-safe hash)
function getFallbackImage(article, index) {
  const s = (article.id ? String(article.id) : '') + ':' + index;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `/v2-assets/${ASSET_POOL[h % ASSET_POOL.length]}`;
}

function SourcingArticlesV2Inner() {
  useSRWTitle('Space Industry Articles | Space OS');

  const [tenant, setTenant] = useState(null);
  const [articles, setArticles] = useState([]);
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

  // Load active articles
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
          .eq('category', 'article')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
        const { data, error } = await qb.limit(100);
        if (error) throw error;
        if (cancelled) return;
        setArticles(data || []);
      } catch (err) {
        console.error('ArticlesV2 fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant]);

  const filtered = useMemo(() => {
    if (!searchInput.trim()) return articles;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return articles.filter((a) => {
      const haystack = [a.title, a.description, a.excerpt, a.vertical,
        Array.isArray(a.tags) ? a.tags.join(' ') : '',
      ].filter(Boolean).join(' ').toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [articles, searchInput]);

  // Split articles: feature (first) + grid (rest)
  const featureArticle = filtered.length > 0 ? filtered[0] : null;
  const gridArticles = filtered.length > 1 ? filtered.slice(1) : [];

  return (
    <div className="osv3-articles-page">
      {/* Page Header: "Articles" + Subtitle */}
      <div className="osv3-articles-header">
        <div>
          <h1 className="osv3-articles-page-title">Articles</h1>
          <p className="osv3-articles-page-subtitle">Editorial from across the space industry.</p>
        </div>
        <div className="osv3-articles-header-action">
          <Link to="/articles/post" className="osv3-articles-cta">
            + Post an Article
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="osv3-articles-search-bar">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search articles, topics, companies..."
          aria-label="Search articles"
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      {/* No Supabase Error */}
      {!supabase && (
        <div className="osv3-articles-error">
          Supabase not configured
        </div>
      )}

      {/* Loading State */}
      {loading && supabase && (
        <>
          {/* Feature Hero Skeleton */}
          <div className="osv3-magazine-feature-skeleton" />
          {/* Grid Skeletons */}
          <div className="osv3-articles-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="osv3-article-card osv3-article-card-skeleton">
                <div className="osv3-article-card-image-skeleton" />
                <div className="osv3-article-card-content">
                  <div className="osv3-article-card-skeleton-line" />
                  <div className="osv3-article-card-skeleton-line-short" />
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
          {featureArticle && (
            <Link
              to={`/articles/${featureArticle.id}`}
              className="osv3-magazine-feature-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <img
                src={featureArticle.cover_image_url || getFallbackImage(featureArticle, 0)}
                alt={featureArticle.title}
                className="osv3-magazine-feature-image"
                loading="eager"
              />
              <div className="osv3-magazine-feature-overlay" />
              <div className="osv3-magazine-feature-content">
                <div className="osv3-magazine-feature-kicker">{featureArticle.vertical || 'Featured'}</div>
                <h2 className="osv3-magazine-feature-headline">{featureArticle.title}</h2>
                <p className="osv3-magazine-feature-deck">{featureArticle.description || ''}</p>
                <div className="osv3-magazine-feature-byline">
                  {[
                    featureArticle.author_name && `By ${featureArticle.author_name}`,
                    formatPubDate(featureArticle.created_at),
                    featureArticle.read_time_min && `${featureArticle.read_time_min} min read`,
                  ].filter(Boolean).join(' · ')}
                </div>
                <button
                  className="osv3-magazine-feature-button"
                  onClick={(e) => { e.preventDefault(); }}
                >
                  Read Article →
                </button>
              </div>
            </Link>
          )}

          {/* EDITORIAL GRID (Tier 2) */}
          {gridArticles.length > 0 && (
            <>
              <div className="osv3-magazine-section-header">
                <div className="osv3-magazine-section-eyebrow">Latest Articles</div>
                <Link to="#" className="osv3-magazine-section-link">See all →</Link>
              </div>
              <div className="osv3-articles-grid">
                {gridArticles.map((article, idx) => {
                  const date = formatPubDate(article.created_at);
                  return (
                    <Link
                      key={article.id}
                      to={`/articles/${article.id}`}
                      className="osv3-article-card"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      {/* Card Image (3:2) */}
                      <div className="osv3-article-card-image-wrapper">
                        <img
                          src={article.cover_image_url || getFallbackImage(article, idx + 1)}
                          alt={article.title}
                          className="osv3-article-card-image"
                          loading="lazy"
                        />
                      </div>

                      {/* Card Content */}
                      <div className="osv3-article-card-content">
                        <div className="osv3-article-card-kicker">{article.vertical || 'Article'}</div>
                        <h3 className="osv3-article-card-headline">{article.title}</h3>
                        <p className="osv3-article-card-deck">{article.description || ''}</p>
                        <div className="osv3-article-card-meta">
                          {[article.author_name, date, article.read_time_min && `${article.read_time_min} min read`].filter(Boolean).join(' · ')}
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
            <div className="osv3-articles-empty">
              {searchInput ? `No articles match "${searchInput}"` : 'No articles posted yet.'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SourcingArticlesV2() {
  return <SourcingArticlesV2Inner />;
}
