// SourcingJobsV2.jsx
// nat-geo-uplift R5a — Jobs page in the locked V2 list-pattern.
// Mirrors /spaceos directory: same hero + chip row + live fuzzy
// search + list-of-rows + sec-hdr CTA. The data is jobs, the shell is
// the directory's. Proving the list pattern adapts cleanly.

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import useSRWTitle from './srw/useSRWTitle.js';
import { V2ChipNav } from './V2ChipNav.jsx';
// Loads the V2 theme + R5a hero-archetype rules. Required for /spaceos/*
// routes to pick up the locked palette, type, and card grid.
import '../space-rising-theme-v2.css';

// V2 route is static (no :tenantSlug); we hardcode so data-tenant matches the
// V2 theme CSS selectors and we filter against the space-rising tenant row.
const TENANT_SLUG_V2 = 'space-rising-v2';
const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function formatSalary(min, max, jobType) {
  if (!min && !max) return null;
  const unit = jobType === 'contract' ? '/hr' : '/yr';
  const fmt = (n) =>
    jobType === 'contract' ? `$${n}` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)}–${fmt(max)}${unit}`;
  if (min) return `${fmt(min)}+${unit}`;
  return `Up to ${fmt(max)}${unit}`;
}

function postedAgo(created_at) {
  if (!created_at) return '';
  const days = Math.floor((Date.now() - new Date(created_at)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d';
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

function SourcingJobsV2Inner() {
  useSRWTitle('Space Jobs | Space OS');
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);

  const [tenant, setTenant] = useState(null);
  const [listings, setListings] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  // Load SR tenant row once (for tenant_id filter and hero subtitle)
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

  // Load active jobs, scoped to the SR tenant when it's loaded
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
          .eq('category', 'job')
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
            (compData || []).forEach((c) => {
              map[c.id] = c;
            });
            if (!cancelled) setCompanies(map);
          }
        } else {
          if (!cancelled) setCompanies({});
        }
      } catch (err) {
        console.error('JobsV2 fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  // R4l-style live fuzzy filter — instant as you type, AND-semantics on words
  const filteredListings = useMemo(() => {
    if (!searchInput.trim()) return listings;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return listings.filter((l) => {
      const company = companies[l.company_id];
      const haystack = [
        l.title,
        l.description,
        l.location,
        l.vertical,
        l.job_type,
        company?.name,
        company?.city,
        company?.state,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [listings, companies, searchInput]);

  const isSpaceRising = true; // V2 route is always space-rising

  return (
    <div
      data-tenant={TENANT_SLUG_V2}
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--tx)',
        position: 'relative',
        fontFamily:
          '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
        ...(isSpaceRising && {
          '--bg': 'transparent',
          '--tx': '#E8E4DA',
          '--tx2': 'rgba(232,228,218,0.60)',
          '--tx3': 'rgba(232,228,218,0.25)',
          '--s1': 'rgba(11,11,13,0.72)',
          '--s2': 'rgba(11,11,13,0.82)',
          '--s3': 'rgba(11,11,13,0.92)',
          '--bd': 'rgba(232,228,218,0.10)',
          '--bd2': 'rgba(232,228,218,0.16)',
          '--cyan': '#E8A23A',
          '--cyan-dim': 'rgba(232,162,58,0.10)',
          '--cyan-brd': 'rgba(232,162,58,0.32)',
        }),
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
      `}</style>

      {/* R5a hero archetype — same shell as /spaceos directory; only
          the heading + --page-hero-bg change per page. */}
      <div
        className="browse-hero"
        style={{ '--page-hero-bg': "url('/v2-assets/rocket-ascent.png')" }}
      >
        <div className="browse-hero-bg" />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <div className="browse-hero-toprow">
            <Link to="/spaceos" className="browse-back" style={{ textDecoration: 'none' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
            <img
              src="/images/space-rising/logo-white.png"
              alt="Space Rising"
              className="tenant-hero-logo"
            />
          </div>
          <div className="browse-title">Open Roles.</div>
          <div className="browse-sub">
            Hiring across Arizona&rsquo;s space industry. Launch suppliers, defense contractors,
            and R&amp;D firms.
          </div>
        </div>
      </div>

      {/* Live fuzzy search */}
      <div className="browse-search">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search roles, companies, locations..."
          aria-label="Search jobs"
          autoComplete="off"
          spellCheck="false"
        />
        {loading && <div className="spinner" />}
      </div>

      <V2ChipNav active="jobs" />

      {/* Section header — count + Post CTA */}
      <div className="sec-hdr">
        <div className="sec-title">
          {loading ? 'Loading...' : `${filteredListings.length} Open Role${filteredListings.length === 1 ? '' : 's'}.`}
        </div>
        <div className="sec-count">
          <Link
            to="/spaceos/jobs/post"
            style={{
              textDecoration: 'none',
              color: 'var(--cyan)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            + Post a Role
          </Link>
        </div>
      </div>

      {/* List */}
      <div className="co-list">
        {!supabase && (
          <div
            style={{
              padding: '24px 20px',
              border: '1px solid rgba(232,162,58,0.32)',
              background: 'rgba(232,162,58,0.10)',
              borderRadius: 10,
              color: '#E8A23A',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            Supabase not configured — copy your env keys to .env.local
          </div>
        )}

        {loading && supabase && (
          <>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  height: 84,
                  borderRadius: 10,
                  background: 'rgba(18,20,28,0.40)',
                  border: '1px solid rgba(232,228,218,0.05)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </>
        )}

        {!loading &&
          filteredListings.map((listing) => {
            const company = companies[listing.company_id];
            const salary = formatSalary(listing.salary_min, listing.salary_max, listing.job_type);
            const ago = postedAgo(listing.created_at);
            const loc = listing.remote
              ? 'Remote'
              : listing.location || [company?.city, company?.state].filter(Boolean).join(', ');
            return (
              <Link
                key={listing.id}
                to={`/spaceos/jobs/${listing.id}`}
                className="co-card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="co-body">
                  {company?.slug ? (
                    <img
                      className="co-mono-logo"
                      src={`/v2-assets/logos/${company.slug}-white.png`}
                      alt=""
                      aria-hidden="true"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className="co-name">{listing.title || 'Untitled role'}</div>
                  <div className="co-loc">
                    {[company?.name, loc, ago].filter(Boolean).join(' · ')}
                  </div>
                  <div className="co-badges">
                    {listing.job_type && (
                      <span className="co-badge cert">{listing.job_type.replace('-', ' ')}</span>
                    )}
                    {listing.remote && <span className="co-badge cert">Remote</span>}
                    {salary && <span className="co-badge feat">{salary}</span>}
                  </div>
                </div>
                <div className="co-arrow">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </Link>
            );
          })}

        {!loading && supabase && filteredListings.length === 0 && (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              color: 'rgba(232,228,218,0.55)',
              fontSize: 13,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {searchInput ? `No roles match "${searchInput}"` : 'No roles posted yet.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SourcingJobsV2() {
  return (
    <SourcingThemeProvider>
      <SourcingJobsV2Inner />
    </SourcingThemeProvider>
  );
}
