import React from 'react';
import { Link } from 'react-router-dom';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import SRWArizonaStatsV2 from './SRWArizonaStatsV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

// R10b: dropped 4 self-pointing chips. The 3 real navigations remain.
const QUICK_LINKS = [
  { label: "'26 Photos",     to: '/srw-v2/media' },
  { label: 'Arizona Media',  to: '/srw-v2/media' },
  { label: 'Arizona Events', to: '/srw-v2/events' },
];

export default function SRWSpaceCongressV2() {
  useSRWTitle('Space Congress™ | Space Rising');

  return (
    <div data-srw="v2">
      <SRWNavV2 />

      <header
        className="srw-pg-hero"
        style={{ '--srw-pg-hero-bg': "url('/v2-assets/starfield-dense.png')" }}
      >
        <div className="srw-pg-hero-inner">
          <div className="srw-pg-eyebrow">APRIL 29, 2026 · HYATT REGENCY · PHOENIX</div>
          <h1 className="srw-pg-title">
            Space Congress<span style={{ fontSize: '0.55em', verticalAlign: 'super' }}>™</span><span className="srw-pg-period">.</span>
          </h1>
          <p className="srw-pg-sub">
            Cross-sector convenings for regional space alignment. The method that turns fragmented activity into coordinated strategy — and brings the right people into the same room.
          </p>
          <div className="srw-pg-chips">
            {QUICK_LINKS.map((q) => (
              <Link key={q.label} to={q.to} className="srw-pg-chip">{q.label}</Link>
            ))}
          </div>
        </div>
      </header>

      <SRWArizonaStatsV2 />

      <section className="srw-pg-cta-stripe">
        <div className="srw-wrap">
          <div className="srw-pg-eyebrow">CONTACT</div>
          <h2>Bring Space Congress to your region<span className="srw-pg-period">.</span></h2>
          <a href="mailto:info@spacerising.org" className="srw-pg-cta-stripe-email">info@spacerising.org</a>
        </div>
      </section>

      <SRWFooterV2 />
    </div>
  );
}
