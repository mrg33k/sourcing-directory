import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens, ThemeToggle } from './SourcingTheme.jsx';

const VERTICALS = [
  {
    key: 'semiconductor',
    label: 'Semiconductor',
    color: '#29B6F6',
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="7" y="7" width="10" height="10" rx="1"/>
        <path d="M7 9H5M7 12H5M7 15H5M17 9h2M17 12h2M17 15h2M9 7V5M12 7V5M15 7V5M9 17v2M12 17v2M15 17v2"/>
      </svg>
    ),
    href: '/sc3',
    description: 'Fabs, EDA tools, packaging, materials, and supply chain partners.',
  },
  {
    key: 'space',
    label: 'Space & Aerospace',
    color: '#7C3AED',
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 2L8 8H4l4 4-2 6 6-3 6 3-2-6 4-4h-4L12 2z"/>
      </svg>
    ),
    href: '/space-rising',
    description: 'Avionics, propulsion, structures, composites, and satellite systems.',
  },
  {
    key: 'biotech',
    label: 'Biotech',
    color: '#22C55E',
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
    href: '/az-biotech',
    description: 'Life sciences, diagnostics, medical devices, and pharmaceutical suppliers.',
  },
  {
    key: 'defense',
    label: 'Defense',
    color: '#EF4444',
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    href: '/az-defense',
    description: 'ITAR-registered suppliers, C4ISR, weapons systems, and cyber defense.',
  },
];

function StatBlock({ label, value, V }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 24px' }}>
      <div style={{
        fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800,
        fontFamily: "'Syne', sans-serif", color: V.accent, lineHeight: 1,
        marginBottom: 6,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em' }}>
        {label}
      </div>
    </div>
  );
}

function SourcingAboutInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const [stats, setStats] = useState({ companies: 107, verticals: 4, certs: '500+' });

  useEffect(() => {
    document.title = 'About | sourcing.directory -- Arizona Industrial Supplier Directory';
    const setMeta = (attr, key, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('name', 'description', 'Find verified semiconductor, aerospace, biotech, and defense suppliers in Arizona. sourcing.directory connects procurement teams with certified industrial partners.');
    setMeta('property', 'og:title', 'sourcing.directory | Arizona Industrial Supplier Directory');
    setMeta('property', 'og:description', 'Find verified suppliers in semiconductor, aerospace, biotech, and defense. Direct connections to certified Arizona industrial companies.');
    return () => { document.title = 'Sourcing Directory | Find Certified Suppliers'; };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('directory_companies').select('id', { count: 'exact', head: true }).eq('status', 'active').then(({ count }) => {
      if (count) setStats(s => ({ ...s, companies: count }));
    });
  }, []);

  const accent = V.accent;

  return (
    <div style={{ minHeight: '100vh', background: '#0C0C0C', color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .about-fade { animation: fadeUp 0.5s ease forwards; }
      `}</style>

      {/* Nav */}
      <nav style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 16, height: 56,
        background: 'rgba(12,12,12,0.95)',
        position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(12px)',
      }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>AOM</span>
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>/</span>
        <Link to="/" style={{ textDecoration: 'none', fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: "'Space Grotesk', sans-serif" }}>Sourcing</Link>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>About</span>
        <div style={{ flex: 1 }} />
        <ThemeToggle />
        <Link to="/sc3/signup" style={{
          background: accent, color: '#fff', textDecoration: 'none',
          borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          List Your Company
        </Link>
      </nav>

      {/* Hero */}
      <section style={{
        background: 'linear-gradient(180deg, rgba(16,185,129,0.07) 0%, #0C0C0C 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: 'clamp(64px, 8vw, 100px) 24px clamp(56px, 7vw, 88px)',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
          color: accent, letterSpacing: '0.2em', textTransform: 'uppercase',
          background: `${accent}12`, border: `1px solid ${accent}30`,
          borderRadius: 4, padding: '4px 12px', marginBottom: 24,
        }}>
          sourcing.directory -- Arizona
        </div>
        <h1 style={{
          fontSize: 'clamp(32px, 6vw, 62px)', fontWeight: 800,
          fontFamily: "'Syne', sans-serif",
          color: '#fff', lineHeight: 1.1,
          margin: '0 auto 20px', maxWidth: 760,
        }}>
          The Industrial Supplier Directory Built for Arizona
        </h1>
        <p style={{
          fontSize: 'clamp(15px, 2vw, 18px)', color: 'rgba(255,255,255,0.6)',
          maxWidth: 580, margin: '0 auto 36px', lineHeight: 1.7,
        }}>
          Semiconductor. Aerospace. Biotech. Defense. Real companies, verified credentials, direct connections.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/sc3" style={{
            background: accent, color: '#fff', textDecoration: 'none',
            borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 700,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Browse Directory
          </Link>
          <Link to="/sc3/signup" style={{
            background: 'transparent', color: '#fff', textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
            padding: '12px 28px', fontSize: 15, fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            List Your Company
          </Link>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '36px 24px',
      }}>
        <div style={{
          maxWidth: 800, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexWrap: 'wrap', gap: 24,
        }}>
          {[
            { label: 'Verified Companies', value: `${stats.companies}+` },
            { label: 'Industry Verticals', value: '4' },
            { label: 'Certifications Tracked', value: '500+' },
            { label: 'Arizona Focused', value: '100%' },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)' }} />}
              <StatBlock label={s.label} value={s.value} V={V} />
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section style={{ padding: 'clamp(56px, 7vw, 88px) 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
          color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', textTransform: 'uppercase',
          textAlign: 'center', marginBottom: 14,
        }}>
          How It Works
        </div>
        <h2 style={{
          fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800,
          fontFamily: "'Syne', sans-serif", color: '#fff',
          textAlign: 'center', margin: '0 auto 48px', maxWidth: 480,
        }}>
          From search to connection in three steps
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
          {[
            {
              num: '01',
              title: 'Search & Discover',
              body: 'Find verified suppliers by vertical, certification, size, and location. Scout\'s AI search understands plain-language queries.',
            },
            {
              num: '02',
              title: 'Connect Directly',
              body: 'Every listing includes contact info, capabilities, and verified certifications. No gatekeeping, no pay-to-contact walls.',
            },
            {
              num: '03',
              title: 'Get Listed',
              body: 'Add your company to reach procurement teams, engineers, and industry partners across Arizona\'s advanced industries.',
            },
          ].map(step => (
            <div key={step.num} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, padding: '28px 24px',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                color: accent, letterSpacing: '0.1em', marginBottom: 14,
              }}>
                {step.num}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: '#fff', marginBottom: 10 }}>
                {step.title}
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>
                {step.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Verticals */}
      <section style={{
        padding: 'clamp(48px, 6vw, 72px) 24px',
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
            color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', textTransform: 'uppercase',
            textAlign: 'center', marginBottom: 14,
          }}>
            Industries
          </div>
          <h2 style={{
            fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800,
            fontFamily: "'Syne', sans-serif", color: '#fff',
            textAlign: 'center', margin: '0 auto 40px', maxWidth: 480,
          }}>
            Four verticals, one platform
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {VERTICALS.map(v => (
              <Link
                key={v.key}
                to={v.href}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  background: `${v.color}08`,
                  border: `1px solid ${v.color}25`,
                  borderRadius: 12, padding: '24px 20px',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}>
                  <div style={{ color: v.color, marginBottom: 14 }}>{v.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: '#fff', marginBottom: 8 }}>
                    {v.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 16 }}>
                    {v.description}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: v.color,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    Browse
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Scout section */}
      <section style={{ padding: 'clamp(56px, 7vw, 88px) 24px', maxWidth: 780, margin: '0 auto' }}>
        <div style={{
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 16, padding: 'clamp(32px, 4vw, 48px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: '#fff' }}>Scout</div>
              <div style={{ fontSize: 12, color: 'rgba(16,185,129,0.8)', fontFamily: "'JetBrains Mono', monospace" }}>AI-powered search</div>
            </div>
            <div style={{
              marginLeft: 'auto',
              width: 8, height: 8, borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 6px #10b981',
            }} />
          </div>
          <h3 style={{
            fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800,
            fontFamily: "'Syne', sans-serif", color: '#fff',
            margin: '0 0 14px',
          }}>
            Search That Actually Understands You
          </h3>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: '0 0 24px' }}>
            Don't just type keywords. Describe what you need. Scout finds the right suppliers for your specific requirements -- certifications, capabilities, location, size.
          </p>
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '12px 16px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13, color: 'rgba(255,255,255,0.5)',
            marginBottom: 24,
          }}>
            <span style={{ color: 'rgba(16,185,129,0.7)' }}>&gt; </span>
            ISO-certified PCB manufacturer near Phoenix with defense experience
          </div>
          <Link to="/sc3" style={{
            background: 'rgba(16,185,129,0.15)',
            border: '1px solid rgba(16,185,129,0.3)',
            color: '#10b981', textDecoration: 'none',
            borderRadius: 7, padding: '10px 20px',
            fontSize: 13, fontWeight: 700,
            fontFamily: "'Space Grotesk', sans-serif",
            display: 'inline-block',
          }}>
            Try Scout Search
          </Link>
        </div>
      </section>

      {/* For Organizations */}
      <section style={{
        padding: 'clamp(48px, 6vw, 72px) 24px',
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', textTransform: 'uppercase',
                marginBottom: 14,
              }}>
                For Organizations
              </div>
              <h3 style={{
                fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 800,
                fontFamily: "'Syne', sans-serif", color: '#fff', margin: '0 0 16px',
              }}>
                Power your member directory
              </h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: '0 0 24px' }}>
                Running an industry association or trade group? sourcing.directory powers member directories for Space Rising, SC3, and more. Your members get a branded directory. You get analytics, member management, and a platform that grows with your community.
              </p>
              <Link to="/sc3/signup" style={{
                background: accent, color: '#fff', textDecoration: 'none',
                borderRadius: 7, padding: '10px 20px',
                fontSize: 13, fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                display: 'inline-block',
              }}>
                Learn More
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['SC3 -- Semiconductor Consortium', 'Space Rising', 'AZ Biotech Alliance', 'AZ Defense Network'].map(org => (
                <div key={org} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: accent, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {org}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section style={{ padding: 'clamp(48px, 6vw, 72px) 24px', maxWidth: 780, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
          color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          Pricing
        </div>
        <h3 style={{
          fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 800,
          fontFamily: "'Syne', sans-serif", color: '#fff', margin: '0 auto 12px', maxWidth: 400,
        }}>
          Free to start. Grow from there.
        </h3>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', margin: '0 auto 28px', maxWidth: 420, lineHeight: 1.6 }}>
          Free listings available. Pro and Enterprise tiers for featured placement, photos, and priority search position.
        </p>
        <Link to="/sc3/checkout" style={{
          background: 'transparent', color: accent, textDecoration: 'none',
          border: `1px solid ${accent}40`, borderRadius: 7,
          padding: '10px 20px', fontSize: 13, fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif", display: 'inline-block',
        }}>
          View Plans
        </Link>
      </section>

      {/* Footer CTA */}
      <section style={{
        background: `linear-gradient(135deg, ${accent}10 0%, rgba(124,58,237,0.08) 100%)`,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: 'clamp(56px, 7vw, 80px) 24px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800,
          fontFamily: "'Syne', sans-serif", color: '#fff',
          margin: '0 auto 14px', maxWidth: 560,
        }}>
          Ready to connect with Arizona's industrial ecosystem?
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', margin: '0 auto 32px', maxWidth: 420, lineHeight: 1.6 }}>
          Join {stats.companies}+ verified companies already on the platform.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/sc3" style={{
            background: accent, color: '#fff', textDecoration: 'none',
            borderRadius: 8, padding: '14px 32px', fontSize: 15, fontWeight: 700,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Browse the Directory
          </Link>
          <Link to="/sc3/signup" style={{
            background: 'transparent', color: '#fff', textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
            padding: '14px 32px', fontSize: 15, fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            List Your Company Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono', monospace" }}>
          sourcing.directory -- Powered by AOM
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { label: 'Directory', href: '/sc3' },
            { label: 'List Company', href: '/sc3/signup' },
            { label: 'Admin', href: '/admin' },
          ].map(l => (
            <Link key={l.label} to={l.href} style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontFamily: "'Space Grotesk', sans-serif" }}>
              {l.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default function SourcingAbout() {
  return (
    <SourcingThemeProvider>
      <SourcingAboutInner />
    </SourcingThemeProvider>
  );
}
