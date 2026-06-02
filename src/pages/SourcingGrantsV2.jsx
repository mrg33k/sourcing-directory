// SourcingGrantsV2.jsx
// nat-geo-uplift — Grants page in V2 list-pattern.
// Mirrors JobsV2/EventsV2 shell. Data: directory_listings where category='grant'.

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import { V2ChipNav } from './V2ChipNav.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';
const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function formatAmount(min, max) {
  const fmt = (n) => {
    if (!n && n !== 0) return null;
    if (n >= 1000000) return `$${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return `$${n.toLocaleString()}`;
  };
  const lo = fmt(min);
  const hi = fmt(max);
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return `${lo}+`;
  if (hi) return `Up to ${hi}`;
  return null;
}

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const daysLeft = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (daysLeft < 0) return `Closed ${label}`;
  if (daysLeft <= 30) return `Due ${label} (${daysLeft}d)`;
  return `Due ${label}`;
}

function SourcingGrantsV2Inner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);

  const [tenant, setTenant] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

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
          .eq('category', 'grant')
          .eq('status', 'active')
          .order('deadline', { ascending: true, nullsFirst: false });
        if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
        const { data, error } = await qb.limit(100);
        if (error) throw error;
        if (!cancelled) setListings(data || []);
      } catch (err) {
        console.error('GrantsV2 fetch error:', err);
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
        l.title, l.description, l.grant_type,
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>

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
          <div className="browse-title">Grants.</div>
          <div className="browse-sub">
            Federal, state, and private funding for the space ecosystem.
          </div>
        </div>
      </div>

      <div className="browse-search">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search grants, agencies, types..."
          aria-label="Search grants"
          autoComplete="off"
          spellCheck="false"
        />
        {loading && <div className="spinner" />}
      </div>

      <V2ChipNav active="grants" />

      <div className="sec-hdr">
        <div className="sec-title">
          {loading ? 'Loading...' : `${filteredListings.length} Grant${filteredListings.length === 1 ? '' : 's'}.`}
        </div>
        <div className="sec-count">
          <span style={{ color: 'var(--tx3)', fontSize: 12, fontFamily: 'JetBrains Mono, ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Open opportunities
          </span>
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

        {!loading && filteredListings.map((grant) => {
          const amount = formatAmount(grant.grant_amount_min, grant.grant_amount_max);
          const deadline = formatDeadline(grant.deadline);
          const description = grant.description
            ? (grant.description.length > 140 ? grant.description.slice(0, 140) + '…' : grant.description)
            : '';
          return (
            <div
              key={grant.id}
              className="co-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="co-body">
                <div className="co-name">{grant.title || 'Untitled grant'}</div>
                <div className="co-loc">
                  {[grant.grant_type, deadline].filter(Boolean).join(' · ')}
                </div>
                {description && (
                  <div style={{
                    fontSize: 13,
                    color: 'rgba(232,228,218,0.55)',
                    marginTop: 6,
                    fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, sans-serif',
                    lineHeight: 1.5,
                  }}>
                    {description}
                  </div>
                )}
                <div className="co-badges">
                  {grant.grant_type && <span className="co-badge cert">{grant.grant_type}</span>}
                  {amount && <span className="co-badge feat">{amount}</span>}
                </div>
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
            {searchInput ? `No grants match "${searchInput}"` : 'No grants available.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SourcingGrantsV2() {
  return (
    <SourcingThemeProvider>
      <SourcingGrantsV2Inner />
    </SourcingThemeProvider>
  );
}
