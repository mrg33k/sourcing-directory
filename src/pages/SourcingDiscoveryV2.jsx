// SourcingDiscoveryV2.jsx
// Discovery — community whitepaper library for Space OS.
// Modeled on SourcingArticlesV2.jsx (same list shell as Jobs/Events/Articles).
// Data: directory_listings where category='whitepaper'.
//
// Field mapping onto the shared polymorphic directory_listings table
// (no schema change — same field-reuse pattern Articles already uses):
//   title           -> whitepaper title
//   excerpt / description -> abstract
//   organizer       -> author / publishing org (e.g. "NASA", "ESA")
//   apply_url       -> direct link to the PDF / source document
//   cover_image_url -> optional thumbnail
//   tags            -> topics
//   created_at      -> publication date (byline year)

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
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

function SourcingDiscoveryV2Inner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);

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
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        [data-tenant="space-rising-v2"] .wp-list { display: flex; flex-direction: column; gap: 12px; width: 100%; grid-column: 1 / -1; }
        [data-tenant="space-rising-v2"] .wp-card {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
          padding: 20px 22px; border: 1px solid rgba(232,228,218,0.10); border-radius: 12px;
          background: rgba(18,20,28,0.40); text-decoration: none; color: inherit;
          transition: border-color 0.16s ease, background 0.16s ease, transform 0.16s ease;
        }
        [data-tenant="space-rising-v2"] .wp-card:hover {
          border-color: rgba(232,162,58,0.45); background: rgba(232,162,58,0.06); transform: translateY(-1px);
        }
        [data-tenant="space-rising-v2"] .wp-card:hover .wp-arrow { color: #E8A23A; transform: translateX(2px); }
        [data-tenant="space-rising-v2"] .wp-title { font-size: 16px; font-weight: 700; color: #F1ECE0; line-height: 1.3; }
        [data-tenant="space-rising-v2"] .wp-meta { font-size: 12px; color: rgba(232,228,218,0.55); margin-top: 5px; letter-spacing: 0.01em; }
        [data-tenant="space-rising-v2"] .wp-abstract {
          font-size: 13px; color: rgba(232,228,218,0.66); margin-top: 9px; line-height: 1.55;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        [data-tenant="space-rising-v2"] .wp-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-top: 12px; }
        [data-tenant="space-rising-v2"] .wp-badge {
          font-size: 11px; font-weight: 600; letter-spacing: 0.02em; padding: 3px 9px; border-radius: 100px;
          border: 1px solid rgba(232,228,218,0.16); color: rgba(232,228,218,0.70); white-space: nowrap;
        }
        [data-tenant="space-rising-v2"] .wp-badge.pdf {
          color: #E8A23A; border-color: rgba(232,162,58,0.40); background: rgba(232,162,58,0.10);
          display: inline-flex; align-items: center; gap: 4px;
        }
        [data-tenant="space-rising-v2"] .wp-arrow { color: rgba(232,228,218,0.35); flex-shrink: 0; margin-top: 2px; transition: color 0.16s ease, transform 0.16s ease; }
      `}</style>

      <div className="browse-hero" style={{ '--page-hero-bg': "url('/v2-assets/earth.png')" }}>
        <div className="browse-hero-bg" />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <div className="browse-hero-toprow">
            <Link to="/space-rising-v2" className="browse-back" style={{ textDecoration: 'none' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
              Back
            </Link>
            <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
          </div>
          <div className="browse-title">Discovery.</div>
          <div className="browse-sub">
            Whitepapers, research, and industry reports from across space.
          </div>
        </div>
      </div>

      <div className="browse-search">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search whitepapers, topics, authors..."
          aria-label="Search whitepapers"
          autoComplete="off"
          spellCheck="false"
        />
        {loading && <div className="spinner" />}
      </div>

      <V2ChipNav active="discovery" />

      <div className="sec-hdr">
        <div className="sec-title">
          {loading ? 'Loading...' : `${filteredListings.length} Whitepaper${filteredListings.length === 1 ? '' : 's'}.`}
        </div>
        <div className="sec-count">
          <Link
            to="/space-rising-v2/discovery/post"
            style={{ textDecoration: 'none', color: 'var(--cyan)', fontSize: 12, fontWeight: 600 }}
          >
            + Submit a Whitepaper
          </Link>
        </div>
      </div>

      <div className="co-list">
        <div className="wp-list">
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
              <div key={i} style={{ height: 96, borderRadius: 12, background: 'rgba(18,20,28,0.40)', border: '1px solid rgba(232,228,218,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}</>
          )}

          {!loading && filteredListings.map((listing) => {
            const tags = Array.isArray(listing.tags) ? listing.tags : [];
            const year = listing.created_at ? new Date(listing.created_at).getFullYear() : null;
            const meta = [listing.organizer, Number.isFinite(year) ? year : null].filter(Boolean).join(' · ');
            const href = listing.apply_url || null;
            const abstract = listing.excerpt || listing.description || '';
            const CardTag = href ? 'a' : 'div';
            const cardProps = href ? { href, target: '_blank', rel: 'noreferrer noopener' } : {};
            return (
              <CardTag key={listing.id} className="wp-card" {...cardProps}>
                <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {listing.cover_image_url ? (
                    <img
                      src={listing.cover_image_url}
                      alt=""
                      aria-hidden="true"
                      style={{ width: 56, height: 72, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(232,228,218,0.10)' }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : null}
                  <div style={{ minWidth: 0 }}>
                    <div className="wp-title">{listing.title || 'Untitled whitepaper'}</div>
                    {meta && <div className="wp-meta">{meta}</div>}
                    {abstract && <div className="wp-abstract">{abstract}</div>}
                    <div className="wp-badges">
                      {href && (
                        <span className="wp-badge pdf">
                          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                          PDF
                        </span>
                      )}
                      {tags.slice(0, 4).map((t) => (
                        <span key={t} className="wp-badge">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="wp-arrow">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 17L17 7M17 7H8M17 7v9" /></svg>
                </div>
              </CardTag>
            );
          })}

          {!loading && supabase && filteredListings.length === 0 && (
            <div style={{
              padding: '48px 24px', textAlign: 'center',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              color: 'rgba(232,228,218,0.55)',
              fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {searchInput ? `No whitepapers match "${searchInput}"` : 'No whitepapers posted yet.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SourcingDiscoveryV2() {
  return (
    <SourcingThemeProvider>
      <SourcingDiscoveryV2Inner />
    </SourcingThemeProvider>
  );
}
