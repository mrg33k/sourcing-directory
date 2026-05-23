import React from 'react';
import { Link } from 'react-router-dom';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import { ArizonaStats } from './SRWSpaceCongress.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

const QUICK_LINKS = [
  { label: "'26 Agenda", to: '/srw/arizona' },
  { label: "'26 Speakers", to: '/srw/arizona' },
  { label: "'26 Scholars", to: '/srw/arizona' },
  { label: "'26 Collective", to: '/srw/arizona' },
  { label: "'26 Photos", to: '/srw/media' },
  { label: 'Arizona Media', to: '/srw/media' },
  { label: 'Arizona Events', to: '/srw/events' },
];

export default function SRWArizona() {
  useSRWTitle('Arizona Space Rising');

  return (
    <div data-srw>
      <SRWNav />

      <header className="srw-hero srw-hero-sm">
        <div className="srw-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-hero-veil" />
        <div className="srw-wrap srw-hero-inner">
          <p className="srw-hero-sub">April 29, 2026 &nbsp;|&nbsp; Hyatt Regency &nbsp;|&nbsp; Phoenix, Arizona</p>
          <div className="srw-quicklinks">
            {QUICK_LINKS.map((q) => (
              <Link key={q.label} to={q.to} className="srw-chip">{q.label}</Link>
            ))}
          </div>
        </div>
      </header>

      <ArizonaStats />

      <SRWFooter />
    </div>
  );
}
