import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import './osv3-detail.css';

// Detail page for a single directory_reports row. Built 2026-06-05 so report
// cards open a real page instead of bouncing to the directory. Free reports
// expose the PDF directly; members/paid reports show the membership path
// (full gated streaming stays server-side at api/sourcing/reports/[id]/content).
// Reskinned 2026-07-06 into v3 shell as light publication-style detail view.

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
      <div className="osv3-detail-page">
        <div className="osv3-detail-loading">Loading...</div>
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="osv3-detail-page">
        <div className="osv3-detail-notfound">
          <h2 className="osv3-detail-notfound-title">This report isn't available</h2>
          <p className="osv3-detail-notfound-text">It may have been unpublished or removed.</p>
          <Link to="/reports" className="osv3-detail-back-btn">← Back to reports</Link>
        </div>
      </div>
    );
  }

  const isFree = report.access === 'free' || report.access === 'public' || !report.access;
  const isGated = !isFree || report.is_premium === true;
  const pubDate = fmtDate(report.published_at);
  const fileHref = report.file_url
    ? (report.file_url.startsWith('http') ? report.file_url : `https://${report.file_url}`)
    : null;

  return (
    <div className="osv3-detail-page osv3-report-detail">
      {/* Left cover block — navy mini-cover treatment */}
      <div className="osv3-report-cover">
        <div className="osv3-report-cover-inner">
          <div className="osv3-report-cover-accent"></div>
          <div className="osv3-report-cover-eyebrow">SPACE RISING</div>
          <div className="osv3-report-cover-label">REPORT</div>
        </div>
      </div>

      {/* Right content block */}
      <div className="osv3-report-content">
        {/* Back link */}
        <Link to="/reports" className="osv3-detail-back-btn">← Back to reports</Link>

        {/* Header row: title + author + date + access pill */}
        <div className="osv3-report-header">
          <div>
            <h2 className="osv3-detail-title">{report.title || 'Untitled report'}</h2>
            <div className="osv3-report-meta-row">
              {report.author && <span className="osv3-report-meta-text">By {report.author}</span>}
              {pubDate && <span className="osv3-report-meta-text">·</span>}
              {pubDate && <span className="osv3-report-meta-text">{pubDate}</span>}
            </div>
          </div>
          <span className={`osv3-report-access-pill ${isGated ? 'gated' : 'free'}`}>
            {isGated ? 'Members' : 'Free'}
          </span>
        </div>

        {/* Description */}
        {report.description && (
          <p className="osv3-detail-description">{report.description}</p>
        )}

        {/* Primary CTA */}
        <div className="osv3-detail-actions">
          {!isGated && fileHref && (
            <a href={fileHref} target="_blank" rel="noopener noreferrer" className="osv3-detail-cta-primary">
              View / Download
            </a>
          )}
          {isGated && (
            <Link to="/membership" className="osv3-detail-cta-primary">
              Become a member
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
