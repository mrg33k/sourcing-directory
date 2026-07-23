/**
 * OSGrantsPage — Grants section built on OSMagazinePage engine
 *
 * Data: directory_listings WHERE category = 'grant', tenant = 'space-rising'
 * Column map:
 *   title       → grant name
 *   grant_agency → issuing agency (new column)
 *   deadline    → application deadline (ISO string)
 *   apply_url   → application / grant URL
 *   description → eligibility / summary
 *   vertical    → grant type (SBIR, STTR, State, Federal, Foundation)
 *   salary_min  → amount_min (USD)
 *   salary_max  → amount_max (USD)
 *
 * Featured = soonest upcoming deadline.
 * "Closing Soon" rust chip fires when deadline is within 30 days.
 *
 * v3 tokens: #000C20 navy / #FEFDFD content bg / #CE4421 rust accent
 * Roboto only — no serif, no system-ui
 * ALIVE standard: utility-dashboard hero, deadline-driven, filter pills
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import OSMagazinePage from './OSMagazinePage.jsx';
import './osv3-magazine.css';
import { useSiteContentBySlug } from '../hooks/useSiteContent.js';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

/* pill definitions */
const PILLS = [
  { label: 'All', value: 'all' },
  { label: 'SBIR', value: 'SBIR' },
  { label: 'STTR', value: 'STTR' },
  { label: 'Federal', value: 'Federal' },
  { label: 'State', value: 'State' },
  { label: 'Foundation', value: 'Foundation' },
];

/* format ISO date to "Mon D, YYYY" */
function fmtDeadline(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* true when deadline is within 30 days from today */
function isClosingSoon(iso) {
  if (!iso) return false;
  const diff = new Date(iso) - new Date();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

/* format dollar amount */
function fmtAmount(min, max) {
  if (!min && !max) return null;
  const fmt = (n) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (max) return `Up to ${fmt(max)}`;
  return `From ${fmt(min)}`;
}

/* ------------------------------------------------------------------ */
/* GrantMediaSlot — hero LEFT panel                                    */
/* Funding/utility aesthetic: funding card with deadline              */
function GrantMediaSlot({ agency, deadline, grantType, amountMin, amountMax }) {
  const soon = deadline ? isClosingSoon(deadline) : false;
  const amount = fmtAmount(amountMin, amountMax);

  return (
    <div className="osv3-rfp-media">
      {/* subtle corner dots */}
      <div className="osv3-rfp-corner-tl" aria-hidden="true" />
      <div className="osv3-rfp-corner-br" aria-hidden="true" />

      {/* funding icon */}
      <div className="osv3-rfp-doc-icon" aria-hidden="true">
        <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* outer ring */}
          <circle cx="24" cy="28" r="18" stroke="rgba(254,253,253,0.2)" strokeWidth="1.5" />
          {/* inner circle */}
          <circle cx="24" cy="28" r="12" stroke="rgba(254,253,253,0.15)" strokeWidth="1" />
          {/* dollar sign */}
          <text x="24" y="34" textAnchor="middle" fontSize="14" fontWeight="700"
            fill="rgba(254,253,253,0.35)" fontFamily="Roboto, sans-serif">$</text>
          {/* accent dot bottom */}
          <circle cx="36" cy="46" r="10" fill="#CE4421" />
          {/* check mark */}
          <path d="M32 46 l3 3 l5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* agency + amount stacked top-left */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        zIndex: 3,
      }}>
        {agency && (
          <div style={{
            fontFamily: "'Roboto', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(254,253,253,0.5)',
            letterSpacing: '0.04em',
          }}>{agency}</div>
        )}
        {amount && (
          <div style={{
            fontFamily: "'Roboto', sans-serif",
            fontSize: 12,
            fontWeight: 700,
            color: 'rgba(254,253,253,0.75)',
            letterSpacing: '-0.01em',
          }}>{amount}</div>
        )}
      </div>

      {/* deadline chip */}
      {deadline && (
        <div className={`osv3-rfp-deadline-chip${soon ? ' osv3-rfp-deadline-soon' : ''}`}>
          {soon ? 'Closing Soon' : 'Deadline'}: {fmtDeadline(deadline)}
        </div>
      )}

      {/* type badge */}
      <div className="osv3-rfp-badge">{grantType || 'GRANT'}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GrantCard — grid card renderer */
function GrantCard({ item }) {
  const link = item.apply_url || item.virtual_url;
  const soon = item.deadline ? isClosingSoon(item.deadline) : false;
  const amount = fmtAmount(item.salary_min, item.salary_max);
  const agency = item.grant_agency || item.author_name;

  const handleApply = (e) => {
    e.stopPropagation();
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="osv3-rfp-card">
      {/* header row */}
      <div className="osv3-rfp-card-head">
        {agency && (
          <span className="osv3-rfp-agency">{agency}</span>
        )}
        {item.vertical && (
          <span className="osv3-rfp-type">{item.vertical}</span>
        )}
      </div>

      {/* title */}
      <h3 className="osv3-rfp-title">{item.title}</h3>

      {/* amount */}
      {amount && (
        <div className="osv3-rfp-amount">{amount}</div>
      )}

      {/* description */}
      {item.description && (
        <p className="osv3-rfp-desc">
          {item.description.slice(0, 140)}
          {item.description.length > 140 ? '...' : ''}
        </p>
      )}

      {/* footer */}
      <div className="osv3-rfp-foot">
        <div className="osv3-rfp-deadline-row">
          {item.deadline && (
            <span className={`osv3-rfp-dl${soon ? ' osv3-rfp-dl-soon' : ''}`}>
              {soon && <span className="osv3-rfp-dl-dot" />}
              {soon ? 'Closing Soon' : 'Deadline'}: {fmtDeadline(item.deadline)}
            </span>
          )}
        </div>
        {link && (
          <button
            className="osv3-rfp-apply-btn"
            type="button"
            onClick={handleApply}
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OSGrantsPage — top-level page component */
function OSGrantsPage() {
  const navigate = useNavigate();
  const { get } = useSiteContentBySlug(TENANT_DB_LOOKUP_SLUG);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadItems = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data: tenantData } = await supabase
        .from('directory_tenants')
        .select('id')
        .eq('slug', TENANT_DB_LOOKUP_SLUG)
        .single();

      let qb = supabase
        .from('directory_listings')
        .select('*')
        .eq('category', 'grant')
        .eq('status', 'active')
        .order('deadline', { ascending: true, nullsFirst: false });

      if (tenantData?.id) qb = qb.eq('tenant_id', tenantData.id);

      const { data, error } = await qb.limit(50);
      if (!error && data) setItems(data);
    } catch (_) {
      /* silently degrade */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = activeFilter === 'all'
    ? items
    : items.filter(v =>
        (v.vertical || '').toLowerCase().includes(activeFilter.toLowerCase()) ||
        (v.grant_agency || '').toLowerCase().includes(activeFilter.toLowerCase()) ||
        (v.author_name || '').toLowerCase().includes(activeFilter.toLowerCase())
      );

  /* featured = soonest upcoming deadline */
  const featured = items[0] || null;
  const featLink = featured ? (featured.apply_url || featured.virtual_url) : null;
  const featDeadline = featured?.deadline ? fmtDeadline(featured.deadline) : null;
  const featSoon = featured?.deadline ? isClosingSoon(featured.deadline) : false;
  const featAmount = featured ? fmtAmount(featured.salary_min, featured.salary_max) : null;
  const featAgency = featured ? (featured.grant_agency || featured.author_name) : null;

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Opportunities Hub / Grants"
      pageTitle={get('grants', 'page_title', 'Grants')}
      pageSubtitle={get('grants', 'page_subtitle', 'SBIR, STTR, Arizona Commerce Authority, and foundation funding for Arizona space companies and researchers.')}
      addLabel="Add Grant"
      onAdd={() => navigate('/admin/listings?category=grant')}

      /* feature */
      featuredItem={featured}
      mediaSlot={
        featured
          ? <GrantMediaSlot
              agency={featAgency}
              deadline={featured.deadline}
              grantType={featured.vertical}
              amountMin={featured.salary_min}
              amountMax={featured.salary_max}
            />
          : null
      }
      featureEyebrow={featSoon ? 'CLOSING SOON' : 'FEATURED GRANT'}
      featureTitle={featured?.title || ''}
      featureHost={featAgency || ''}
      featureHostTag="Agency"
      featureDesc={featured?.description
        ? featured.description.slice(0, 240) + (featured.description.length > 240 ? '...' : '')
        : ''}
      featureMeta={[
        ...(featured?.vertical ? [{ label: 'Type', value: featured.vertical }] : []),
        ...(featAmount ? [{ label: 'Award', value: featAmount }] : []),
        ...(featDeadline ? [{ label: 'Deadline', value: featDeadline }] : []),
      ]}
      featureActions={
        featured ? (
          <>
            {featLink && (
              <a
                href={featLink}
                target="_blank"
                rel="noopener noreferrer"
                className="osv3-mag-btn-play"
              >
                View Grant
              </a>
            )}
            <button
              className="osv3-mag-btn-ghost"
              type="button"
              onClick={() => navigate('/admin/listings?category=grant')}
            >
              + Add Grant
            </button>
          </>
        ) : null
      }

      /* grid */
      pills={PILLS}
      activeFilter={activeFilter}
      onFilter={setActiveFilter}
      items={filtered}
      cardRenderer={(item, i) => (
        <GrantCard key={item.id || i} item={item} />
      )}
      isLoading={isLoading}
      sectionLabel="ALL GRANTS"
    />
  );
}

export default OSGrantsPage;
