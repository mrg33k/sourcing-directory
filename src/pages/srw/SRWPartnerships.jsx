import React from 'react';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

const FOUNDING = [
  'Arizona Commerce Authority',
  'Defense Innovation Unit (DIU)',
  'Higher Orbits',
];

const PARTNERS = [
  'Space Foundation',
  'World View Enterprises',
  'Arizona Space Alliance',
  'Phantom Space',
  'Arizona State University',
  'SpaceFest',
  'Silicon Oasis Summit',
  'Arizona Aerospace & Defense',
  'NewSpace Nexus',
];

const SUPPORTERS = [
  'Arizona Space Commission',
  'City of Chandler',
  'Tucson Regional Economic Opportunities',
  'Orbital Sciences',
  'Near Space Corporation',
  'AZ STEM Network',
];

export default function SRWPartnerships() {
  useSRWTitle('Partnerships | Space Rising');

  return (
    <div data-srw>
      <SRWNav />

      <header className="srw-hero srw-hero-sm">
        <div className="srw-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-hero-veil" />
        <div className="srw-wrap srw-hero-inner">
          <div className="srw-eyebrow">Partnerships</div>
          <h1>Built Together</h1>
        </div>
      </header>

      {/* Intro */}
      <section className="srw-section">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Our Network</div>
          <h2 style={{ maxWidth: '28ch' }}>
            Connecting Arizona's space ecosystem to the nation
          </h2>
          <p className="srw-section-lead" style={{ fontSize: 20, marginTop: 20, maxWidth: '60ch' }}>
            Space Rising grows through collaboration. Our partners span government agencies,
            research institutions, aerospace companies, and community organizations — all aligned
            around a shared commitment to Arizona's space future.
          </p>
        </div>
      </section>

      {/* Founding Partners */}
      <section className="srw-section srw-section-dark">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Founding Partners</div>
          <h2>Founding Partners</h2>
          <div className="srw-partners" style={{ marginTop: 44, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {FOUNDING.map(name => (
              <div className="srw-partner" key={name}>{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="srw-section">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Partners</div>
          <h2>Partners</h2>
          <div className="srw-partners" style={{ marginTop: 44 }}>
            {PARTNERS.map(name => (
              <div className="srw-partner" key={name}>{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Supporters */}
      <section className="srw-section srw-section-dark">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Supporters</div>
          <h2>Supporters</h2>
          <div className="srw-partners" style={{ marginTop: 44 }}>
            {SUPPORTERS.map(name => (
              <div className="srw-partner" key={name}>{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="srw-contact">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Get In Touch</div>
          <h2>Interested in partnering with Space Rising?</h2>
          <a href="mailto:info@spacerising.org" className="srw-email">info@spacerising.org</a>
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
