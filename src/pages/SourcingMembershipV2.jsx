// SourcingMembershipV2.jsx (v3 — free-only, no pricing tiers)
// Single free membership CTA. No dollar amounts, no tier selectors.

import React from 'react';
import { Link } from 'react-router-dom';
import '../osv3-tokens.css';
import '../pages/OSLayoutV3.css';
import { useSiteContentBySlug } from '../hooks/useSiteContent';

const FREE_BENEFITS = [
  'Be findable in the directory',
  'Quarterly intelligence reports',
  'Read every job, event, article, and deal',
  'Government affairs + Arsenal updates',
  'Community access',
];

function CheckGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="9" fill="var(--v3-accent)" opacity="0.16" />
      <path d="M5.5 9.5l2 2 5-5" stroke="var(--v3-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SourcingMembershipV2() {
  const { get } = useSiteContentBySlug('space-rising');

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: 'var(--v3-h1-font-size)', fontWeight: 'var(--v3-h1-font-weight)', color: 'var(--v3-ink-primary)', margin: '0 0 8px' }}>
          {get('membership', 'headline', 'Join Space Rising')}
        </h1>
        <p style={{ fontSize: 'var(--v3-body-font-size)', color: 'var(--v3-muted)', margin: 0, lineHeight: 'var(--v3-body-line-height)', maxWidth: '50ch' }}>
          {get('membership', 'subcopy', 'Membership is free. Sign up and access everything SpaceOS has to offer.')}
        </p>
      </div>

      <div style={{
        background: 'white',
        border: '1px solid var(--v3-border)',
        borderRadius: '8px',
        padding: '32px 24px',
        marginBottom: '32px',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: 'var(--v3-label-font-size)', fontWeight: 'var(--v3-font-weight-semibold)', color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 'var(--v3-eyebrow-letter-spacing)', marginBottom: '4px' }}>
            Member access
          </div>
          <div style={{ fontSize: 'var(--v3-font-size-2xl)', fontWeight: 'var(--v3-font-weight-bold)', color: 'var(--v3-ink-primary)' }}>
            Free
          </div>
          <div style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', marginTop: '4px' }}>
            No card required
          </div>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {FREE_BENEFITS.map((b) => (
            <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-ink-secondary)', lineHeight: 'var(--v3-body-sm-line-height)' }}>
              <CheckGlyph />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <Link
          to="/signup?tier=free"
          style={{
            display: 'block',
            textDecoration: 'none',
            background: 'var(--v3-accent)',
            color: 'white',
            border: '1px solid var(--v3-accent)',
            padding: '12px 20px',
            borderRadius: '6px',
            fontWeight: 'var(--v3-font-weight-semibold)',
            fontSize: 'var(--v3-body-sm-font-size)',
            textAlign: 'center',
          }}
        >
          Become a Member
        </Link>
      </div>
    </div>
  );
}
