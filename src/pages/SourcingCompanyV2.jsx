import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

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
      <div className="osv3" style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--v3-muted)' }}>Loading company profile…</div>
      </div>
    );
  }

  if (notFound || !company) {
    return (
      <div className="osv3" style={{ padding: '40px 24px', maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{
          fontSize: 'var(--v3-h2-font-size)',
          fontWeight: 'var(--v3-h2-font-weight)',
          color: 'var(--v3-ink-primary)',
          marginBottom: 16,
        }}>
          Company not found
        </h1>
        <p style={{ color: 'var(--v3-muted)', marginBottom: 24, fontSize: 14 }}>
          We couldn't find <code>{slug}</code>. It may have been removed or renamed.
        </p>
        <Link to="/directory" style={{
          display: 'inline-block',
          padding: '10px 16px',
          backgroundColor: 'var(--v3-accent)',
          color: 'white',
          textDecoration: 'none',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
        }}>
          Back to directory
        </Link>
      </div>
    );
  }

  const cityState = [company.city, company.state].filter(Boolean).join(', ');
  const verticalLabel = company.vertical === 'space' ? 'Space & Aerospace'
    : company.vertical === 'semiconductor' ? 'Semiconductor'
    : (company.vertical || 'Directory');

  return (
    <div className="osv3" style={{ padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          background: 'white',
          border: '1px solid var(--v3-border)',
          borderRadius: 8,
          padding: '32px 24px',
          marginBottom: 32,
        }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {company.logo_url && (
              <img
                src={company.logo_url}
                alt=""
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 8,
                  objectFit: 'cover',
                  border: '1px solid var(--v3-border)',
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontSize: 32,
                fontWeight: 700,
                color: 'var(--v3-ink-primary)',
                margin: '0 0 8px 0',
              }}>
                {company.name}
              </h1>
              <p style={{
                fontSize: 16,
                color: 'var(--v3-muted)',
                margin: 0,
                marginBottom: 16,
              }}>
                {company.description}
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {verticalLabel && (
                  <span style={{
                    display: 'inline-block',
                    background: 'var(--v3-panel-bg)',
                    color: 'var(--v3-ink-secondary)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                  }}>
                    {verticalLabel}
                  </span>
                )}
                {cityState && (
                  <span style={{
                    display: 'inline-block',
                    background: 'var(--v3-panel-bg)',
                    color: 'var(--v3-ink-secondary)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                  }}>
                    {cityState}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {company.website && (
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'var(--v3-accent)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Visit website
                </a>
              )}
              {company.email && (
                <a
                  href={`mailto:${company.email}`}
                  style={{
                    padding: '10px 16px',
                    border: '1px solid var(--v3-border)',
                    backgroundColor: 'white',
                    color: 'var(--v3-accent)',
                    textDecoration: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Email
                </a>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
          <main>
            {company.description && (
              <Section eyebrow="ABOUT" title="What they do">
                <p style={{ color: 'var(--v3-ink-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {company.description}
                </p>
              </Section>
            )}

            {certs.length > 0 && (
              <Section eyebrow="CERTIFICATIONS" title={`${certs.length} on file`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {certs.map(c => (
                    <div
                      key={c.id}
                      style={{
                        background: 'white',
                        border: '1px solid var(--v3-border)',
                        borderRadius: 8,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v3-ink-primary)', marginBottom: 4 }}>
                        {c.cert_name}
                      </div>
                      {c.issuer && (
                        <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginBottom: 8 }}>
                          {c.issuer}
                        </div>
                      )}
                      {c.valid_through && (
                        <div style={{ fontSize: 11, color: 'var(--v3-muted)' }}>
                          VALID THRU: {c.valid_through}
                        </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {items.map(l => (
                    <div
                      key={l.id}
                      style={{
                        background: 'white',
                        border: '1px solid var(--v3-border)',
                        borderRadius: 8,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--v3-ink-primary)', marginBottom: 4 }}>
                        {l.title}
                      </div>
                      {l.location && (
                        <div style={{ fontSize: 13, color: 'var(--v3-muted)', marginBottom: 8 }}>
                          {l.location}
                        </div>
                      )}
                      {l.description && (
                        <p style={{ fontSize: 14, color: 'var(--v3-ink-secondary)', lineHeight: 1.6, margin: '0 0 12px 0' }}>
                          {l.description}
                        </p>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--v3-muted)', display: 'flex', gap: 16 }}>
                        {l.salary_range && <span>{l.salary_range}</span>}
                        {l.employment_type && <span>{l.employment_type}</span>}
                        {l.created_at && <span>POSTED {new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ))}

            {reviews.length > 0 && (
              <Section
                eyebrow="REVIEWS"
                title={`${avgRating} from ${reviews.length} ${reviews.length === 1 ? 'voice' : 'voices'}`}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {reviews.slice(0, 5).map(r => (
                    <div
                      key={r.id}
                      style={{
                        background: 'white',
                        border: '1px solid var(--v3-border)',
                        borderRadius: 8,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 14, marginBottom: 8, color: 'var(--v3-accent)' }}>
                        {'★'.repeat(r.rating || 0)}{'☆'.repeat(5 - (r.rating || 0))}
                      </div>
                      {r.title && (
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v3-ink-primary)', marginBottom: 4 }}>
                          {r.title}
                        </div>
                      )}
                      {r.body && (
                        <p style={{ fontSize: 13, color: 'var(--v3-ink-secondary)', lineHeight: 1.6, margin: '0 0 8px 0' }}>
                          {r.body}
                        </p>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--v3-muted)' }}>
                        {r.name || 'Anonymous'} — {r.created_at && new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {certs.length === 0 && listings.length === 0 && reviews.length === 0 && (
              <Section eyebrow="ACTIVITY" title="Just listed">
                <div style={{ color: 'var(--v3-muted)', fontSize: 14, lineHeight: 1.6 }}>
                  {company.name} is in the directory but hasn't published certifications, listings, or reviews yet.{' '}
                  {company.website && (
                    <>
                      The team can be reached at{' '}
                      <a
                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--v3-link)' }}
                      >
                        their website
                      </a>
                      .
                    </>
                  )}
                </div>
              </Section>
            )}
          </main>

          <aside>
            <div style={{
              background: 'white',
              border: '1px solid var(--v3-border)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--v3-muted)',
                marginBottom: 16,
              }}>
                Facts
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {company.year_founded && <Fact label="FOUNDED" value={company.year_founded} />}
                {company.employee_count && <Fact label="TEAM" value={`${formatRangeOrValue(company.employee_count)} people`} />}
                {cityState && <Fact label="LOCATION" value={cityState} />}
                <Fact label="VERTICAL" value={verticalLabel} />
                {company.membership_tier && (
                  <Fact label="MEMBER" value={company.membership_tier === 'paid' ? 'Premium' : company.membership_tier} />
                )}
              </div>
            </div>

            {(company.phone || company.email || company.website) && (
              <div style={{
                background: 'white',
                border: '1px solid var(--v3-border)',
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
              }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--v3-muted)',
                  marginBottom: 16,
                }}>
                  Contact
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {company.phone && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--v3-muted)', marginBottom: 4 }}>PHONE</div>
                      <a href={`tel:${company.phone}`} style={{ color: 'var(--v3-link)', fontSize: 14 }}>
                        {company.phone}
                      </a>
                    </div>
                  )}
                  {company.email && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--v3-muted)', marginBottom: 4 }}>EMAIL</div>
                      <a href={`mailto:${company.email}`} style={{ color: 'var(--v3-link)', fontSize: 14 }}>
                        {company.email}
                      </a>
                    </div>
                  )}
                  {company.website && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--v3-muted)', marginBottom: 4 }}>WEB</div>
                      <a
                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--v3-link)', fontSize: 14 }}
                      >
                        {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Section({ eyebrow, title, children }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--v3-muted)',
        marginBottom: 12,
      }}>
        {eyebrow}
      </div>
      <h2 style={{
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--v3-ink-primary)',
        margin: '0 0 16px 0',
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--v3-muted)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--v3-ink-primary)', fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}
