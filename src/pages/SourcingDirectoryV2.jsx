// SourcingDirectoryV2.jsx
// Space OS v3 — Directory page (magazine pattern with feature hero + editorial grid)

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import './osv3-directory.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

// Asset rotation array (deterministic per company ID)
const ASSET_POOL = [
  'earth.png',
  'rocket-orbital.png',
  'bg-opp-orbital-construction.png',
  'bg-opp-lunar.png',
  'bg-opp-energy.png',
  'asteroid-close.png',
  'bg-opp-stations.png',
  'planet-red.png',
  'rocket-ascent.png',
  'blueprint-hero.png',
];

// Vertical config (same as Reports)
const VERTICALS = [
  { key: 'all', label: 'All Industries', value: null },
  { key: 'space', label: 'Space & Aerospace', value: 'space' },
  { key: 'semiconductor', label: 'Semiconductor', value: 'semiconductor' },
];

function getImageForCompany(company, index) {
  // Deterministic + diverse: hash the full id string (+ index) so cards don't
  // repeat the same photo. charCodeAt(0) alone collided across most companies.
  const s = (company.id ? String(company.id) : '') + ':' + index;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `/v2-assets/${ASSET_POOL[h % ASSET_POOL.length]}`;
}

function getCompanyLocation(company) {
  const parts = [company.city, company.state].filter(Boolean);
  return parts.join(', ');
}

function getCertificationCount(company) {
  if (!company.certifications) return 0;
  if (Array.isArray(company.certifications)) return company.certifications.length;
  if (typeof company.certifications === 'string') {
    return company.certifications.split(',').filter(c => c.trim()).length;
  }
  return 0;
}

function MembershipModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 300,
          animation: 'fadeIn 200ms ease-out',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          width: '100%',
          maxWidth: 420,
          zIndex: 301,
          background: 'white',
          border: '1px solid #D7DEE2',
          borderRadius: 12,
          overflow: 'hidden',
          transform: 'translate(-50%, -50%)',
          animation: 'fadeIn 200ms ease-out',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        }}
      >
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
        <div style={{ padding: 32 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--v3-font-family-base)',
              letterSpacing: '0.08em',
              color: '#6B7280',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            Membership
          </div>
          <h3
            style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: 'var(--v3-font-family-base)',
              color: '#010B13',
              lineHeight: 1.2,
              marginBottom: 12,
            }}
          >
            Claim your company
          </h3>
          <p
            style={{
              fontSize: 15,
              fontFamily: 'var(--v3-font-family-base)',
              color: '#6B7280',
              lineHeight: 1.6,
              marginBottom: 28,
            }}
          >
            Add your company to the directory and get found by procurement teams and contractors.
          </p>
          <Link
            to="/membership"
            onClick={onClose}
            style={{
              display: 'block',
              textDecoration: 'none',
              textAlign: 'center',
              padding: '12px 20px',
              marginBottom: 12,
              background: '#CE4421',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontFamily: 'var(--v3-font-family-base)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#b83916';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#CE4421';
            }}
          >
            Join Now
          </Link>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: '#6B7280',
              fontFamily: 'var(--v3-font-family-base)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              padding: '12px 0',
              transition: 'color 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#010B13';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#6B7280';
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </>
  );
}

export default function SourcingDirectoryV2() {
  useSRWTitle('Company Directory | Space OS');

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [selectedVertical, setSelectedVertical] = useState('all');
  const [showMembership, setShowMembership] = useState(false);

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
          .from('directory_companies')
          .select('*')
          .eq('status', 'active')
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        if (!cancelled) setCompanies(data || []);
      } catch (err) {
        console.error('DirectoryV2 fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Filter by search + vertical
  const filtered = useMemo(() => {
    let result = companies;

    // Filter by vertical
    if (selectedVertical !== 'all') {
      result = result.filter(c => c.vertical === selectedVertical);
    }

    // Filter by search
    if (searchInput.trim()) {
      const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter(c => {
        const haystack = [c.name, c.description, c.vertical, c.city, c.state]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return terms.every(t => haystack.includes(t));
      });
    }

    return result;
  }, [companies, searchInput, selectedVertical]);

  // Split companies: feature (featured or first) + grid (rest)
  const featuredCompany = filtered.find(c => c.featured) || (filtered.length > 0 ? filtered[0] : null);
  const gridCompanies = featuredCompany
    ? filtered.filter(c => c.id !== featuredCompany.id)
    : filtered.length > 1
    ? filtered.slice(1)
    : [];

  return (
    <div className="osv3-directory-page">
      {/* Page Header: "Ecosystem" + Subtitle */}
      <div className="osv3-directory-header">
        <div>
          <h1 className="osv3-directory-page-title">Ecosystem</h1>
          <p className="osv3-directory-page-subtitle">
            Discover companies, organizations, and resources building the space industry.
          </p>
        </div>
      </div>

      {/* No Supabase Error */}
      {!supabase && <div className="osv3-directory-error">Supabase not configured</div>}

      {/* Loading State */}
      {loading && supabase && (
        <>
          {/* Feature Hero Skeleton */}
          <div className="osv3-directory-feature-skeleton" />
          {/* Grid Skeletons */}
          <div className="osv3-directory-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="osv3-company-card osv3-company-card-skeleton">
                <div className="osv3-company-card-image-skeleton" />
                <div className="osv3-company-card-content">
                  <div className="osv3-company-card-skeleton-line" />
                  <div className="osv3-company-card-skeleton-line-short" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Content */}
      {!loading && supabase && (
        <>
          {/* Search & Filter Row */}
          <div className="osv3-directory-search-row">
            <input
              type="text"
              className="osv3-directory-search-input"
              placeholder="Search by company name, location..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
            <div className="osv3-directory-filter-chips">
              {VERTICALS.map(v => (
                <button
                  key={v.key}
                  className={`osv3-directory-chip ${selectedVertical === v.key ? 'active' : ''}`}
                  onClick={() => setSelectedVertical(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* FEATURE HERO (Tier 1) */}
          {featuredCompany && (
            <Link
              to={`/${featuredCompany.slug}`}
              className="osv3-directory-feature-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <img
                src={getImageForCompany(featuredCompany, 0)}
                alt={featuredCompany.name}
                className="osv3-directory-feature-image"
                loading="eager"
              />
              <div className="osv3-directory-feature-overlay" />
              <div className="osv3-directory-feature-content">
                <div className="osv3-directory-feature-kicker">
                  {featuredCompany.vertical || 'Featured'}
                </div>
                <h2 className="osv3-directory-feature-headline">{featuredCompany.name}</h2>
                <p className="osv3-directory-feature-deck">
                  {getCompanyLocation(featuredCompany)}
                  {getCertificationCount(featuredCompany) > 0 &&
                    ` • ${getCertificationCount(featuredCompany)} cert${getCertificationCount(featuredCompany) > 1 ? 's' : ''}`}
                </p>
                <button
                  className="osv3-directory-feature-button"
                  onClick={e => {
                    e.preventDefault();
                  }}
                >
                  View Company →
                </button>
              </div>
            </Link>
          )}

          {/* EDITORIAL GRID (Tier 2) */}
          {gridCompanies.length > 0 && (
            <>
              <div className="osv3-directory-section-header">
                <div className="osv3-directory-section-eyebrow">Companies</div>
              </div>
              <div className="osv3-directory-grid">
                {gridCompanies.map((company, idx) => (
                  <Link
                    key={company.id}
                    to={`/${company.slug}`}
                    className="osv3-company-card"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {/* Card Image (3:2) with Logo Overlay */}
                    <div className="osv3-company-card-image-wrapper">
                      <img
                        src={getImageForCompany(company, idx + 1)}
                        alt={company.name}
                        className="osv3-company-card-image"
                        loading="lazy"
                      />

                      {/* Logo Overlay */}
                      {company.logo_url && (
                        <div className="osv3-company-card-logo">
                          <img
                            src={company.logo_url}
                            alt={`${company.name} logo`}
                            style={{ maxWidth: '100%', maxHeight: '100%' }}
                          />
                        </div>
                      )}

                      {company.featured && (
                        <div className="osv3-company-card-featured-badge">Featured</div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="osv3-company-card-content">
                      <div className="osv3-company-card-kicker">
                        {company.vertical || 'Company'}
                      </div>
                      <h3 className="osv3-company-card-headline">{company.name}</h3>
                      <p className="osv3-company-card-deck">{getCompanyLocation(company)}</p>
                      <div className="osv3-company-card-meta">
                        {getCertificationCount(company) > 0 && `${getCertificationCount(company)} cert${getCertificationCount(company) > 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Empty State */}
          {filtered.length === 0 && (
            <div className="osv3-directory-empty">
              {searchInput || selectedVertical !== 'all'
                ? `No companies match your search`
                : 'No companies in the directory yet.'}
            </div>
          )}
        </>
      )}

      {/* Membership join modal */}
      <MembershipModal isOpen={showMembership} onClose={() => setShowMembership(false)} />
    </div>
  );
}
