import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

// All assets pulled directly from spacerising.org — exact Squarespace mirror.
// HERO_VIDEO is the actual Squarespace background video; HERO_POSTER is the
// astronaut/city fallback frame; HERO_OVERLAY is the "a new way to SPACE" text PNG.
const HERO_VIDEO = '/videos/spacerising-hero.mp4';
const HERO_POSTER = 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/341f4645-4175-4b09-a77f-0c2ba6d6b47f/Hero-Image-banner.jpg?format=2500w';
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

// Each service row mirrors .org exactly: a single <p> per service with a
// brick-red <strong> "name", a line break, then black body text with black
// inline <strong> for highlighted terms. Order matches .org left-to-right.
const SERVICES = [
  {
    name: 'Space Congress™',
    body: (<>Cross-sector convenings for <strong>regional space alignment.</strong></>),
    to: '/srw/space-congress',
  },
  {
    name: 'SpaceOS™',
    body: (<>The <strong>intelligence infrastructure</strong> connecting the space economy.</>),
    to: '/space-rising-v2',
  },
  {
    name: 'Partnerships',
    body: (<><strong>Commercialization initiatives</strong> partnered with businesses to enter and scale within the space economy.</>),
    to: '/srw/partnerships',
  },
];

export default function SRWHomeV2() {
  useSRWTitle('Space Rising V2 | A New Way To Space');

  // Contact form state
  const [contact, setContact] = useState({ first_name: '', last_name: '', email: '', message: '' });
  const [contactStatus, setContactStatus] = useState('idle'); // idle | submitting | success | error
  const [contactError, setContactError] = useState('');

  async function handleContact(e) {
    e.preventDefault();
    if (!contact.email || !contact.email.includes('@')) {
      setContactError('Please enter a valid email address.');
      return;
    }
    setContactStatus('submitting');
    setContactError('');
    try {
      const res = await fetch('/api/sourcing/srw-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_type: 'contact', ...contact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setContactStatus('success');
    } catch (err) {
      setContactError(err.message || 'Something went wrong. Please try again.');
      setContactStatus('error');
    }
  }

  // Reverse parallax for the rocket band: image translates UPWARD as the
  // user scrolls down through the section (opposite of background-attachment:fixed).
  const bandRef = useRef(null);
  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = band.getBoundingClientRect();
        const vh = window.innerHeight;
        // progress: 0 when band top reaches viewport bottom, 1 when band bottom leaves the top
        const progress = (vh - rect.top) / (vh + rect.height);
        const clamped = Math.max(0, Math.min(1, progress));
        band.style.setProperty('--srw-band-shift', `${-clamped * 140}px`);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div data-srw>
      <SRWNavV2 />

      {/* Hero — looped background video (8s) with "a new way to SPACE" text overlay */}
      <header className="srw-hero-composite">
        <video
          className="srw-hero-bg-video"
          src={HERO_VIDEO}
          poster={HERO_POSTER}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        <img className="srw-hero-overlay" src={HERO_OVERLAY} alt="A new way to SPACE" />
      </header>

      {/* The space economy is scaling — stat block */}
      <section className="srw-section srw-section-tight" style={{ textAlign: 'center' }}>
        <div className="srw-wrap">
          <h1 className="srw-h2-thin">THE SPACE ECONOMY IS SCALING</h1>
          <p className="srw-section-sub-center">we are now entering a mainstream economic infrastructure</p>
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
          <h2 className="srw-h2-mid">EMERGING OPPORTUNITIES FOR SPACE INFRASTRUCTURE</h2>
          <div className="srw-opp-grid">
            {OPPORTUNITIES.map((o) => (
              <div className="srw-opp" key={o}>{o}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Connective layer — orange rocket band (reverse parallax driven by JS) */}
      <section
        ref={bandRef}
        className="srw-band srw-band-rocket"
        style={{ '--srw-band-bg-image': `url(${ROCKET_BG})` }}
      >
        <div className="srw-band-bg" />
        <div className="srw-band-veil-rocket" />
        <div className="srw-wrap srw-band-inner">
          <p className="srw-band-copy">
            Space Rising serves as the <strong>connective layer</strong> across the evolving space economy. We translate regional activity into coordinated strategy.
          </p>
          <Link to="/srw/about" className="srw-link-plain">ABOUT</Link>
        </div>
      </section>

      {/* We mobilize space ecosystems through — white bg, 2-column (heading L, services R)
          Matches spacerising.org: brick-red service names, black body with bold accents. */}
      <section className="srw-mobilize-section">
        <div className="srw-wrap">
          <div className="srw-mobilize-grid">
            <h2 className="srw-mobilize-heading">WE MOBILIZE SPACE ECOSYSTEMS THROUGH:</h2>
            <div className="srw-services">
              {SERVICES.map((s) => (
                <Link to={s.to} className="srw-service" key={s.name}>
                  <p>
                    <strong className="srw-service-name">{s.name}</strong>
                    <br /><br />
                    {s.body}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section className="srw-contact-form">
        <div className="srw-wrap">
          {contactStatus === 'success' ? (
            <div className="srw-contact-success">
              <p>Message received — we'll be in touch.</p>
            </div>
          ) : (
            <form className="srw-form" onSubmit={handleContact} noValidate>
              <div className="srw-form-row">
                <label>
                  <span>Name <em>(required)</em></span>
                  <div className="srw-form-double">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={contact.first_name}
                      onChange={(e) => setContact((p) => ({ ...p, first_name: e.target.value }))}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={contact.last_name}
                      onChange={(e) => setContact((p) => ({ ...p, last_name: e.target.value }))}
                    />
                  </div>
                  <div className="srw-form-hint">
                    <span>First Name</span><span>Last Name</span>
                  </div>
                </label>
              </div>
              <div className="srw-form-row">
                <label>
                  <span>Email <em>(required)</em></span>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
                    required
                  />
                </label>
              </div>
              <div className="srw-form-row">
                <label>
                  <span>Message <em>(required)</em></span>
                  <textarea
                    rows={6}
                    value={contact.message}
                    onChange={(e) => setContact((p) => ({ ...p, message: e.target.value }))}
                    required
                  />
                </label>
              </div>
              {contactError && <div className="srw-form-error">{contactError}</div>}
              <button
                type="submit"
                className="srw-btn-outline"
                disabled={contactStatus === 'submitting'}
              >
                {contactStatus === 'submitting' ? 'SUBMITTING...' : 'SUBMIT'}
              </button>
            </form>
          )}
        </div>
      </section>

      <SRWFooterV2 />
    </div>
  );
}
