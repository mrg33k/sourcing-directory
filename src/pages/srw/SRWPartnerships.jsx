import React from 'react';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

// TODO: replace placeholder partner slots with real sponsor logos + links.
const PARTNER_SLOTS = Array.from({ length: 9 }, (_, i) => `Partner ${i + 1}`);

export default function SRWPartnerships() {
  return (
    <div data-srw>
      <SRWNav />

      <header className="srw-hero srw-hero-sm">
        <div className="srw-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-hero-veil" />
        <div className="srw-wrap srw-hero-inner">
          <div className="srw-eyebrow">Partnerships</div>
          <h1>Building the Space Ecosystem Together</h1>
          <p className="srw-hero-sub">
            Strategic connections across industry, government, and academia —
            the partners powering Arizona's space economy.
          </p>
        </div>
      </header>

      <section className="srw-section">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Our Partners</div>
          <h2>Sponsors & Collaborators</h2>
          <p className="srw-section-lead">
            Space Rising works alongside leading companies, institutions, and
            agencies committed to advancing the space economy in Arizona and beyond.
          </p>
          <div className="srw-partners">
            {PARTNER_SLOTS.map((p) => (
              <div className="srw-partner" key={p}>{p}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-contact">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Join the Coalition</div>
          <h2>Become a Partner</h2>
          <p className="srw-section-lead" style={{ margin: '0 auto 30px', textAlign: 'center' }}>
            Interested in partnering with Space Rising? We'd love to talk.
          </p>
          <a href="mailto:info@spacerising.org" className="srw-btn">Become a Partner →</a>
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
