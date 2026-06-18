import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import V2ChipNav from './V2ChipNav.jsx';
import '../space-rising-theme-v2.css';

// Detail page for a single directory_reports row. Built 2026-06-05 so report
// cards open a real page instead of bouncing to the directory. Free reports
// expose the PDF directly; members/paid reports show the membership path
// (full gated streaming stays server-side at api/sourcing/reports/[id]/content).

function fmtDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function SourcingReportDetailV2() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('directory_reports')
          .select('*')
          .eq('id', id)
          .single();
        if (error || !data) {
          if (!cancelled) { setNotFound(true); setLoading(false); }
          return;
        }
        if (!cancelled) setReport(data);
      } catch (err) {
        console.error('Report fetch error:', err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!report) return;
    document.title = `${report.title || 'Report'} | Space Rising`;
    return () => { document.title = 'Space Rising'; };
  }, [report]);

  if (loading) {
    return (
      <div className="srcv2-shell" data-tenant="space-rising-v2">
        <div className="srcv2-loading"><div className="srsv2-eyebrow">LOADING</div></div>
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="srcv2-shell" data-tenant="space-rising-v2">
        <div className="srcv2-notfound">
          <div className="srsv2-eyebrow">NOT FOUND</div>
          <h1 className="srsv2-title">This report isn't available<span className="srsv2-period">.</span></h1>
          <div className="srsv2-sub">It may have been unpublished or removed.</div>
          <Link to="/spaceos/reports" className="srsv2-cta srsv2-cta-solid">Back to reports</Link>
        </div>
      </div>
    );
  }

  const isFree = report.access === 'free' || report.access === 'public' || !report.access;
  const isGated = !isFree || report.is_premium === true;
  const pubDate = fmtDate(report.published_at);
  const eyebrowBits = ['REPORT', report.category, report.author].filter(Boolean).join(' · ');
  const fileHref = report.file_url
    ? (report.file_url.startsWith('http') ? report.file_url : `https://${report.file_url}`)
    : null;

  return (
    <div className="srcv2-shell" data-tenant="space-rising-v2">
      <div className="srcv2-topbar">
        <div className="browse-hero-toprow">
          <Link to="/spaceos/reports" className="browse-back" style={{ textDecoration: 'none' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
            Back to reports
          </Link>
          <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
        </div>
      </div>

      <header className="srcv2-hero" style={{ '--profile-hero-bg': "url('/v2-assets/asteroid-close.png')" }}>
        <div className="srcv2-hero-overlay" />
        <div className="srcv2-hero-inner">
          <div className="srsv2-eyebrow">{eyebrowBits.toUpperCase()}</div>
          <h1 className="srcv2-name">{report.title || 'Untitled report'}<span className="srsv2-period">.</span></h1>
          {report.description && <p className="srcv2-lede">{report.description}</p>}
          <div className="srcv2-hero-actions">
            {!isGated && fileHref && (
              <a href={fileHref} target="_blank" rel="noopener noreferrer" className="srsv2-cta srsv2-cta-solid">
                View / Download PDF
              </a>
            )}
            {isGated && (
              <Link to="/spaceos/membership" className="srsv2-cta srsv2-cta-solid">
                Members only — become a member
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="srcv2-body">
        <main className="srcv2-main">
          <Section eyebrow="AT A GLANCE" title="Report details">
            <dl className="srcv2-facts">
              {report.category && <Fact label="Category" value={report.category} />}
              {report.author && <Fact label="Author" value={report.author} />}
              {pubDate && <Fact label="Published" value={pubDate} />}
              <Fact label="Access" value={isGated ? 'Members' : 'Free'} />
              {report.file_url && <Fact label="Format" value="PDF" />}
            </dl>
          </Section>

          {report.description && (
            <Section eyebrow="SUMMARY" title="About this report">
              <p className="srcv2-paragraph" style={{ whiteSpace: 'pre-wrap' }}>{report.description}</p>
            </Section>
          )}

          {isGated && (
            <Section eyebrow="ACCESS" title="Members-only report">
              <p className="srcv2-paragraph">
                This report is available to Space Rising members. Become a member to read and download the full PDF.
              </p>
              <div className="srcv2-hero-actions" style={{ marginTop: 12 }}>
                <Link to="/spaceos/membership" className="srsv2-cta srsv2-cta-line">View membership</Link>
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
