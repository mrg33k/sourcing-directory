// SourcingGrantsV2.jsx
// Space OS v3 — Grants page (magazine pattern with feature hero + editorial grid)

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import './osv3-grants.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

// Asset rotation array (deterministic per grant ID)
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getImageForGrant(grant, index) {
  // Deterministic + diverse: hash the full id string (+ index)
  const s = (grant.id ? String(grant.id) : '') + ':' + index;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `/v2-assets/${ASSET_POOL[h % ASSET_POOL.length]}`;
}

export default function SourcingGrantsV2() {
  useSRWTitle('Space Grants | Space OS');

  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('directory_listings')
          .select('*')
          .eq('category', 'grant')
          .eq('status', 'active')
          .order('deadline', { ascending: true, nullsFirst: false })
          .limit(100);
        if (error) throw error;
        if (!cancelled) setGrants(data || []);
      } catch (err) {
        console.error('GrantsV2 fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!searchInput.trim()) return grants;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return grants.filter((g) => {
      const haystack = [g.title, g.description, g.grant_type, g.grant_agency]
        .filter(Boolean).join(' ').toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [grants, searchInput]);

  // Split grants: feature (deadline-soon or first) + grid (rest)
  const featureGrant = filtered.length > 0 ? filtered[0] : null;
  const gridGrants = filtered.length > 1 ? filtered.slice(1) : [];

  return (
    <div className="osv3-grants-page">
      {/* Page Header: "Grants" + Subtitle */}
      <div className="osv3-grants-header">
        <div>
          <h1 className="osv3-grants-page-title">Grants</h1>
          <p className="osv3-grants-page-subtitle">Funding opportunities for the space economy.</p>
        </div>
      </div>

      {/* No Supabase Error */}
      {!supabase && (
        <div className="osv3-grants-error">
          Supabase not configured
        </div>
      )}

      {/* Loading State */}
      {loading && supabase && (
        <>
          {/* Feature Hero Skeleton */}
          <div className="osv3-magazine-feature-skeleton" />
          {/* Grid Skeletons */}
          <div className="osv3-grants-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="osv3-grant-card osv3-grant-card-skeleton">
                <div className="osv3-grant-card-image-skeleton" />
                <div className="osv3-grant-card-content">
                  <div className="osv3-grant-card-skeleton-line" />
                  <div className="osv3-grant-card-skeleton-line-short" />
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
          {featureGrant && (
            <a
              href={featureGrant.url || '#'}
              target={featureGrant.url ? '_blank' : undefined}
              rel={featureGrant.url ? 'noopener noreferrer' : undefined}
              className="osv3-magazine-feature-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <img
                src={getImageForGrant(featureGrant, 0)}
                alt={featureGrant.title}
                className="osv3-magazine-feature-image"
                loading="eager"
              />
              <div className="osv3-magazine-feature-overlay" />
              <div className="osv3-magazine-feature-content">
                <div className="osv3-magazine-feature-kicker">{featureGrant.grant_type || 'Grant'}</div>
                <h2 className="osv3-magazine-feature-headline">{featureGrant.title}</h2>
                <p className="osv3-magazine-feature-deck">{featureGrant.grant_agency || ''}</p>
                <button
                  className="osv3-magazine-feature-button"
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                >
                  View Grant →
                </button>
              </div>
            </a>
          )}

          {/* EDITORIAL GRID (Tier 2) */}
          {gridGrants.length > 0 && (
            <>
              <div className="osv3-magazine-section-header">
                <div className="osv3-magazine-section-eyebrow">Available Grants</div>
              </div>
              <div className="osv3-grants-grid">
                {gridGrants.map((grant, idx) => {
                  const deadline = formatDeadline(grant.deadline);
                  const amount = formatAmount(grant.grant_amount_min, grant.grant_amount_max);
                  const daysLeft = grant.deadline
                    ? Math.ceil((new Date(grant.deadline) - new Date()) / (1000 * 60 * 60 * 24))
                    : null;
                  const isDeadlineSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

                  return (
                    <a
                      key={grant.id}
                      href={grant.url || '#'}
                      target={grant.url ? '_blank' : undefined}
                      rel={grant.url ? 'noopener noreferrer' : undefined}
                      className="osv3-grant-card"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      {/* Card Image (3:2) */}
                      <div className="osv3-grant-card-image-wrapper">
                        <img
                          src={getImageForGrant(grant, idx + 1)}
                          alt={grant.title}
                          className="osv3-grant-card-image"
                          loading="lazy"
                        />
                        {isDeadlineSoon && (
                          <div className="osv3-grant-card-badge">Deadline Soon</div>
                        )}
                      </div>

                      {/* Card Content */}
                      <div className="osv3-grant-card-content">
                        <div className="osv3-grant-card-kicker">{grant.grant_type || 'Grant'}</div>
                        <h3 className="osv3-grant-card-headline">{grant.title}</h3>
                        <p className="osv3-grant-card-deck">{grant.grant_agency || ''}</p>
                        <div className="osv3-grant-card-meta">
                          {[deadline, amount].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty State */}
          {filtered.length === 0 && (
            <div className="osv3-grants-empty">
              {searchInput ? `No grants match "${searchInput}"` : 'No grants available.'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
