// SourcingReportsV2.jsx
// Space OS v3 — Reports page (magazine pattern with feature hero + editorial grid)

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import './osv3-reports.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

// Asset rotation array (deterministic per report ID)
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

function formatPubDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getImageForReport(report, index) {
  // Deterministic mapping: use report ID hash or fallback to index
  const hashCode = report.id ? report.id.toString().charCodeAt(0) : index;
  return `/v2-assets/${ASSET_POOL[hashCode % ASSET_POOL.length]}`;
}

export default function SourcingReportsV2() {
  useSRWTitle('Space Industry Reports | Space OS');

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('directory_reports')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        if (!cancelled) setReports(data || []);
      } catch (err) {
        console.error('ReportsV2 fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!searchInput.trim()) return reports;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return reports.filter((r) => {
      const haystack = [r.title, r.description, r.category, r.author, r.access]
        .filter(Boolean).join(' ').toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [reports, searchInput]);

  // Split reports: feature (first) + grid (rest)
  const featureReport = filtered.length > 0 ? filtered[0] : null;
  const gridReports = filtered.length > 1 ? filtered.slice(1) : [];

  return (
    <div className="osv3-reports-page">
      {/* Page Header: "Intelligence" + Subtitle */}
      <div className="osv3-reports-header">
        <div>
          <h1 className="osv3-reports-page-title">Intelligence</h1>
          <p className="osv3-reports-page-subtitle">Curated research, reports, and insights from the space ecosystem.</p>
        </div>
      </div>

      {/* No Supabase Error */}
      {!supabase && (
        <div className="osv3-reports-error">
          Supabase not configured
        </div>
      )}

      {/* Loading State */}
      {loading && supabase && (
        <>
          {/* Feature Hero Skeleton */}
          <div className="osv3-magazine-feature-skeleton" />
          {/* Grid Skeletons */}
          <div className="osv3-reports-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="osv3-report-card osv3-report-card-skeleton">
                <div className="osv3-report-card-image-skeleton" />
                <div className="osv3-report-card-content">
                  <div className="osv3-report-card-skeleton-line" />
                  <div className="osv3-report-card-skeleton-line-short" />
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
          {featureReport && (
            <Link
              to={`/reports/${featureReport.id}`}
              className="osv3-magazine-feature-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <img
                src={getImageForReport(featureReport, 0)}
                alt={featureReport.title}
                className="osv3-magazine-feature-image"
                loading="eager"
              />
              <div className="osv3-magazine-feature-overlay" />
              <div className="osv3-magazine-feature-content">
                <div className="osv3-magazine-feature-kicker">{featureReport.category || 'Featured'}</div>
                <h2 className="osv3-magazine-feature-headline">{featureReport.title}</h2>
                <p className="osv3-magazine-feature-deck">{featureReport.description || ''}</p>
                <button
                  className="osv3-magazine-feature-button"
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                >
                  {featureReport.access === 'members' ? 'Unlock with Membership' : 'View Report'} →
                </button>
              </div>
            </Link>
          )}

          {/* EDITORIAL GRID (Tier 2) */}
          {gridReports.length > 0 && (
            <>
              <div className="osv3-magazine-section-header">
                <div className="osv3-magazine-section-eyebrow">Latest Reports</div>
                <Link to="#" className="osv3-magazine-section-link">See all →</Link>
              </div>
              <div className="osv3-reports-grid">
                {gridReports.map((report, idx) => {
                  const date = formatPubDate(report.published_at);
                  const isFree = report.access === 'free' || !report.access;
                  return (
                    <Link
                      key={report.id}
                      to={`/reports/${report.id}`}
                      className="osv3-report-card"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      {/* Card Image (3:2) */}
                      <div className="osv3-report-card-image-wrapper">
                        <img
                          src={getImageForReport(report, idx + 1)}
                          alt={report.title}
                          className="osv3-report-card-image"
                          loading="lazy"
                        />
                        {!isFree && (
                          <div className="osv3-report-card-badge">Members Only</div>
                        )}
                      </div>

                      {/* Card Content */}
                      <div className="osv3-report-card-content">
                        <div className="osv3-report-card-kicker">{report.category || 'Report'}</div>
                        <h3 className="osv3-report-card-headline">{report.title}</h3>
                        <p className="osv3-report-card-deck">{report.description || ''}</p>
                        <div className="osv3-report-card-meta">
                          {[report.author || 'Space Rising', date].filter(Boolean).join(' · ')}
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
            <div className="osv3-reports-empty">
              {searchInput ? `No reports match "${searchInput}"` : 'No reports published yet.'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
