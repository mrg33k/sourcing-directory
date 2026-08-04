/**
 * OSJobsPage — Jobs section built on OSMagazinePage engine
 *
 * Data: directory_listings WHERE category = 'job', tenant = 'space-rising'
 * Column map: title, author_name (contact), image_url (company image, now rendered),
 *   location, job_type, salary_min/max, remote, vertical, company_id
 *
 * FIX: image_url was saved by admin but never rendered — wired here.
 *   Featured hero shows image_url (or company logo_url) as cover + logo overlay.
 *   Job cards show image_url as card background + logo in center (navy fallback if none).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import OSMagazinePage from './OSMagazinePage.jsx';
import './osv3-magazine.css';
import { useSiteContentBySlug } from '../hooks/useSiteContent.js';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function fmtSalary(lo, hi) {
  const f = (n) => `$${Math.round(Number(n) / 1000)}k`;
  if (lo && hi) return `${f(lo)} – ${f(hi)}`;
  if (lo) return `${f(lo)}+`;
  if (hi) return `Up to ${f(hi)}`;
  return null;
}

function initials(title = '') {
  /* filter out non-letter-starting tokens ("(Arizona)", "—", etc.) */
  const parts = title.trim().split(/\s+/).filter(w => /^[A-Za-z]/.test(w));
  if (parts.length === 0) return 'JO';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  /* take first word + second word (not last) to avoid cross-word II patterns */
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const PILLS = [
  { label: 'All', value: 'all' },
  { label: 'Engineering', value: 'Engineering' },
  { label: 'Operations', value: 'Operations' },
  { label: 'Business', value: 'Business' },
  { label: 'Internship', value: 'Internship' },
];

/* ------------------------------------------------------------------ */
/* JobMediaSlot — hero LEFT panel                                        */
/* Design: navy gradient + starfield + rust accent stripe + monogram.   */
/* NO gray box, NO media controls — this is a job listing, not audio.  */
function JobMediaSlot({ featured }) {
  const hasImg = !!(featured?.image_url);
  const company = featured?._company;
  const logoSrc = company?.logo_url || null;
  const companyName = company?.name || featured?.author_name || '';
  /* Use company name for monogram: company initials are more diverse than
     job title initials and won't produce "II"-style vertical-bar ambiguity.
     Fall back to first two chars of first word when no company name. */
  const jobInits = companyName
    ? initials(companyName)
    : (featured?.title || 'JO').trim().split(/\s+/).filter(w => /^[A-Za-z]/.test(w))[0]?.slice(0, 2).toUpperCase() || 'JO';

  return (
    <div className="osv3-job-media">
      {hasImg && (
        <img src={featured.image_url} alt="" className="osv3-job-media-img" aria-hidden="true" />
      )}
      {/* starfield — the slot needs stars to feel alive */}
      <div className="osv3-job-media-stars" aria-hidden="true" />
      <div className="osv3-job-media-overlay" />
      {/* left rust accent stripe (no media player connotation) */}
      <div className="osv3-job-media-stripe" aria-hidden="true" />

      <div className="osv3-job-media-inner">
        <div className="osv3-job-media-label">FEATURED ROLE</div>
        {logoSrc ? (
          <img src={logoSrc} alt={companyName} className="osv3-job-media-logo" />
        ) : (
          /* large ghost monogram — type-only, no box, cannot read as media control */
          <div className="osv3-job-media-monogram" aria-hidden="true">{jobInits}</div>
        )}
        {featured?.title && (
          <div className="osv3-job-media-title">{featured.title}</div>
        )}
        {companyName && (
          <div className="osv3-job-media-company">{companyName}</div>
        )}
      </div>

      {/* bottom rust rule — editorial accent, no media-player connotation */}
      <div className="osv3-job-media-rule" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* JobCard — grid card renderer                                          */
function JobCard({ item }) {
  const link = item.virtual_url || item.apply_url;
  const salary = fmtSalary(item.salary_min, item.salary_max);
  const loc = item.remote ? 'Remote' : item.location;
  const company = item._company;
  const logoSrc = company?.logo_url || null;
  const jobInits = initials(item.title || 'J');

  const handleClick = () => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="osv3-job-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
    >
      <div className="osv3-job-card-cover">
        {item.image_url && (
          <img src={item.image_url} alt="" className="osv3-job-card-cover-img" aria-hidden="true" />
        )}
        {logoSrc ? (
          <img src={logoSrc} alt={company?.name || ''} className="osv3-job-card-logo" />
        ) : (
          <div className="osv3-job-card-logo-init">{jobInits}</div>
        )}
        {item.vertical && (
          <div className="osv3-job-card-vertical">{item.vertical}</div>
        )}
      </div>
      <div className="osv3-job-card-body">
        {(company?.name || item.author_name) && (
          <div className="osv3-job-card-company">{company?.name || item.author_name}</div>
        )}
        <h3 className="osv3-job-card-title">{item.title}</h3>
        <div className="osv3-job-card-chips">
          {loc && <span className="osv3-job-card-chip">{loc}</span>}
          {item.job_type && (
            <span className="osv3-job-card-chip">{String(item.job_type).replace('-', ' ')}</span>
          )}
        </div>
        <div className="osv3-job-card-foot">
          <span className="osv3-job-card-salary">{salary || fmtDate(item.created_at)}</span>
          {link && <span className="osv3-job-card-apply">Apply &rarr;</span>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OSJobsPage — top-level page component                                */
function OSJobsPage() {
  const navigate = useNavigate();
  const { get } = useSiteContentBySlug(TENANT_DB_LOOKUP_SLUG);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadJobs = useCallback(async () => {
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
        .eq('category', 'job')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (tenantData?.id) qb = qb.eq('tenant_id', tenantData.id);

      const { data, error } = await qb.limit(50);
      if (!error && data) {
        /* enrich with company info for logo_url */
        const companyIds = [
          ...new Set(data.filter(j => j.company_id).map(j => j.company_id)),
        ];
        let companyMap = {};
        if (companyIds.length > 0) {
          const { data: companies } = await supabase
            .from('directory_companies')
            .select('id, name, slug, logo_url')
            .in('id', companyIds);
          if (companies) companies.forEach(c => { companyMap[c.id] = c; });
        }
        setJobs(data.map(j => ({
          ...j,
          _company: j.company_id ? companyMap[j.company_id] : null,
        })));
      }
    } catch (_) {
      /* silently degrade */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  /* filter by vertical */
  const filtered = activeFilter === 'all'
    ? jobs
    : jobs.filter(j =>
        (j.vertical || '').toLowerCase().includes(activeFilter.toLowerCase())
      );

  /* featured = first job with image_url set, else first overall */
  const featured = jobs.find(j => j.image_url) || jobs[0] || null;

  const featLink = featured ? (featured.virtual_url || featured.apply_url) : null;
  const featSalary = featured ? fmtSalary(featured.salary_min, featured.salary_max) : null;
  const featCompany = featured?._company;

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Careers / Open Positions"
      pageTitle={get('jobs', 'page_title', 'Jobs')}
      pageSubtitle={get('jobs', 'page_subtitle', 'Open positions across Arizona\'s space economy. From propulsion to policy.')}
      addLabel="Post a Job"
      onAdd={() => navigate('/jobs/post')}

      featuredItem={featured}
      mediaSlot={featured ? <JobMediaSlot featured={featured} /> : null}
      featureEyebrow="CAREERS · OPEN POSITIONS"
      featureTitle={featured?.title || ''}
      featureHost={featCompany?.name || featured?.author_name || ''}
      featureHostTag="Company"
      featureDesc={
        featured?.description
          ? featured.description.slice(0, 220) +
            (featured.description.length > 220 ? '...' : '')
          : ''
      }
      featureMeta={[
        ...(featured?.location
          ? [{ label: 'Location', value: featured.remote ? 'Remote' : featured.location }]
          : []),
        ...(featSalary ? [{ label: 'Salary', value: featSalary }] : []),
        ...(featured?.job_type
          ? [{ label: 'Type', value: featured.job_type }]
          : []),
        ...(featured?.vertical
          ? [{ label: 'Track', value: featured.vertical }]
          : []),
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
                Apply Now
              </a>
            )}
            <button
              className="osv3-mag-btn-ghost"
              type="button"
              onClick={() => navigate('/jobs/post')}
            >
              + Post a Job
            </button>
          </>
        ) : null
      }

      pills={PILLS}
      activeFilter={activeFilter}
      onFilter={setActiveFilter}
      items={filtered}
      cardRenderer={(item, i) => (
        <JobCard key={item.id || i} item={item} index={i} />
      )}
      isLoading={isLoading}
      sectionLabel="OPEN POSITIONS"
    />
  );
}

export default OSJobsPage;
