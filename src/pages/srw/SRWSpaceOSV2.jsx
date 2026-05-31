import React from 'react';
import { Link } from 'react-router-dom';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

// R10b (nat-geo-uplift) — each tile clicks into its directory surface.
const FEATURES = [
  { name: 'Companies', desc: "Arizona's space companies — from primes to early-stage startups — in one searchable directory.", to: '/space-rising-v2' },
  { name: 'Jobs',      desc: 'Open roles across the state aerospace sector, posted by the companies hiring.',                    to: '/space-rising-v2/jobs' },
  { name: 'Events',    desc: 'Conferences, roundtables, and convenings keeping the ecosystem connected.',                       to: '/space-rising-v2/events' },
  { name: 'Resources', desc: 'Grants, reports, and tools for builders navigating the space economy.',                            to: '/space-rising-v2/reports' },
];

export default function SRWSpaceOSV2() {
  useSRWTitle('SpaceOS™ | Space Rising');

  return (
    <div data-srw="v2">
      <SRWNavV2 />

      <header
        className="srw-pg-hero"
        style={{ '--srw-pg-hero-bg': "url('/v2-assets/rocket-orbital.png')" }}
      >
        <div className="srw-pg-hero-inner">
          <div className="srw-pg-eyebrow">THE PLATFORM</div>
          <h1 className="srw-pg-title">
            SpaceOS<span style={{ fontSize: '0.55em', verticalAlign: 'super' }}>™</span><span className="srw-pg-period">.</span>
          </h1>
          <p className="srw-pg-sub">
            The connective layer for the space industry. Companies, jobs, events, and resources in one interactive platform — a living map of the ecosystem.
          </p>
          <div className="srw-pg-cta-row">
            <Link to="/space-rising-v2" className="srw-pg-cta solid">Enter the directory →</Link>
            <Link to="/srw-v2/about" className="srw-pg-cta line">About Space Rising</Link>
          </div>
        </div>
      </header>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">WHAT IT IS</div>
            <h2 className="srw-pg-section-title">
              A living map of the space ecosystem<span className="srw-pg-period">.</span>
            </h2>
            <p className="srw-pg-section-lede">
              SpaceOS™ is the interactive Space Rising platform — a directory that helps companies, talent, and institutions find each other and move faster. Built to be searched, filtered, and trusted by the people inside the industry.
            </p>
          </div>
        </div>
      </section>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">WHAT'S INSIDE</div>
            <h2 className="srw-pg-section-title">Four surfaces<span className="srw-pg-period">.</span></h2>
          </div>
          <div className="srw-pg-tile-grid">
            {FEATURES.map((f, i) => (
              <Link to={f.to} className="srw-pg-tile srw-pg-tile-link" key={f.name}>
                <div className="srw-pg-tile-num">SURFACE {String(i + 1).padStart(2, '0')}</div>
                <div className="srw-pg-tile-name">{f.name}</div>
                <div className="srw-pg-tile-body">{f.desc}</div>
                <div className="srw-pg-tile-arrow">Enter →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SRWFooterV2 />
    </div>
  );
}
