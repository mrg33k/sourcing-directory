// SourcingArticlesV2.jsx
// Space OS v3 — Articles page reskin.
// Data: directory_listings where category='article'.

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import '../osv3-tokens.css';
import '../pages/OSLayoutV3.css';
import './osv3-articles.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SourcingArticlesV2Inner() {
  useSRWTitle('Space Industry Articles | Space OS');

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
        setListings(data || []);
      } catch (err) {
        console.error('ArticlesV2 fetch error:', err);
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
        l.title, l.description, l.excerpt, l.vertical,
        Array.isArray(l.tags) ? l.tags.join(' ') : '',
      ].filter(Boolean).join(' ').toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [listings, searchInput]);

  return (
    <div className="osv3 osv3-articles-container">
      {!supabase && (
        <div style={{
          padding: '24px 20px',
          border: '1px solid rgba(206, 68, 33, 0.32)',
          background: 'rgba(206, 68, 33, 0.10)',
          borderRadius: 8,
          color: 'var(--v3-accent)',
          fontFamily: 'monospace',
          fontSize: 13,
          textAlign: 'center',
          marginBottom: 24,
        }}>
          Supabase not configured — copy your env keys to .env.local
        </div>
      )}

      <div className="osv3-articles-header">
        <div className="osv3-articles-header-content">
          <h2>Articles</h2>
          <p>Editorial from across the space industry.</p>
        </div>
        <div className="osv3-articles-header-action">
          <Link to="/articles/post" className="osv3-articles-cta">
            + Post an Article
          </Link>
        </div>
      </div>

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

      {loading && supabase && (
        <div className="osv3-articles-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="osv3-articles-loading-skeleton" />
          ))}
        </div>
      )}

      {!loading && filteredListings.length > 0 && (
        <div className="osv3-articles-list">
          {filteredListings.map((listing) => {
            const posted = formatDate(listing.created_at);
            const metaParts = [
              listing.author_name && `By ${listing.author_name}`,
              posted,
              listing.read_time_min && `${listing.read_time_min} min read`,
            ].filter(Boolean);

            return (
              <div
                key={listing.id}
                className={`osv3-article-card ${listing.cover_image_url ? 'has-cover' : 'no-cover'}`}
              >
                {listing.cover_image_url && (
                  <img
                    src={listing.cover_image_url}
                    alt=""
                    className="osv3-article-card-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <div className="osv3-article-card-content">
                  <h3 className="osv3-article-card-title">{listing.title || 'Untitled article'}</h3>
                  {metaParts.length > 0 && (
                    <div className="osv3-article-card-meta">
                      {metaParts.join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filteredListings.length === 0 && supabase && (
        <div className="osv3-articles-empty">
          <div className="osv3-articles-empty-icon">📝</div>
          <div className="osv3-articles-empty-text">
            {searchInput ? `No articles match "${searchInput}"` : 'No articles posted yet.'}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SourcingArticlesV2() {
  return <SourcingArticlesV2Inner />;
}
