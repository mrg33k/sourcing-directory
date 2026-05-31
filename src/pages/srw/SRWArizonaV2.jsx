import React from 'react';
import { Link } from 'react-router-dom';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import SRWArizonaStatsV2 from './SRWArizonaStatsV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

// R10b: dropped 4 self-pointing chips ('26 Agenda/Speakers/Scholars/Collective).
// Add back when those sub-pages exist. The 3 real navigations remain.
const QUICK_LINKS = [
  { label: "'26 Photos",     to: '/srw-v2/media' },
  { label: 'Arizona Media',  to: '/srw-v2/media' },
  { label: 'Arizona Events', to: '/srw-v2/events' },
];

export default function SRWArizonaV2() {
  useSRWTitle('Arizona | Space Rising');

  return (
    <div data-srw="v2">
      <SRWNavV2 />

      <header
        className="srw-pg-hero"
        style={{ '--srw-pg-hero-bg': "url('/v2-assets/sun.png')" }}
      >
        <div className="srw-pg-hero-inner">
          <div className="srw-pg-eyebrow">APRIL 29, 2026 · HYATT REGENCY · PHOENIX</div>
          <h1 className="srw-pg-title">Arizona Space Congress<span className="srw-pg-period">.</span></h1>
          <p className="srw-pg-sub">
            The annual Arizona convening. Cross-sector. Mission-forward. A method to translate collective input into actionable strategy.
          </p>
          <div className="srw-pg-chips">
            {QUICK_LINKS.map((q) => (
              <Link key={q.label} to={q.to} className="srw-pg-chip">{q.label}</Link>
            ))}
          </div>
        </div>
      </header>

      <SRWArizonaStatsV2 />

      <SRWFooterV2 />
    </div>
  );
}
