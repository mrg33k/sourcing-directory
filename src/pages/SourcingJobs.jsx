import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingNav } from './SourcingMarketplace.jsx';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

const VERTICALS = [
  { key: 'all',           label: 'All Industries',   color: '#9ca3af' },
  { key: 'semiconductor', label: 'Semiconductor',     color: '#29B6F6' },
  { key: 'space',         label: 'Space & Aerospace', color: '#7C3AED' },
  { key: 'biotech',       label: 'Biotech',           color: '#22C55E' },
  { key: 'defense',       label: 'Defense',           color: '#EF4444' },
];

const JOB_TYPES = [
  { key: 'all',        label: 'All Types' },
  { key: 'full-time',  label: 'Full-Time' },
  { key: 'contract',   label: 'Contract' },
  { key: 'internship', label: 'Internship' },
  { key: 'part-time',  label: 'Part-Time' },
];

const JOB_TYPE_COLORS = {
  'full-time':  { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.4)',   text: '#86EFAC' },
  'contract':   { bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.4)',  text: '#93C5FD' },
  'internship': { bg: 'rgba(139,92,246,0.1)',   border: 'rgba(139,92,246,0.4)',  text: '#C4B5FD' },
  'part-time':  { bg: 'rgba(138,132,124,0.1)', border: 'rgba(138,132,124,0.4)', text: '#8A847C' },
};

function JobTypeBadge({ jobType, V }) {
  if (!jobType) return null;
  const c = JOB_TYPE_COLORS[jobType] || JOB_TYPE_COLORS['part-time'];
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: 10, fontWeight: 700, fontFamily: V.mono,
      padding: '2px 7px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {jobType}
    </span>
  );
}

function VerticalDot({ vertical, V }) {
  const v = VERTICALS.find(x => x.key === vertical);
  if (!v || v.key === 'all') return null;
  return (
    <span style={{
      background: `${v.color}18`, border: `1px solid ${v.color}50`, color: v.color,
      fontSize: 10, fontWeight: 700, fontFamily: V.mono,
      padding: '2px 7px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {v.label}
    </span>
  );
}

function formatSalary(min, max, jobType) {
  if (!min && !max) return null;
  const unit = jobType === 'contract' ? '/hr' : '/yr';
  const fmt = (n) => jobType === 'contract'
    ? `$${n}`
    : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}${unit}`;
  if (min) return `${fmt(min)}+${unit}`;
  return `Up to ${fmt(max)}${unit}`;
}

function JobCard({ listing, company, onClick, V }) {
  const [hovered, setHovered] = useState(false);
  const salary = formatSalary(listing.salary_min, listing.salary_max, listing.job_type);
  const postedAgo = (() => {
    const days = Math.floor((Date.now() - new Date(listing.created_at)) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  })();

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? V.cardHov : V.card,
        border: `1px solid ${hovered ? V.borderHov : V.border}`,
        borderRadius: 10, padding: '18px 20px',
        cursor: 'pointer', transition: 'all 0.15s ease',
        display: 'flex', gap: 14, alignItems: 'flex-start',
        boxShadow: hovered ? `0 0 0 1px ${V.accent}20` : 'none',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 8, flexShrink: 0,
        background: company?.logo_url ? 'transparent' : V.accentDim,
        border: `1px solid ${V.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {company?.logo_url
          ? <img src={company.logo_url} alt={company.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 18, fontWeight: 800, fontFamily: V.syne, color: V.accent }}>
              {(company?.name || '?').charAt(0)}
            </span>
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: V.syne, color: V.text, lineHeight: 1.2, marginBottom: 4 }}>
          {listing.title}
        </div>
        <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space, marginBottom: 10 }}>
          {company?.name || 'Unknown Company'}
          {listing.location && ` · ${listing.location}`}
          {listing.remote && ' · Remote OK'}
        </div>
        {listing.description && (
          <div style={{
            fontSize: 13, color: V.dim, fontFamily: V.space, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            marginBottom: 10,
          }}>
            {listing.description}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <JobTypeBadge jobType={listing.job_type} V={V} />
          <VerticalDot vertical={listing.vertical} V={V} />
          {salary && (
            <span style={{ fontSize: 13, fontWeight: 700, color: V.accent, fontFamily: V.mono }}>
              {salary}
            </span>
          )}
          {listing.remote && (
            <span style={{
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
              color: V.blue, fontSize: 10, fontFamily: V.mono,
              padding: '2px 7px', borderRadius: 3, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Remote
            </span>
          )}
          <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, marginLeft: 'auto' }}>
            {postedAgo}
          </span>
        </div>
      </div>
    </div>
  );
}

function JobModal({ listing, company, onClose, V }) {
  const salary = formatSalary(listing.salary_min, listing.salary_max, listing.job_type);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: V.card, border: `1px solid ${V.border}`,
          borderRadius: 12, maxWidth: 640, width: '100%',
          maxHeight: '85vh', overflow: 'auto', padding: 28,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: V.syne, color: V.text, margin: 0, lineHeight: 1.2 }}>
            {listing.title}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: V.muted, cursor: 'pointer', fontSize: 20, flexShrink: 0, padding: 0 }}>
            ×
          </button>
        </div>

        <div style={{ fontSize: 14, color: V.muted, fontFamily: V.space, marginBottom: 16 }}>
          {company?.name}{listing.location && ` · ${listing.location}`}{listing.remote && ' · Remote OK'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <JobTypeBadge jobType={listing.job_type} V={V} />
          <VerticalDot vertical={listing.vertical} V={V} />
          {salary && <span style={{ fontSize: 16, fontWeight: 800, color: V.accent, fontFamily: V.mono }}>{salary}</span>}
          {listing.remote && (
            <span style={{
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
              color: V.blue, fontSize: 10, fontFamily: V.mono,
              padding: '2px 7px', borderRadius: 3, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Remote</span>
          )}
        </div>

        {listing.description && (
          <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, lineHeight: 1.8, margin: '0 0 24px', whiteSpace: 'pre-wrap' }}>
            {listing.description}
          </p>
        )}

        {company && (
          <div style={{
            background: V.card2, border: `1px solid ${V.border}`,
            borderRadius: 8, padding: '14px 16px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>Company</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 2 }}>{company.name}</div>
            <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space }}>{[company.city, company.state].filter(Boolean).join(', ')}</div>
            {company.website && (
              <a href={company.website} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: V.blue, fontFamily: V.space, textDecoration: 'none', display: 'block', marginTop: 4 }}>
                {company.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        )}

        {listing.apply_url ? (
          <a href={listing.apply_url} target="_blank" rel="noreferrer" style={{
            display: 'block', width: '100%', boxSizing: 'border-box',
            background: V.accent, color: '#fff', textDecoration: 'none',
            borderRadius: 8, padding: '12px', fontSize: 14,
            fontWeight: 700, fontFamily: V.space, textAlign: 'center',
          }}>
            Apply Now
          </a>
        ) : listing.contact_email && (
          <a href={`mailto:${listing.contact_email}?subject=Application: ${encodeURIComponent(listing.title)}`} style={{
            display: 'block', width: '100%', boxSizing: 'border-box',
            background: V.accent, color: '#fff', textDecoration: 'none',
            borderRadius: 8, padding: '12px', fontSize: 14,
            fontWeight: 700, fontFamily: V.space, textAlign: 'center',
          }}>
            Apply via Email
          </a>
        )}

        <div style={{ marginTop: 12, fontSize: 11, color: V.dim, fontFamily: V.mono, textAlign: 'center' }}>
          Posted {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

function SourcingJobsInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { tenant, tenantSlug, loading: tenantLoading } = useTenant();

  const [listings, setListings] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [vertical, setVertical] = useState('all');
  const [jobType, setJobType] = useState('all');
  const [remoteFilter, setRemoteFilter] = useState('all'); // 'all' | 'remote' | 'onsite'
  const [locationInput, setLocationInput] = useState('');
  const [location, setLocation] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchListings = useCallback(async (q, v, jt, remFilt, loc, sMin, sMax) => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    try {
      let qb = supabase
        .from('directory_listings')
        .select('*')
        .eq('category', 'job')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
      if (v && v !== 'all') qb = qb.eq('vertical', v);
      if (jt && jt !== 'all') qb = qb.eq('job_type', jt);
      if (remFilt === 'remote') qb = qb.eq('remote', true);
      if (remFilt === 'onsite') qb = qb.eq('remote', false);
      if (loc && loc.trim()) qb = qb.ilike('location', `%${loc.trim()}%`);
      if (sMin && !isNaN(Number(sMin))) qb = qb.gte('salary_max', Number(sMin));
      if (sMax && !isNaN(Number(sMax))) qb = qb.lte('salary_min', Number(sMax));
      if (q && q.trim()) qb = qb.or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`);

      const { data, error } = await qb.limit(100);
      if (error) throw error;
      setListings(data || []);

      if (data && data.length > 0) {
        const companyIds = [...new Set(data.map(l => l.company_id))];
        const { data: compData } = await supabase.from('directory_companies').select('*').in('id', companyIds);
        const map = {};
        (compData || []).forEach(c => { map[c.id] = c; });
        setCompanies(map);
      } else {
        setCompanies({});
      }
    } catch (err) {
      console.error('Jobs fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (tenantSlug && tenantLoading) return;
    fetchListings(query, vertical, jobType, remoteFilter, location, salaryMin, salaryMax);
  }, [query, vertical, jobType, remoteFilter, location, salaryMin, salaryMax, fetchListings, tenantLoading, tenantSlug]);

  const handleSearch = () => setQuery(searchInput.trim());
  const handleLocationSearch = () => setLocation(locationInput.trim());

  const activeFilterCount = [
    vertical !== 'all',
    jobType !== 'all',
    remoteFilter !== 'all',
    location.trim() !== '',
    salaryMin !== '',
    salaryMax !== '',
  ].filter(Boolean).length;

  const inputStyle = {
    background: V.card2, border: `1px solid ${V.border}`,
    color: V.text, borderRadius: 6, padding: '7px 10px',
    fontSize: 12, fontFamily: V.space, outline: 'none', width: '100%',
  };

  return (
    <div style={{ minHeight: '100vh', background: V.bg, color: V.text }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        * { box-sizing: border-box; }
        a { color: inherit; }
        input::placeholder { color: ${V.dim}; }
        input:focus { border-color: ${V.accent} !important; box-shadow: 0 0 0 2px ${V.accentDim}; }
        select { appearance: none; -webkit-appearance: none; }
        select:focus { border-color: ${V.accent} !important; box-shadow: 0 0 0 2px ${V.accentDim}; outline: none; }
        @media (min-width: 640px) { .jobs-filters-panel { display: flex !important; } .jobs-filters-toggle { display: none !important; } }
      `}</style>

      <SourcingNav active="jobs" tenantSlug={tenantSlug} tenantName={tenant?.nav_label || tenant?.name} features={tenant?.features} brandColor={tenant?.brand_color} />

      <div style={{ padding: '40px 24px 28px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.accent, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
          Job Board
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, fontFamily: V.syne, color: V.heading, margin: '0 0 6px', lineHeight: 1.15 }}>
              Industry Jobs
            </h1>
            <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, margin: 0 }}>
              Positions at Arizona's semiconductor, space, and advanced tech companies.
            </p>
          </div>
          <Link to={`${tenantSlug ? `/${tenantSlug}` : '/'}/jobs/post`} style={{
            background: V.accent, color: '#fff', textDecoration: 'none',
            borderRadius: 7, padding: '9px 18px', fontSize: 13,
            fontWeight: 700, fontFamily: V.space, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            + Post a Job
          </Link>
        </div>

        {/* Search row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search job title, company, location..."
              style={{
                width: '100%',
                background: V.card2, border: `1px solid ${V.border}`,
                color: V.text, borderRadius: 8, padding: '10px 42px 10px 14px',
                fontSize: 14, fontFamily: V.space, outline: 'none',
              }}
            />
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: V.muted }}>
              {loading
                ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${V.dim}`, borderTop: `2px solid ${V.accent}`, animation: 'spin 0.8s linear infinite' }} />
                : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              }
            </div>
          </div>
          <button onClick={handleSearch} style={{
            background: V.accent, border: 'none', color: '#fff',
            borderRadius: 8, padding: '0 18px', fontSize: 13,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Search
          </button>
          {/* Mobile filters toggle */}
          <button
            className="jobs-filters-toggle"
            onClick={() => setFiltersOpen(o => !o)}
            style={{
              background: activeFilterCount > 0 ? V.accentDim : V.card2,
              border: `1px solid ${activeFilterCount > 0 ? V.accentBrd : V.border}`,
              color: activeFilterCount > 0 ? V.accent : V.muted,
              borderRadius: 8, padding: '0 14px', fontSize: 13,
              fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            <span style={{ fontSize: 10 }}>{filtersOpen ? '▲' : '▼'}</span>
          </button>
        </div>

        {/* Filter panel */}
        <div
          className="jobs-filters-panel"
          style={{
            display: filtersOpen ? 'flex' : 'none',
            flexDirection: 'column', gap: 12,
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, padding: '16px 18px', marginBottom: 16,
          }}
        >
          {/* Row 1: Vertical + Job type */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Industry</span>
            {VERTICALS.map(v => (
              <button key={v.key} onClick={() => setVertical(v.key)} style={{
                background: vertical === v.key ? `${v.color}20` : 'transparent',
                border: `1px solid ${vertical === v.key ? v.color : V.border}`,
                color: vertical === v.key ? v.color : V.muted,
                borderRadius: 6, padding: '5px 11px', fontSize: 12,
                fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>
                {v.label}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: V.border }} />

          {/* Row 2: Job type */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Type</span>
            {JOB_TYPES.map(jt => (
              <button key={jt.key} onClick={() => setJobType(jt.key)} style={{
                background: jobType === jt.key ? V.accentDim : 'transparent',
                border: `1px solid ${jobType === jt.key ? V.accentBrd : V.border}`,
                color: jobType === jt.key ? V.accent : V.muted,
                borderRadius: 6, padding: '5px 11px', fontSize: 12,
                fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>
                {jt.label}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: V.border }} />

          {/* Row 3: Remote + Location + Salary */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Remote toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Remote</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ key: 'all', label: 'All' }, { key: 'remote', label: 'Remote' }, { key: 'onsite', label: 'On-site' }].map(opt => (
                  <button key={opt.key} onClick={() => setRemoteFilter(opt.key)} style={{
                    background: remoteFilter === opt.key ? 'rgba(59,130,246,0.12)' : 'transparent',
                    border: `1px solid ${remoteFilter === opt.key ? 'rgba(59,130,246,0.5)' : V.border}`,
                    color: remoteFilter === opt.key ? '#93C5FD' : V.muted,
                    borderRadius: 6, padding: '5px 11px', fontSize: 12,
                    fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Location</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="text"
                  value={locationInput}
                  onChange={e => setLocationInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLocationSearch()}
                  placeholder="City or state..."
                  style={{ ...inputStyle, minWidth: 120 }}
                />
                <button onClick={handleLocationSearch} style={{
                  background: location ? V.accentDim : 'transparent',
                  border: `1px solid ${location ? V.accentBrd : V.border}`,
                  color: location ? V.accent : V.muted,
                  borderRadius: 6, padding: '5px 10px', fontSize: 11,
                  fontWeight: 700, fontFamily: V.mono, cursor: 'pointer', flexShrink: 0,
                }}>Go</button>
              </div>
            </div>

            {/* Salary range */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Salary Range</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="number"
                  value={salaryMin}
                  onChange={e => setSalaryMin(e.target.value)}
                  placeholder="Min"
                  style={{ ...inputStyle, width: 90 }}
                />
                <span style={{ color: V.dim, fontSize: 12, fontFamily: V.mono, flexShrink: 0 }}>–</span>
                <input
                  type="number"
                  value={salaryMax}
                  onChange={e => setSalaryMax(e.target.value)}
                  placeholder="Max"
                  style={{ ...inputStyle, width: 90 }}
                />
              </div>
            </div>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button onClick={() => {
                setVertical('all'); setJobType('all'); setRemoteFilter('all');
                setLocationInput(''); setLocation(''); setSalaryMin(''); setSalaryMax('');
              }} style={{
                background: 'transparent', border: `1px solid ${V.border}`,
                color: V.muted, borderRadius: 6, padding: '5px 11px', fontSize: 12,
                fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 60px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space, marginBottom: 16 }}>
          {loading ? 'Loading...' : (
            <>
              <span style={{ color: V.text, fontWeight: 600 }}>{listings.length}</span>
              {' '}job{listings.length !== 1 ? 's' : ''}
              {query && <> for <span style={{ color: V.accent }}>"{query}"</span></>}
            </>
          )}
        </div>

        {!supabase && (
          <div style={{ background: V.accentDim, border: `1px solid ${V.accentBrd}`, borderRadius: 8, padding: '20px 24px', textAlign: 'center' }}>
            <div style={{ color: V.accent, fontFamily: V.mono, fontSize: 13, marginBottom: 8 }}>Supabase not configured</div>
            <div style={{ color: V.muted, fontFamily: V.space, fontSize: 12 }}>Run migrations 001 + 002 in Supabase SQL editor to activate.</div>
          </div>
        )}

        {loading && supabase && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, height: 120, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {!loading && listings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {listings.map(listing => (
              <JobCard key={listing.id} listing={listing} company={companies[listing.company_id]} onClick={() => setSelected(listing)} V={V} />
            ))}
          </div>
        )}

        {!loading && supabase && listings.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 12,
          }}>
            <svg width="56" height="56" fill="none" stroke={V.dim} strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16, opacity: 0.5 }}>
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 8 }}>No jobs found</div>
            <div style={{ fontSize: 14, color: V.muted, fontFamily: V.space, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
              {query ? `No results for "${query}". Try different filters or broaden your search.` : 'No jobs posted yet. Companies in this directory can post open positions here.'}
            </div>
            <Link to={`${tenantSlug ? `/${tenantSlug}` : '/'}/jobs/post`} style={{
              background: V.accent, color: '#fff', textDecoration: 'none',
              borderRadius: 7, padding: '10px 20px', fontSize: 13,
              fontWeight: 700, fontFamily: V.space, display: 'inline-block',
            }}>
              Post a Job
            </Link>
          </div>
        )}
      </div>

      {selected && (
        <JobModal listing={selected} company={companies[selected.company_id]} onClose={() => setSelected(null)} V={V} />
      )}
    </div>
  );
}

export default function SourcingJobs() {
  return (
    <SourcingThemeProvider>
      <SourcingJobsInner />
    </SourcingThemeProvider>
  );
}
