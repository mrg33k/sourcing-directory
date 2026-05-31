import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import V2ChipNav from './V2ChipNav.jsx';
import '../space-rising-theme-v2.css';

const VERTICAL_HERO = {
  space:         '/v2-assets/rocket-orbital.png',
  semiconductor: '/v2-assets/asteroid-close.png',
  default:       '/v2-assets/rocket-orbital.png',
};

const CATEGORY_LABEL = {
  job:         'Jobs',
  jobs:        'Jobs',
  event:       'Events',
  events:      'Events',
  marketplace: 'Marketplace',
  report:      'Reports',
  article:     'Articles',
  deal:        'Deals',
};

function formatRangeOrValue(v) {
  if (!v) return null;
  return String(v).trim();
}

function buildLogoFallback(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export default function SourcingCompanyV2() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [certs, setCerts] = useState([]);
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('directory_companies')
          .select('*')
          .eq('slug', slug)
          .eq('status', 'active')
          .single();

        if (error || !data) {
          if (!cancelled) { setNotFound(true); setLoading(false); }
          return;
        }
        if (cancelled) return;
        setCompany(data);

        const [certsRes, listingsRes, reviewsRes] = await Promise.all([
          supabase.from('directory_certifications').select('*').eq('company_id', data.id),
          supabase.from('directory_listings').select('*').eq('company_id', data.id).eq('status', 'active').order('created_at', { ascending: false }),
          supabase.from('directory_reviews').select('*').eq('company_id', data.id).eq('status', 'approved').order('created_at', { ascending: false }),
        ]);
        if (cancelled) return;
        setCerts(certsRes.data || []);
        setListings(listingsRes.data || []);
        setReviews(reviewsRes.data || []);
      } catch (err) {
        console.error('Profile fetch error:', err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  // SEO meta
  useEffect(() => {
    if (!company) return;
    document.title = `${company.name} | Space Rising`;
    const setMeta = (attr, key, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('name', 'description', company.description);
    setMeta('property', 'og:title', company.name);
    setMeta('property', 'og:description', company.description);
    if (company.logo_url) setMeta('property', 'og:image', company.logo_url);
    return () => { document.title = 'Space Rising'; };
  }, [company]);

  const listingsByCategory = useMemo(() => {
    const out = {};
    for (const l of listings) {
      const k = (l.category || 'other').toLowerCase();
      if (!out[k]) out[k] = [];
      out[k].push(l);
    }
    return out;
  }, [listings]);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null;

  if (loading) {
    return (
      <div className="srcv2-shell" data-tenant="space-rising-v2">
        <div className="srcv2-loading">
          <div className="srsv2-eyebrow">LOADING</div>
        </div>
      </div>
    );
  }

  if (notFound || !company) {
    return (
      <div className="srcv2-shell" data-tenant="space-rising-v2">
        <div className="srcv2-notfound">
          <div className="srsv2-eyebrow">NOT FOUND</div>
          <h1 className="srsv2-title">This company isn't in the directory<span className="srsv2-period">.</span></h1>
          <div className="srsv2-sub">We couldn't find <code>{slug}</code>. It may have been removed or renamed.</div>
          <Link to="/space-rising-v2" className="srsv2-cta srsv2-cta-solid">Back to the directory</Link>
        </div>
      </div>
    );
  }

  const heroBg = VERTICAL_HERO[company.vertical] || VERTICAL_HERO.default;
  const cityState = [company.city, company.state].filter(Boolean).join(', ');
  const verticalLabel = company.vertical === 'space' ? 'Space & Aerospace'
    : company.vertical === 'semiconductor' ? 'Semiconductor'
    : (company.vertical || 'Directory');

  return (
    <div className="srcv2-shell" data-tenant="space-rising-v2">
      {/* Top bar — polish-srw-cleanup (2026-05-31): unified with the rest of the
          directory pages. Back link (left) + Space Rising logo (right) as the
          very top row, above the eyebrow / company-name headline below.
          Replaces the previous wordmark + breadcrumb layout. */}
      <div className="srcv2-topbar">
        <div className="browse-hero-toprow">
          <Link to="/space-rising-v2" className="browse-back" style={{ textDecoration: 'none' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
            Back to directory
          </Link>
          <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
        </div>
      </div>

      {/* Hero */}
      <header
        className="srcv2-hero"
        style={{ '--profile-hero-bg': `url('${heroBg}')` }}
      >
        <div className="srcv2-hero-overlay" />
        <div className="srcv2-hero-inner">
          <div className="srsv2-eyebrow">{verticalLabel.toUpperCase()}{cityState ? ` · ${cityState.toUpperCase()}` : ''}</div>
          <h1 className="srcv2-name">
            {company.name}<span className="srsv2-period">.</span>
          </h1>
          {company.description && (
            <p className="srcv2-lede">{company.description}</p>
          )}
          <div className="srcv2-hero-actions">
            {company.website && (
              <a
                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="srsv2-cta srsv2-cta-solid"
              >
                Visit website
              </a>
            )}
            {company.email && (
              <a href={`mailto:${company.email}`} className="srsv2-cta srsv2-cta-line">
                Email {company.name.split(' ')[0]}
              </a>
            )}
            {/* polish-srw-cleanup: Contact CTA moved here from the topbar so
                we don't lose it when the topbar was reduced to back + logo. */}
            {(company.email || company.phone) && !company.email && (
              <a href={`tel:${company.phone}`} className="srsv2-cta srsv2-cta-line">
                Contact {company.name.split(' ')[0]}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Body — two columns on desktop, stacked on mobile */}
      <div className="srcv2-body">
        <main className="srcv2-main">
          {company.description && (
            <Section eyebrow="ABOUT" title="What they do">
              <p className="srcv2-paragraph">{company.description}</p>
            </Section>
          )}

          {certs.length > 0 && (
            <Section eyebrow="CERTIFICATIONS" title={`${certs.length} on file`}>
              <div className="srcv2-cert-grid">
                {certs.map(c => (
                  <div key={c.id} className="srcv2-cert-tile">
                    <div className="srcv2-cert-name">{c.cert_name}</div>
                    {c.issuer && <div className="srcv2-cert-issuer">{c.issuer}</div>}
                    {c.valid_through && (
                      <div className="srcv2-cert-meta">VALID THRU · {c.valid_through}</div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {Object.keys(listingsByCategory).length > 0 && Object.entries(listingsByCategory).map(([cat, items]) => (
            <Section
              key={cat}
              eyebrow={(CATEGORY_LABEL[cat] || cat).toUpperCase()}
              title={`${items.length} active`}
            >
              <ul className="srcv2-listing-list">
                {items.map(l => (
                  <li key={l.id} className="srcv2-listing">
                    <div className="srcv2-listing-head">
                      <div className="srcv2-listing-title">{l.title}</div>
                      {l.location && <div className="srcv2-listing-loc">{l.location}</div>}
                    </div>
                    {l.description && (
                      <div className="srcv2-listing-body">{l.description}</div>
                    )}
                    <div className="srcv2-listing-meta">
                      {l.salary_range && <span>{l.salary_range}</span>}
                      {l.employment_type && <span>· {l.employment_type}</span>}
                      {l.created_at && <span>· POSTED {new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ))}

          {reviews.length > 0 && (
            <Section
              eyebrow="REVIEWS"
              title={`${avgRating} from ${reviews.length} ${reviews.length === 1 ? 'voice' : 'voices'}`}
            >
              <ul className="srcv2-review-list">
                {reviews.slice(0, 5).map(r => (
                  <li key={r.id} className="srcv2-review">
                    <div className="srcv2-review-rating">
                      {'★'.repeat(r.rating || 0)}{'☆'.repeat(5 - (r.rating || 0))}
                    </div>
                    {r.title && <div className="srcv2-review-title">{r.title}</div>}
                    {r.body && <div className="srcv2-review-body">{r.body}</div>}
                    <div className="srcv2-review-meta">
                      {r.name || 'Anonymous'}
                      {r.created_at && ` · ${new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}`}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {certs.length === 0 && listings.length === 0 && reviews.length === 0 && (
            <Section eyebrow="ACTIVITY" title="Just listed">
              <div className="srcv2-empty">
                {company.name} is in the directory but hasn't published certifications, listings, or reviews yet. {company.website && <>The team can be reached at <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer">their website</a>.</>}
              </div>
            </Section>
          )}
        </main>

        <aside className="srcv2-aside">
          <div className="srcv2-aside-card">
            <div className="srsv2-eyebrow">FACTS</div>
            <dl className="srcv2-facts">
              {company.year_founded && <Fact label="FOUNDED" value={company.year_founded} />}
              {company.employee_count && <Fact label="TEAM" value={`${formatRangeOrValue(company.employee_count)} PEOPLE`} />}
              {cityState && <Fact label="LOCATION" value={cityState.toUpperCase()} />}
              <Fact label="VERTICAL" value={verticalLabel.toUpperCase()} />
              {company.membership_tier && (
                <Fact label="MEMBER" value={(company.membership_tier === 'paid' ? 'PREMIUM' : company.membership_tier).toUpperCase()} />
              )}
            </dl>
          </div>

          {(company.phone || company.email || company.website) && (
            <div className="srcv2-aside-card">
              <div className="srsv2-eyebrow">CONTACT</div>
              <ul className="srcv2-contact-list">
                {company.phone && (
                  <li>
                    <span className="srcv2-contact-label">PHONE</span>
                    <a href={`tel:${company.phone}`} className="srcv2-contact-value">{company.phone}</a>
                  </li>
                )}
                {company.email && (
                  <li>
                    <span className="srcv2-contact-label">EMAIL</span>
                    <a href={`mailto:${company.email}`} className="srcv2-contact-value">{company.email}</a>
                  </li>
                )}
                {company.website && (
                  <li>
                    <span className="srcv2-contact-label">WEB</span>
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="srcv2-contact-value"
                    >
                      {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="srcv2-aside-card srcv2-aside-back">
            <div className="srsv2-eyebrow">DIRECTORY</div>
            <div className="srcv2-aside-back-copy">
              Looking for similar companies in {verticalLabel.toLowerCase()}? Walk the room.
            </div>
            <Link to="/space-rising-v2" className="srsv2-cta srsv2-cta-line">All companies</Link>
          </div>
        </aside>
      </div>

      <footer className="srcv2-footer">
        <V2ChipNav active="companies" />
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

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
