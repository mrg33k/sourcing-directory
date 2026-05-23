import React from 'react';
import { Link } from 'react-router-dom';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

const QUICK_LINKS = [
  { label: 'Agenda', to: '/srw/events' },
  { label: 'Speakers', to: '/srw/events' },
  { label: 'Scholars', to: '/srw/events' },
  { label: 'Photos', to: '/srw/media' },
];

const STATS = [
  { num: '62K+', label: 'Aerospace Employees' },
  { num: '1.3K+', label: 'Supply Chain Companies' },
  { num: '$29.5B', label: 'Statewide Economic Impact' },
];

const RANKINGS = [
  { rank: '#1', label: 'Guided missile manufacturing jobs' },
  { rank: '#3', label: 'Aerospace attractiveness' },
  { rank: '$120M', label: 'NASA funding per year' },
];

const FACTS = [
  { title: 'Industry Leaders', body: 'Major contractors — including Boeing, Raytheon, Honeywell, and Northrop Grumman — operate significant aerospace footprints across Arizona.' },
  { title: 'University of Arizona', body: "Research leadership in planetary science and space instrumentation, including leadership of NASA's OSIRIS-REx asteroid sample-return mission." },
  { title: 'Aerospace Rankings', body: 'Arizona consistently ranks among the top states for aerospace manufacturing jobs and industry attractiveness.' },
  { title: 'Arizona State University', body: 'Contributions across space science, instrumentation, and lunar/planetary exploration programs.' },
  { title: 'Starliner Landing Site', body: "Arizona's White Sands corridor and desert geography make it a strategic site for spacecraft testing and landing." },
];

const EDGE = [
  { name: 'Space Science', desc: 'World-class planetary and astronomical research.' },
  { name: 'Manufacturing', desc: 'Deep aerospace and defense production base.' },
  { name: 'Space Data & Communications', desc: 'Satellite, sensing, and ground-station expertise.' },
  { name: 'Humans in Space', desc: 'Training, life-support, and exploration systems.' },
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
          <div className="srw-eyebrow">National Standing</div>
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
          <div className="srw-grid srw-grid-3" style={{ marginTop: 40 }}>
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
          <h2>Four Areas of Strategic Advantage</h2>
          <div className="srw-grid srw-grid-4" style={{ marginTop: 40 }}>
            {EDGE.map((e, i) => (
              <div className="srw-card" key={e.name}>
                <div className="srw-card-num">{String(i + 1).padStart(2, '0')}</div>
                <h3 style={{ fontSize: 19 }}>{e.name}</h3>
                <p>{e.desc}</p>
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
          <div className="srw-eyebrow">Space Rising Presents</div>
          <h1>Space Congress™</h1>
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
          <div className="srw-eyebrow">Join Us</div>
          <h2>Be part of the convening</h2>
          <a href="mailto:info@spacerising.org" className="srw-email">info@spacerising.org</a>
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
