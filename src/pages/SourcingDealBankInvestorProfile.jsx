// SourcingDealBankInvestorProfile.jsx
// Deal Bank R6 (Round A, 2026-06-09) — Investors profile page.
// Route: /space-rising-v2/deal-bank/investors/:slug.
// Reads real firm data from deal_bank_investors table (approved status only).
// Hero with breadcrumb + focus statement + criteria block (check size, deal
// types, last-18-mo deals, LinkedIn). Contact email is intentionally NOT
// rendered to the public DOM — internal-only per the BUILD spec.

import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
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
  const [firm, setFirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchFirm = async () => {
      try {
        // Search for firm by slug or exact name match
        const { data, error } = await supabase
          .from('deal_bank_investors')
          .select('*')
          .eq('status', 'approved')
          .or(`firm_name.ilike.%${slug.replace(/-/g, ' ')}%`)
          .limit(1)
          .single();

        if (error || !data) {
          setNotFound(true);
        } else {
          setFirm(data);
        }
      } catch (err) {
        console.error('Error fetching firm:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchFirm();
  }, [slug]);

  if (loading) {
    return (
      <div
        data-tenant="space-rising-v2"
        style={{
          minHeight: '100dvh',
          background: 'var(--bg)',
          color: 'var(--tx)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (notFound || !firm) {
    return (
      <div
        data-tenant="space-rising-v2"
        style={{
          minHeight: '100dvh',
          background: 'var(--bg)',
          color: 'var(--tx)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, marginBottom: 16 }}>Firm not found.</div>
          <Link
            to="/space-rising-v2/deal-bank?tab=investors"
            style={{ fontSize: 12, color: 'var(--cyan)', textDecoration: 'none' }}
          >
            Back to Investors
          </Link>
        </div>
      </div>
    );
  }

  const firmName = firm.firm_name;

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
        <FocusStatement firm={firm} />
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 24px 8px' }}>
        <CriteriaBlock firm={firm} />
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 24px 48px' }}>
        <ConnectCard firmName={firmName} />
      </div>

      {/* Contact email is internal-only — NEVER rendered to the public DOM.
          The BUILD spec is explicit about this; founders reach out via the
          platform's contact flow, not via a published mailto. */}
    </div>
  );
}

function ConnectCard({ firmName }) {
  const label = firmName || 'this firm';
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
        How to connect
      </div>
      <div style={{ color: 'rgba(232,228,218,0.85)', fontSize: 16, lineHeight: 1.55, marginBottom: 16 }}>
        {`Reach ${label} through Space Rising. Founders raising in the Deal Bank can request an intro — we handle the routing so investor inboxes stay clean.`}
      </div>
      <div style={{ color: 'var(--cyan)', fontSize: 12, fontFamily: 'JetBrains Mono, ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.10em' }}>
        Intro request flow opening soon.
      </div>
    </div>
  );
}

function FocusStatement({ firm }) {
  const hasCriteria = firm && firm.criteria;
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
        {hasCriteria
          ? firm.criteria
          : "This firm hasn't published their investment criteria yet."}
      </div>
    </div>
  );
}

function CriteriaBlock({ firm }) {
  const getFieldValue = (field) => {
    if (!firm) return '—';
    switch (field.key) {
      case 'checkSize':
        if (firm.check_size_min && firm.check_size_max) {
          return `$${(firm.check_size_min / 1000000).toFixed(1)}M – $${(firm.check_size_max / 1000000).toFixed(1)}M`;
        }
        return '—';
      case 'dealTypes':
        return firm.deal_types && firm.deal_types.length > 0 ? firm.deal_types.join(', ') : '—';
      case 'last18Months':
        return firm.deals_last_18mo ? `${firm.deals_last_18mo} deals` : '—';
      case 'linkedin':
        return firm.linkedin_url ? (
          <a
            href={firm.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--cyan)', textDecoration: 'none' }}
          >
            Profile →
          </a>
        ) : (
          '—'
        );
      default:
        return '—';
    }
  };

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
            {getFieldValue(field)}
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
