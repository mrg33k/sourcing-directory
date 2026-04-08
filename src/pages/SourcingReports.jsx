import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

// ─── Placeholder reports (until DB table is created) ─────────────────────────
const PLACEHOLDER_REPORTS = [
  {
    id: 1,
    title: 'Q1 2026 Arizona Semiconductor Supply Chain Report',
    category: 'quarterly',
    access: 'free',
    date: '2026-03-31',
    description: 'Quarterly overview of semiconductor supply chain developments in Arizona. TSMC, Intel, and AMD facility updates, workforce trends, and investment analysis.',
  },
  {
    id: 2,
    title: 'Federal Appropriations Tracker -- Arizona Projects',
    category: 'government',
    access: 'member',
    date: '2026-03-15',
    description: 'Tracking active federal appropriations bills affecting Arizona\'s advanced industries. Infrastructure, CHIPS Act funding, and defense allocations.',
  },
  {
    id: 3,
    title: 'Space Industry Acquisition Digest -- March 2026',
    category: 'acquisition',
    access: 'member',
    date: '2026-03-28',
    description: 'Monthly digest of mergers, acquisitions, and strategic partnerships in the aerospace and space industry.',
  },
  {
    id: 4,
    title: 'ACA Economic Growth & Workforce Report',
    category: 'economic',
    access: 'free',
    date: '2026-02-28',
    description: 'Arizona Commerce Authority report on economic development initiatives, workforce pipeline programs, and growth projections for advanced manufacturing.',
  },
];

function SourcingReportsInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { tenant, tenantSlug } = useTenant();
  const base = tenantSlug ? `/${tenantSlug}` : '';
  const accent = tenant?.brand_color || V.accent;
  const [category, setCategory] = useState('all');
  const [authUser, setAuthUser] = useState(null);
  const [memberTier, setMemberTier] = useState('free');

  useEffect(() => {
    document.title = `Reports & Intelligence | ${tenant?.name || 'sourcing.directory'}`;
    if (!supabase) return;
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
    })();
  }, [tenant]);

  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setReports(PLACEHOLDER_REPORTS); setReportsLoading(false); return; }
    (async () => {
      let q = supabase.from('directory_reports').select('*').order('published_at', { ascending: false });
      if (tenant?.id) q = q.eq('tenant_id', tenant.id);
      const { data } = await q;
      setReports(data && data.length > 0 ? data : PLACEHOLDER_REPORTS);
      setReportsLoading(false);
    })();
  }, [tenant]);

  const isPaid = memberTier !== 'free';
  const filtered = reports.filter(r =>
    category === 'all' || r.category === category
  );

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
            const locked = report.access === 'member' && !isPaid;
            const catLabel = CATEGORIES.find(c => c.key === report.category)?.label || report.category;
            return (
              <div key={report.id} style={{
                background: V.card, border: `1px solid ${V.border}`,
                borderRadius: 10, padding: '20px 24px',
                opacity: locked ? 0.7 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
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
                      <Link
                        to={`${base}/membership`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: 'transparent', border: `1px solid ${V.border}`,
                          color: V.muted, textDecoration: 'none', borderRadius: 6,
                          padding: '8px 14px', fontSize: 12, fontWeight: 600, fontFamily: V.space,
                        }}
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect x="3" y="11" width="18" height="11" rx="2"/>
                          <path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                        Upgrade
                      </Link>
                    ) : (
                      <button style={{
                        background: accent, border: 'none', color: '#fff',
                        borderRadius: 6, padding: '8px 14px', fontSize: 12,
                        fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
                      }}>
                        View Report
                      </button>
                    )}
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
      </section>
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
