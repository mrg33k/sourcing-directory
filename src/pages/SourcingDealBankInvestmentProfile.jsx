// SourcingDealBankInvestmentProfile.jsx
// Deal Bank R7b (2026-06-05) — Investments profile page shell.
// Route: /space-rising-v2/deal-bank/investments/:slug.
// Hero with breadcrumb + top-fields block (Seeking / Offering / Minimum /
// Min Investments / Round / Value Proposition) + four-tab content area
// (Profile / Video / Pitch Deck / Team). No data wired in R7b — every
// tab + field renders an honest empty state. Data lands in a later round.

import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';

const TABS = [
  { slug: 'profile',     label: 'Profile' },
  { slug: 'video',       label: 'Video' },
  { slug: 'pitch-deck',  label: 'Pitch Deck' },
  { slug: 'team',        label: 'Team' },
];

const TOP_FIELDS = [
  { key: 'seeking',          label: 'Seeking' },
  { key: 'offering',         label: 'Offering' },
  { key: 'minimum',          label: 'Minimum' },
  { key: 'minInvestments',   label: 'Min Investments' },
  { key: 'round',            label: 'Round' },
  { key: 'valueProposition', label: 'Value Proposition' },
];

function humanizeSlug(slug) {
  if (!slug) return '';
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function SourcingDealBankInvestmentProfileInner() {
  const { slug } = useParams();
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);

  const [activeTab, setActiveTab] = useState('profile');
  const companyName = humanizeSlug(slug);

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
          <div className="browse-title">{companyName}.</div>
          <div className="browse-sub">
            Investment profile.
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 16px' }}>
        <TopFieldsBlock />
      </div>

      <div className="chips" style={{ paddingBottom: 4 }} role="tablist" aria-label="Investment profile sections">
        {TABS.map((tab) => (
          <button
            key={tab.slug}
            type="button"
            role="tab"
            aria-selected={tab.slug === activeTab}
            onClick={() => setActiveTab(tab.slug)}
            className={`chip${tab.slug === activeTab ? ' on' : ''}`}
            style={{ font: 'inherit', cursor: 'pointer' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <TabPanel tab={activeTab} companyName={companyName} />
      </div>
    </div>
  );
}

function TopFieldsBlock() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 1,
        background: 'rgba(232,228,218,0.10)',
        border: '1px solid rgba(232,228,218,0.10)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {TOP_FIELDS.map((field) => (
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

function TabPanel({ tab, companyName }) {
  if (tab === 'profile') {
    return (
      <EmptyTab
        eyebrow="Profile"
        title="Company profile coming soon."
        body={`Exec summary, headline, founding story, segment, and region will appear here once ${companyName || 'this company'} completes their investment profile.`}
      />
    );
  }
  if (tab === 'video') {
    return (
      <EmptyTab
        eyebrow="Video"
        title="Pitch video not posted yet."
        body="Loom, YouTube, or Vimeo embed will play here once the company adds a pitch video."
      />
    );
  }
  if (tab === 'pitch-deck') {
    return (
      <EmptyTab
        eyebrow="Pitch Deck"
        title="Deck not posted yet."
        body="Inline deck viewer + public download will appear here once the company uploads a pitch deck."
      />
    );
  }
  if (tab === 'team') {
    return (
      <EmptyTab
        eyebrow="Team"
        title="Team not posted yet."
        body="Up to four leadership entries — name, photo, bio, LinkedIn — will appear here."
      />
    );
  }
  return null;
}

function EmptyTab({ eyebrow, title, body }) {
  return (
    <div
      style={{
        padding: '56px 24px',
        textAlign: 'center',
        border: '1px solid rgba(232,228,218,0.10)',
        borderRadius: 10,
        background: 'rgba(18,20,28,0.40)',
      }}
    >
      <div style={{ color: 'rgba(232,228,218,0.55)', fontSize: 11, fontFamily: 'JetBrains Mono, ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
        {eyebrow}
      </div>
      <div style={{ color: 'var(--tx)', fontSize: 22, fontWeight: 600, lineHeight: 1.2, marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ color: 'rgba(232,228,218,0.70)', fontSize: 14, lineHeight: 1.55, maxWidth: 560, margin: '0 auto' }}>
        {body}
      </div>
    </div>
  );
}

export default function SourcingDealBankInvestmentProfile() {
  return (
    <SourcingThemeProvider>
      <SourcingDealBankInvestmentProfileInner />
    </SourcingThemeProvider>
  );
}
