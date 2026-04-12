import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingNav } from './SourcingMarketplace.jsx';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

// ─── Report categories ───────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',            label: 'All Reports' },
  { key: 'government',     label: 'Government Affairs' },
  { key: 'acquisition',    label: 'Acquisitions & Contracts' },
  { key: 'economic',       label: 'Economic Development' },
  { key: 'quarterly',      label: 'Quarterly Intelligence' },
];


function SourcingReportsInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { tenant, tenantSlug } = useTenant();
  const { reportId } = useParams();
  const navigate = useNavigate();
  const base = tenantSlug ? `/${tenantSlug}` : '';
  const accent = tenant?.brand_color || V.accent;
  const [category, setCategory] = useState('all');
  const [authUser, setAuthUser] = useState(null);
  const [memberTier, setMemberTier] = useState('free');
  const [authLoading, setAuthLoading] = useState(true);
  const [premiumGateReport, setPremiumGateReport] = useState(null);

  // Helper function to get download URL for a report
  const getReportDownloadUrl = (report) => {
    if (!report || !report.file_url || typeof report.file_url !== 'string') return null;

    const trimmedFileUrl = report.file_url.trim();
    if (!trimmedFileUrl) return null;

    if (trimmedFileUrl.startsWith('http://') || trimmedFileUrl.startsWith('https://')) {
      return trimmedFileUrl;
    }

    if (trimmedFileUrl.startsWith('/')) {
      return trimmedFileUrl;
    }

    const ragBaseUrl = 'https://rag.aheadofmarket.com/files/';
    const normalizedPath = trimmedFileUrl.replace(/^files\//, '').replace(/^\/+/, '');
    const encodedPath = normalizedPath
      .split('/')
      .filter(Boolean)
      .map(segment => encodeURIComponent(segment))
      .join('/');

    return encodedPath ? `${ragBaseUrl}${encodedPath}` : null;
  };

  useEffect(() => {
    document.title = `Reports & Intelligence | ${tenant?.name || 'sourcing.directory'}`;
    if (!supabase) { setAuthLoading(false); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setAuthUser(user);
      if (user && tenant?.id) {
        const { data: member } = await supabase
          .from('directory_members')
          .select('company_id')
          .eq('auth_user_id', user.id)
          .eq('tenant_id', tenant.id)
          .single();
        if (member?.company_id) {
          const { data: company } = await supabase
            .from('directory_companies')
            .select('membership_tier')
            .eq('id', member.company_id)
            .single();
          setMemberTier(company?.membership_tier || 'free');
        }
      }
      setAuthLoading(false);
    })();
  }, [tenant]);

  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [downloadType, setDownloadType] = useState('companies');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const params = new URLSearchParams({ type: downloadType });
      if (tenantSlug) params.set('tenant_slug', tenantSlug);
      const res = await fetch(`/api/sourcing/download-report?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(err.error || 'Download failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `report-${downloadType}-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!supabase) { setReports([]); setReportsLoading(false); return; }
    (async () => {
      let q = supabase.from('directory_reports').select('*').order('published_at', { ascending: false });
      if (tenant?.id) q = q.eq('tenant_id', tenant.id);
      const { data } = await q;
      setReports(data || []);
      setReportsLoading(false);
    })();
  }, [tenant]);

  const isPaid = memberTier !== 'free';
  const filtered = reports.filter(r =>
    category === 'all' || r.category === category
  );

  const handleReportClick = (report) => {
    if (report.access === 'member' && !isPaid) {
      setPremiumGateReport(report);
    } else {
      navigate(`${base}/reports/${report.id}`);
    }
  };

  // ─── Detail view (direct navigation to /:tenantSlug/reports/:reportId) ───
  if (reportId) {
    const loading = reportsLoading || authLoading;
    const report = loading ? null : reports.find(r => String(r.id) === reportId);
    const isPremiumReport = report ? report.access === 'member' : false;
    const canAccess = !isPremiumReport || isPaid;
    const catLabel = report ? (CATEGORIES.find(c => c.key === report.category)?.label || report.category) : '';

    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--tx)' }}>
        <SourcingNav active="reports" tenantSlug={tenantSlug} tenantName={tenant?.nav_label || tenant?.name} features={tenant?.features} brandColor={tenant?.brand_color} />

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          </div>
        ) : !report ? (
          <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: '0 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: 'var(--tx)', marginBottom: 12 }}>
              Report not found
            </div>
            <Link to={`${base}/reports`} style={{ color: accent, textDecoration: 'none', fontSize: 13 }}>
              ← Back to Reports
            </Link>
          </div>
        ) : !canAccess ? (
          /* Premium gate wall for direct navigation */
          <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
            <div style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
              padding: '48px 40px',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <svg width="26" height="26" fill="none" stroke={accent} strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </div>
              <h2 style={{
                fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif",
                color: 'var(--tx)', margin: '0 0 12px',
              }}>
                Premium Membership Required
              </h2>
              <p style={{ fontSize: 14, color: 'var(--tx)', fontWeight: 600, margin: '0 0 8px', lineHeight: 1.5 }}>
                {report.title}
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 32px', lineHeight: 1.6 }}>
                This report is available to paid members only. Upgrade your membership to access all premium intelligence reports.
              </p>
              <button
                onClick={() => navigate(`${base}/membership`)}
                style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  background: accent, border: 'none', color: '#fff', borderRadius: 8,
                  padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  marginBottom: 14,
                }}
              >
                Join Now
              </button>
              <Link
                to={`${base}/reports`}
                style={{ display: 'block', textAlign: 'center', fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}
              >
                ← Back to Reports
              </Link>
            </div>
          </div>
        ) : (
          /* Accessible report detail */
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>
            <Link
              to={`${base}/reports`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                color: 'var(--muted)', textDecoration: 'none', fontSize: 13, marginBottom: 32,
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7"/>
              </svg>
              Back to Reports
            </Link>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                padding: '2px 8px', borderRadius: 4,
                background: report.access === 'free' ? 'rgba(16,185,129,0.12)' : `${accent}15`,
                color: report.access === 'free' ? '#6EE7B7' : accent,
              }}>
                {report.access === 'free' ? 'Free' : 'Members Only'}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {catLabel}
              </span>
            </div>
            <h1 style={{
              fontSize: 26, fontWeight: 700, fontFamily: "'Syne', sans-serif",
              color: 'var(--tx)', margin: '0 0 12px', lineHeight: 1.3,
            }}>
              {report.title}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 28 }}>
              {new Date(report.published_at || report.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <div style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '24px', marginBottom: 20,
            }}>
              <p style={{ fontSize: 14, color: 'var(--tx)', lineHeight: 1.7, margin: 0 }}>
                {report.description}
              </p>
            </div>
            {(() => {
              const downloadUrl = getReportDownloadUrl(report);
              return downloadUrl ? (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: accent, color: '#fff', borderRadius: 8,
                    padding: '12px 22px', fontSize: 14, fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                  Download Report
                </a>
              ) : (
                <div style={{
                  background: `${accent}08`, border: `1px solid ${accent}25`,
                  borderRadius: 8, padding: '14px 18px', fontSize: 13, color: 'var(--muted)',
                }}>
                  Full report content and PDF download coming soon.
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--tx)' }}>
      <SourcingNav active="reports" tenantSlug={tenantSlug} tenantName={tenant?.nav_label || tenant?.name} features={tenant?.features} brandColor={tenant?.brand_color} />

      {/* v10 Hero */}
      <div className="browse-hero" style={{ minHeight: 200 }}>
        <div className="browse-hero-bg" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80')" }} />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content">
          <Link to={tenantSlug ? `/${tenantSlug}` : '/'} className="browse-back" style={{ textDecoration: 'none' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
            Back
          </Link>
          <div className="browse-title">Reports & Intelligence</div>
          <div className="browse-sub">Government affairs, acquisition analysis, quarterly intelligence</div>
        </div>
      </div>

      <section style={{ padding: '0 24px 80px', maxWidth: 900, margin: '0 auto' }}>
        <div className="sec-hdr" style={{ padding: '12px 0' }}>
          <div className="sec-title">Latest Reports</div>
        </div>

        {/* Category filters */}
        <div className="chips" style={{ padding: '0 0 20px' }}>
          {CATEGORIES.map(cat => (
            <div
              key={cat.key}
              className={`chip ${category === cat.key ? 'on' : ''}`}
              onClick={() => setCategory(cat.key)}
            >
              {cat.label}
            </div>
          ))}
        </div>

        {/* Reports list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(report => {
            const isPremiumReport = report.access === 'member';
            const locked = isPremiumReport && !isPaid;
            const catLabel = CATEGORIES.find(c => c.key === report.category)?.label || report.category;
            return (
              <div
                key={report.id}
                onClick={() => handleReportClick(report)}
                style={{
                  background: V.card, border: `1px solid ${V.border}`,
                  borderRadius: 10, padding: '20px 24px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = accent + '66'}
                onMouseLeave={e => e.currentTarget.style.borderColor = V.border}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                      {isPremiumReport && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, fontFamily: V.mono,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          padding: '2px 8px', borderRadius: 4,
                          background: `${accent}22`, color: accent,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <svg width="9" height="9" fill={accent} viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                          Premium
                        </span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700, fontFamily: V.mono,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        padding: '2px 8px', borderRadius: 4,
                        background: report.access === 'free' ? 'rgba(16,185,129,0.12)' : `${accent}15`,
                        color: report.access === 'free' ? '#6EE7B7' : accent,
                      }}>
                        {report.access === 'free' ? 'Free' : 'Members Only'}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, fontFamily: V.mono,
                        color: V.dim, textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {catLabel}
                      </span>
                    </div>
                    <h3 style={{
                      fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif",
                      color: V.heading, margin: '0 0 6px',
                    }}>
                      {report.title}
                    </h3>
                    <p style={{
                      fontSize: 13, color: V.muted, fontFamily: V.space,
                      margin: '0 0 8px', lineHeight: 1.6,
                    }}>
                      {report.description}
                    </p>
                    <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                      {new Date(report.published_at || report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {locked ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'transparent', border: `1px solid ${V.border}`,
                        color: V.muted, borderRadius: 6,
                        padding: '8px 14px', fontSize: 12, fontWeight: 600, fontFamily: V.space,
                      }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect x="3" y="11" width="18" height="11" rx="2"/>
                          <path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                        Upgrade
                      </span>
                    ) : (() => {
                      const downloadUrl = getReportDownloadUrl(report);
                      return downloadUrl ? (
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: accent, border: 'none', color: '#fff',
                            borderRadius: 6, padding: '8px 14px', fontSize: 12,
                            fontWeight: 600, fontFamily: V.space, textDecoration: 'none',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                          </svg>
                          Download Report
                        </a>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, padding: '40px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 6 }}>
              No reports in this category yet
            </div>
            <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
              Reports will be added as they become available.
            </div>
          </div>
        )}

        {/* ── Report Downloads ─────────────────────────────────────────────── */}
        <div style={{ marginTop: 48 }}>
          <div className="sec-hdr" style={{ padding: '12px 0' }}>
            <div className="sec-title">Download Reports</div>
          </div>
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, padding: '24px',
          }}>
            <p style={{
              fontSize: 13, color: V.muted, fontFamily: V.space,
              margin: '0 0 20px', lineHeight: 1.6,
            }}>
              Export directory data as a CSV file. Select a report type and click Download.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={downloadType}
                onChange={e => { setDownloadType(e.target.value); setDownloadError(null); }}
                disabled={downloading}
                style={{
                  background: V.card2, border: `1px solid ${V.border}`,
                  color: V.text, borderRadius: 6, padding: '8px 12px',
                  fontSize: 13, fontFamily: V.space, cursor: downloading ? 'not-allowed' : 'pointer',
                  outline: 'none', minWidth: 200,
                }}
              >
                <option value="companies">Company Directory</option>
                <option value="jobs">Jobs Listings</option>
                <option value="reports">Reports Index</option>
              </select>
              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: downloading ? V.card2 : accent,
                  border: `1px solid ${downloading ? V.border : 'transparent'}`,
                  color: downloading ? V.muted : '#fff',
                  borderRadius: 6, padding: '8px 18px', fontSize: 13,
                  fontWeight: 600, fontFamily: V.space,
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {downloading ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    Generating…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                    Download CSV
                  </>
                )}
              </button>
            </div>
            {downloadError && (
              <div style={{
                marginTop: 14, padding: '10px 14px',
                background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.25)',
                borderRadius: 6, fontSize: 13, color: V.rose, fontFamily: V.space,
              }}>
                {downloadError}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Premium gate modal (listing page) ────────────────────────────── */}
      {premiumGateReport && (
        <div
          onClick={() => setPremiumGateReport(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: V.card, border: `1px solid ${V.border}`, borderRadius: 16,
              padding: '40px 36px', maxWidth: 480, width: '100%', textAlign: 'center',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setPremiumGateReport(null)}
              style={{
                position: 'absolute', top: 14, right: 14, background: 'none',
                border: 'none', cursor: 'pointer', color: V.muted, padding: 4,
              }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <svg width="24" height="24" fill="none" stroke={accent} strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </div>
            <h2 style={{
              fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif",
              color: V.heading, margin: '0 0 10px',
            }}>
              Premium Membership Required
            </h2>
            <p style={{ fontSize: 13, color: V.text, fontWeight: 600, margin: '0 0 6px', lineHeight: 1.5 }}>
              {premiumGateReport.title}
            </p>
            <p style={{ fontSize: 13, color: V.muted, margin: '0 0 28px', lineHeight: 1.6 }}>
              Upgrade your membership to unlock all premium intelligence reports.
            </p>
            <button
              onClick={() => navigate(`${base}/membership`)}
              style={{
                display: 'block', width: '100%',
                background: accent, border: 'none', color: '#fff', borderRadius: 8,
                padding: '13px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                marginBottom: 10,
              }}
            >
              Join Now
            </button>
            <button
              onClick={() => setPremiumGateReport(null)}
              style={{
                display: 'block', width: '100%', background: 'none',
                border: `1px solid ${V.border}`, color: V.muted,
                borderRadius: 8, padding: '10px 24px', fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SourcingReports() {
  return (
    <SourcingThemeProvider>
      <SourcingReportsInner />
    </SourcingThemeProvider>
  );
}
