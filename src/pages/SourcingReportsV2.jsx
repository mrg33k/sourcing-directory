// SourcingReportsV2.jsx
// Space OS v3 — Reports page (light design with designed navy covers)

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';
import './osv3-reports.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function formatPubDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  return (
    <div className="osv3-reports-page">
      {/* Page Header */}
      <div className="osv3-reports-header">
        <div>
          <h2 className="osv3-reports-title">Reports</h2>
          <p className="osv3-reports-subtitle">Intelligence reports for the space economy.</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="osv3-reports-search-container">
        <input
          type="text"
          className="osv3-reports-search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search reports, categories, authors..."
          aria-label="Search reports"
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      {/* No Supabase Error */}
      {!supabase && (
        <div className="osv3-reports-error">
          Supabase not configured
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && supabase && (
        <div className="osv3-reports-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="osv3-report-card osv3-report-card-skeleton">
              <div className="osv3-report-card-cover-skeleton" />
              <div className="osv3-report-card-content">
                <div className="osv3-report-card-skeleton-line" />
                <div className="osv3-report-card-skeleton-line-short" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reports Grid */}
      {!loading && (
        <>
          <div className="osv3-reports-grid">
            {filtered.map((report) => {
              const date = formatPubDate(report.published_at);
              const isFree = report.access === 'free' || !report.access;
              return (
                <Link
                  key={report.id}
                  to={`/reports/${report.id}`}
                  className="osv3-report-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  {/* Navy Mini-Cover */}
                  <div className="osv3-report-card-cover">
                    <div className="osv3-report-card-cover-eyebrow">
                      SPACE RISING / REPORT
                    </div>
                    <div className="osv3-report-card-cover-title">
                      {report.title}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="osv3-report-card-content">
                    <h3 className="osv3-report-card-title">{report.title}</h3>
                    <div className="osv3-report-card-meta">
                      {[report.category, report.author, date].filter(Boolean).join(' · ')}
                    </div>
                    <div className="osv3-report-card-pills">
                      {isFree && <span className="osv3-report-card-pill osv3-pill-free">Free</span>}
                      {!isFree && <span className="osv3-report-card-pill osv3-pill-members">Members Only</span>}
                      {report.file_url && <span className="osv3-report-card-pill osv3-pill-pdf">PDF</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Empty State */}
          {supabase && filtered.length === 0 && (
            <div className="osv3-reports-empty">
              {searchInput ? `No reports match "${searchInput}"` : 'No reports published yet.'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
