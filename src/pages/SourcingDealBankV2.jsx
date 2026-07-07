// SourcingDealBankV2.jsx — Space OS v3 reskin
// Renders inside OSLayoutV3 shell (navy sidebar + white topbar + light content)
// Three lanes: Completed Rounds (live API), Investments (Supabase), Investors (Supabase)
// Tabs as light underlines (navy active, muted inactive—not orange chips)
// Cards: white bg, light borders, company/firm ink 600, meta/focus muted 13-14px,
// pills as quiet gray (round/segment/region/check-size/deal-types)

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';

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

  return (
    <div className="osv3 deal-bank-page">
      <style>{`
        .deal-bank-page {
          padding: 32px 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* ===== PAGE HEADER ===== */
        .db-page-header {
          margin-bottom: 32px;
        }

        .db-page-title {
          font-size: var(--v3-h2-font-size);
          font-weight: var(--v3-h2-font-weight);
          color: var(--v3-ink-primary);
          margin-bottom: 8px;
          line-height: var(--v3-h2-line-height);
        }

        .db-page-sub {
          font-size: 16px;
          font-weight: 400;
          color: var(--v3-muted);
          line-height: 1.5;
        }

        /* ===== TABS ===== */
        .db-tabs {
          display: flex;
          gap: 32px;
          border-bottom: 1px solid var(--v3-border);
          margin-bottom: 24px;
        }

        .db-tab {
          padding: 12px 0;
          background: none;
          border: none;
          font-family: var(--v3-font-family-base);
          font-size: 16px;
          font-weight: 500;
          color: var(--v3-muted);
          cursor: pointer;
          position: relative;
          transition: color 0.2s;
          text-decoration: none;
          display: inline-block;
        }

        .db-tab:hover {
          color: var(--v3-ink-primary);
        }

        .db-tab-active {
          color: var(--v3-ink-primary);
        }

        .db-tab-active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background-color: var(--v3-active-nav);
        }

        /* ===== SEARCH / FILTER ===== */
        .db-search-row {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .db-search-input {
          flex: 1;
          min-width: 200px;
          padding: 10px 14px;
          border: 1px solid var(--v3-border);
          border-radius: 8px;
          font-family: var(--v3-font-family-base);
          font-size: 14px;
          font-weight: 400;
          color: var(--v3-ink-primary);
          background: white;
          transition: border-color 0.2s;
        }

        .db-search-input:focus {
          outline: none;
          border-color: var(--v3-accent);
        }

        .db-search-input::placeholder {
          color: var(--v3-muted);
        }

        /* ===== CARDS / ROWS ===== */
        .db-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .db-card {
          display: flex;
          align-items: stretch;
          padding: 16px;
          background: white;
          border: 1px solid var(--v3-border);
          border-radius: 8px;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
          cursor: pointer;
        }

        .db-card:hover {
          border-color: var(--v3-muted);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .db-card-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .db-card-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--v3-ink-primary);
          line-height: 1.4;
        }

        .db-card-meta {
          font-size: 13px;
          font-weight: 400;
          color: var(--v3-muted);
          line-height: 1.4;
        }

        .db-card-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }

        .db-pill {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          background-color: var(--v3-panel-bg);
          border: 1px solid var(--v3-border);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: var(--v3-ink-primary);
          white-space: nowrap;
        }

        .db-card-arrow {
          display: flex;
          align-items: center;
          margin-left: 16px;
          color: var(--v3-muted);
          transition: color 0.2s;
        }

        .db-card:hover .db-card-arrow {
          color: var(--v3-ink-primary);
        }

        /* ===== EMPTY STATE ===== */
        .db-empty {
          padding: 48px 24px;
          text-align: center;
          color: var(--v3-muted);
          font-size: 14px;
          font-weight: 400;
        }

        /* ===== LOADING ===== */
        .db-skeleton {
          height: 80px;
          background: linear-gradient(90deg, var(--v3-panel-bg) 0%, var(--v3-gray-100) 50%, var(--v3-panel-bg) 100%);
          background-size: 200% 100%;
          animation: skeleton-pulse 1.5s ease-in-out infinite;
          border-radius: 8px;
          border: 1px solid var(--v3-border);
        }

        @keyframes skeleton-pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ===== CTA BUTTON ===== */
        .db-cta-button {
          display: inline-block;
          padding: 12px 18px;
          background-color: white;
          border: 1px solid var(--v3-border);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: var(--v3-link);
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .db-cta-button:hover {
          border-color: var(--v3-link);
          background-color: rgba(37, 99, 235, 0.04);
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 640px) {
          .deal-bank-page {
            padding: 20px 16px;
          }

          .db-page-header {
            margin-bottom: 24px;
          }

          .db-page-title {
            font-size: 24px;
          }

          .db-tabs {
            gap: 16px;
            margin-bottom: 16px;
          }

          .db-tab {
            font-size: 14px;
          }

          .db-search-row {
            flex-direction: column;
          }

          .db-search-input {
            width: 100%;
          }

          .db-card {
            flex-direction: column;
            padding: 12px;
          }

          .db-card-arrow {
            display: none;
          }

          .db-card-pills {
            margin-top: 4px;
          }
        }
      `}</style>

      {/* Page Header */}
      <div className="db-page-header">
        <h2 className="db-page-title">Deal Bank</h2>
        <p className="db-page-sub">
          Three ways to connect with deal flow in the space economy: completed rounds,
          companies raising capital, and investor firms.
        </p>
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
        {activeLane === 'completed' && <CompletedRoundsLane loading={loading} filtered={filtered} searchInput={searchInput} />}
        {activeLane === 'investments' && <InvestmentsLane searchInput={searchInput} />}
        {activeLane === 'investors' && <InvestorsLane searchInput={searchInput} />}
      </div>
    </div>
  );
}

function CompletedRoundsLane({ loading, filtered, searchInput }) {
  if (loading) {
    return (
      <>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="db-skeleton" />
        ))}
      </>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="db-empty">
        {searchInput ? `No deals match "${searchInput}"` : 'No deals available.'}
      </div>
    );
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
                {[deal.round, deal.segment, deal.region].filter(Boolean).join(' • ')}
              </div>
              <div className="db-card-pills">
                {deal.round && <span className="db-pill">{deal.round}</span>}
                {amount && <span className="db-pill">{amount}</span>}
              </div>
            </div>
            {date && <div className="db-card-meta" style={{ marginLeft: 'auto', marginTop: 0, whiteSpace: 'nowrap' }}>{date}</div>}
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
              {[item.round, item.segment, item.region].filter(Boolean).join(' • ')}
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
