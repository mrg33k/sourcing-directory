// SourcingDirectoryV2.jsx
// Space OS v3 — New Directory landing page (7 sections: hero, search, carousel, categories, regions, companies, newsletter)

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { getCategoryForCompany, CATEGORIES, getCategoryCount, getCompaniesByCategory } from '../lib/directoryCategories.js';
import useSRWTitle from './srw/useSRWTitle.js';
import '../styles/osv3-directory.css';

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

// Deterministic image selection per company
function getImageForCompany(company, index) {
  const s = (company.id ? String(company.id) : '') + ':' + index;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `/v2-assets/${ASSET_POOL[h % ASSET_POOL.length]}`;
}

// US Census regions with states
const US_REGIONS = {
  'West': { states: ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WA', 'WY'], color: '#CE4421' },
  'Midwest': { states: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'], color: '#10B981' },
  'South': { states: ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV'], color: '#FBBF24' },
  'Northeast': { states: ['CT', 'MA', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'], color: '#3B82F6' },
};

function getRegionForState(state) {
  for (const [region, data] of Object.entries(US_REGIONS)) {
    if (data.states.includes(state)) return region;
  }
  return null;
}

function computeRegionCounts(companies) {
  const counts = {};
  Object.keys(US_REGIONS).forEach(region => counts[region] = 0);
  companies.forEach(c => {
    const region = getRegionForState(c.state);
    if (region) counts[region]++;
  });
  return counts;
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
        <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        <div style={{ padding: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--v3-font-family-base)', letterSpacing: '0.08em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 16 }}>
            Membership
          </div>
          <h3 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--v3-font-family-base)', color: '#010B13', lineHeight: 1.2, marginBottom: 12 }}>
            Claim your company
          </h3>
          <p style={{ fontSize: 15, fontFamily: 'var(--v3-font-family-base)', color: '#6B7280', lineHeight: 1.6, marginBottom: 28 }}>
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
            onMouseEnter={(e) => { e.currentTarget.style.background = '#b83916'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#CE4421'; }}
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
            onMouseEnter={(e) => { e.currentTarget.style.color = '#010B13'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#6B7280'; }}
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
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [showMembership, setShowMembership] = useState(false);
  const [companiesPage, setCompaniesPage] = useState(1);
  const COMPANIES_PER_PAGE = 10;

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
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;
        if (!cancelled) setCompanies(data || []);
      } catch (err) {
        console.error('DirectoryV2 fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Recently added: newest 5 companies
  const recentlyAdded = useMemo(() => companies.slice(0, 5), [companies]);

  // Filter by search + category + region
  const filtered = useMemo(() => {
    let result = companies;

    if (selectedCategory) {
      result = result.filter(c => getCategoryForCompany(c.name) === selectedCategory);
    }

    if (selectedRegion) {
      result = result.filter(c => getRegionForState(c.state) === selectedRegion);
    }

    if (searchInput.trim()) {
      const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter(c => {
        const haystack = [c.name, c.description, c.city, c.state]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return terms.every(t => haystack.includes(t));
      });
    }

    return result;
  }, [companies, searchInput, selectedCategory, selectedRegion]);

  // Paginate companies
  const paginatedCompanies = useMemo(() => {
    const start = (companiesPage - 1) * COMPANIES_PER_PAGE;
    return filtered.slice(start, start + COMPANIES_PER_PAGE);
  }, [filtered, companiesPage]);

  const totalPages = Math.ceil(filtered.length / COMPANIES_PER_PAGE);

  // Compute region counts
  const regionCounts = useMemo(() => computeRegionCounts(companies), [companies]);

  return (
    <div className="osv3-directory-page-v3">
      {/* SECTION 1: HERO */}
      <section className="v3-hero-section">
        <div className="v3-hero-bg" />
        <div className="v3-hero-content">
          <div className="v3-hero-left">
            <div className="v3-hero-eyebrow">space_OS // Directory</div>
            <h1 className="v3-hero-title">Directory</h1>
            <p className="v3-hero-description">
              Discover companies, organizations, and resources building the space industry across infrastructure, mobility, intelligence, life sciences, industrial services, and defense.
            </p>
          </div>
          <div className="v3-hero-right">
            <div className="v3-hero-cta-block">
              <h3 className="v3-hero-cta-title">Add your company</h3>
              <p className="v3-hero-cta-subtitle">Let your organization get discovered by the Space OS ecosystem.</p>
              <button
                onClick={() => setShowMembership(true)}
                className="v3-hero-cta-button"
              >
                ADD YOUR COMPANY →
              </button>
            </div>
          </div>
        </div>
      </section>

      {!supabase && <div className="v3-error">Supabase not configured</div>}

      {loading && supabase && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9AA6B2' }}>
          Loading directory...
        </div>
      )}

      {!loading && supabase && (
        <>
          {/* SECTION 2: SEARCH BAR */}
          <section className="v3-search-section">
            <div className="v3-search-wrapper">
              <input
                type="text"
                className="v3-search-input"
                placeholder="Search the ecosystem, companies, people, reports…"
                value={searchInput}
                onChange={e => {
                  setSearchInput(e.target.value);
                  setCompaniesPage(1);
                }}
              />
              <button className="v3-search-button">SEARCH →</button>
            </div>
          </section>

          {/* SECTION 3: RECENTLY ADDED CAROUSEL */}
          {recentlyAdded.length > 0 && (
            <section className="v3-carousel-section">
              <div className="v3-carousel-header">
                <h2 className="v3-carousel-title">RECENTLY ADDED →</h2>
              </div>
              <div className="v3-carousel-scroll">
                {recentlyAdded.map((company, idx) => (
                  <Link
                    key={company.id}
                    to={`/${company.slug}`}
                    className="v3-carousel-card"
                  >
                    <img
                      src={getImageForCompany(company, idx)}
                      alt={company.name}
                      className="v3-carousel-card-image"
                    />
                    <div className="v3-carousel-card-content">
                      <div className="v3-carousel-card-category">
                        {getCategoryForCompany(company.name) || 'Featured'}
                      </div>
                      <h3 className="v3-carousel-card-name">{company.name}</h3>
                      <p className="v3-carousel-card-location">
                        {[company.city, company.state].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* SECTION 4: CATEGORIES */}
          <section className="v3-categories-section">
            <div className="v3-categories-header">
              <h2 className="v3-categories-title">CATEGORIES →</h2>
            </div>
            <div className="v3-categories-grid">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  className={`v3-category-tile ${selectedCategory === cat.key ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCategory(selectedCategory === cat.key ? null : cat.key);
                    setSelectedRegion(null);
                    setCompaniesPage(1);
                  }}
                  style={{
                    '--category-color': cat.color
                  }}
                >
                  <div className="v3-category-id">{cat.id}</div>
                  <div className="v3-category-label">{cat.label}</div>
                  <div className="v3-category-subtitle">{cat.subtitle}</div>
                  <div className="v3-category-count">{getCategoryCount(cat.key)} Companies</div>
                </button>
              ))}
            </div>
          </section>

          {/* SECTION 5: BY REGION */}
          <section className="v3-region-section">
            <div className="v3-region-header">
              <h2 className="v3-region-title">BY REGION →</h2>
            </div>
            <div className="v3-region-content">
              <div className="v3-region-map">
                {/* Simplified region visualization */}
                <svg className="v3-region-map-svg" viewBox="0 0 960 600" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="960" height="600" fill="#010B13" />
                  <text x="480" y="300" textAnchor="middle" fill="#6B7280" fontSize="16" fontFamily="Roboto" fontWeight="300">
                    US Region Map Coming Soon
                  </text>
                </svg>
              </div>
              <div className="v3-region-list">
                {Object.entries(US_REGIONS).map(([region, data]) => (
                  <button
                    key={region}
                    className={`v3-region-item ${selectedRegion === region ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedRegion(selectedRegion === region ? null : region);
                      setSelectedCategory(null);
                      setCompaniesPage(1);
                    }}
                    style={{ borderLeft: `4px solid ${data.color}` }}
                  >
                    <div className="v3-region-name">{region.toUpperCase()}</div>
                    <div className="v3-region-states">{data.states.join(', ')}</div>
                    <div className="v3-region-count" style={{ color: data.color }}>
                      {regionCounts[region]} Companies
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 6: COMPANIES DIRECTORY */}
          <section className="v3-companies-section">
            <div className="v3-companies-header">
              <h2 className="v3-companies-title">COMPANIES DIRECTORY →</h2>
            </div>
            {paginatedCompanies.length > 0 ? (
              <>
                <div className="v3-companies-list">
                  {paginatedCompanies.map((company, idx) => (
                    <div key={company.id} className="v3-company-row">
                      <div className="v3-company-row-logo">
                        {company.logo_url ? (
                          <img src={company.logo_url} alt={company.name} className="v3-company-row-logo-img" />
                        ) : (
                          <div className="v3-company-row-logo-fallback">
                            {company.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="v3-company-row-content">
                        <h3 className="v3-company-row-name">{company.name}</h3>
                        <p className="v3-company-row-description">{company.description || ''}</p>
                        <div className="v3-company-row-meta">
                          {[company.city, company.state].filter(Boolean).join(', ')}
                          {company.phone && ` • ${company.phone}`}
                        </div>
                      </div>
                      <div className="v3-company-row-action">
                        <Link to={`/${company.slug}`} className="v3-company-row-link">
                          VIEW PROFILE →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="v3-pagination">
                    {companiesPage > 1 && (
                      <button onClick={() => setCompaniesPage(companiesPage - 1)} className="v3-pagination-button">
                        ← Previous
                      </button>
                    )}
                    <span className="v3-pagination-info">
                      Page {companiesPage} of {totalPages}
                    </span>
                    {companiesPage < totalPages && (
                      <button onClick={() => setCompaniesPage(companiesPage + 1)} className="v3-pagination-button">
                        Next →
                      </button>
                    )}
                  </div>
                )}
                {companiesPage === totalPages && (
                  <div className="v3-load-more">
                    <button className="v3-load-more-button" disabled>
                      No more companies to load
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="v3-empty-state">
                {searchInput || selectedCategory || selectedRegion
                  ? 'No companies match your search'
                  : 'No companies in the directory yet.'}
              </div>
            )}
          </section>

          {/* SECTION 7: STAY CONNECTED */}
          <section className="v3-newsletter-section">
            <div className="v3-newsletter-content">
              <h2 className="v3-newsletter-title">Stay Connected</h2>
              <p className="v3-newsletter-description">
                Get the latest company updates, opportunities, and ecosystem insights.
              </p>
              <div className="v3-newsletter-form">
                <input
                  type="email"
                  className="v3-newsletter-input"
                  placeholder="Enter your email"
                />
                <button className="v3-newsletter-button">SUBSCRIBE →</button>
              </div>
            </div>
          </section>
        </>
      )}

      <MembershipModal isOpen={showMembership} onClose={() => setShowMembership(false)} />
    </div>
  );
}
