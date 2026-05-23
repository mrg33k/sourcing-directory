import React from 'react';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

const PILLARS = [
  {
    name: 'Mission Forward Space Congress',
    desc: 'Convening method built to transform collective input into actionable strategy, supporting regional space economy development with national scalability.',
  },
  {
    name: 'STEM + Jobs',
    desc: 'Prepare the next generation of space-ready talent through accelerators and workforce pathways.',
  },
  {
    name: 'Partnered Innovation',
    desc: 'Accelerate technology transfer and collaboration across federal, state, and industry partners.',
  },
  {
    name: 'Research Facilities',
    desc: 'Expand research laboratory infrastructure nationwide.',
  },
  {
    name: 'Power Systems',
    desc: 'Drive advanced nuclear propulsion and emerging energy solutions to accelerate space innovation.',
  },
];

const TEAM = [
  { name: 'Ben Smith', title: 'Chief Executive Officer' },
  { name: 'Taryn Struck', title: 'Chief Operating Officer, Co-Founder' },
  { name: 'Tim Struck', title: 'Chief Brand Officer, Co-Founder' },
  { name: 'Angelica Sirotin', title: 'Chief Communications Officer' },
  { name: 'Jospeh Valdez', title: 'Chief Strategy Officer' },
  { name: 'Robert S Katz', title: 'Strategic Advisor, CEO & Executive Director, World Innovation Network (WIN)' },
  { name: 'Patrik Matheson', title: 'Lead Systems & Media Architect' },
];

const PRINCIPLES = [
  'Creativity is our obligation',
  'Respect the rules – until they limit what’s possible',
  'Selectivity is the strategy',
  'Integrity in every interaction',
  'Trust something bigger when the odds are stacked against you',
  'Action beats perfection – experiment',
  'Relationships are the work',
  'Progress compounds when capability is shared',
  'Raise standards - everywhere',
  'Growth comes through humility and service',
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
        </div>
      </header>

      {/* Vision + Mission */}
      <section className="srw-section">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Our Vision</div>
          <h2 style={{ maxWidth: '30ch' }}>
            Become a spacefaring civilization guided by knowledge, cooperation, and stewardship
          </h2>
          <p className="srw-section-lead" style={{ fontSize: 20, marginTop: 20, maxWidth: '60ch' }}>
            While empowering the next generation of leaders to carry that future forward. We serve as a
            connective layer for the evolving space economy — translating fragmented activity into
            coordinated ecosystem development.
          </p>
        </div>
      </section>

      {/* Strategic pillars */}
      <section className="srw-section srw-section-dark">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Strategy</div>
          <h2>Mission Forward</h2>
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
          <div className="srw-eyebrow">Leadership</div>
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
          <div className="srw-eyebrow">Principles Guiding the Way</div>
          <h2>Guiding Principles</h2>
          <div className="srw-principles" style={{ marginTop: 40 }}>
            {PRINCIPLES.map((p, i) => (
              <div className="srw-principle" key={i}>
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
