// SourcingMembershipV2.jsx
// nat-geo-uplift R5g — Membership landing in the V2 system.
//
// Premium feel for BOTH paths. Patrik 2026-05-30: "whether you're signing up
// for free or for the premium experience that should feel premium." Free
// and Premium are presented as equal-weight doors — the amber-frame lockup
// on the Premium card is the only visual differentiator. The full benefit
// breakdown is laid out as editorial scroll-strips below the cards (one
// section per concept: Intelligence / Visibility / Access / Tools / Congress)
// with rule lines between, mono-caps labels, period-treated headlines.
//
// The signup flow modal that fires on CTA click is the next round (R5h);
// for now the CTAs link to /space-rising-v2/signup which routes to V1.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import { V2ChipNav } from './V2ChipNav.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';

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

const SEAT_TIERS = [
  { range: '1–4 seats',   price: '$1,000', perMo: '~$83/mo per seat' },
  { range: '5–14 seats',  price: '$850',   perMo: '~$71/mo per seat', recommended: true },
  { range: '15–49 seats', price: '$700',   perMo: '~$58/mo per seat' },
  { range: '50+ seats',   price: 'Custom', perMo: 'Contact us' },
];

const BENEFIT_STRIPS = [
  {
    label: 'Intelligence',
    title: 'See what the industry sees.',
    body: 'Monthly research, funding round summaries, contract awards, and grant calls — curated for the room before they hit the broader market.',
    items: [
      'Monthly research, contracts, and funding reports',
      'Full access to submit articles, events, and job listings',
      'KPI dashboard — views, referrals, analytics',
      'Tailored grant notifications, early access',
    ],
    bg: '/v2-assets/sun.png',
  },
  {
    label: 'Visibility',
    title: 'Be the one they call.',
    body: 'Your logo lives on the platform. Your certifications surface in the right searches. You show up where buyers are already looking.',
    items: [
      'Company logo on the platform',
      'Featured presence at expos, congresses, events',
      'Inclusion in the Congress Action Blueprint',
      'Press release distribution',
      'Publish your events, webinars, and seminars',
      'Recognition across events and briefings',
    ],
    bg: '/v2-assets/earth.png',
  },
  {
    label: 'Access',
    title: 'A real room. Not a directory.',
    body: 'Speaking opportunities, VIP events, curated connections, early invites to monthly space activations across the state.',
    items: [
      'Full sourcing directory access',
      'Speaking opportunities and briefings',
      'VIP events and curated connections',
      'Priority early invites to monthly space activations',
      'Discount codes for all events, seminars, and activities',
      'Film and documentary screenings',
    ],
    bg: '/v2-assets/rocket-orbital.png',
  },
  {
    label: 'Tools',
    title: 'Hire, sell, and find work — in one place.',
    body: 'Job posts that reach the right talent, an equipment exchange that moves real capacity, and early access to the RFP database when it lands this summer.',
    items: [
      'Job posting distribution and talent visibility',
      'Equipment exchange access (buy, sell, trade)',
      'Early access to the RFP database (summer)',
    ],
    bg: '/v2-assets/asteroid-distant.png',
  },
  {
    label: 'Congress',
    title: 'Show up at Space Congress.',
    body: 'Member-only discounts on the Expo Booth and Congress Registration. Priority panel consideration. Speaker submission slots.',
    items: [
      'Discount on Expo Booth',
      'Discount on Congress Registrations',
      'Priority panel consideration',
      'Opportunities to submit speakers',
    ],
    bg: '/v2-assets/planet-red.png',
  },
];

const COMPARISON = [
  { feature: 'Directory listing',                   free: true,  paid: true },
  { feature: 'Quarterly intelligence reports',      free: true,  paid: true },
  { feature: 'Government affairs + Arsenal updates',free: true,  paid: true },
  { feature: 'Community access',                    free: true,  paid: true },
  { feature: 'View jobs, events, articles, deals',  free: true,  paid: true },
  { feature: 'Grants access',                       free: false, paid: true },
  { feature: 'Post articles',                       free: false, paid: true },
  { feature: 'Post job listings',                   free: false, paid: true },
  { feature: 'Post events',                         free: false, paid: true },
  { feature: 'Marketplace — buy / sell / trade',    free: false, paid: true },
  { feature: 'Monthly research + funding reports',  free: false, paid: true },
  { feature: 'KPI dashboard + analytics',           free: false, paid: true },
  { feature: 'Company logo on platform',            free: false, paid: true },
  { feature: 'Press release distribution',          free: false, paid: true },
  { feature: 'Speaking opportunities + VIP events', free: false, paid: true },
  { feature: 'Congress discounts + priority',       free: false, paid: true },
  { feature: 'Tailored grant notifications',        free: false, paid: true },
  { feature: 'Early access to RFP database',        free: false, paid: true },
];

function CheckGlyph({ on }) {
  if (on) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="9" fill="#E8A23A" opacity="0.16" />
        <path d="M5.5 9.5l2 2 5-5" stroke="#E8A23A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="9" stroke="rgba(232,228,218,0.18)" strokeWidth="1" />
      <path d="M6 6l6 6M12 6l-6 6" stroke="rgba(232,228,218,0.3)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TierCard({ kind, title, lede, benefits, footnote, cta, ctaHref }) {
  const isPremium = kind === 'premium';
  return (
    <div
      style={{
        position: 'relative',
        background: isPremium ? 'rgba(11,11,13,0.92)' : 'rgba(10,11,14,0.86)',
        border: isPremium ? '1px solid rgba(232,162,58,0.45)' : '1px solid rgba(232,228,218,0.08)',
        borderRadius: 12,
        padding: '40px 36px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        boxShadow: isPremium
          ? '0 0 0 1px rgba(232,162,58,0.10) inset, 0 14px 44px rgba(0,0,0,0.4)'
          : '0 2px 12px rgba(0,0,0,0.25)',
      }}
    >
      {isPremium && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            left: 36,
            background: '#E8A23A',
            color: '#0B0B0D',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            fontWeight: 700,
          }}
        >
          Members
        </div>
      )}
      <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em', color: isPremium ? '#E8A23A' : 'rgba(232,228,218,0.5)', textTransform: 'uppercase' }}>
        {kind === 'free' ? 'Free' : 'Membership'}
      </div>
      <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 36, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.01em', color: '#E8E4DA' }}>
        {title}<span style={{ color: '#E8A23A' }}>.</span>
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.55, color: 'rgba(232,228,218,0.7)', maxWidth: '40ch' }}>
        {lede}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {benefits.map((b) => (
          <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 14, color: '#E8E4DA', lineHeight: 1.45 }}>
            <CheckGlyph on={true} />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div style={{ borderTop: '1px solid rgba(232,228,218,0.08)', paddingTop: 20, marginTop: 'auto' }}>
        {footnote && (
          <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, letterSpacing: '0.12em', color: 'rgba(232,228,218,0.5)', textTransform: 'uppercase', marginBottom: 14 }}>
            {footnote}
          </div>
        )}
        <Link
          to={ctaHref}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            textDecoration: 'none',
            background: isPremium ? '#E8A23A' : 'transparent',
            color: isPremium ? '#0B0B0D' : '#E8E4DA',
            border: isPremium ? '1px solid #E8A23A' : '1px solid rgba(232,228,218,0.24)',
            padding: '14px 22px',
            borderRadius: 999,
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.02em',
            transition: 'all 0.16s ease',
          }}
        >
          {cta}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function BenefitStrip({ label, title, body, items, bg, flipped }) {
  return (
    <section
      style={{
        position: 'relative',
        padding: '88px 0',
        borderTop: '1px solid rgba(232,228,218,0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(rgba(11,11,13,0.92), rgba(11,11,13,0.88)), url(${bg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.6,
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1140,
          margin: '0 auto',
          padding: '0 32px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 80,
          alignItems: 'center',
          direction: flipped ? 'rtl' : 'ltr',
        }}
      >
        <div style={{ direction: 'ltr' }}>
          <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em', color: '#E8A23A', textTransform: 'uppercase', marginBottom: 18 }}>
            {label}
          </div>
          <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 'clamp(32px, 3.4vw, 48px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.01em', color: '#E8E4DA', margin: 0 }}>
            {title}<span style={{ color: '#E8A23A' }}>.</span>
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: 'rgba(232,228,218,0.78)', marginTop: 18, maxWidth: '42ch' }}>
            {body}
          </p>
        </div>
        <ul style={{ direction: 'ltr', listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, fontSize: 14, color: 'rgba(232,228,218,0.92)', lineHeight: 1.45, paddingBottom: 14, borderBottom: '1px solid rgba(232,228,218,0.06)' }}>
              <CheckGlyph on={true} />
              <span>{i}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SourcingMembershipV2Inner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const [compareOpen, setCompareOpen] = useState(false);
  const [seats, setSeats] = useState(5);

  // Pricing math — matches V1 thresholds
  const ppm = seats <= 4 ? 1000 : seats <= 14 ? 850 : seats <= 49 ? 700 : null;
  const totalMo = ppm ? Math.round((ppm * seats) / 12) : null;

  return (
    <div
      data-tenant={TENANT_SLUG_V2}
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--tx)',
        position: 'relative',
        fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
        '--bg': 'transparent',
        '--tx': '#E8E4DA',
        '--tx2': 'rgba(232,228,218,0.60)',
        '--tx3': 'rgba(232,228,218,0.25)',
        '--s1': 'rgba(11,11,13,0.72)',
        '--s2': 'rgba(11,11,13,0.82)',
        '--s3': 'rgba(11,11,13,0.92)',
        '--bd': 'rgba(232,228,218,0.10)',
        '--bd2': 'rgba(232,228,218,0.16)',
        '--cyan': '#E8A23A',
        '--cyan-dim': 'rgba(232,162,58,0.10)',
        '--cyan-brd': 'rgba(232,162,58,0.32)',
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        .v2-membership-cta:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(232,162,58,0.3); }
      `}</style>

      <div className="browse-hero" style={{ '--page-hero-bg': "url('/v2-assets/planet-blue.png')" }}>
        <div className="browse-hero-bg" />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <Link to="/space-rising-v2" className="browse-back" style={{ textDecoration: 'none' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
            Back
          </Link>
          <div className="browse-title">Be in the room.</div>
          <div className="browse-sub">
            Where Arizona&rsquo;s space industry decides what gets built next.
          </div>
          <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
        </div>
      </div>

      <V2ChipNav active="membership" />

      {/* Two-up tier cards — the conversion centerpiece */}
      <section
        style={{
          maxWidth: 1140,
          margin: '56px auto 0',
          padding: '0 32px',
        }}
      >
        <div className="sec-hdr" style={{ maxWidth: 'none', padding: 0, marginBottom: 32 }}>
          <div className="sec-title" style={{ whiteSpace: 'normal' }}>Pick how you walk in.</div>
          <div className="sec-count">
            <span style={{ color: 'var(--tx3)', fontSize: 12, fontFamily: 'JetBrains Mono, ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Two doors, same room
            </span>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 28,
          }}
        >
          <TierCard
            kind="free"
            title="Watch from the floor"
            lede="Get on the map and read the room. Free forever — listing, reports, jobs, deals, events, all readable."
            benefits={FREE_BENEFITS}
            footnote="No card required"
            cta="Join Free"
            ctaHref="/space-rising-v2/signup?tier=free"
          />
          <TierCard
            kind="premium"
            title="Join the room"
            lede="Full posting privileges, deep intelligence reports, speaking slots, member events, logo placement, and Congress discounts."
            benefits={PREMIUM_BENEFITS}
            footnote={`From $700 / seat / yr · billed annually`}
            cta="Become a Member"
            ctaHref="/space-rising-v2/signup?tier=paid"
          />
        </div>
      </section>

      {/* Seat-pricing band — premium pricing detail without overwhelming */}
      <section style={{ maxWidth: 1140, margin: '56px auto 0', padding: '0 32px' }}>
        <div
          style={{
            border: '1px solid rgba(232,228,218,0.10)',
            background: 'rgba(10,11,14,0.62)',
            borderRadius: 12,
            padding: '32px 36px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 48,
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em', color: '#E8A23A', textTransform: 'uppercase', marginBottom: 14 }}>
              Per-seat pricing
            </div>
            <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 26, fontWeight: 700, lineHeight: 1.15, color: '#E8E4DA', marginBottom: 10 }}>
              Price drops as the team grows.
            </div>
            <div style={{ fontSize: 14, color: 'rgba(232,228,218,0.65)', lineHeight: 1.55 }}>
              Adjust seats below to see what your team would pay. Billed annually.
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
              <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 48, fontWeight: 800, color: '#E8E4DA', lineHeight: 1 }}>
                {seats}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(232,228,218,0.55)' }}>
                {seats === 1 ? 'seat' : 'seats'}
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: '"Space Grotesk", sans-serif', fontSize: 26, fontWeight: 700, color: '#E8A23A' }}>
                {ppm ? `$${ppm}` : 'Custom'}
                {ppm && <span style={{ fontSize: 13, color: 'rgba(232,228,218,0.55)', fontWeight: 400, marginLeft: 6 }}>/seat/yr</span>}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#E8A23A' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(232,228,218,0.45)', textTransform: 'uppercase' }}>
              <span>1</span>
              <span>{totalMo ? `~$${totalMo.toLocaleString()}/mo total` : 'Contact for 50+'}</span>
              <span>50+</span>
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
          }}
        >
          {SEAT_TIERS.map((t) => (
            <div
              key={t.range}
              style={{
                padding: '14px 16px',
                border: `1px solid ${t.recommended ? 'rgba(232,162,58,0.32)' : 'rgba(232,228,218,0.08)'}`,
                borderRadius: 8,
                background: t.recommended ? 'rgba(232,162,58,0.06)' : 'rgba(10,11,14,0.42)',
              }}
            >
              <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.14em', color: 'rgba(232,228,218,0.55)', textTransform: 'uppercase', marginBottom: 6 }}>
                {t.range}
              </div>
              <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 20, fontWeight: 700, color: t.recommended ? '#E8A23A' : '#E8E4DA' }}>
                {t.price}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(232,228,218,0.5)', marginTop: 4 }}>{t.perMo}</div>
            </div>
          ))}
        </div>
      </section>

      {/* "What's in the room" — full benefits as editorial strips */}
      <section style={{ marginTop: 96 }}>
        <div style={{ maxWidth: 1140, margin: '0 auto 0', padding: '0 32px' }}>
          <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em', color: '#E8A23A', textTransform: 'uppercase', marginBottom: 14 }}>
            What&rsquo;s in the room
          </div>
          <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 'clamp(36px, 4vw, 56px)', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.015em', color: '#E8E4DA', margin: 0, maxWidth: '18ch' }}>
            Five things every member gets<span style={{ color: '#E8A23A' }}>.</span>
          </h2>
        </div>
        {BENEFIT_STRIPS.map((s, i) => (
          <BenefitStrip key={s.label} {...s} flipped={i % 2 === 1} />
        ))}
      </section>

      {/* Comparison — collapsible "what's the difference" */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '64px 32px 24px' }}>
        <button
          onClick={() => setCompareOpen((v) => !v)}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid rgba(232,228,218,0.12)',
            borderRadius: 10,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            color: 'inherit',
            fontFamily: '"Space Grotesk", sans-serif',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, color: '#E8E4DA' }}>
            See what&rsquo;s different between Free and Members
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, letterSpacing: '0.16em', color: '#E8A23A', textTransform: 'uppercase' }}>
            {compareOpen ? 'Hide' : 'Show'} table
          </span>
        </button>
        {compareOpen && (
          <div style={{ marginTop: 16, border: '1px solid rgba(232,228,218,0.10)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', padding: '14px 24px', borderBottom: '1px solid rgba(232,228,218,0.10)', background: 'rgba(10,11,14,0.62)' }}>
              <span style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, letterSpacing: '0.14em', color: 'rgba(232,228,218,0.55)', textTransform: 'uppercase' }}>Feature</span>
              <span style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, letterSpacing: '0.14em', color: 'rgba(232,228,218,0.55)', textTransform: 'uppercase' }}>Free</span>
              <span style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, letterSpacing: '0.14em', color: '#E8A23A', textTransform: 'uppercase' }}>Members</span>
            </div>
            {COMPARISON.map((row, idx) => (
              <div
                key={row.feature}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 110px 110px',
                  alignItems: 'center',
                  padding: '14px 24px',
                  borderBottom: idx < COMPARISON.length - 1 ? '1px solid rgba(232,228,218,0.06)' : 'none',
                  fontSize: 14,
                  color: '#E8E4DA',
                }}
              >
                <span>{row.feature}</span>
                <span style={{ display: 'flex', justifyContent: 'center' }}><CheckGlyph on={row.free} /></span>
                <span style={{ display: 'flex', justifyContent: 'center' }}><CheckGlyph on={row.paid} /></span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Final CTA stripe */}
      <section style={{ borderTop: '1px solid rgba(232,228,218,0.08)', marginTop: 56, padding: '88px 32px 120px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em', color: '#E8A23A', textTransform: 'uppercase', marginBottom: 18 }}>
            Pick a door
          </div>
          <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 'clamp(32px, 3.6vw, 52px)', fontWeight: 800, lineHeight: 1.05, color: '#E8E4DA', margin: 0 }}>
            Decide who you want to be in this industry<span style={{ color: '#E8A23A' }}>.</span>
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: 'rgba(232,228,218,0.72)', marginTop: 22, maxWidth: '48ch', marginLeft: 'auto', marginRight: 'auto' }}>
            Watch from the floor or join the room. Either way, you&rsquo;re on the map and you&rsquo;re in the conversation.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 36, flexWrap: 'wrap' }}>
            <Link
              to="/space-rising-v2/signup?tier=free"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                textDecoration: 'none',
                background: 'transparent',
                color: '#E8E4DA',
                border: '1px solid rgba(232,228,218,0.30)',
                padding: '16px 32px',
                borderRadius: 999,
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Join Free
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
            </Link>
            <Link
              to="/space-rising-v2/signup?tier=paid"
              className="v2-membership-cta"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                textDecoration: 'none',
                background: '#E8A23A',
                color: '#0B0B0D',
                border: '1px solid #E8A23A',
                padding: '16px 32px',
                borderRadius: 999,
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: 14,
                transition: 'all 0.16s ease',
              }}
            >
              Become a Member
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SourcingMembershipV2() {
  return (
    <SourcingThemeProvider>
      <SourcingMembershipV2Inner />
    </SourcingThemeProvider>
  );
}
