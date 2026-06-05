// SourcingDealBankInvestorProfile.jsx
// Deal Bank R7c (2026-06-05) — Investors profile page shell.
// Route: /space-rising-v2/deal-bank/investors/:slug.
// Hero with breadcrumb + focus statement + criteria block (check size, deal
// types, last-18-mo deals, LinkedIn). Contact email is intentionally NOT
// rendered to the public DOM — internal-only per the BUILD spec. Empty
// states until the data source lands in a later round.

import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';

const CRITERIA_FIELDS = [
  { key: 'checkSize',     label: 'Check Size' },
  { key: 'dealTypes',     label: 'Deal Types' },
  { key: 'last18Months',  label: 'Last 18 Months' },
  { key: 'linkedin',      label: 'LinkedIn' },
];

function humanizeSlug(slug) {
  if (!slug) return '';
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function SourcingDealBankInvestorProfileInner() {
  const { slug } = useParams();
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);

  const firmName = humanizeSlug(slug);

  return (
    <div
      data-tenant={TENANT_SLUG_V2}
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--tx)',
        position: 'relative',
        fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
        '--bg': 'transparent', '--tx': '#E8E4DA',
        '--tx2': 'rgba(232,228,218,0.60)', '--tx3': 'rgba(232,228,218,0.25)',
        '--s1': 'rgba(11,11,13,0.72)', '--s2': 'rgba(11,11,13,0.82)', '--s3': 'rgba(11,11,13,0.92)',
        '--bd': 'rgba(232,228,218,0.10)', '--bd2': 'rgba(232,228,218,0.16)',
        '--cyan': '#E8A23A', '--cyan-dim': 'rgba(232,162,58,0.10)', '--cyan-brd': 'rgba(232,162,58,0.32)',
      }}
    >
      <div className="browse-hero" style={{ '--page-hero-bg': "url('/v2-assets/earth.png')" }}>
        <div className="browse-hero-bg" />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <div className="browse-hero-toprow">
            <Link to="/space-rising-v2/deal-bank" className="browse-back" style={{ textDecoration: 'none' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
              Deal Bank
            </Link>
            <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
          </div>
          <div className="browse-title">{firmName}.</div>
          <div className="browse-sub">
            Investor firm profile.
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 8px' }}>
        <FocusStatement />
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 24px 24px' }}>
        <CriteriaBlock />
      </div>

      {/* Contact email is internal-only — NEVER rendered to the public DOM.
          The BUILD spec is explicit about this; founders reach out via the
          platform's contact flow, not via a published mailto. */}
    </div>
  );
}

function FocusStatement() {
  return (
    <div
      style={{
        padding: '32px 28px',
        border: '1px solid rgba(232,228,218,0.10)',
        borderRadius: 10,
        background: 'rgba(18,20,28,0.40)',
      }}
    >
      <div
        style={{
          color: 'rgba(232,228,218,0.55)',
          fontSize: 11,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 12,
        }}
      >
        Investment focus
      </div>
      <div style={{ color: 'rgba(232,228,218,0.85)', fontSize: 16, lineHeight: 1.55 }}>
        Focus statement will appear here once the firm publishes their profile — sectors of interest, stages they back, and what makes them a fit for space companies.
      </div>
    </div>
  );
}

function CriteriaBlock() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 1,
        background: 'rgba(232,228,218,0.10)',
        border: '1px solid rgba(232,228,218,0.10)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {CRITERIA_FIELDS.map((field) => (
        <div
          key={field.key}
          style={{
            padding: '18px 20px',
            background: 'rgba(18,20,28,0.50)',
          }}
        >
          <div
            style={{
              color: 'rgba(232,228,218,0.55)',
              fontSize: 10,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 8,
            }}
          >
            {field.label}
          </div>
          <div style={{ color: 'rgba(232,228,218,0.40)', fontSize: 15, fontWeight: 500 }}>
            —
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SourcingDealBankInvestorProfile() {
  return (
    <SourcingThemeProvider>
      <SourcingDealBankInvestorProfileInner />
    </SourcingThemeProvider>
  );
}
