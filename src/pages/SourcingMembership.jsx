import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingNav } from './SourcingMarketplace.jsx';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

// ─── Pricing tiers ───────────────────────────────────────────────────────────
const PRICING_TIERS = [
  { seats: '1-4 seats',  price: '$1,000', perMonth: '~$83/mo per seat',  highlight: false },
  { seats: '5-14 seats', price: '$850',   perMonth: '~$71/mo per seat',  highlight: true },
  { seats: '15-49 seats', price: '$700',  perMonth: '~$58/mo per seat',  highlight: false },
  { seats: '50+ seats',  price: 'Custom', perMonth: 'Contact us',        highlight: false },
];

// ─── Benefits breakdown ──────────────────────────────────────────────────────
const BENEFIT_SECTIONS = [
  {
    title: 'Intelligence',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M9 17H7A5 5 0 017 7h2m6 10h2a5 5 0 000-10h-2M8 12h8"/>
      </svg>
    ),
    items: [
      'Monthly Research, Contracts & Funding Reports',
      'Full access to submit articles, events, and job listings',
      'KPI dashboard (views, referrals, analytics)',
      'Tailored Grant Notifications (Early Access)',
    ],
  },
  {
    title: 'Visibility',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
    items: [
      'Company logo on platform',
      'Featured presence at Expos, Congresses & Events',
      'Inclusion (logo) in Congress Action Blueprint',
      'Recognition across events & briefings',
      'Publish your events, webinars & seminars',
      'Press release distribution',
    ],
  },
  {
    title: 'Access',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    ),
    items: [
      'Full Sourcing Directory access',
      'Speaking opportunities & briefings',
      'VIP events & curated connections',
      'Connect with other industry professionals',
      'Priority early invites to monthly space activations',
      'Discount codes for all events, seminars & activities',
      'Film & documentary screenings',
    ],
  },
  {
    title: 'Tools',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
    items: [
      'Job posting distribution & talent visibility',
      'Equipment exchange access (buy, sell, trade)',
      'Early access to RFP database (coming summer)',
    ],
  },
  {
    title: 'Congress',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    items: [
      'Discount on Expo Booth',
      'Discount on Congress Registrations',
      'Priority Panel Consideration',
      'Opportunities to Submit Speakers',
    ],
  },
];

// ─── Free tier benefits ──────────────────────────────────────────────────────
const FREE_BENEFITS = [
  'Directory Listing',
  'Quarterly Intelligence Reports',
  'Government Affairs & Arsenal updates',
  'Access to Community',
  'View Careers listings',
  'View Events',
  'Read Media & Articles',
  'Funding, Appropriations & Grants access',
];

// ─── Comparison table ────────────────────────────────────────────────────────
const COMPARISON = [
  { feature: 'Directory Listing',              free: true,  paid: true },
  { feature: 'Quarterly Intelligence Reports', free: true,  paid: true },
  { feature: 'Government Affairs & Arsenal',   free: true,  paid: true },
  { feature: 'Community Access',               free: true,  paid: true },
  { feature: 'View Jobs, Events & Articles',   free: true,  paid: true },
  { feature: 'Grants Access',                  free: false, paid: true },
  { feature: 'Post Articles',                  free: false, paid: true },
  { feature: 'Post Job Listings',              free: false, paid: true },
  { feature: 'Post Events',                    free: false, paid: true },
  { feature: 'Marketplace (Buy/Sell/Trade)',    free: false, paid: true },
  { feature: 'Monthly Research & Funding Reports', free: false, paid: true },
  { feature: 'KPI Dashboard & Analytics',      free: false, paid: true },
  { feature: 'Company Logo on Platform',       free: false, paid: true },
  { feature: 'Press Release Distribution',     free: false, paid: true },
  { feature: 'Speaking Opportunities & VIP Events', free: false, paid: true },
  { feature: 'Congress Discounts & Priority',  free: false, paid: true },
  { feature: 'Tailored Grant Notifications',   free: false, paid: true },
  { feature: 'Early Access to RFP Database',   free: false, paid: true },
];

function Check({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill={color} opacity={0.15} />
      <path d="M5.5 9.5l2 2 5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="rgba(255,255,255,0.05)" />
      <path d="M6.5 6.5l5 5M11.5 6.5l-5 5" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Inner component ─────────────────────────────────────────────────────────
function SourcingMembershipInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { tenant, tenantSlug } = useTenant();
  const navigate = useNavigate();
  const base = tenantSlug ? `/${tenantSlug}` : '';
  const accent = tenant?.brand_color || V.accent;
  const [authUser, setAuthUser] = useState(null);
  const [seats, setSeats] = useState(1);

  const getPricePerSeat = (n) => {
    if (n >= 50) return null; // custom
    if (n >= 15) return 700;
    if (n >= 5) return 850;
    return 1000;
  };
  const pricePerSeat = getPricePerSeat(seats);
  const totalPrice = pricePerSeat ? pricePerSeat * seats : null;

  useEffect(() => {
    document.title = `Membership | ${tenant?.name || 'sourcing.directory'}`;
    if (supabase) {
      supabase.auth.getUser().then(({ data }) => setAuthUser(data?.user || null));
    }
  }, [tenant]);

  const orgName = tenant?.nav_label || tenant?.name || 'sourcing.directory';

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--tx)' }}>
      <SourcingNav active="membership" tenantSlug={tenantSlug} tenantName={tenant?.nav_label || tenant?.name} features={tenant?.features} brandColor={tenant?.brand_color} />

      {/* v10 Membership Hero */}
      <div style={{ padding: 'max(env(safe-area-inset-top),16px) 20px 0' }}>
        <Link to={tenantSlug ? `/${tenantSlug}` : '/'} className="browse-back" style={{ textDecoration: 'none' }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
          Back
        </Link>
      </div>
      <div className="mem-hero">
        <div className="mem-title">Join {orgName}</div>
        <div className="mem-sub">Get full access to post jobs, events, articles, and connect with industry leaders.</div>
      </div>

      {/* Comparison Table */}
      <section style={{ padding: '0 24px 64px', maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{
          fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800,
          fontFamily: "'Syne', sans-serif", color: '#fff',
          textAlign: 'center', margin: '0 0 32px',
        }}>
          Free vs. Paid
        </h2>

        <div style={{
          background: V.card, borderRadius: 12, border: `1px solid ${V.border}`,
          overflow: 'hidden',
        }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px',
            padding: '14px 20px', borderBottom: `1px solid ${V.border}`,
            background: 'rgba(255,255,255,0.02)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: V.muted, fontFamily: V.space, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Feature</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: V.muted, fontFamily: V.space, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>Free</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: accent, fontFamily: V.space, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>Paid</span>
          </div>
          {COMPARISON.map((row, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 80px',
              padding: '12px 20px',
              borderBottom: i < COMPARISON.length - 1 ? `1px solid ${V.border}` : 'none',
            }}>
              <span style={{ fontSize: 13, color: V.text, fontFamily: V.space }}>{row.feature}</span>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {row.free ? <Check color={accent} /> : <XMark />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {row.paid ? <Check color={accent} /> : <XMark />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Tiers */}
      <section style={{
        padding: '64px 24px',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{
            fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800,
            fontFamily: "'Syne', sans-serif", color: '#fff',
            textAlign: 'center', margin: '0 0 12px',
          }}>
            Per-Seat Pricing
          </h2>
          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.45)',
            textAlign: 'center', margin: '0 0 40px', fontFamily: V.space,
          }}>
            Annual membership. Volume discounts as your team grows.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}>
            {PRICING_TIERS.map((tier, i) => (
              <div key={i} style={{
                background: tier.highlight ? `${accent}12` : V.card,
                border: `1px solid ${tier.highlight ? accent : V.border}`,
                borderRadius: 12, padding: '28px 20px', textAlign: 'center',
                position: 'relative',
              }}>
                {tier.highlight && (
                  <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    background: accent, color: '#fff', fontSize: 10, fontWeight: 700,
                    fontFamily: V.space, padding: '3px 10px', borderRadius: 10,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    Popular
                  </div>
                )}
                <div style={{
                  fontSize: 13, color: V.muted, fontFamily: V.space, fontWeight: 600, marginBottom: 12,
                }}>
                  {tier.seats}
                </div>
                <div style={{
                  fontSize: 32, fontWeight: 800, fontFamily: "'Syne', sans-serif",
                  color: tier.highlight ? accent : '#fff', marginBottom: 4,
                }}>
                  {tier.price}
                </div>
                <div style={{
                  fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: V.space,
                }}>
                  {tier.perMonth}
                </div>
              </div>
            ))}
          </div>

          {/* Seat selector */}
          <div style={{
            maxWidth: 400, margin: '32px auto 0', background: V.card,
            border: `1px solid ${V.border}`, borderRadius: 12, padding: '24px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: V.space, color: V.text, marginBottom: 12 }}>
              How many seats do you need?
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <button
                onClick={() => setSeats(Math.max(1, seats - 1))}
                style={{
                  width: 36, height: 36, borderRadius: 8, border: `1px solid ${V.border}`,
                  background: V.card2, color: V.text, fontSize: 18, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >-</button>
              <input
                type="number"
                min="1"
                value={seats}
                onChange={e => setSeats(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: 60, textAlign: 'center', background: V.card2,
                  border: `1px solid ${V.border}`, color: V.text, borderRadius: 8,
                  padding: '8px', fontSize: 16, fontWeight: 700, fontFamily: V.space,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => setSeats(seats + 1)}
                style={{
                  width: 36, height: 36, borderRadius: 8, border: `1px solid ${V.border}`,
                  background: V.card2, color: V.text, fontSize: 18, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >+</button>
              <span style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
                {seats === 1 ? 'seat' : 'seats'}
              </span>
            </div>
            {totalPrice ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
                  {seats} x ${pricePerSeat.toLocaleString()}/seat
                </span>
                <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: '#fff' }}>
                  ${totalPrice.toLocaleString()}<span style={{ fontSize: 13, fontWeight: 400, color: V.muted }}>/yr</span>
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: accent, fontFamily: V.space, fontWeight: 600, marginBottom: 16 }}>
                50+ seats: contact us for custom pricing
              </div>
            )}
            <Link
              to={authUser
                ? `${base}/checkout?tier=Member&seats=${seats}&price=${totalPrice || 0}`
                : `${base}/signup`
              }
              style={{
                display: 'block', textAlign: 'center', background: accent, color: '#fff',
                textDecoration: 'none', borderRadius: 8, padding: '12px 0',
                fontSize: 14, fontWeight: 700, fontFamily: V.space,
              }}
            >
              {authUser
                ? (totalPrice ? `Upgrade - $${totalPrice.toLocaleString()}/yr` : 'Contact Us for Pricing')
                : 'Sign Up & Become a Member'
              }
            </Link>
          </div>
        </div>
      </section>

      {/* Paid Benefits Breakdown */}
      <section style={{ padding: '64px 24px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{
          fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800,
          fontFamily: "'Syne', sans-serif", color: '#fff',
          textAlign: 'center', margin: '0 0 40px',
        }}>
          What Paid Members Get
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20,
        }}>
          {BENEFIT_SECTIONS.map((section, i) => (
            <div key={i} style={{
              background: V.card, border: `1px solid ${V.border}`,
              borderRadius: 12, padding: '24px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ color: accent }}>{section.icon}</div>
                <h3 style={{
                  fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif",
                  color: '#fff', margin: 0,
                }}>
                  {section.title}
                </h3>
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'none' }}>
                {section.items.map((item, j) => (
                  <li key={j} style={{
                    fontSize: 13, color: 'rgba(255,255,255,0.6)',
                    fontFamily: V.space, lineHeight: 1.6,
                    paddingLeft: 0, marginBottom: 6,
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <span style={{ color: accent, fontSize: 14, marginTop: 2, flexShrink: 0 }}>+</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '48px 24px 72px', textAlign: 'center',
      }}>
        <p style={{
          fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: V.space,
          marginBottom: 20,
        }}>
          Already have an account?{' '}
          <Link to={`${base}/login`} style={{ color: accent, textDecoration: 'underline' }}>Log in</Link>
          {' '}to manage your membership.
        </p>
        <p style={{
          fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: V.space,
        }}>
          Questions? Contact us at membership@sourcing.directory
        </p>
      </section>
    </div>
  );
}

export default function SourcingMembership() {
  return (
    <SourcingThemeProvider>
      <SourcingMembershipInner />
    </SourcingThemeProvider>
  );
}
