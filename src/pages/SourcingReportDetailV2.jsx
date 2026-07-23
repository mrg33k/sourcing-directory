import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import './osv3-mag-detail.css';

// Detail page for a single directory_reports row.
// Reskinned 2026-07-07 as magazine editorial article pattern:
// Hero image + kicker + headline + byline + body + members gate + related rail.

function fmtDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// A report's real delivered cover art (e.g. Tim's Blueprint cover) wins over the
// stock rotation. Add a cover here (or set a cover_image_url column) and the detail
// hero shows the actual cover instead of a random space photo.
function reportCover(report) {
  if (report?.cover_image_url) return report.cover_image_url;
  if (/blueprint/i.test(report?.title || '')) return '/v2-assets/blueprint-cover.png';
  return null;
}

// Deterministic hero image selection based on report id (hash stable across loads)
function selectHeroImage(report) {
  const cover = reportCover(report);
  if (cover) return cover;
  const heroAssets = [
    'blueprint-hero.png',
    'asteroid-close.png',
    'rocket-orbital.png',
    'bg-opp-orbital-construction.png',
    'bg-opp-lunar.png',
    'bg-opp-stations.png',
    'bg-opp-energy.png',
    'bg-opp-rideshare.png',
    'planet-red.png',
    'planet-blue.png',
    'earth.png',
  ];
  // Stable hash over the full id string (ids are UUIDs — parseInt would NaN on
  // any id starting with a hex letter and break the image). Sum char codes.
  const s = String(report?.id || '0');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const index = h % heroAssets.length;
  return `/v2-assets/${heroAssets[index]}`;
}

// Calculate read time from text (rough: ~200 words per minute)
function calcReadTime(text) {
  if (!text) return null;
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

// Get author initials for avatar. Reports are Space-Rising-published; when no
// byline author exists, attribute to Space Rising (never a bare "?").
function getInitials(author) {
  if (!author) return 'SR';
  return author
    .split(' ')
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 2);
}

export default function SourcingReportDetailV2() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [relatedReports, setRelatedReports] = useState([]);
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

  // Fetch related reports (exclude current)
  useEffect(() => {
    if (!supabase || !report) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('directory_reports')
          .select('id, title, published_at')
          .neq('id', report.id)
          .order('published_at', { ascending: false })
          .limit(3);
        if (!cancelled) setRelatedReports(data || []);
      } catch (err) {
        console.error('Related reports fetch error:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [report]);

  useEffect(() => {
    if (!report) return;
    document.title = `${report.title || 'Report'} | Space Rising`;
    return () => { document.title = 'Space Rising'; };
  }, [report]);

  if (loading) {
    return (
      <div className="osv3-mag-detail">
        <div className="osv3-mag-loading">Loading...</div>
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="osv3-mag-detail">
        <div className="osv3-mag-notfound">
          <h2 className="osv3-mag-notfound-title">This report isn't available</h2>
          <p className="osv3-mag-notfound-text">It may have been unpublished or removed.</p>
          <Link to="/reports" className="osv3-mag-back-link">← Back to reports</Link>
        </div>
      </div>
    );
  }

  const isFree = report.access === 'free' || report.access === 'public' || !report.access;
  const isGated = !isFree || report.is_premium === true;
  const pubDate = fmtDate(report.published_at);
  const readTime = calcReadTime(report.description);
  const heroUrl = selectHeroImage(report);
  const heroIsCover = Boolean(reportCover(report));
  const authorInitials = getInitials(report.author);
  const fileHref = report.file_url
    ? (report.file_url.startsWith('http') ? report.file_url : `https://${report.file_url}`)
    : null;

  return (
    <div className="osv3-mag-detail">
      {/* Back link */}
      <Link to="/reports" className="osv3-mag-back-link">← Back to reports</Link>

      {/* Hero image */}
      <div className="osv3-mag-hero">
        <img src={heroUrl} alt={report.title || 'Report'} className="osv3-mag-hero-image" style={heroIsCover ? { objectPosition: 'top center' } : undefined} />
        <div className="osv3-mag-hero-overlay"></div>
      </div>

      {/* Article header */}
      <div className="osv3-mag-header">
        <div className="osv3-mag-kicker">Report</div>
        <h1 className="osv3-mag-headline">{report.title || 'Untitled report'}</h1>
        <div className="osv3-mag-byline">
          <div className="osv3-mag-avatar">{authorInitials}</div>
          <div className="osv3-mag-byline-text">
            <span className="osv3-mag-byline-author">{report.author || 'Space Rising'}</span>
            <span className="osv3-mag-byline-dot">·</span>
            {pubDate && <span>{pubDate}</span>}
            {readTime && <span className="osv3-mag-byline-dot">·</span>}
            {readTime && <span>{readTime}</span>}
          </div>
        </div>
      </div>

      {/* Body content with members gate */}
      {isGated ? (
        // Gated: blurred content + overlay
        <div className="osv3-mag-gate-wrapper">
          <div className="osv3-mag-gated-content">
            {report.description && (
              <div className="osv3-mag-body">
                <p>{report.description}</p>
              </div>
            )}
          </div>
          <div className="osv3-mag-gate-overlay">
            <div className="osv3-mag-gate-card">
              <div className="osv3-mag-gate-headline">Full access to report</div>
              <div className="osv3-mag-gate-description">
                Members unlock the complete analysis, insights, and data.
              </div>
              <Link to="/membership" className="osv3-mag-gate-button">
                Unlock with Membership
              </Link>
              <a href="#membership" className="osv3-mag-gate-secondary-link">
                Learn about membership
              </a>
            </div>
          </div>
        </div>
      ) : (
        // Free: full body + download CTA
        <>
          {report.description && (
            <div className="osv3-mag-body">
              <p>{report.description}</p>
            </div>
          )}
          {fileHref && (
            <div className="osv3-mag-free-cta">
              <a href={fileHref} target="_blank" rel="noopener noreferrer" className="osv3-mag-download-button">
                View / Download Report
              </a>
            </div>
          )}
        </>
      )}

      {/* Related section */}
      {relatedReports.length > 0 && (
        <div className="osv3-mag-related">
          <div className="osv3-mag-section-eyebrow">Related in Intelligence</div>
          <div className="osv3-mag-related-grid">
            {relatedReports.map((r) => (
              <Link
                key={r.id}
                to={`/reports/${r.id}`}
                className="osv3-mag-related-card"
              >
                <div className="osv3-mag-related-card-title">{r.title || 'Untitled'}</div>
                <div className="osv3-mag-related-card-meta">
                  {fmtDate(r.published_at) || 'Unpublished'}
                </div>
              </Link>
            ))}
          </div>
          <div className="osv3-mag-related-footer">
            <Link to="/reports" className="osv3-mag-related-link">
              See all reports →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
