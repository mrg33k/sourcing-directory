// SourcingMembershipV2.jsx (v3 — reskinned to light/navy system)
// Membership pricing page with tier selection. Billing & employee tier logic intact.
// Render inside v3 shell with light tier cards and feature lists.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../osv3-tokens.css';
import '../pages/OSLayoutV3.css';

const FREE_BENEFITS = [
  'Be findable in the directory',
  'Quarterly intelligence reports',
  'Read every job, event, article, and deal',
  'Government affairs + Arsenal updates',
  'Community access',
];

const PREMIUM_BENEFITS = [
  'Everything in Free',
  'Post jobs, events, articles, listings',
  'Monthly research + funding intelligence',
  'Speaking slots + VIP events',
  'Logo placement + press distribution',
];

const EMP_TIERS = [
  { key: 'small', label: '<25 employees',   annual: '$500',   monthly: '$50/mo'  },
  { key: 'mid',   label: '25–199 employees', annual: '$1,000', monthly: '$100/mo' },
  { key: 'large', label: '200+ employees',  annual: '$2,700', monthly: '$250/mo' },
];

function CheckGlyph({ on }) {
  if (on) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="9" fill="var(--v3-accent)" opacity="0.16" />
        <path d="M5.5 9.5l2 2 5-5" stroke="var(--v3-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="9" stroke="var(--v3-border)" strokeWidth="1" />
      <path d="M6 6l6 6M12 6l-6 6" stroke="var(--v3-muted)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TierCard({ kind, title, lede, benefits, footnote, cta, ctaHref, billingChips, activeBilling, onBillingChange, empChips, activeEmp, onEmpChange }) {
  const isPremium = kind === 'premium';
  return (
    <div style={{
      position: 'relative',
      background: 'white',
      border: isPremium ? '1px solid var(--v3-accent)' : '1px solid var(--v3-border)',
      borderRadius: '8px',
      padding: '32px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      transition: 'all var(--v3-transition-fast)',
    }}>
      {isPremium && (
        <div style={{
          position: 'absolute',
          top: '-10px',
          left: '24px',
          background: 'var(--v3-active-nav)',
          color: 'white',
          fontSize: 'var(--v3-label-font-size)',
          fontWeight: 'var(--v3-font-weight-semibold)',
          padding: '4px 10px',
          borderRadius: '4px',
        }}>
          Recommended
        </div>
      )}
      <div>
        <h3 style={{ fontSize: 'var(--v3-h3-font-size)', fontWeight: 'var(--v3-h3-font-weight)', color: 'var(--v3-ink-primary)', margin: 0 }}>
          {title}
        </h3>
        <div style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', marginTop: '8px', lineHeight: 'var(--v3-body-sm-line-height)' }}>
          {lede}
        </div>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {benefits.map((b) => (
          <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-ink-secondary)', lineHeight: 'var(--v3-body-sm-line-height)' }}>
            <CheckGlyph on={true} />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {isPremium && billingChips && (
        <>
          <div style={{ borderTop: '1px solid var(--v3-border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {billingChips.map((chip) => {
                const active = activeBilling === chip.key;
                return (
                  <button
                    key={chip.key}
                    onClick={() => onBillingChange && onBillingChange(chip.key)}
                    style={{
                      flex: '1 1 0',
                      background: active ? 'var(--v3-panel-bg)' : 'white',
                      border: `1px solid ${active ? 'var(--v3-accent)' : 'var(--v3-border)'}`,
                      borderRadius: '6px',
                      padding: '10px 8px',
                      cursor: 'pointer',
                      color: active ? 'var(--v3-accent)' : 'var(--v3-ink-secondary)',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                      fontSize: 'var(--v3-label-font-size)',
                      fontWeight: 'var(--v3-font-weight-medium)',
                    }}
                  >
                    <div>{chip.label}</div>
                    <div style={{ fontSize: 'var(--v3-font-size-xs)', color: 'var(--v3-muted)', marginTop: '4px' }}>
                      {chip.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {empChips && empChips.map((chip) => {
              const active = activeEmp === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => onEmpChange && onEmpChange(chip.key)}
                  style={{
                    flex: '1 1 0',
                    minWidth: '80px',
                    background: active ? 'var(--v3-panel-bg)' : 'white',
                    border: `1px solid ${active ? 'var(--v3-accent)' : 'var(--v3-border)'}`,
                    borderRadius: '6px',
                    padding: '10px 8px',
                    cursor: 'pointer',
                    color: active ? 'var(--v3-accent)' : 'var(--v3-ink-secondary)',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                    fontSize: 'var(--v3-label-font-size)',
                    fontWeight: 'var(--v3-font-weight-medium)',
                  }}
                >
                  <div>{chip.label}</div>
                  <div style={{ fontSize: 'var(--v3-font-size-xs)', color: 'var(--v3-muted)', marginTop: '4px' }}>
                    {chip.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div style={{ borderTop: '1px solid var(--v3-border)', paddingTop: '16px', marginTop: 'auto' }}>
        {footnote && (
          <div style={{ fontSize: 'var(--v3-label-font-size)', color: 'var(--v3-muted)', marginBottom: '12px' }}>
            {footnote}
          </div>
        )}
        <Link
          to={ctaHref}
          style={{
            display: 'block',
            textDecoration: 'none',
            background: isPremium ? 'var(--v3-accent)' : 'white',
            color: isPremium ? 'white' : 'var(--v3-accent)',
            border: `1px solid var(--v3-accent)`,
            padding: '10px 16px',
            borderRadius: '6px',
            fontWeight: 'var(--v3-font-weight-semibold)',
            fontSize: 'var(--v3-body-sm-font-size)',
            textAlign: 'center',
            transition: 'all var(--v3-transition-fast)',
          }}
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

function SourcingMembershipV2Inner() {
  const [billing, setBilling] = useState('annual');
  const [empTier, setEmpTier] = useState('small');

  const tierData = EMP_TIERS.find(t => t.key === empTier) || EMP_TIERS[0];
  const premiumFootnote = billing === 'annual'
    ? `${tierData.annual} · billed once annually`
    : `${tierData.monthly} · recurring monthly`;
  const premiumCtaHref = `/signup?tier=paid&plan=${empTier}-${billing}`;

  const BILLING_CHIPS = [
    { key: 'annual',  label: 'Annual',  sub: 'billed once/year' },
    { key: 'monthly', label: 'Monthly', sub: 'recurring' },
  ];

  const EMP_CHIPS = EMP_TIERS.map(t => ({
    key: t.key,
    label: t.label,
    sub: billing === 'annual' ? t.annual : t.monthly,
  }));

  return (
    <div className="osv3 osv3-shell">
      <div className="osv3-sidebar">
        <div className="osv3-sidebar-logo">Space OS</div>
        <div className="osv3-sidebar-divider" />
      </div>
      <div className="osv3-main-container">
        <div className="osv3-topbar">
          <div className="osv3-search-container"></div>
          <div className="osv3-topbar-actions"></div>
        </div>
        <div className="osv3-content">
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '48px' }}>
              <h1 style={{ fontSize: 'var(--v3-h1-font-size)', fontWeight: 'var(--v3-h1-font-weight)', color: 'var(--v3-ink-primary)', margin: '0 0 8px' }}>
                Organization Membership
              </h1>
              <p style={{ fontSize: 'var(--v3-body-font-size)', color: 'var(--v3-muted)', margin: '0', lineHeight: 'var(--v3-body-line-height)', maxWidth: '50ch' }}>
                Choose how you want to engage with Space OS.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '64px' }}>
              <TierCard
                kind="free"
                title="Free"
                lede="Explore at your pace. Read and connect."
                benefits={FREE_BENEFITS}
                footnote="No card required"
                cta="Start Exploring"
                ctaHref="/signup?tier=free"
              />
              <TierCard
                kind="premium"
                title="Premium"
                lede="Full access to post, lead, and access exclusive features."
                benefits={PREMIUM_BENEFITS}
                footnote={premiumFootnote}
                cta="Become a Member"
                ctaHref={premiumCtaHref}
                billingChips={BILLING_CHIPS}
                activeBilling={billing}
                onBillingChange={setBilling}
                empChips={EMP_CHIPS}
                activeEmp={empTier}
                onEmpChange={setEmpTier}
              />
            </div>

            <div style={{ marginBottom: '64px' }}>
              <h2 style={{ fontSize: 'var(--v3-eyebrow-font-size)', fontWeight: 'var(--v3-eyebrow-font-weight)', color: 'var(--v3-muted)', letterSpacing: 'var(--v3-eyebrow-letter-spacing)', textTransform: 'uppercase', marginBottom: '16px' }}>
                Pricing by company size
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {EMP_TIERS.map((t) => (
                  <div
                    key={t.key}
                    style={{
                      padding: '16px',
                      border: `1px solid ${empTier === t.key ? 'var(--v3-accent)' : 'var(--v3-border)'}`,
                      borderRadius: '8px',
                      background: empTier === t.key ? 'var(--v3-panel-bg)' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => setEmpTier(t.key)}
                  >
                    <div style={{ fontSize: 'var(--v3-label-font-size)', fontWeight: 'var(--v3-font-weight-medium)', color: 'var(--v3-muted)', marginBottom: '8px' }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 'var(--v3-font-size-2xl)', fontWeight: 'var(--v3-font-weight-bold)', color: empTier === t.key ? 'var(--v3-accent)' : 'var(--v3-ink-primary)', marginBottom: '4px' }}>
                      {t.annual}
                    </div>
                    <div style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)' }}>
                      or {t.monthly} monthly
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SourcingMembershipV2() {
  return <SourcingMembershipV2Inner />;
}
