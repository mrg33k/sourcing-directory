import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import V2ChipNav from './V2ChipNav.jsx';
import '../space-rising-theme-v2.css';

// Detail page for a single directory_listings row (a job, event, or marketplace
// item). One component, three entry routes — the `kind` prop only drives labels
// and which facts are shown. Built 2026-06-05 so listing cards open a real page
// instead of bouncing to the directory (no matching detail route existed before).

const KIND_META = {
  job:         { eyebrow: 'JOB',         backLabel: 'jobs',        backPath: '/space-rising-v2/jobs',        hero: '/v2-assets/rocket-orbital.png' },
  event:       { eyebrow: 'EVENT',       backLabel: 'events',      backPath: '/space-rising-v2/events',      hero: '/v2-assets/rocket-orbital.png' },
  marketplace: { eyebrow: 'MARKETPLACE', backLabel: 'marketplace', backPath: '/space-rising-v2/marketplace', hero: '/v2-assets/asteroid-close.png' },
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
    document.title = `${listing.title || meta.eyebrow} | Space Rising`;
    return () => { document.title = 'Space Rising'; };
  }, [listing, meta.eyebrow]);

  if (loading) {
    return (
      <div className="srcv2-shell" data-tenant="space-rising-v2">
        <div className="srcv2-loading"><div className="srsv2-eyebrow">LOADING</div></div>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="srcv2-shell" data-tenant="space-rising-v2">
        <div className="srcv2-notfound">
          <div className="srsv2-eyebrow">NOT FOUND</div>
          <h1 className="srsv2-title">This listing isn't available<span className="srsv2-period">.</span></h1>
          <div className="srsv2-sub">It may have been filled, expired, or removed.</div>
          <Link to={meta.backPath} className="srsv2-cta srsv2-cta-solid">Back to {meta.backLabel}</Link>
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
  const eyebrowBits = [meta.eyebrow, company?.name, loc].filter(Boolean).join(' · ');
  const ctaUrl = externalHref(listing.virtual_url);
  const companyWebsite = externalHref(company?.website);

  return (
    <div className="srcv2-shell" data-tenant="space-rising-v2">
      <div className="srcv2-topbar">
        <div className="browse-hero-toprow">
          <Link to={meta.backPath} className="browse-back" style={{ textDecoration: 'none' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
            Back to {meta.backLabel}
          </Link>
          <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
        </div>
      </div>

      <header className="srcv2-hero" style={{ '--profile-hero-bg': `url('${meta.hero}')` }}>
        <div className="srcv2-hero-overlay" />
        <div className="srcv2-hero-inner">
          <div className="srsv2-eyebrow">{eyebrowBits.toUpperCase()}</div>
          <h1 className="srcv2-name">{listing.title || 'Untitled'}<span className="srsv2-period">.</span></h1>
          <div className="srcv2-hero-actions">
            {ctaUrl && (
              <a href={ctaUrl} target="_blank" rel="noopener noreferrer" className="srsv2-cta srsv2-cta-solid">
                {kind === 'event' ? 'Event details' : kind === 'marketplace' ? 'View listing' : 'Apply / Learn more'}
              </a>
            )}
            {!ctaUrl && company?.email && (
              <a href={`mailto:${company.email}`} className="srsv2-cta srsv2-cta-solid">
                {kind === 'marketplace' ? 'Contact seller' : kind === 'event' ? 'Contact organizer' : 'Apply / Contact'}
              </a>
            )}
            {company?.slug && (
              <Link to={`/space-rising-v2/${company.slug}`} className="srsv2-cta srsv2-cta-line">
                View {company.name}
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="srcv2-body">
        <main className="srcv2-main">
          {listing.description && (
            <Section eyebrow="DETAILS" title="About this listing">
              <p className="srcv2-paragraph" style={{ whiteSpace: 'pre-wrap' }}>{listing.description}</p>
            </Section>
          )}

          <Section eyebrow="AT A GLANCE" title="Key facts">
            <dl className="srcv2-facts">
              {company?.name && <Fact label="Posted by" value={company.slug
                ? <Link to={`/space-rising-v2/${company.slug}`} style={{ color: 'inherit' }}>{company.name}</Link>
                : company.name} />}
              {loc && <Fact label="Location" value={loc} />}
              {kind === 'job' && listing.job_type && <Fact label="Type" value={String(listing.job_type).replace('-', ' ')} />}
              {kind === 'job' && salary && <Fact label="Compensation" value={salary} />}
              {kind === 'job' && listing.remote && <Fact label="Remote" value="Yes" />}
              {kind === 'event' && eventDate && <Fact label="Date" value={eventDate} />}
              {kind === 'event' && listing.event_type && <Fact label="Format" value={listing.event_type} />}
              {kind === 'event' && listing.organizer && <Fact label="Organizer" value={listing.organizer} />}
              {kind === 'marketplace' && listing.price && <Fact label="Price" value={listing.price} />}
              {kind === 'marketplace' && listing.condition && <Fact label="Condition" value={listing.condition} />}
              {posted && <Fact label="Posted" value={posted} />}
            </dl>
          </Section>

          {(companyWebsite || company?.email) && (
            <Section eyebrow="CONTACT" title={company?.name || 'Get in touch'}>
              <div className="srcv2-hero-actions" style={{ marginTop: 0 }}>
                {companyWebsite && (
                  <a href={companyWebsite} target="_blank" rel="noopener noreferrer" className="srsv2-cta srsv2-cta-line">Visit website</a>
                )}
                {company?.email && (
                  <a href={`mailto:${company.email}`} className="srsv2-cta srsv2-cta-line">Email {String(company.name || '').split(' ')[0] || 'them'}</a>
                )}
              </div>
            </Section>
          )}
        </main>
      </div>

      <V2ChipNav />
    </div>
  );
}

function Section({ eyebrow, title, children }) {
  return (
    <section className="srcv2-section">
      <header className="srcv2-section-head">
        <div className="srsv2-eyebrow">{eyebrow}</div>
        <h2 className="srcv2-section-title">{title}<span className="srsv2-period">.</span></h2>
      </header>
      <div className="srcv2-section-body">{children}</div>
    </section>
  );
}

function Fact({ label, value }) {
  return (
    <div className="srcv2-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
