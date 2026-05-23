import React from 'react';
import { Link } from 'react-router-dom';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

const FEATURES = [
  { name: 'Companies', desc: "Arizona's space companies — from primes to early-stage startups — in one searchable directory." },
  { name: 'Jobs', desc: 'Open roles across the state aerospace sector, posted by the companies hiring.' },
  { name: 'Events', desc: 'Conferences, roundtables, and convenings keeping the ecosystem connected.' },
  { name: 'Resources', desc: 'Grants, reports, and tools for builders navigating the space economy.' },
];

export default function SRWSpaceOS() {
  useSRWTitle('SpaceOS™ | Space Rising');

  return (
    <div data-srw>
      <SRWNav />

      <header className="srw-hero srw-hero-sm">
        <div className="srw-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-hero-veil" />
        <div className="srw-wrap srw-hero-inner">
          <div className="srw-eyebrow">The Platform</div>
          <h1>SpaceOS™</h1>
          <p className="srw-hero-sub">
            The connective layer for Arizona's space industry — companies, jobs,
            events, and resources in one interactive platform.
          </p>
        </div>
      </header>

      <section className="srw-section">
        <div className="srw-wrap">
          <p className="srw-section-lead" style={{ fontSize: 20, maxWidth: '54ch' }}>
            SpaceOS™ is the interactive Space Rising platform — a living map of
            Arizona's space ecosystem that helps companies, talent, and institutions
            find each other and move faster.
          </p>
          <Link to="/space-rising" className="srw-btn">Browse the Directory →</Link>

          <div className="srw-grid srw-grid-2" style={{ marginTop: 64 }}>
            {FEATURES.map((f) => (
              <div className="srw-card" key={f.name}>
                <h3>{f.name}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
