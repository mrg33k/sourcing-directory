import React from 'react';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

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

export default function SRWPartnershipsV2() {
  useSRWTitle('Partnerships | Space Rising');

  return (
    <div data-srw="v2">
      <SRWNavV2 />

      <header
        className="srw-pg-hero"
        style={{ '--srw-pg-hero-bg': "url('/v2-assets/planet-blue.png')" }}
      >
        <div className="srw-pg-hero-inner">
          <div className="srw-pg-eyebrow">PARTNERSHIPS</div>
          <h1 className="srw-pg-title">Built together<span className="srw-pg-period">.</span></h1>
          <p className="srw-pg-sub">
            Space Rising grows through collaboration. Our partners span government agencies, research institutions, aerospace companies, and community organizations — aligned around a shared commitment to the space future.
          </p>
        </div>
      </header>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">FOUNDING PARTNERS</div>
            <h2 className="srw-pg-section-title">The first three<span className="srw-pg-period">.</span></h2>
          </div>
          <div className="srw-pg-partner-grid">
            {FOUNDING.map((name) => (
              <div className="srw-pg-partner" key={name}>{name}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">PARTNERS</div>
            <h2 className="srw-pg-section-title">The network<span className="srw-pg-period">.</span></h2>
          </div>
          <div className="srw-pg-partner-grid">
            {PARTNERS.map((name) => (
              <div className="srw-pg-partner" key={name}>{name}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">SUPPORTERS</div>
            <h2 className="srw-pg-section-title">In the room with us<span className="srw-pg-period">.</span></h2>
          </div>
          <div className="srw-pg-partner-grid">
            {SUPPORTERS.map((name) => (
              <div className="srw-pg-partner" key={name}>{name}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-pg-cta-stripe">
        <div className="srw-wrap">
          <div className="srw-pg-eyebrow">GET IN TOUCH</div>
          <h2>Interested in partnering with Space Rising<span className="srw-pg-period">?</span></h2>
          <a href="mailto:info@spacerising.org" className="srw-pg-cta-stripe-email">info@spacerising.org</a>
        </div>
      </section>

      <SRWFooterV2 />
    </div>
  );
}
