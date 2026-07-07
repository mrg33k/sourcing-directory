// SourcingDealBankV2.jsx — Space OS v3 reskin with feature hero
// Renders inside OSLayoutV3 shell (navy sidebar + white topbar + light content)
// Three lanes: Completed Rounds (live API), Investments (Supabase), Investors (Supabase)
// Feature hero on Completed lane (biggest/newest deal 16:9 image + scrim + kicker + headline + deck + CTA)
// Cards: white bg, light borders, company/firm ink 600, meta/focus muted 13-14px,
// pills as quiet gray (round/segment/region/check-size/deal-types)

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import './osv3-dealbank.css';

const LANES = [
  { slug: 'completed', label: 'Completed Rounds' },
  { slug: 'investments', label: 'Investments' },
  { slug: 'investors', label: 'Investors' },
];

const LANE_PLACEHOLDERS = {
  investments: 'Search by company, segment, round, or raise size',
  investors: 'Search by firm, focus area, check size, or deal types',
  completed: 'Search companies, rounds, investors, segments...',
};

// Asset pool for feature hero
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

// Sample data (fallback for empty states)
const SAMPLE_INVESTMENTS = [
  {
    slug: 'sample-launch-co',
    company: 'Sample Launch Co.',
    round: 'Series A',
    seeking: '$5M',
    region: 'Phoenix, AZ',
    segment: 'Launch services',
  },
  {
    slug: 'sample-observation-labs',
    company: 'Sample Observation Labs',
    round: 'Pre-Seed',
    seeking: '$750K',
    region: 'Tucson, AZ',
    segment: 'Earth observation',
  },
  {
    slug: 'sample-orbital-systems',
    company: 'Sample Orbital Systems',
    round: 'Seed',
    seeking: '$2M',
    region: 'Mesa, AZ',
    segment: 'Spacecraft components',
  },
];

const SAMPLE_INVESTORS = [
  {
    slug: 'sample-orbit-ventures',
    firm: 'Sample Orbit Ventures',
    focus: 'Early-stage space infrastructure',
    checkSize: '$250K – $2M',
    dealTypes: 'SAFE, Priced Seed',
  },
  {
    slug: 'sample-southwest-capital',
    firm: 'Sample Southwest Capital',
    focus: 'Arizona-based aerospace + defense',
    checkSize: '$1M – $5M',
    dealTypes: 'Series A, Series B',
  },
  {
    slug: 'sample-frontier-family-office',
    firm: 'Sample Frontier Family Office',
    focus: 'Deep-tech + frontier sciences',
    checkSize: '$500K – $3M',
    dealTypes: 'Seed, Series A',
  },
];

function formatDealDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function amountHeadline(raw, m) {
  if (raw && String(raw).trim()) return String(raw).trim();
  if (m && !Number.isNaN(Number(m))) {
    const n = Number(m);
    return n >= 1 ? `$${n}M` : `$${Math.round(n * 1000)}K`;
  }
  return null;
}

function getImageForDeal(deal, index) {
  const s = (deal.id ? String(deal.id) : '') + ':' + index;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `/v2-assets/${ASSET_POOL[h % ASSET_POOL.length]}`;
}

function investmentSearchMatch(item, terms) {
  const haystack = [item.company, item.round, item.segment, item.region, item.seeking]
    .filter(Boolean).join(' ').toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

function investorSearchMatch(item, terms) {
  const haystack = [item.firm, item.focus, item.checkSize, item.dealTypes]
    .filter(Boolean).join(' ').toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

function SourcingDealBankV2() {
  useSRWTitle('Space Deal Bank | Space OS');

  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [activeLane, setActiveLane] = useState('completed');

  // Clear search when switching lanes
  useEffect(() => { setSearchInput(''); }, [activeLane]);

  // Fetch completed rounds from external API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (activeLane === 'completed') {
        setLoading(true);
        try {
          const r = await fetch('https://www.aheadofmarket.com/api/deal-bank/completed');
          if (!r.ok) throw new Error('Deal Bank API ' + r.status);
          const j = await r.json();
          if (!cancelled) setDeals(Array.isArray(j.rounds) ? j.rounds : []);
        } catch (err) {
          console.error('DealBankV2 fetch error:', err);
          if (!cancelled) setDeals([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeLane]);

  const filtered = useMemo(() => {
    if (activeLane !== 'completed') return [];

    const dealTime = (d) => {
      const t = d.date ? new Date(d.date).getTime() : NaN;
      return Number.isNaN(t) ? -Infinity : t;
    };
    const byNewest = (a, b) => dealTime(b) - dealTime(a);

    const base = !searchInput.trim()
      ? deals
      : deals.filter((d) => {
          const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
          const haystack = [
            d.company, d.round, d.segment, d.region, d.short_description,
            Array.isArray(d.investors) ? d.investors.join(' ') : d.investors,
          ].filter(Boolean).join(' ').toLowerCase();
          return terms.every((t) => haystack.includes(t));
        });

    return [...base].sort(byNewest);
  }, [deals, searchInput, activeLane]);

  // Feature deal (first/biggest from Completed lane)
  const featureDeal = filtered.length > 0 ? filtered[0] : null;
  const gridDeals = filtered.length > 1 ? filtered.slice(1) : [];

  return (
    <div className="osv3-dealbank-page">
      {/* Page Header */}
      <div className="db-page-header">
        <div>
          <h1 className="db-page-title">Deal Bank</h1>
          <p className="db-page-sub">
            Three ways to connect with deal flow in the space economy: completed rounds, companies raising capital, and investor firms.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="db-tabs" role="tablist">
        {LANES.map((lane) => (
          <button
            key={lane.slug}
            type="button"
            role="tab"
            aria-selected={lane.slug === activeLane}
            onClick={() => setActiveLane(lane.slug)}
            className={`db-tab ${lane.slug === activeLane ? 'db-tab-active' : ''}`}
          >
            {lane.label}
          </button>
        ))}
      </div>

      {/* FEATURE HERO (only on Completed lane) */}
      {activeLane === 'completed' && featureDeal && (
        <div className="db-feature-hero">
          <img
            src={getImageForDeal(featureDeal, 0)}
            alt={featureDeal.company}
            className="db-feature-image"
            loading="eager"
          />
          <div className="db-feature-overlay" />
          <div className="db-feature-content">
            <div className="db-feature-kicker">Funding</div>
            <h2 className="db-feature-headline">{featureDeal.company} raises {amountHeadline(featureDeal.amount_raised, featureDeal.amount_usd_m)}</h2>
            <p className="db-feature-deck">{[featureDeal.round, featureDeal.segment, featureDeal.region].filter(Boolean).join(' · ')}</p>
            <button
              className="db-feature-button"
              onClick={(e) => {
                e.preventDefault();
              }}
            >
              View Deal →
            </button>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="db-search-row">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={LANE_PLACEHOLDERS[activeLane]}
          aria-label={`Search ${activeLane}`}
          autoComplete="off"
          spellCheck="false"
          className="db-search-input"
        />
      </div>

      {/* Content */}
      <div className="db-list">
        {activeLane === 'completed' && <CompletedRoundsLane loading={loading} filtered={gridDeals} searchInput={searchInput} featureDeal={featureDeal} />}
        {activeLane === 'investments' && <InvestmentsLane searchInput={searchInput} />}
        {activeLane === 'investors' && <InvestorsLane searchInput={searchInput} />}
      </div>
    </div>
  );
}

function CompletedRoundsLane({ loading, filtered, searchInput, featureDeal }) {
  if (loading) {
    return (
      <>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="db-skeleton" />
        ))}
      </>
    );
  }

  if (filtered.length === 0 && !featureDeal) {
    return (
      <div className="db-empty">
        {searchInput ? `No deals match "${searchInput}"` : 'No deals available.'}
      </div>
    );
  }

  if (filtered.length === 0 && featureDeal) {
    return null;
  }

  return (
    <>
      {filtered.map((deal, idx) => {
        const amount = amountHeadline(deal.amount_raised, deal.amount_usd_m);
        const date = formatDealDate(deal.date);

        return (
          <div key={deal.id || `${deal.company}-${idx}`} className="db-card">
            <div className="db-card-body">
              <div className="db-card-title">{deal.company}</div>
              <div className="db-card-meta">
                {[deal.round, deal.segment, deal.region].filter(Boolean).join(' · ')}
              </div>
              <div className="db-card-pills">
                {amount && <span className="db-pill">{amount}</span>}
              </div>
            </div>
            {date && <div className="db-card-date">{date}</div>}
          </div>
        );
      })}
    </>
  );
}

function InvestmentsLane({ searchInput }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const { data, error } = await supabase
          .from('deal_bank_listings')
          .select(`
            id,
            company_id,
            capital_sought,
            round_stage,
            directory_companies (
              name,
              vertical,
              city,
              state,
              country
            )
          `)
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const transformed = (data || []).map((listing) => {
          const company = listing.directory_companies;
          const region = [company?.city, company?.state].filter(Boolean).join(', ') || company?.country || '';
          return {
            id: listing.id,
            company_id: listing.company_id,
            slug: company?.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || '',
            company: company?.name || '(Unnamed company)',
            round: listing.round_stage || '',
            seeking: listing.capital_sought || '',
            segment: company?.vertical || '',
            region,
          };
        });

        setListings(transformed);
      } catch (err) {
        console.error('Error fetching listings:', err);
        setListings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, []);

  const displayListings = listings.length > 0 ? listings : SAMPLE_INVESTMENTS;

  const filtered = useMemo(() => {
    if (!searchInput.trim()) return displayListings;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return displayListings.filter((item) => investmentSearchMatch(item, terms));
  }, [searchInput, displayListings]);

  if (loading) {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <div key={i} className="db-skeleton" />
        ))}
      </>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="db-empty">
        {searchInput ? `No listings match "${searchInput}"` : 'No listings available.'}
      </div>
    );
  }

  return (
    <>
      {filtered.map((item) => (
        <Link
          key={item.id || item.slug}
          to={`/deal-bank/investments/${item.slug}`}
          className="db-card"
        >
          <div className="db-card-body">
            <div className="db-card-title">{item.company}</div>
            <div className="db-card-meta">
              {[item.round, item.segment, item.region].filter(Boolean).join(' · ')}
            </div>
            <div className="db-card-pills">
              {item.round && <span className="db-pill">{item.round}</span>}
              {item.seeking && <span className="db-pill">Seeking {item.seeking}</span>}
            </div>
          </div>
          <div className="db-card-arrow">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </Link>
      ))}
    </>
  );
}

function InvestorsLane({ searchInput }) {
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvestors = async () => {
      try {
        const { data, error } = await supabase
          .from('deal_bank_investors')
          .select('id, firm_name, criteria, check_size_min, check_size_max, deal_types, deals_last_18mo, linkedin_url')
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const transformed = (data || []).map((firm) => ({
          id: firm.id,
          slug: firm.firm_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          firm: firm.firm_name,
          focus: firm.criteria || '',
          checkSize: firm.check_size_min && firm.check_size_max
            ? `$${(firm.check_size_min / 1000000).toFixed(1)}M – $${(firm.check_size_max / 1000000).toFixed(1)}M`
            : '',
          dealTypes: firm.deal_types ? firm.deal_types.join(', ') : '',
        }));

        setInvestors(transformed);
      } catch (err) {
        console.error('Error fetching investors:', err);
        setInvestors(SAMPLE_INVESTORS);
      } finally {
        setLoading(false);
      }
    };

    fetchInvestors();
  }, []);

  const filtered = useMemo(() => {
    if (!searchInput.trim()) return investors;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return investors.filter((item) => investorSearchMatch(item, terms));
  }, [searchInput, investors]);

  const showSample = investors.length === 0 && !loading;

  if (loading) {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <div key={i} className="db-skeleton" />
        ))}
      </>
    );
  }

  return (
    <>
      {showSample && (
        <div style={{ padding: '16px', backgroundColor: 'var(--v3-panel-bg)', borderRadius: '8px', border: '1px solid var(--v3-border)', marginBottom: '16px', fontSize: '14px', color: 'var(--v3-muted)', textAlign: 'center' }}>
          No live listings yet. Be the first to list your firm.
        </div>
      )}

      {filtered.map((item) => (
        <Link
          key={item.id || item.slug}
          to={`/deal-bank/investors/${item.slug}`}
          className="db-card"
        >
          <div className="db-card-body">
            <div className="db-card-title">{item.firm}</div>
            <div className="db-card-meta">{item.focus || 'No focus area provided'}</div>
            <div className="db-card-pills">
              {item.checkSize && <span className="db-pill">{item.checkSize}</span>}
              {item.dealTypes && <span className="db-pill">{item.dealTypes}</span>}
            </div>
          </div>
          <div className="db-card-arrow">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </Link>
      ))}

      {filtered.length === 0 && !loading && (
        <div className="db-empty">
          {searchInput ? `No firms match "${searchInput}"` : 'No firms available.'}
        </div>
      )}

      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--v3-border)' }}>
        <Link
          to="/deal-bank/investors/signup"
          className="db-cta-button"
        >
          List Your Firm
        </Link>
      </div>
    </>
  );
}

export default SourcingDealBankV2;
