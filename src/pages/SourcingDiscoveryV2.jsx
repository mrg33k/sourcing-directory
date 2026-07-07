// SourcingDiscoveryV2.jsx
// Space OS v3 — Discovery page (whitepapers & research)
// Data: directory_listings where category='whitepaper'

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import '../osv3-tokens.css';
import '../pages/OSLayoutV3.css';
import './osv3-discovery.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  return (
    <div className="osv3 osv3-discovery-container">
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

      <div className="osv3-discovery-header">
        <div className="osv3-discovery-header-content">
          <h2>Discovery</h2>
          <p>Research and white papers from across the space industry.</p>
        </div>
        <div className="osv3-discovery-header-action">
          <Link to="/discovery/post" className="osv3-discovery-cta">
            + Post a Whitepaper
          </Link>
        </div>
      </div>

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

      {loading && supabase && (
        <div className="osv3-discovery-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="osv3-discovery-loading-skeleton" />
          ))}
        </div>
      )}

      {!loading && filteredListings.length > 0 && (
        <div className="osv3-discovery-list">
          {filteredListings.map((listing) => {
            const tags = Array.isArray(listing.tags) ? listing.tags : [];
            const published = formatDate(listing.created_at);
            const metaParts = [
              listing.organizer,
              published,
            ].filter(Boolean);
            const href = listing.apply_url || null;
            const abstract = listing.excerpt || listing.description || '';
            const CardTag = href ? 'a' : 'div';
            const cardProps = href ? { href, target: '_blank', rel: 'noreferrer noopener' } : {};

            return (
              <CardTag
                key={listing.id}
                className="osv3-discovery-card"
                style={{ textDecoration: 'none', color: 'inherit' }}
                {...cardProps}
              >
                <div className="osv3-discovery-card-main">
                  {listing.cover_image_url && (
                    <img
                      src={listing.cover_image_url}
                      alt=""
                      aria-hidden="true"
                      className="osv3-discovery-card-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <div className="osv3-discovery-card-content">
                    <h3 className="osv3-discovery-card-title">
                      {listing.title || 'Untitled whitepaper'}
                    </h3>
                    {metaParts.length > 0 && (
                      <div className="osv3-discovery-card-meta">
                        {metaParts.join(' · ')}
                      </div>
                    )}
                    {abstract && (
                      <div className="osv3-discovery-card-abstract">
                        {abstract}
                      </div>
                    )}
                    <div className="osv3-discovery-card-pills">
                      {href && (
                        <span className="osv3-discovery-card-pill osv3-pill-pdf">
                          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                          </svg>
                          PDF
                        </span>
                      )}
                      {tags.slice(0, 3).map((t) => (
                        <span key={t} className="osv3-discovery-card-pill osv3-pill-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardTag>
            );
          })}
        </div>
      )}

      {!loading && supabase && filteredListings.length === 0 && (
        <div className="osv3-discovery-empty">
          {searchInput ? `No whitepapers match "${searchInput}"` : 'No whitepapers posted yet.'}
        </div>
      )}
    </div>
  );
}

export default function SourcingDiscoveryV2() {
  return <SourcingDiscoveryV2Inner />;
}
