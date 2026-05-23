import React from 'react';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import { ArizonaStats } from './SRWSpaceCongress.jsx';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

export default function SRWArizona() {
  return (
    <div data-srw>
      <SRWNav />

      <header className="srw-hero srw-hero-sm">
        <div className="srw-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-hero-veil" />
        <div className="srw-wrap srw-hero-inner">
          <div className="srw-eyebrow">The Grand Canyon State</div>
          <h1>Arizona Aerospace</h1>
          <p className="srw-hero-sub">
            A national leader in aerospace manufacturing, space science, and
            exploration — the foundation Space Rising is built on.
          </p>
        </div>
      </header>

      <ArizonaStats />

      <SRWFooter />
    </div>
  );
}
