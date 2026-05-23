import React from 'react';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

const PILLARS = [
  { name: 'STEM + Jobs', desc: 'Workforce development — building the talent pipeline for the space economy.' },
  { name: 'Partnered Innovation', desc: 'Technology transfer between industry, universities, and government.' },
  { name: 'Research Facilities', desc: 'Infrastructure expansion to support next-generation space programs.' },
  { name: 'Power Systems', desc: 'Advancing nuclear propulsion and in-space power generation.' },
];

// TODO: replace placeholder team with real names, titles, photos, and LinkedIn URLs.
const TEAM = [
  { name: 'Taryn [Last Name]', title: 'Executive Director' },
  { name: 'TBD', title: 'Director of Partnerships' },
  { name: 'TBD', title: 'Program Director' },
  { name: 'TBD', title: 'Director of Operations' },
  { name: 'TBD', title: 'Community Lead' },
  { name: 'TBD', title: 'Policy Advisor' },
  { name: 'TBD', title: 'Communications Lead' },
];

// TODO: confirm exact guiding principles from spacerising.org — placeholders below.
const PRINCIPLES = [
  'Creativity', 'Integrity', 'Action', 'Relationships',
  'Curiosity', 'Stewardship', 'Excellence', 'Collaboration',
  'Resilience', 'Vision',
];

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

export default function SRWAbout() {
  return (
    <div data-srw>
      <SRWNav />

      <header className="srw-hero srw-hero-sm">
        <div className="srw-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-hero-veil" />
        <div className="srw-wrap srw-hero-inner">
          <div className="srw-eyebrow">About Us</div>
          <h1>A New Way to Space</h1>
          <p className="srw-hero-sub">
            Building the connective infrastructure for America's space economy.
          </p>
        </div>
      </header>

      {/* Vision + Mission */}
      <section className="srw-section">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Our Vision</div>
          <h2 style={{ maxWidth: '24ch' }}>
            A thriving, coordinated space economy — built from Arizona outward.
          </h2>
          <p className="srw-section-lead" style={{ fontSize: 20, marginTop: 20, maxWidth: '60ch' }}>
            Space Rising exists to be the connective layer for the evolving space
            economy — turning a fragmented ecosystem of companies, capital,
            institutions, and talent into a coordinated engine for growth.
          </p>
        </div>
      </section>

      {/* Space Congress methodology */}
      <section className="srw-band">
        <div className="srw-band-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-band-veil" />
        <div className="srw-wrap srw-band-inner">
          <div className="srw-eyebrow">How We Work</div>
          <h2>From collective input to actionable strategy</h2>
          <p>
            Through Space Congress™, Space Rising convenes the people building the
            space economy and translates their collective input into a shared,
            actionable strategy for the region.
          </p>
        </div>
      </section>

      {/* Strategic pillars */}
      <section className="srw-section srw-section-dark">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Strategy</div>
          <h2>Four Strategic Pillars</h2>
          <div className="srw-grid srw-grid-2" style={{ marginTop: 44 }}>
            {PILLARS.map((p, i) => (
              <div className="srw-card" key={p.name}>
                <div className="srw-card-num">{String(i + 1).padStart(2, '0')}</div>
                <h3>{p.name}</h3>
                <p>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="srw-section">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Our People</div>
          <h2>Leadership</h2>
          <div className="srw-team" style={{ marginTop: 44 }}>
            {TEAM.map((m, i) => (
              <div className="srw-team-card" key={i}>
                <div className="srw-team-photo"><PersonIcon /></div>
                <div className="srw-team-name">{m.name}</div>
                <div className="srw-team-title">{m.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guiding principles */}
      <section className="srw-section srw-section-dark">
        <div className="srw-wrap">
          <div className="srw-eyebrow">What Guides Us</div>
          <h2>Guiding Principles</h2>
          <div className="srw-principles" style={{ marginTop: 40 }}>
            {PRINCIPLES.map((p, i) => (
              <div className="srw-principle" key={p}>
                <span className="srw-principle-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="srw-principle-name">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
