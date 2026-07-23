/**
 * OSRFPsPage — RFPs section built on OSMagazinePage engine
 *
 * Data: directory_listings WHERE category = 'rfp', tenant = 'space-rising'
 * Column map:
 *   title       → solicitation title
 *   author_name → issuing agency
 *   deadline    → deadline date (ISO string)
 *   apply_url   → solicitation / application URL
 *   description → summary of the solicitation
 *   vertical    → type tag (Federal, NASA, DoD, State, ...)
 *
 * Featured = soonest upcoming deadline.
 * "Deadline Soon" rust chip fires when deadline is within 30 days.
 *
 * v3 tokens: #000C20 navy / #FEFDFD content bg / #CE4421 rust accent
 * Roboto only — no serif, no system-ui
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
  { label: 'Federal', value: 'Federal' },
  { label: 'NASA', value: 'NASA' },
  { label: 'DoD', value: 'DoD' },
  { label: 'State', value: 'State' },
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

/* ------------------------------------------------------------------ */
/* RFPMediaSlot — hero LEFT panel                                      */
/* Document/solicitation aesthetic: document card with deadline        */
function RFPMediaSlot({ agency, deadline, vertical }) {
  const soon = deadline ? isClosingSoon(deadline) : false;
  return (
    <div className="osv3-rfp-media">
      {/* subtle corner dots */}
      <div className="osv3-rfp-corner-tl" aria-hidden="true" />
      <div className="osv3-rfp-corner-br" aria-hidden="true" />

      {/* document icon */}
      <div className="osv3-rfp-doc-icon" aria-hidden="true">
        <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="2" width="34" height="44" rx="3" stroke="rgba(254,253,253,0.25)" strokeWidth="1.5" />
          <path d="M4 14 H38" stroke="rgba(254,253,253,0.15)" strokeWidth="1" />
          <rect x="10" y="20" width="22" height="2" rx="1" fill="rgba(254,253,253,0.2)" />
          <rect x="10" y="26" width="18" height="2" rx="1" fill="rgba(254,253,253,0.2)" />
          <rect x="10" y="32" width="14" height="2" rx="1" fill="rgba(254,253,253,0.15)" />
          <circle cx="36" cy="46" r="10" fill="#CE4421" />
          <path d="M36 42 v8 M32 46 h8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>

      {/* agency label */}
      {agency && (
        <div className="osv3-rfp-agency-label">{agency}</div>
      )}

      {/* deadline chip */}
      {deadline && (
        <div className={`osv3-rfp-deadline-chip${soon ? ' osv3-rfp-deadline-soon' : ''}`}>
          {soon ? 'Closing Soon' : 'Deadline'}: {fmtDeadline(deadline)}
        </div>
      )}

      {/* type badge */}
      <div className="osv3-rfp-badge">OPEN</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* RFPCard — grid card renderer */
function RFPCard({ item }) {
  const link = item.apply_url || item.virtual_url;
  const soon = item.deadline ? isClosingSoon(item.deadline) : false;

  const handleApply = (e) => {
    e.stopPropagation();
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="osv3-rfp-card">
      {/* header row */}
      <div className="osv3-rfp-card-head">
        {item.author_name && (
          <span className="osv3-rfp-agency">{item.author_name}</span>
        )}
        {item.vertical && (
          <span className="osv3-rfp-type">{item.vertical}</span>
        )}
      </div>

      {/* title */}
      <h3 className="osv3-rfp-title">{item.title}</h3>

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
/* OSRFPsPage — top-level page component */
function OSRFPsPage() {
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
        .eq('category', 'rfp')
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
        (v.author_name || '').toLowerCase().includes(activeFilter.toLowerCase())
      );

  /* featured = soonest upcoming deadline */
  const featured = items[0] || null;
  const featLink = featured ? (featured.apply_url || featured.virtual_url) : null;
  const featDeadline = featured?.deadline ? fmtDeadline(featured.deadline) : null;
  const featSoon = featured?.deadline ? isClosingSoon(featured.deadline) : false;

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Opportunities Hub / RFPs"
      pageTitle={get('rfps', 'page_title', 'RFPs')}
      pageSubtitle={get('rfps', 'page_subtitle', 'Open solicitations from NASA, DoD, and state agencies seeking Arizona-based vendors and partners.')}
      addLabel="Add RFP"
      onAdd={() => navigate('/admin/listings?category=rfp')}

      /* feature */
      featuredItem={featured}
      mediaSlot={
        featured
          ? <RFPMediaSlot
              agency={featured.author_name}
              deadline={featured.deadline}
              vertical={featured.vertical}
            />
          : null
      }
      featureEyebrow={featSoon ? 'CLOSING SOON' : 'FEATURED RFP'}
      featureTitle={featured?.title || ''}
      featureHost={featured?.author_name || ''}
      featureHostTag="Agency"
      featureDesc={featured?.description
        ? featured.description.slice(0, 240) + (featured.description.length > 240 ? '...' : '')
        : ''}
      featureMeta={[
        ...(featured?.vertical ? [{ label: 'Type', value: featured.vertical }] : []),
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
                View Solicitation
              </a>
            )}
            <button
              className="osv3-mag-btn-ghost"
              type="button"
              onClick={() => navigate('/admin/listings?category=rfp')}
            >
              + Add RFP
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
        <RFPCard key={item.id || i} item={item} />
      )}
      isLoading={isLoading}
      sectionLabel="ALL RFPS"
    />
  );
}

export default OSRFPsPage;
