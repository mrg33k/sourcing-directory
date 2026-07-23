/**
 * OSReportsPage — Reports section built on OSMagazinePage engine
 *
 * Data: directory_reports WHERE tenant = 'space-rising'
 * Featured: the 2026 Arizona Space Blueprint (title match /blueprint/i)
 *   fallback: first with cover_image_url
 *   fallback: first overall
 *
 * Cover design: real cover img OR publication-cover fallback
 *   (navy bg, rust 3px top border, category eyebrow, title-as-art)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import OSMagazinePage from './OSMagazinePage.jsx';
import './osv3-magazine.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function catLabel(cat) {
  const MAP = {
    government: 'Government Affairs',
    acquisition: 'Acquisitions',
    economic: 'Market Intelligence',
    quarterly: 'Quarterly Intelligence',
  };
  return MAP[cat] || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : 'Report');
}

const PILLS = [
  { label: 'All', value: 'all' },
  { label: 'Market Intelligence', value: 'economic' },
  { label: 'Acquisitions', value: 'acquisition' },
  { label: 'Policy', value: 'government' },
  { label: 'Quarterly', value: 'quarterly' },
];

/* ------------------------------------------------------------------ */
/* ReportMediaSlot — hero LEFT panel                                   */
/* With cover: real photo + overlay + access badge.                    */
/* Without cover: publication-cover fallback (navy, rust top border,   */
/*   category eyebrow, title-as-art). Never an empty rectangle.        */
function ReportMediaSlot({ featured }) {
  const hasCover = !!(featured?.cover_image_url);
  const catStr = catLabel(featured?.category);

  if (hasCover) {
    return (
      <div className="osv3-rep-media">
        <img
          src={featured.cover_image_url}
          alt=""
          className="osv3-rep-media-img"
          aria-hidden="true"
        />
        <div className="osv3-rep-media-overlay" />
        <div className="osv3-rep-media-badge">{catStr}</div>
      </div>
    );
  }

  /* Publication-cover fallback */
  return (
    <div className="osv3-rep-media-fallback">
      <div className="osv3-rep-media-fallback-stars" aria-hidden="true" />
      {catStr && (
        <div className="osv3-rep-media-fallback-eyebrow">{catStr}</div>
      )}
      {featured?.title && (
        <div className="osv3-rep-media-fallback-title">{featured.title}</div>
      )}
      <div className="osv3-rep-media-fallback-mark">SPACE RISING INTELLIGENCE</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ReportCard — grid card renderer; links to /reports/:id              */
function ReportCard({ item, onOpen }) {
  const hasCover = !!(item.cover_image_url);
  const dateStr = fmtDate(item.published_at || item.created_at);
  const catStr = catLabel(item.category);
  const isMembersOnly = item.access && item.access !== 'free' && item.access !== 'public';

  return (
    <div
      className="osv3-rep-card"
      onClick={() => onOpen(item)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen(item)}
    >
      <div className="osv3-rep-card-cover">
        {hasCover ? (
          <img
            src={item.cover_image_url}
            alt=""
            className="osv3-rep-card-cover-img"
          />
        ) : (
          <div className="osv3-rep-card-pub-cover">
            {catStr && (
              <div className="osv3-rep-card-pub-eyebrow">{catStr}</div>
            )}
            <div className="osv3-rep-card-pub-title">{item.title}</div>
          </div>
        )}
        {isMembersOnly && (
          <div className="osv3-rep-card-badge">Members</div>
        )}
      </div>
      <div className="osv3-rep-card-body">
        <div className="osv3-rep-card-cat">{catStr}</div>
        <h3 className="osv3-rep-card-title">{item.title}</h3>
        {item.description && (
          <p className="osv3-rep-card-desc">{item.description}</p>
        )}
        <div className="osv3-rep-card-foot">
          {dateStr && <span className="osv3-rep-card-date">{dateStr}</span>}
          <span className="osv3-rep-card-cta">
            {item.file_url ? 'Download' : 'View'} &rarr;
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OSReportsPage — top-level page component                            */
function OSReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadReports = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data: tenantData } = await supabase
        .from('directory_tenants')
        .select('id')
        .eq('slug', TENANT_DB_LOOKUP_SLUG)
        .single();

      let qb = supabase
        .from('directory_reports')
        .select('*')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (tenantData?.id) qb = qb.eq('tenant_id', tenantData.id);

      const { data, error } = await qb.limit(50);
      if (!error && data) setReports(data);
    } catch (_) {
      /* silently degrade */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  /* filter by category */
  const filtered = activeFilter === 'all'
    ? reports
    : reports.filter(r => r.category === activeFilter);

  /* featured: Blueprint first, then first with cover, then first */
  const featured =
    reports.find(r => /blueprint/i.test(r.title)) ||
    reports.find(r => r.cover_image_url) ||
    reports[0] ||
    null;

  const featDate = featured ? fmtDate(featured.published_at || featured.created_at) : null;

  /* card action: open PDF if available, else navigate to detail */
  const handleCardOpen = (item) => {
    if (item.file_url) {
      window.open(item.file_url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(`/reports/${item.id}`);
    }
  };

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Intelligence Hub / Reports"
      pageTitle="Reports"
      pageSubtitle="Intelligence reports, policy briefs, and market analysis for Arizona's space economy."
      addLabel="Add Report"
      onAdd={() => navigate('/admin/reports')}

      featuredItem={featured}
      mediaSlot={featured ? <ReportMediaSlot featured={featured} /> : null}
      featureEyebrow="INTELLIGENCE REPORT"
      featureTitle={featured?.title || ''}
      featureHost={catLabel(featured?.category)}
      featureHostTag="Category"
      featureDesc={
        featured?.description
          ? featured.description.slice(0, 280) +
            (featured.description.length > 280 ? '...' : '')
          : ''
      }
      featureMeta={[
        ...(featDate ? [{ label: 'Published', value: featDate }] : []),
        ...(featured?.access && featured.access !== 'free' && featured.access !== 'public'
          ? [{ label: 'Access', value: 'Members' }]
          : [{ label: 'Access', value: 'Free' }]),
      ]}
      featureActions={
        featured ? (
          <>
            <button
              className="osv3-mag-btn-play"
              type="button"
              onClick={() => {
                if (featured.file_url) {
                  window.open(featured.file_url, '_blank', 'noopener,noreferrer');
                } else {
                  navigate(`/reports/${featured.id}`);
                }
              }}
            >
              {featured.file_url ? 'Download Report' : 'View Report'}
            </button>
            <button
              className="osv3-mag-btn-ghost"
              type="button"
              onClick={() => navigate('/admin/reports')}
            >
              + Add Report
            </button>
          </>
        ) : null
      }

      pills={PILLS}
      activeFilter={activeFilter}
      onFilter={setActiveFilter}
      items={filtered}
      cardRenderer={(item, i) => (
        <ReportCard
          key={item.id || i}
          item={item}
          onOpen={handleCardOpen}
        />
      )}
      isLoading={isLoading}
      sectionLabel="ALL REPORTS"
    />
  );
}

export default OSReportsPage;
