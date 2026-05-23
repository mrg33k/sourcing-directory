import React from 'react';
import { Link } from 'react-router-dom';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import './srw.css';

// All assets pulled directly from spacerising.org CDN — exact Squarespace copy.
// HERO_BG is the astronaut + cityscape photo; HERO_OVERLAY is the "a new way to SPACE" text PNG layered on top.
const HERO_BG = 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/341f4645-4175-4b09-a77f-0c2ba6d6b47f/Hero-Image-banner.jpg?format=2500w';
const HERO_OVERLAY = 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/be97f7c9-2222-4898-bdf5-e893d1cfa297/Hero-Image-banner-text_no+date.png?format=2500w';
const ROCKET_BG = 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/e4769b24-1ded-425b-b1a8-0d7e0a77a5b9/AdobeStock_1565186160.jpeg?format=2500w';

const STATS = [
  { num: '$570B', label: 'Global Market' },
  { num: '$2T', label: 'Projected by 2040' },
  { num: '80%', label: 'Commercial Activity' },
  { num: '7.4%', label: 'Annual Growth Rate' },
];

const OPPORTUNITIES = [
  'Launch Rideshare + Space Trucking',
  'Orbital Construction',
  'Lunar Resource Extraction',
  'AI + Robotics',
  'Space Based Energy Production',
  'Commercial Space Stations & Orbital Platforms',
];

const SERVICES = [
  {
    name: 'Space Congress™',
    desc: 'Cross-sector convenings for regional space alignment.',
    to: '/srw/space-congress',
  },
  {
    name: 'SpaceOS™',
    desc: 'The intelligence infrastructure connecting the space economy.',
    to: '/space-rising',
  },
  {
    name: 'Partnerships',
    desc: 'Commercialization initiatives partnered with businesses to enter and scale within the space economy.',
    to: '/srw/partnerships',
  },
];

export default function SRWHome() {
  return (
    <div data-srw>
      <SRWNav />

      {/* Hero — astronaut + cityscape photo with "a new way to SPACE" text overlay */}
      <header className="srw-hero-composite">
        <img className="srw-hero-bg-img" src={HERO_BG} alt="" aria-hidden="true" />
        <img className="srw-hero-overlay" src={HERO_OVERLAY} alt="A new way to SPACE" />
      </header>

      {/* The space economy is scaling — stat block */}
      <section className="srw-section srw-section-tight" style={{ textAlign: 'center' }}>
        <div className="srw-wrap">
          <h2 className="srw-h2-thin">The Space Economy is Scaling</h2>
          <p className="srw-section-sub-center"><strong>we are now entering a mainstream economic infrastructure</strong></p>
          <div className="srw-stats">
            {STATS.map((s) => (
              <div className="srw-stat" key={s.label}>
                <div className="srw-stat-num">{s.num}</div>
                <div className="srw-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Emerging Opportunities */}
      <section className="srw-section" style={{ textAlign: 'center', paddingTop: 0 }}>
        <div className="srw-wrap">
          <h2 className="srw-h2-thin">Emerging Opportunities for Space Infrastructure</h2>
          <div className="srw-opp-grid">
            {OPPORTUNITIES.map((o) => (
              <div className="srw-opp" key={o}>{o}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Connective layer — orange rocket band */}
      <section className="srw-band srw-band-rocket">
        <div className="srw-band-bg" style={{ backgroundImage: `url(${ROCKET_BG})` }} />
        <div className="srw-band-veil-rocket" />
        <div className="srw-wrap srw-band-inner">
          <p className="srw-band-copy">
            Space Rising serves as the <strong>connective layer</strong> across the evolving space economy. We translate regional activity into coordinated strategy.
          </p>
          <Link to="/srw/about" className="srw-btn-outline">ABOUT</Link>
        </div>
      </section>

      {/* We mobilize space ecosystems through */}
      <section className="srw-section" style={{ textAlign: 'center' }}>
        <div className="srw-wrap">
          <h2 className="srw-h2-thin srw-h2-faint">We Mobilize Space Ecosystems Through:</h2>
          <div className="srw-services">
            {SERVICES.map((s) => (
              <Link to={s.to} className="srw-service" key={s.name}>
                <h3>{s.name}</h3>
                <p>{s.desc}</p>
                <span className="srw-service-divider" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section className="srw-contact-form">
        <div className="srw-wrap">
          <h2 className="srw-h2-thin srw-h2-faint">Contact Us</h2>
          <form
            className="srw-form"
            action="mailto:info@spacerising.org"
            method="POST"
            encType="text/plain"
            onSubmit={(e) => { /* let mailto handle it */ }}
          >
            <div className="srw-form-row">
              <label>
                <span>Name <em>(required)</em></span>
                <div className="srw-form-double">
                  <input type="text" name="firstName" placeholder="First Name" required />
                  <input type="text" name="lastName" placeholder="Last Name" required />
                </div>
                <div className="srw-form-hint">
                  <span>First Name</span><span>Last Name</span>
                </div>
              </label>
            </div>
            <div className="srw-form-row">
              <label>
                <span>Email <em>(required)</em></span>
                <input type="email" name="email" required />
              </label>
            </div>
            <div className="srw-form-row">
              <label>
                <span>Message <em>(required)</em></span>
                <textarea name="message" rows={6} required />
              </label>
            </div>
            <button type="submit" className="srw-btn-outline">SUBMIT</button>
          </form>
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
