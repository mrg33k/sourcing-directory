// SourcingJobsV2.jsx (v3 reskin)
// Space OS v3 Jobs/Careers page — renders inside OSLayoutV3 shell
// Replaces old dark hero + V2ChipNav with clean v3 header + list-item cards

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';

// Space Rising tenant for filtering
const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function formatSalary(min, max, jobType) {
  if (!min && !max) return null;
  const unit = jobType === 'contract' ? '/hr' : '/yr';
  const fmt = (n) =>
    jobType === 'contract' ? `$${n}` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)}–${fmt(max)}${unit}`;
  if (min) return `${fmt(min)}+${unit}`;
  return `Up to ${fmt(max)}${unit}`;
}

function postedAgo(created_at) {
  if (!created_at) return '';
  const days = Math.floor((Date.now() - new Date(created_at)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d';
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

function SourcingJobsV2Inner() {
  useSRWTitle('Careers | Space OS');
  const navigate = useNavigate();

  const [tenant, setTenant] = useState(null);
  const [listings, setListings] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [bookmarks, setBookmarks] = useState(new Set());

  // Load SR tenant row once (for tenant_id filter and hero subtitle)
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from('directory_tenants')
        .select('*')
        .eq('slug', TENANT_DB_LOOKUP_SLUG)
        .single();
      if (data) setTenant(data);
    })();
  }, []);

  // Load active jobs, scoped to the SR tenant when it's loaded
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let qb = supabase
          .from('directory_listings')
          .select('*')
          .eq('category', 'job')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
        const { data, error } = await qb.limit(100);
        if (error) throw error;
        if (cancelled) return;
        setListings(data || []);

        if (data && data.length > 0) {
          const companyIds = [...new Set(data.map((l) => l.company_id).filter(Boolean))];
          if (companyIds.length > 0) {
            const { data: compData } = await supabase
              .from('directory_companies')
              .select('*')
              .in('id', companyIds);
            const map = {};
            (compData || []).forEach((c) => {
              map[c.id] = c;
            });
            if (!cancelled) setCompanies(map);
          }
        } else {
          if (!cancelled) setCompanies({});
        }
      } catch (err) {
        console.error('JobsV2 fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  // R4l-style live fuzzy filter — instant as you type, AND-semantics on words
  const filteredListings = useMemo(() => {
    if (!searchInput.trim()) return listings;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return listings.filter((l) => {
      const company = companies[l.company_id];
      const haystack = [
        l.title,
        l.description,
        l.location,
        l.vertical,
        l.job_type,
        company?.name,
        company?.city,
        company?.state,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [listings, companies, searchInput]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{
              fontSize: 'var(--v3-h2-font-size)',
              fontWeight: 'var(--v3-h2-font-weight)',
              color: 'var(--v3-ink-primary)',
              marginBottom: '8px',
              lineHeight: 'var(--v3-h2-line-height)',
            }}>
              Careers
            </h2>
            <p style={{
              fontSize: 'var(--v3-body-sm-font-size)',
              color: 'var(--v3-muted)',
              lineHeight: 'var(--v3-body-sm-line-height)',
              maxWidth: '600px',
            }}>
              Discover opportunities across Arizona's space ecosystem. Explore roles at launch suppliers, defense contractors, and R&D firms.
            </p>
          </div>
          <Link
            to="/jobs/post"
            style={{
              padding: '10px 16px',
              backgroundColor: 'var(--v3-accent)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: 'var(--v3-body-sm-font-size)',
              fontWeight: 'var(--v3-font-weight-semibold)',
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color var(--v3-transition-fast)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b83916'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--v3-accent)'}
          >
            <span style={{ fontSize: '16px' }}>+</span> Post a Job
          </Link>
        </div>

        {/* Search & Filter */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            position: 'relative',
          }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ position: 'absolute', left: '12px', color: 'var(--v3-muted)' }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title, company, or location..."
              aria-label="Search jobs"
              autoComplete="off"
              spellCheck="false"
              style={{
                flex: 1,
                maxWidth: '500px',
                padding: '10px 16px 10px 40px',
                border: '1px solid var(--v3-border)',
                borderRadius: '6px',
                fontSize: 'var(--v3-body-sm-font-size)',
                fontFamily: 'var(--v3-font-family-base)',
                color: 'var(--v3-ink-secondary)',
                transition: 'border-color var(--v3-transition-fast)',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--v3-accent)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--v3-border)'}
            />
          </div>
        </div>

        {/* No Supabase Warning */}
        {!supabase && (
          <div style={{
            padding: '16px',
            border: '1px solid var(--v3-border)',
            background: 'var(--v3-panel-bg)',
            borderRadius: '8px',
            color: 'var(--v3-muted)',
            fontSize: 'var(--v3-body-sm-font-size)',
            textAlign: 'center',
            marginBottom: '24px',
          }}>
            Supabase not configured — copy your env keys to .env.local
          </div>
        )}

        {/* Job Listings */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {loading && supabase && (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  style={{
                    height: '84px',
                    borderRadius: '6px',
                    background: 'var(--v3-panel-bg)',
                    border: '1px solid var(--v3-border)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              ))}
            </>
          )}

          {!loading && filteredListings.length > 0 && filteredListings.map((listing) => {
            const company = companies[listing.company_id];
            const salary = formatSalary(listing.salary_min, listing.salary_max, listing.job_type);
            const ago = postedAgo(listing.created_at);
            const loc = listing.remote
              ? 'Remote'
              : listing.location || [company?.city, company?.state].filter(Boolean).join(', ');
            const isBookmarked = bookmarks.has(listing.id);

            return (
              <div
                key={listing.id}
                onClick={() => navigate(`/jobs/${listing.id}`)}
                style={{
                  padding: '16px',
                  border: '1px solid var(--v3-border)',
                  borderRadius: '6px',
                  transition: 'all var(--v3-transition-fast)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: 'white',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--v3-accent)';
                  e.currentTarget.style.backgroundColor = 'var(--v3-panel-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--v3-border)';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                {/* Bookmark icon */}
                <div
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: isBookmarked ? 'var(--v3-accent)' : 'var(--v3-muted)',
                    transition: 'color var(--v3-transition-fast)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setBookmarks(prev => {
                      const next = new Set(prev);
                      if (next.has(listing.id)) next.delete(listing.id);
                      else next.add(listing.id);
                      return next;
                    });
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--v3-accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = isBookmarked ? 'var(--v3-accent)' : 'var(--v3-muted)'}
                >
                  {isBookmarked ? '★' : '☆'}
                </div>

                {/* Title */}
                <div style={{
                  fontSize: 'var(--v3-body-font-size)',
                  fontWeight: 'var(--v3-font-weight-bold)',
                  color: 'var(--v3-ink-primary)',
                  paddingRight: '40px',
                }}>
                  {listing.title || 'Untitled role'}
                </div>

                {/* Company + Location + Meta */}
                <div style={{
                  fontSize: 'var(--v3-body-sm-font-size)',
                  fontWeight: 'var(--v3-font-weight-medium)',
                  color: 'var(--v3-ink-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}>
                  {company?.name && <span>{company.name}</span>}
                  {loc && <span style={{ color: 'var(--v3-muted)' }}>•</span>}
                  {loc && <span style={{ color: 'var(--v3-muted)' }}>{loc}</span>}
                  {ago && <span style={{ color: 'var(--v3-muted)' }}>•</span>}
                  {ago && <span style={{ color: 'var(--v3-muted)' }}>{ago}</span>}
                </div>

                {/* Badges: job_type + remote + salary */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginTop: '4px',
                }}>
                  {listing.job_type && (
                    <span style={{
                      display: 'inline-block',
                      fontSize: '12px',
                      fontWeight: 'var(--v3-font-weight-medium)',
                      backgroundColor: 'var(--v3-panel-bg)',
                      color: 'var(--v3-ink-secondary)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      textTransform: 'capitalize',
                    }}>
                      {listing.job_type.replace('-', ' ')}
                    </span>
                  )}
                  {listing.remote && (
                    <span style={{
                      display: 'inline-block',
                      fontSize: '12px',
                      fontWeight: 'var(--v3-font-weight-medium)',
                      backgroundColor: 'var(--v3-panel-bg)',
                      color: 'var(--v3-ink-secondary)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                    }}>
                      Remote
                    </span>
                  )}
                  {salary && (
                    <span style={{
                      display: 'inline-block',
                      fontSize: '12px',
                      fontWeight: 'var(--v3-font-weight-semibold)',
                      color: 'var(--v3-accent)',
                    }}>
                      {salary}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {!loading && supabase && filteredListings.length === 0 && (
            <div style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: 'var(--v3-muted)',
              fontSize: 'var(--v3-body-font-size)',
            }}>
              {searchInput ? `No roles match "${searchInput}"` : 'No open positions yet. Check back soon!'}
            </div>
          )}
        </div>

        {/* Inline animation styles */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.7; }
          }
        `}</style>
    </div>
  );
}

export default function SourcingJobsV2() {
  return <SourcingJobsV2Inner />;
}
