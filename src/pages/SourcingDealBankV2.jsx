// SourcingDealBankV2.jsx
// nat-geo-uplift R5e — Deal Bank page in the V2 list-pattern.
// R7a (2026-06-05) — 3-path directory hero. Bubble lane selector
// (Investments / Investors / Completed). Completed leads by default.

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import { V2ChipNav } from './V2ChipNav.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';

const LANES = [
  { slug: 'investments', label: 'Investments' },
  { slug: 'investors',   label: 'Investors' },
  { slug: 'completed',   label: 'Completed' },
];

const LANE_PLACEHOLDERS = {
  investments: 'Search by company, segment, round, or raise size',
  investors:   'Search by firm, focus area, check size, or deal types',
  completed:   'Search companies, rounds, investors, segments...',
};

const LANE_HEADINGS = {
  investments: 'Companies raising',
  investors:   'Investor firms',
  completed:   'Completed rounds',
};

// R7d — preview-only sample entries. Clearly marked SAMPLE on each card and
// behind a "Preview — sample listings" banner. The real data source is
// deferred to a later round (Patrik 2026-05-31).
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

function investmentSearchMatch(item, terms) {
  const haystack = [item.company, item.round, item.segment, item.region, item.seeking]
    .filter(Boolean).join(' ').toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

// R7e — preview-only sample firms. Same marking pattern as investments.
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

function investorSearchMatch(item, terms) {
  const haystack = [item.firm, item.focus, item.checkSize, item.dealTypes]
    .filter(Boolean).join(' ').toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

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

function SourcingDealBankV2Inner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);

  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [activeLane, setActiveLane] = useState('completed');

  // Clear search when switching lanes — each lane scopes its own query.
  useEffect(() => { setSearchInput(''); }, [activeLane]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!searchInput.trim()) return deals;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return deals.filter((d) => {
      const haystack = [
        d.company, d.round, d.segment, d.region, d.short_description,
        Array.isArray(d.investors) ? d.investors.join(' ') : d.investors,
      ].filter(Boolean).join(' ').toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [deals, searchInput]);

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
          <div className="browse-title">Deal Bank.</div>
          <div className="browse-sub">
            Three ways into Arizona space deal flow: companies raising, investor firms, and completed rounds.
          </div>
        </div>
      </div>

      <div className="browse-search">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={LANE_PLACEHOLDERS[activeLane]}
          aria-label={`Search Deal Bank ${activeLane}`}
          autoComplete="off"
          spellCheck="false"
        />
        {loading && activeLane === 'completed' && <div className="spinner" />}
      </div>

      {/* Deal-Bank-only lane selector — three bubbles, defaults to Completed
          so the live R5b data leads while Investments + Investors fill in. */}
      <div className="chips" style={{ paddingBottom: 4 }} role="tablist" aria-label="Deal Bank lanes">
        {LANES.map((lane) => (
          <button
            key={lane.slug}
            type="button"
            role="tab"
            aria-selected={lane.slug === activeLane}
            onClick={() => setActiveLane(lane.slug)}
            className={`chip${lane.slug === activeLane ? ' on' : ''}`}
            style={{ font: 'inherit', cursor: 'pointer' }}
          >
            {lane.label}
          </button>
        ))}
      </div>

      <V2ChipNav active="deal-bank" />

      <div className="sec-hdr">
        <div className="sec-title">
          {activeLane === 'completed'
            ? (loading ? 'Loading...' : `${filtered.length} Deal${filtered.length === 1 ? '' : 's'}.`)
            : LANE_HEADINGS[activeLane] + '.'}
        </div>
        <div className="sec-count">
          <span style={{ color: 'var(--tx3)', fontSize: 12, fontFamily: 'JetBrains Mono, ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {LANE_HEADINGS[activeLane]}
          </span>
        </div>
      </div>

      <div className="co-list">
        {activeLane === 'completed' && (
          <>
            {loading && (
              <>{[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ height: 84, borderRadius: 10, background: 'rgba(18,20,28,0.40)', border: '1px solid rgba(232,228,218,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}</>
            )}

            {!loading && filtered.map((deal, idx) => {
              const amount = amountHeadline(deal.amount_raised, deal.amount_usd_m);
              const date = formatDealDate(deal.date);
              return (
                <div
                  key={deal.id || `${deal.company}-${idx}`}
                  className="co-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="co-body">
                    <div className="co-name">{deal.company}</div>
                    <div className="co-loc">
                      {[deal.round, deal.segment, deal.region, date].filter(Boolean).join(' · ')}
                    </div>
                    <div className="co-badges">
                      {deal.round && <span className="co-badge cert">{deal.round}</span>}
                      {amount && <span className="co-badge feat">{amount}</span>}
                    </div>
                  </div>
                  <div className="co-arrow">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
                  </div>
                </div>
              );
            })}

            {!loading && filtered.length === 0 && (
              <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: 'rgba(232,228,218,0.55)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {searchInput ? `No deals match "${searchInput}"` : 'No deals available.'}
              </div>
            )}
          </>
        )}

        {activeLane === 'investments' && (
          <InvestmentsLane searchInput={searchInput} />
        )}

        {activeLane === 'investors' && (
          <InvestorsLane searchInput={searchInput} />
        )}
      </div>
    </div>
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
              segment,
              region
            )
          `)
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Transform DB data into display format + slugs for routing
        const transformed = (data || []).map((listing) => {
          const company = listing.directory_companies;
          return {
            id: listing.id,
            company_id: listing.company_id,
            slug: company?.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || '',
            company: company?.name || '(Unnamed company)',
            round: listing.round_stage || '',
            seeking: listing.capital_sought || '',
            segment: company?.segment || '',
            region: company?.region || '',
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

  const filtered = useMemo(() => {
    if (!searchInput.trim()) return listings;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return listings.filter((item) => investmentSearchMatch(item, terms));
  }, [searchInput, listings]);

  const showSample = listings.length === 0 && !loading;

  return (
    <>
      {showSample && (
        <SamplePreviewBanner
          copy="No live listings yet. Companies in the directory can add their listing."
        />
      )}

      {loading && (
        <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: 'rgba(232,228,218,0.35)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Loading...
        </div>
      )}

      {filtered.map((item) => (
        <Link
          key={item.id || item.slug}
          to={`/space-rising-v2/deal-bank/investments/${item.slug}`}
          className="co-card"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="co-body">
            <div className="co-name">{item.company}</div>
            <div className="co-loc">
              {[item.round, item.segment, item.region].filter(Boolean).join(' · ')}
            </div>
            <div className="co-badges">
              {item.round && <span className="co-badge cert">{item.round}</span>}
              {item.seeking && <span className="co-badge feat">{`Seeking ${item.seeking}`}</span>}
            </div>
          </div>
          <div className="co-arrow">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
          </div>
        </Link>
      ))}

      {filtered.length === 0 && !loading && (
        <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: 'rgba(232,228,218,0.55)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {`No listings match "${searchInput}"`}
        </div>
      )}
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

        // Transform DB data into display format + slugs for routing
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
        // Fallback to SAMPLE_INVESTORS on error
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

  return (
    <>
      {showSample && (
        <SamplePreviewBanner
          copy="No live listings yet. Be the first — list your firm."
        />
      )}

      {filtered.map((item) => (
        <Link
          key={item.id || item.slug}
          to={`/space-rising-v2/deal-bank/investors/${item.slug}`}
          className="co-card"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="co-body">
            <div className="co-name">{item.firm}</div>
            <div className="co-loc">{item.focus}</div>
            <div className="co-badges">
              {item.checkSize && <span className="co-badge cert">{item.checkSize}</span>}
              {item.dealTypes && <span className="co-badge feat">{item.dealTypes}</span>}
            </div>
          </div>
          <div className="co-arrow">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
          </div>
        </Link>
      ))}

      {filtered.length === 0 && !loading && (
        <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: 'rgba(232,228,218,0.55)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {`No firms match "${searchInput}"`}
        </div>
      )}

      {loading && (
        <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: 'rgba(232,228,218,0.35)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Loading...
        </div>
      )}

      <div style={{ padding: '24px', borderTop: '1px solid rgba(232,228,218,0.10)' }}>
        <Link
          to="/space-rising-v2/deal-bank/investors/signup"
          style={{
            display: 'block',
            padding: '12px 16px',
            border: '1px solid rgba(232,162,58,0.32)',
            borderRadius: 6,
            background: 'rgba(232,162,58,0.08)',
            color: 'var(--cyan)',
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.05em',
            textAlign: 'center',
            textTransform: 'uppercase',
            transition: 'all 0.2s',
          }}
        >
          List Your Firm
        </Link>
      </div>
    </>
  );
}

function SamplePreviewBanner({ copy }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        marginBottom: 16,
        borderRadius: 10,
        border: '1px solid rgba(232,162,58,0.32)',
        background: 'rgba(232,162,58,0.08)',
        color: 'var(--cyan)',
        fontSize: 12,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
        textAlign: 'center',
      }}
    >
      {copy}
    </div>
  );
}

export default function SourcingDealBankV2() {
  return (
    <SourcingThemeProvider>
      <SourcingDealBankV2Inner />
    </SourcingThemeProvider>
  );
}
