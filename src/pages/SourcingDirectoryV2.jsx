// SourcingDirectoryV2.jsx
// Space OS v3 — Directory landing page (matches spec IMG_4456)
// Sections: hero (image + search + CTA), recently added, categories, by region (real US map), companies + stay-connected

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { getCategoryForCompany, CATEGORIES, getCategoryCount } from '../lib/directoryCategories.js';
import { STATE_PATHS } from '../lib/usStatesPaths.js';
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

// Deterministic image selection per company (full-string hash, UUID-safe)
function getImageForCompany(company, index) {
  const s = (company.id ? String(company.id) : '') + ':' + index;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `/v2-assets/${ASSET_POOL[h % ASSET_POOL.length]}`;
}

// US regions (5 total). order = display order in the right-hand list.
const US_REGIONS = {
  'West': { states: ['AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'OR', 'UT', 'WA', 'WY'], color: '#CE4421' },
  'Midwest': { states: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'], color: '#10B981' },
  'Southwest': { states: ['AZ', 'NM', 'NV', 'OK', 'TX'], color: '#FBBF24' },
  'Northeast': { states: ['CT', 'MA', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'], color: '#3B82F6' },
  'Southeast': { states: ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'], color: '#06B6D4' },
};

// Floating label anchors on the 960x600 albersUsa map
const REGION_LABELS = {
  'West': { x: 175, y: 250 },
  'Midwest': { x: 600, y: 235 },
  'Southwest': { x: 405, y: 470 },
  'Northeast': { x: 855, y: 175 },
  'Southeast': { x: 720, y: 440 },
};

function getRegionForState(state) {
  for (const [region, data] of Object.entries(US_REGIONS)) {
    if (data.states.includes(state)) return region;
  }
  return null;
}

// state code -> region color, for filling the map
const STATE_COLOR = (() => {
  const m = {};
  for (const [region, data] of Object.entries(US_REGIONS)) {
    for (const s of data.states) m[s] = { region, color: data.color };
  }
  return m;
})();

function computeRegionCounts(companies) {
  const counts = {};
  Object.keys(US_REGIONS).forEach(region => (counts[region] = 0));
  companies.forEach(c => {
    const region = getRegionForState(c.state);
    if (region) counts[region]++;
  });
  return counts;
}

// Small region glyphs for the right-hand list (mountain / trees / sun / buildings)
function RegionIcon({ region, color }) {
  const common = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (region) {
    case 'West': // mountains
      return (<svg {...common}><path d="M3 19l5.5-9 3.5 5 2-3L21 19z" /><path d="M8.5 10l1.8 3" /></svg>);
    case 'Midwest': // pine trees
      return (<svg {...common}><path d="M8 4l3 5H5zM8 8l3.5 5.5H4.5zM8 13v5" /></svg>);
    case 'Southwest': // sun
      return (<svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M6 6l1.5 1.5M16.5 16.5L18 18M18 6l-1.5 1.5M7.5 16.5L6 18" /></svg>);
    case 'Northeast': // city buildings
      return (<svg {...common}><path d="M4 20V9l5-2v13M9 20V4l6 2v14M15 20v-8l5 2v6M3 20h18" /></svg>);
    case 'Southeast': // buildings, wider
      return (<svg {...common}><path d="M3 20V7l6-3v16M9 20V10l6-3v13M15 20v-6l5-2v8M2 20h20" /></svg>);
    default:
      return null;
  }
}

function MembershipModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, animation: 'fadeIn 200ms ease-out' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', width: '100%', maxWidth: 420, zIndex: 301, background: 'white', border: '1px solid #D7DEE2', borderRadius: 12, overflow: 'hidden', transform: 'translate(-50%, -50%)', animation: 'fadeIn 200ms ease-out', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
        <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        <div style={{ padding: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--v3-font-family-base)', letterSpacing: '0.08em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 16 }}>Membership</div>
          <h3 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--v3-font-family-base)', color: '#010B13', lineHeight: 1.2, marginBottom: 12 }}>Claim your company</h3>
          <p style={{ fontSize: 15, fontFamily: 'var(--v3-font-family-base)', color: '#6B7280', lineHeight: 1.6, marginBottom: 28 }}>Add your company to the directory and get found by procurement teams and contractors.</p>
          <Link to="/membership" onClick={onClose} style={{ display: 'block', textDecoration: 'none', textAlign: 'center', padding: '12px 20px', marginBottom: 12, background: '#CE4421', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'var(--v3-font-family-base)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Join Now</Link>
          <button onClick={onClose} style={{ width: '100%', background: 'none', border: 'none', color: '#6B7280', fontFamily: 'var(--v3-font-family-base)', fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: '12px 0' }}>Maybe later</button>
        </div>
      </div>
    </>
  );
}

const COMPANIES_STEP = 10;

export default function SourcingDirectoryV2() {
  useSRWTitle('Company Directory | Space OS');

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [showMembership, setShowMembership] = useState(false);
  const [visibleCount, setVisibleCount] = useState(COMPANIES_STEP);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const carouselRef = useRef(null);

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterSubmitting(true);
    setNewsletterMessage('');
    try {
      const { error } = await supabase.from('srw_subscribers').insert([{ email: newsletterEmail, source: 'directory' }]);
      if (error) throw error;
      setNewsletterMessage('Thanks for subscribing!');
      setNewsletterEmail('');
      setTimeout(() => setNewsletterMessage(''), 3000);
    } catch (err) {
      console.error('Newsletter subscribe error:', err);
      setNewsletterMessage('Error subscribing. Please try again.');
    } finally {
      setNewsletterSubmitting(false);
    }
  };

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
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

  const recentlyAdded = useMemo(() => companies.slice(0, 8), [companies]);

  const filtered = useMemo(() => {
    let result = companies;
    if (selectedCategory) result = result.filter(c => getCategoryForCompany(c.name) === selectedCategory);
    if (selectedRegion) result = result.filter(c => getRegionForState(c.state) === selectedRegion);
    if (searchInput.trim()) {
      const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter(c => {
        const haystack = [c.name, c.description, c.city, c.state].filter(Boolean).join(' ').toLowerCase();
        return terms.every(t => haystack.includes(t));
      });
    }
    return result;
  }, [companies, searchInput, selectedCategory, selectedRegion]);

  // reset load-more window whenever the filter set changes
  useEffect(() => { setVisibleCount(COMPANIES_STEP); }, [searchInput, selectedCategory, selectedRegion]);

  const visibleCompanies = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const regionCounts = useMemo(() => computeRegionCounts(companies), [companies]);

  const pickRegion = (region) => {
    setSelectedRegion(selectedRegion === region ? null : region);
    setSelectedCategory(null);
  };
  const scrollCarousel = () => {
    if (carouselRef.current) carouselRef.current.scrollBy({ left: 520, behavior: 'smooth' });
  };

  return (
    <div className="osv3-directory-page-v3">
      {/* SECTION 1: HERO — image bg + search + CTA */}
      <section className="v3-hero-section">
        <div className="v3-hero-bg" />
        <div className="v3-hero-scrim" />
        <div className="v3-hero-content">
          <div className="v3-hero-left">
            <div className="v3-hero-eyebrow">space_OS <span>//</span> Directory</div>
            <h1 className="v3-hero-title">Directory</h1>
            <p className="v3-hero-description">
              Discover the companies, organizations, and resources building the space
              industry — across infrastructure, mobility, intelligence, life sciences,
              industry, and defense.
            </p>
            <form
              className="v3-hero-search"
              onSubmit={(e) => { e.preventDefault(); document.getElementById('v3-companies-anchor')?.scrollIntoView({ behavior: 'smooth' }); }}
            >
              <input
                type="text"
                className="v3-hero-search-input"
                placeholder="Search the ecosystem, companies, people, reports, and more…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button type="submit" className="v3-hero-search-button">SEARCH &rsaquo;</button>
            </form>
          </div>
          <div className="v3-hero-right">
            <h3 className="v3-hero-cta-title">Add your company</h3>
            <p className="v3-hero-cta-subtitle">List your organization and get discovered by the space ecosystem.</p>
            <button onClick={() => setShowMembership(true)} className="v3-hero-cta-button">
              <span className="v3-hero-cta-plus">+</span> ADD YOUR COMPANY &rsaquo;
            </button>
          </div>
        </div>
      </section>

      {!supabase && <div className="v3-error">Supabase not configured</div>}

      {loading && supabase && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9AA6B2', background: 'var(--v3-dark-bg)' }}>Loading directory…</div>
      )}

      {!loading && supabase && (
        <>
          {/* SECTION 2: RECENTLY ADDED CAROUSEL */}
          {recentlyAdded.length > 0 && (
            <section className="v3-carousel-section">
              <div className="v3-carousel-header">
                <h2 className="v3-section-eyebrow">RECENTLY ADDED <span>&rsaquo;</span></h2>
              </div>
              <div className="v3-carousel-viewport">
                <div className="v3-carousel-scroll" ref={carouselRef}>
                  {recentlyAdded.map((company, idx) => {
                    const cat = getCategoryForCompany(company.name);
                    const loc = [company.city, company.state].filter(Boolean).join(', ');
                    return (
                      <Link key={company.id} to={`/${company.slug}`} className="v3-card">
                        <img src={getImageForCompany(company, idx)} alt="" className="v3-card-img" loading="lazy" />
                        <div className="v3-card-overlay" />
                        <div className="v3-card-monogram">{company.name.slice(0, 2).toUpperCase()}</div>
                        <div className="v3-card-body">
                          {cat && <div className="v3-card-kicker">{cat}</div>}
                          <h3 className="v3-card-name">{company.name}</h3>
                          {cat && <div className="v3-card-tags"><span className="v3-card-tag">{cat}</span></div>}
                          {loc && (
                            <div className="v3-card-loc">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.3-7-11a7 7 0 0114 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                              {loc}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <button className="v3-carousel-next" onClick={scrollCarousel} aria-label="Scroll carousel">&rsaquo;</button>
              </div>
            </section>
          )}

          {/* SECTION 3: CATEGORIES */}
          <section className="v3-categories-section">
            <div className="v3-section-head">
              <h2 className="v3-section-eyebrow">CATEGORIES <span>&rsaquo;</span></h2>
            </div>
            <div className="v3-categories-grid">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  className={`v3-category-tile ${selectedCategory === cat.key ? 'active' : ''}`}
                  onClick={() => { setSelectedCategory(selectedCategory === cat.key ? null : cat.key); setSelectedRegion(null); }}
                  style={{ '--category-color': cat.color }}
                >
                  <div className="v3-category-id">{cat.id}</div>
                  <div className="v3-category-label">{cat.label}</div>
                  <div className="v3-category-subtitle">{cat.subtitle}</div>
                  <div className="v3-category-count"><strong>{getCategoryCount(cat.key)}</strong> Companies</div>
                </button>
              ))}
            </div>
          </section>

          {/* SECTION 4: BY REGION — real US map + region list */}
          <section className="v3-region-section">
            <div className="v3-region-inner">
              <div className="v3-region-mapwrap">
                <svg className="v3-region-map-svg" viewBox="0 0 960 600" preserveAspectRatio="xMidYMid meet" role="img" aria-label="US company map by region">
                  {Object.entries(US_REGIONS).map(([region, data]) => {
                    const dim = selectedRegion && selectedRegion !== region;
                    return (
                      <g
                        key={region}
                        className="v3-map-region"
                        onClick={() => pickRegion(region)}
                        style={{ cursor: 'pointer', opacity: dim ? 0.28 : 1, transition: 'opacity 160ms ease' }}
                      >
                        {data.states.map(s => STATE_PATHS[s] && (
                          <path key={s} d={STATE_PATHS[s]} fill={data.color} stroke="#0A1526" strokeWidth="0.8"
                            style={{ fillOpacity: selectedRegion === region ? 0.98 : 0.82 }} />
                        ))}
                      </g>
                    );
                  })}
                  {Object.entries(REGION_LABELS).map(([region, pos]) => (
                    <text key={region} x={pos.x} y={pos.y} className="v3-map-label" textAnchor="middle">{region} Region</text>
                  ))}
                </svg>
              </div>
              <div className="v3-region-side">
                <h2 className="v3-region-side-title">BY REGION <span>&rsaquo;</span></h2>
                <div className="v3-region-list">
                  {Object.entries(US_REGIONS).map(([region, data]) => (
                    <button key={region} className={`v3-region-item ${selectedRegion === region ? 'active' : ''}`} onClick={() => pickRegion(region)}>
                      <div className="v3-region-icon"><RegionIcon region={region} color={data.color} /></div>
                      <div className="v3-region-text">
                        <div className="v3-region-name">{region.toUpperCase()}</div>
                        <div className="v3-region-states">{data.states.join(', ')}</div>
                        <div className="v3-region-count" style={{ color: data.color }}>{regionCounts[region]} companies</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: COMPANIES DIRECTORY + STAY CONNECTED */}
          <section className="v3-companies-section" id="v3-companies-anchor">
            <div className="v3-companies-inner">
              <div className="v3-companies-main">
                <h2 className="v3-companies-title">COMPANIES DIRECTORY <span>&rsaquo;</span></h2>
                {(selectedCategory || selectedRegion || searchInput.trim()) && (
                  <div className="v3-active-filter">
                    Showing {filtered.length} {selectedCategory || ''} {selectedRegion ? `· ${selectedRegion}` : ''} results
                    <button onClick={() => { setSelectedCategory(null); setSelectedRegion(null); setSearchInput(''); }}>Clear</button>
                  </div>
                )}
                {visibleCompanies.length > 0 ? (
                  <>
                    <div className="v3-companies-list">
                      {visibleCompanies.map((company) => (
                        <div key={company.id} className="v3-company-row">
                          <div className="v3-company-row-logo">
                            {company.logo_url ? (
                              <img src={company.logo_url} alt={company.name} className="v3-company-row-logo-img" />
                            ) : (
                              <div className="v3-company-row-logo-fallback" style={{ '--cat-color': (CATEGORIES.find(c => c.key === getCategoryForCompany(company.name))?.color) || '#6366F1' }}>
                                {company.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="v3-company-row-content">
                            <h3 className="v3-company-row-name">{company.name}</h3>
                            <p className="v3-company-row-description">{company.description || ''}</p>
                          </div>
                          <div className="v3-company-row-side">
                            <div className="v3-company-row-meta">
                              {[company.city, company.state].filter(Boolean).join(', ')}
                              {company.phone && <div>{company.phone}</div>}
                            </div>
                            <Link to={`/${company.slug}`} className="v3-company-row-link">VIEW PROFILE &rsaquo;</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                    {visibleCount < filtered.length && (
                      <div className="v3-load-more">
                        <button className="v3-load-more-button" onClick={() => setVisibleCount(v => v + COMPANIES_STEP)}>
                          LOAD MORE COMPANIES
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="v3-empty-state">
                    {searchInput || selectedCategory || selectedRegion ? 'No companies match your search.' : 'No companies in the directory yet.'}
                  </div>
                )}
              </div>

              <aside className="v3-connect">
                <div className="v3-connect-icon">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                </div>
                <h2 className="v3-connect-title">Stay Connected</h2>
                <p className="v3-connect-desc">Get the latest company updates, opportunities, and ecosystem insights.</p>
                <form className="v3-connect-form" onSubmit={handleNewsletterSubmit}>
                  <input type="email" className="v3-connect-input" placeholder="Enter your email" value={newsletterEmail} onChange={(e) => setNewsletterEmail(e.target.value)} required disabled={newsletterSubmitting} />
                  <button type="submit" className="v3-connect-button" disabled={newsletterSubmitting || !newsletterEmail.trim()}>
                    {newsletterSubmitting ? 'Subscribing…' : 'SUBSCRIBE ›'}
                  </button>
                </form>
                {newsletterMessage && (
                  <div className="v3-connect-msg" style={{ color: newsletterMessage.includes('Error') ? '#CE4421' : '#10B981' }}>{newsletterMessage}</div>
                )}
              </aside>
            </div>
          </section>
        </>
      )}

      <MembershipModal isOpen={showMembership} onClose={() => setShowMembership(false)} />
    </div>
  );
}
