import React from 'react';
import { Link } from 'react-router-dom';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

const STATS = [
  { num: '$2T', label: 'Global Market Projected by 2040' },
  { num: '$570B', label: 'Current Market Size' },
  { num: '80%', label: 'Commercial Activity' },
  { num: '7.4%', label: 'Annual Growth Rate' },
];

const OPPORTUNITIES = [
  'Launch Rideshare + Space Trucking',
  'Orbital Construction',
  'Lunar Resource Extraction',
  'AI + Robotics',
  'Space Based Energy Production',
  'Commercial space stations & orbital platform',
];

const SERVICES = [
  {
    name: 'Space Congress™',
    desc: 'Cross-sector convenings for regional space alignment.',
    to: '/srw/space-congress',
    cta: 'Learn more',
  },
  {
    name: 'SpaceOS™',
    desc: 'The intelligence infrastructure connecting the space economy.',
    to: '/space-rising',
    cta: 'Browse the directory',
  },
  {
    name: 'Partnerships',
    desc: 'Commercialization initiatives partnered with businesses to enter and scale within the space economy.',
    to: '/srw/partnerships',
    cta: 'Partner with us',
  },
];

export default function SRWHome() {
  return (
    <div data-srw>
      <SRWNav />

      {/* Hero */}
      <header className="srw-hero">
        <div className="srw-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-hero-veil" />
        <div className="srw-wrap srw-hero-inner">
          <div className="srw-eyebrow">Space Rising</div>
          <h1>The Space Economy Is Scaling</h1>
          <p className="srw-hero-sub">
            We are now entering a mainstream economic infrastructure — and Arizona
            is positioned at the center of it.
          </p>
        </div>
      </header>

      {/* Stats bar */}
      <section>
        <div className="srw-wrap">
          <div className="srw-stats">
            {STATS.map((s) => (
              <div className="srw-stat" key={s.label}>
                <div className="srw-stat-num"><span className="srw-accent">{s.num.charAt(0)}</span>{s.num.slice(1)}</div>
                <div className="srw-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Opportunities grid */}
      <section className="srw-section">
        <div className="srw-wrap">
          <div className="srw-eyebrow">The Frontier</div>
          <h2>Emerging Opportunities for Space Infrastructure</h2>
          <div className="srw-grid srw-grid-3" style={{ marginTop: 40 }}>
            {OPPORTUNITIES.map((o, i) => (
              <div className="srw-card" key={o}>
                <div className="srw-card-num">{String(i + 1).padStart(2, '0')}</div>
                <h3>{o}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value band */}
      <section className="srw-band">
        <div className="srw-band-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-band-veil" />
        <div className="srw-wrap srw-band-inner">
          <div className="srw-eyebrow">About Space Rising</div>
          <h2>The connective layer across the evolving space economy</h2>
          <p>
            Space Rising serves as the connective layer across the evolving space economy.
            We translate regional activity into coordinated strategy.
          </p>
          <Link to="/srw/about" className="srw-link">About →</Link>
        </div>
      </section>

      {/* Services */}
      <section className="srw-section srw-section-dark">
        <div className="srw-wrap">
          <div className="srw-eyebrow">What We Do</div>
          <h2>We mobilize space ecosystems through:</h2>
          <div className="srw-grid srw-grid-3" style={{ marginTop: 44 }}>
            {SERVICES.map((s) => (
              <div className="srw-card srw-service" key={s.name}>
                <h3>{s.name}</h3>
                <p>{s.desc}</p>
                <div className="srw-link" style={{ marginTop: 18 }}>
                  <Link to={s.to} className="srw-link">{s.cta} →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="srw-contact">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Get In Touch</div>
          <h2>Contact Us</h2>
          <a href="mailto:info@spacerising.org" className="srw-email">info@spacerising.org</a>
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
