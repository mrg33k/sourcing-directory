import React from 'react';
import { Link } from 'react-router-dom';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
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

const STATS = [
  { num: '62K+', label: 'Aerospace & Defense Employees' },
  { num: '1.3K+', label: 'Companies in the Supply Chain' },
  { num: '$29.5B', label: 'Statewide Economic Impact' },
];

const RANKINGS = [
  { rank: '#1', label: 'Guided Missile & Space Vehicle Manufacturing Jobs' },
  { rank: '#3', label: 'Aerospace Manufacturing Attractiveness' },
  { rank: '$120M/yr', label: 'Direct NASA Funding' },
];

const FACTS = [
  {
    title: 'Industry Leaders',
    body: 'Arizona hosts operations from major aerospace and defense companies, including Lockheed Martin, Boeing, Honeywell Aerospace, General Dynamics Mission Systems, Rocket Lab, Northrop Grumman, Raytheon, General Electric, and Virgin Galactic. These companies contribute significantly to Arizona\'s robust aerospace and defense sector.',
  },
  {
    title: "University of Arizona's Space Leadership",
    body: "The University of Arizona ranks among the top 10 U.S. universities for NASA-funded research expenditures. The university has a rich history in space exploration, dating back to the founding of the Lunar and Planetary Laboratory and its involvement in the Viking missions to Mars in the 1970s. In 2023, the university unveiled a new $85 million, 89,000-square-foot Applied Research Building, enhancing its research capabilities in space sciences.",
  },
  {
    title: "Arizona's Aerospace & Defense Rankings",
    body: "Aviation Maintenance: Arizona ranks 8th in the nation for aviation maintenance, with an economic impact of $2.4 billion and over 11,700 workers employed in the sector. Defense Contracts: In Fiscal Year 2023, Arizona received over $17 billion in federal defense spending, ranking 8th among all states. Optics Industry: Arizona's optics industry is valued at approximately $3 billion annually, with Southern Arizona serving as a hub for photonics research.",
  },
  {
    title: "Arizona State University's Space Contributions",
    body: "Arizona State University (ASU) has been a significant contributor to Mars missions since the NASA Viking missions in the 1970s. ASU's School of Earth and Space Exploration boasts over 40 instrument facilities and laboratories, participates in more than 25 active space missions, and collaborates with over 120 space industry partners.",
  },
  {
    title: 'Starliner Landing Site',
    body: "Arizona is home to one of the designated landing sites for Boeing's Starliner spacecraft. The Willcox Playa in Arizona is one of the potential landing locations for the Starliner, alongside sites in New Mexico and Utah.",
  },
];

const EDGE = [
  {
    name: 'Space Science',
    items: [
      'Planetary & Geological Sciences',
      'Deep Space Missions',
      'Microgravity & Space Environment Research',
      'Observational Astronomy',
    ],
  },
  {
    name: 'Manufacturing',
    items: [
      'Satellite Components and Payload Systems',
      'Spacecraft and Launch Vehicle Manufacturing',
      'Subsystems and Precision Subcomponent Fabrication',
      'In-Orbit Assembly and Additive Manufacturing',
    ],
  },
  {
    name: 'Space Data, Information and Communications',
    items: [
      'Space Domain Awareness',
      'Space Debris Monitoring and Mitigation',
      'Remote Sensing and Sensor Development',
      'Data Analytics and Processing',
      'Satellite Communications',
    ],
  },
  {
    name: 'Humans in Space',
    items: [
      'Space Medicine, Health, and Human Performance',
      'Space and the Humanities',
      'Space Business, Leadership, and Economy',
      'Space Tourism',
      'Augmented and Virtual Reality',
    ],
  },
];

export function ArizonaStats() {
  return (
    <>
      <section>
        <div className="srw-wrap">
          <div className="srw-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {STATS.map((s) => (
              <div className="srw-stat" key={s.label}>
                <div className="srw-stat-num">{s.num}</div>
                <div className="srw-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-section">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Leadership + Innovation</div>
          <h2>Where Arizona Ranks</h2>
          <div className="srw-grid srw-grid-3" style={{ marginTop: 40 }}>
            {RANKINGS.map((r) => (
              <div className="srw-card" key={r.label}>
                <div className="srw-stat-num" style={{ fontSize: 44 }}>{r.rank}</div>
                <p style={{ marginTop: 10 }}>{r.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-section srw-section-dark">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Space Facts</div>
          <h2>The Arizona Space Story</h2>
          <div className="srw-grid srw-grid-2" style={{ marginTop: 40 }}>
            {FACTS.map((f) => (
              <div className="srw-card" key={f.title}>
                <h3 style={{ fontSize: 19 }}>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-section">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Arizona's Edge</div>
          <h2>Arizona's Edge</h2>
          <div className="srw-grid srw-grid-4" style={{ marginTop: 40 }}>
            {EDGE.map((e, i) => (
              <div className="srw-card" key={e.name}>
                <h3 style={{ fontSize: 19 }}>{e.name}</h3>
                <ul className="srw-edge-list">
                  {e.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default function SRWSpaceCongress() {
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

      <section className="srw-contact">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Contact</div>
          <h2>info@spacerising.org</h2>
          <a href="mailto:info@spacerising.org" className="srw-email">info@spacerising.org</a>
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
