// SourcingJobsV2.jsx
// Space OS v3 — Jobs/Careers page (magazine pattern with feature hero + editorial grid)

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import './osv3-jobs.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

// Asset rotation array (deterministic per job ID)
const ASSET_POOL = [
  'blueprint-hero.png',
  'earth.png',
  'rocket-orbital.png',
  'bg-opp-orbital-construction.png',
  'bg-opp-lunar.png',
  'bg-opp-energy.png',
  'asteroid-close.png',
  'bg-opp-stations.png',
  'planet-red.png',
  'rocket-ascent.png',
];

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

function getImageForJob(job, index) {
  // Deterministic + diverse: hash the full id string (+ index)
  const s = (job.id ? String(job.id) : '') + ':' + index;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `/v2-assets/${ASSET_POOL[h % ASSET_POOL.length]}`;
}

export default function SourcingJobsV2() {
  useSRWTitle('Careers | Space OS');

  const [tenant, setTenant] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  // Load SR tenant row once
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
        setJobs(data || []);

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

  // Fuzzy filter — instant as you type, AND-semantics on words
  const filtered = useMemo(() => {
    if (!searchInput.trim()) return jobs;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return jobs.filter((l) => {
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
  }, [jobs, companies, searchInput]);

  // Split jobs: feature (first) + grid (rest)
  const featureJob = filtered.length > 0 ? filtered[0] : null;
  const gridJobs = filtered.length > 1 ? filtered.slice(1) : [];

  return (
    <div className="osv3-jobs-page">
      {/* Page Header: "Careers" + Subtitle */}
      <div className="osv3-jobs-header">
        <div>
          <h1 className="osv3-jobs-page-title">Careers</h1>
          <p className="osv3-jobs-page-subtitle">Explore roles across Arizona's space ecosystem. Join launch suppliers, defense contractors, and R&D innovators.</p>
        </div>
        <Link
          to="/jobs/post"
          className="osv3-jobs-post-button"
        >
          + Post a Job
        </Link>
      </div>

      {/* Search */}
      <div className="osv3-jobs-search-row">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
          className="osv3-jobs-search-input"
        />
      </div>

      {/* No Supabase Error */}
      {!supabase && (
        <div className="osv3-jobs-error">
          Supabase not configured
        </div>
      )}

      {/* Loading State */}
      {loading && supabase && (
        <>
          {/* Feature Hero Skeleton */}
          <div className="osv3-magazine-feature-skeleton" />
          {/* Grid Skeletons */}
          <div className="osv3-jobs-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="osv3-job-card osv3-job-card-skeleton">
                <div className="osv3-job-card-image-skeleton" />
                <div className="osv3-job-card-content">
                  <div className="osv3-job-card-skeleton-line" />
                  <div className="osv3-job-card-skeleton-line-short" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Content */}
      {!loading && supabase && (
        <>
          {/* FEATURE HERO (Tier 1) */}
          {featureJob && (
            <Link
              to={`/jobs/${featureJob.id}`}
              className="osv3-magazine-feature-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <img
                src={getImageForJob(featureJob, 0)}
                alt={featureJob.title}
                className="osv3-magazine-feature-image"
                loading="eager"
              />
              <div className="osv3-magazine-feature-overlay" />
              <div className="osv3-magazine-feature-content">
                <div className="osv3-magazine-feature-kicker">{featureJob.job_type ? featureJob.job_type.replace('-', ' ').toUpperCase() : 'FEATURED'}</div>
                <h2 className="osv3-magazine-feature-headline">{featureJob.title}</h2>
                <p className="osv3-magazine-feature-deck">
                  {companies[featureJob.company_id]?.name || 'Company'} · {featureJob.location || 'Location'} {featureJob.salary_min || featureJob.salary_max ? `· ${formatSalary(featureJob.salary_min, featureJob.salary_max, featureJob.job_type)}` : ''}
                </p>
                <button
                  className="osv3-magazine-feature-button"
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                >
                  View Role →
                </button>
              </div>
            </Link>
          )}

          {/* EDITORIAL GRID (Tier 2) */}
          {gridJobs.length > 0 && (
            <>
              <div className="osv3-magazine-section-header">
                <div className="osv3-magazine-section-eyebrow">Open Positions</div>
              </div>
              <div className="osv3-jobs-grid">
                {gridJobs.map((job, idx) => {
                  const company = companies[job.company_id];
                  const salary = formatSalary(job.salary_min, job.salary_max, job.job_type);
                  const ago = postedAgo(job.created_at);
                  const loc = job.remote ? 'Remote' : job.location || [company?.city, company?.state].filter(Boolean).join(', ');
                  return (
                    <Link
                      key={job.id}
                      to={`/jobs/${job.id}`}
                      className="osv3-job-card"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      {/* Card Image (3:2) with optional logo overlay */}
                      <div className="osv3-job-card-image-wrapper">
                        <img
                          src={getImageForJob(job, idx + 1)}
                          alt={job.title}
                          className="osv3-job-card-image"
                          loading="lazy"
                        />
                        {company?.logo_url && (
                          <div className="osv3-job-card-logo-overlay">
                            <img src={company.logo_url} alt={company.name} className="osv3-job-card-logo" />
                          </div>
                        )}
                      </div>

                      {/* Card Content */}
                      <div className="osv3-job-card-content">
                        <div className="osv3-job-card-kicker">{job.job_type ? job.job_type.replace('-', ' ').toUpperCase() : (job.remote ? 'REMOTE' : 'ON-SITE')}</div>
                        <h3 className="osv3-job-card-headline">{job.title}</h3>
                        <p className="osv3-job-card-deck">{company?.name || 'Company'} · {loc}</p>
                        <div className="osv3-job-card-meta">
                          {[salary, ago].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty State */}
          {filtered.length === 0 && (
            <div className="osv3-jobs-empty">
              {searchInput ? `No roles match "${searchInput}"` : 'No open positions yet. Check back soon!'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
