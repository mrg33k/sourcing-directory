import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import './osv3-detail.css';

// Detail page for a single directory_listings row (a job, event, or marketplace
// item). One component, three entry routes — the `kind` prop only drives labels
// and which facts are shown. Built 2026-06-05 so listing cards open a real page
// instead of bouncing to the directory (no matching detail route existed before).
// Reskinned 2026-07-06 into v3 shell as light article-style detail view.

const KIND_META = {
  job:         { backLabel: 'Careers',     backPath: '/jobs',        tabLabel: 'Open Positions' },
  event:       { backLabel: 'Community',   backPath: '/events',      tabLabel: 'Events' },
  marketplace: { backLabel: 'Marketplace', backPath: '/marketplace', tabLabel: 'Browse' },
  article:     { backLabel: 'Intelligence', backPath: '/articles',   tabLabel: 'Articles' },
};

function fmtDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function salaryText(l) {
  const lo = l.salary_min, hi = l.salary_max;
  const f = (n) => `$${Number(n).toLocaleString()}`;
  if (lo && hi) return `${f(lo)} – ${f(hi)}`;
  if (lo) return `From ${f(lo)}`;
  if (hi) return `Up to ${f(hi)}`;
  return null;
}

function externalHref(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : `https://${url}`;
}

export default function SourcingListingV2({ kind = 'job' }) {
  const { id } = useParams();
  const meta = KIND_META[kind] || KIND_META.job;

  const [listing, setListing] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('directory_listings')
          .select('*')
          .eq('id', id)
          .single();
        if (error || !data) {
          if (!cancelled) { setNotFound(true); setLoading(false); }
          return;
        }
        if (cancelled) return;
        setListing(data);
        if (data.company_id) {
          const { data: co } = await supabase
            .from('directory_companies')
            .select('id, name, slug, website, email, vertical, city, state, logo_url')
            .eq('id', data.company_id)
            .single();
          if (!cancelled) setCompany(co || null);
        }
      } catch (err) {
        console.error('Listing fetch error:', err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!listing) return;
    document.title = `${listing.title || 'Listing'} | Space Rising`;
    return () => { document.title = 'Space Rising'; };
  }, [listing]);

  if (loading) {
    return (
      <div className="osv3-detail-page">
        <div className="osv3-detail-loading">Loading...</div>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="osv3-detail-page">
        <div className="osv3-detail-notfound">
          <h2 className="osv3-detail-notfound-title">This listing isn't available</h2>
          <p className="osv3-detail-notfound-text">It may have been filled, expired, or removed.</p>
          <Link to={meta.backPath} className="osv3-detail-back-btn">← Back to {meta.backLabel}</Link>
        </div>
      </div>
    );
  }

  const loc = listing.remote
    ? 'Remote'
    : listing.location || listing.event_location || [company?.city, company?.state].filter(Boolean).join(', ');
  const posted = fmtDate(listing.created_at);
  const eventDate = fmtDate(listing.event_date);
  const salary = salaryText(listing);
  const ctaUrl = externalHref(listing.virtual_url);
  const companyWebsite = externalHref(company?.website);

  // Determine primary CTA text
  let ctaText = 'View';
  if (kind === 'event') ctaText = 'Register';
  else if (kind === 'marketplace') ctaText = 'Contact';
  else ctaText = 'Apply';

  return (
    <div className="osv3-detail-page">
      <div className="osv3-detail-header">
        {/* Back link */}
        <Link to={meta.backPath} className="osv3-detail-back-btn">← Back to {meta.backLabel}</Link>

        {/* Title */}
        <h2 className="osv3-detail-title">{listing.title || 'Untitled'}</h2>

        {/* Company chip for non-events */}
        {kind !== 'event' && company?.slug && (
          <Link to={`/company/${company.slug}`} className="osv3-detail-company-chip">
            {company.logo_url && <img src={company.logo_url} alt={company.name} className="osv3-detail-company-logo" />}
            <span className="osv3-detail-company-name">{company.name}</span>
          </Link>
        )}

        {/* Meta pills */}
        <div className="osv3-detail-meta">
          {kind === 'job' && (
            <>
              {loc && <span className="osv3-detail-meta-pill">{loc}</span>}
              {salary && <span className="osv3-detail-meta-pill">{salary}</span>}
              {listing.job_type && <span className="osv3-detail-meta-pill">{String(listing.job_type).replace('-', ' ')}</span>}
              {listing.remote && <span className="osv3-detail-meta-pill">Remote</span>}
            </>
          )}
          {kind === 'event' && (
            <>
              {eventDate && <span className="osv3-detail-meta-pill">{eventDate}</span>}
              {loc && <span className="osv3-detail-meta-pill">{loc}</span>}
              {listing.organizer && <span className="osv3-detail-meta-pill">{listing.organizer}</span>}
            </>
          )}
          {kind === 'marketplace' && (
            <>
              {listing.price && <span className="osv3-detail-meta-pill">{listing.price}</span>}
              {listing.condition && <span className="osv3-detail-meta-pill">{listing.condition}</span>}
            </>
          )}
          {posted && <span className="osv3-detail-meta-pill">{posted}</span>}
        </div>
      </div>

      {/* Description */}
      <div className="osv3-detail-body">
        {listing.description && (
          <p className="osv3-detail-description">{listing.description}</p>
        )}

        {/* Primary CTA */}
        <div className="osv3-detail-actions">
          {ctaUrl && (
            <a href={ctaUrl} target="_blank" rel="noopener noreferrer" className="osv3-detail-cta-primary">
              {ctaText}
            </a>
          )}
          {!ctaUrl && company?.email && (
            <a href={`mailto:${company.email}`} className="osv3-detail-cta-primary">
              {ctaText}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
