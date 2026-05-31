// SourcingReportsV2.jsx
// nat-geo-uplift R5c — Reports page in the V2 list-pattern.

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import { V2ChipNav } from './V2ChipNav.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';

function formatPubDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SourcingReportsV2Inner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);

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
    <div
      data-tenant={TENANT_SLUG_V2}
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--tx)',
        position: 'relative',
        fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
        '--bg': 'transparent',
        '--tx': '#E8E4DA',
        '--tx2': 'rgba(232,228,218,0.60)',
        '--tx3': 'rgba(232,228,218,0.25)',
        '--s1': 'rgba(11,11,13,0.72)',
        '--s2': 'rgba(11,11,13,0.82)',
        '--s3': 'rgba(11,11,13,0.92)',
        '--bd': 'rgba(232,228,218,0.10)',
        '--bd2': 'rgba(232,228,218,0.16)',
        '--cyan': '#E8A23A',
        '--cyan-dim': 'rgba(232,162,58,0.10)',
        '--cyan-brd': 'rgba(232,162,58,0.32)',
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>

      <div className="browse-hero" style={{ '--page-hero-bg': "url('/v2-assets/sun-corona.png')" }}>
        <div className="browse-hero-bg" />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <Link to="/space-rising-v2" className="browse-back" style={{ textDecoration: 'none' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
            Back
          </Link>
          <div className="browse-title">Industry Reports.</div>
          <div className="browse-sub">
            Market analysis, funding round summaries, and Space Rising research briefings.
          </div>
          <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
        </div>
      </div>

      <div className="browse-search">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search reports, categories, authors..."
          aria-label="Search reports"
          autoComplete="off"
          spellCheck="false"
        />
        {loading && <div className="spinner" />}
      </div>

      <V2ChipNav active="reports" />

      <div className="sec-hdr">
        <div className="sec-title">
          {loading ? 'Loading...' : `${filtered.length} Report${filtered.length === 1 ? '' : 's'}.`}
        </div>
        <div className="sec-count">
          <span style={{ color: 'var(--tx3)', fontSize: 12, fontFamily: 'JetBrains Mono, ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Updated weekly
          </span>
        </div>
      </div>

      <div className="co-list">
        {!supabase && (
          <div style={{ padding: '24px 20px', border: '1px solid rgba(232,162,58,0.32)', background: 'rgba(232,162,58,0.10)', borderRadius: 10, color: '#E8A23A', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 13, textAlign: 'center' }}>
            Supabase not configured
          </div>
        )}

        {loading && supabase && (
          <>{[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 84, borderRadius: 10, background: 'rgba(18,20,28,0.40)', border: '1px solid rgba(232,228,218,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}</>
        )}

        {!loading && filtered.map((report) => {
          const date = formatPubDate(report.published_at);
          const isFree = report.access === 'free' || !report.access;
          return (
            <Link
              key={report.id}
              to={`/space-rising-v2/reports/${report.id}`}
              className="co-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="co-body">
                <div className="co-name">{report.title}</div>
                <div className="co-loc">
                  {[report.category, report.author, date].filter(Boolean).join(' · ')}
                </div>
                <div className="co-badges">
                  {isFree && <span className="co-badge cert">Free</span>}
                  {!isFree && <span className="co-badge feat">Members Only</span>}
                  {report.file_url && <span className="co-badge cert">PDF</span>}
                </div>
              </div>
              <div className="co-arrow">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
              </div>
            </Link>
          );
        })}

        {!loading && supabase && filtered.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: 'rgba(232,228,218,0.55)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {searchInput ? `No reports match "${searchInput}"` : 'No reports published yet.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SourcingReportsV2() {
  return (
    <SourcingThemeProvider>
      <SourcingReportsV2Inner />
    </SourcingThemeProvider>
  );
}
