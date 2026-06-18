// SourcingArticlesV2.jsx
// nat-geo-uplift — Articles page in V2 list-pattern.
// Mirrors the JobsV2/EventsV2 shell. Data: directory_listings where category='article'.

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import useSRWTitle from './srw/useSRWTitle.js';
import { V2ChipNav } from './V2ChipNav.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';
const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SourcingArticlesV2Inner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  useSRWTitle('Space Industry Articles | Space OS');

  const [tenant, setTenant] = useState(null);
  const [listings, setListings] = useState([]);
  const [companies, setCompanies] = useState({});
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

        if (data && data.length > 0) {
          const companyIds = [...new Set(data.map((l) => l.company_id).filter(Boolean))];
          if (companyIds.length > 0) {
            const { data: compData } = await supabase
              .from('directory_companies')
              .select('*')
              .in('id', companyIds);
            const map = {};
            (compData || []).forEach((c) => { map[c.id] = c; });
            if (!cancelled) setCompanies(map);
          }
        } else {
          if (!cancelled) setCompanies({});
        }
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
      const company = companies[l.company_id];
      const haystack = [
        l.title, l.description, l.excerpt, l.vertical,
        Array.isArray(l.tags) ? l.tags.join(' ') : '',
        company?.name,
      ].filter(Boolean).join(' ').toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [listings, companies, searchInput]);

  return (
    <div
      data-tenant={TENANT_SLUG_V2}
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--tx)',
        position: 'relative',
        fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
        '--bg': 'transparent', '--tx': '#E8E4DA',
        '--tx2': 'rgba(232,228,218,0.60)', '--tx3': 'rgba(232,228,218,0.25)',
        '--s1': 'rgba(11,11,13,0.72)', '--s2': 'rgba(11,11,13,0.82)', '--s3': 'rgba(11,11,13,0.92)',
        '--bd': 'rgba(232,228,218,0.10)', '--bd2': 'rgba(232,228,218,0.16)',
        '--cyan': '#E8A23A', '--cyan-dim': 'rgba(232,162,58,0.10)', '--cyan-brd': 'rgba(232,162,58,0.32)',
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>

      <div className="browse-hero" style={{ '--page-hero-bg': "url('/v2-assets/earth.png')" }}>
        <div className="browse-hero-bg" />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <div className="browse-hero-toprow">
            <Link to="/spaceos" className="browse-back" style={{ textDecoration: 'none' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
              Back
            </Link>
            <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
          </div>
          <div className="browse-title">Articles.</div>
          <div className="browse-sub">
            Editorial from across the space industry.
          </div>
        </div>
      </div>

      <div className="browse-search">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search articles, topics, companies..."
          aria-label="Search articles"
          autoComplete="off"
          spellCheck="false"
        />
        {loading && <div className="spinner" />}
      </div>

      <V2ChipNav active="articles" />

      <div className="sec-hdr">
        <div className="sec-title">
          {loading ? 'Loading...' : `${filteredListings.length} Article${filteredListings.length === 1 ? '' : 's'}.`}
        </div>
        <div className="sec-count">
          <Link
            to="/spaceos/articles/post"
            style={{ textDecoration: 'none', color: 'var(--cyan)', fontSize: 12, fontWeight: 600 }}
          >
            + Post an Article
          </Link>
        </div>
      </div>

      <div className="co-list">
        {!supabase && (
          <div style={{
            padding: '24px 20px',
            border: '1px solid rgba(232,162,58,0.32)',
            background: 'rgba(232,162,58,0.10)',
            borderRadius: 10, color: '#E8A23A',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 13, textAlign: 'center',
          }}>
            Supabase not configured — copy your env keys to .env.local
          </div>
        )}

        {loading && supabase && (
          <>{[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ height: 84, borderRadius: 10, background: 'rgba(18,20,28,0.40)', border: '1px solid rgba(232,228,218,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}</>
        )}

        {!loading && filteredListings.map((listing) => {
          const company = companies[listing.company_id];
          const tags = Array.isArray(listing.tags) ? listing.tags : [];
          const posted = formatDate(listing.created_at);
          return (
            <div
              key={listing.id}
              className="co-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="co-body">
                {listing.cover_image_url ? (
                  <img
                    src={listing.cover_image_url}
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: 60, height: 60, borderRadius: 6, objectFit: 'cover',
                      marginBottom: 8, border: '1px solid rgba(232,228,218,0.10)',
                    }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : null}
                <div className="co-name">{listing.title || 'Untitled article'}</div>
                <div className="co-loc">
                  {[company?.name, posted, listing.read_time_min && `${listing.read_time_min} min read`].filter(Boolean).join(' · ')}
                </div>
                {tags.length > 0 && (
                  <div className="co-badges">
                    {tags.slice(0, 4).map((t) => (
                      <span key={t} className="co-badge cert">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="co-arrow">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
              </div>
            </div>
          );
        })}

        {!loading && supabase && filteredListings.length === 0 && (
          <div style={{
            padding: '48px 24px', textAlign: 'center',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            color: 'rgba(232,228,218,0.55)',
            fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {searchInput ? `No articles match "${searchInput}"` : 'No articles posted yet.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SourcingArticlesV2() {
  return (
    <SourcingThemeProvider>
      <SourcingArticlesV2Inner />
    </SourcingThemeProvider>
  );
}
