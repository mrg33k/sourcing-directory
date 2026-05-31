// R6 (nat-geo-uplift) — shared Arizona stats block used by Arizona + Space Congress pages.
// polish-arizona-stats — count-up animation + visceral upgrade applied to BY THE NUMBERS
// section (same IntersectionObserver + ease-out cubic pattern as polish-directory-1 stats
// on /srw-v2 home, adapted to the .srw-pg-tile layout).
import React, { useEffect, useRef, useState } from 'react';

const STATS = [
  { num: '62K+',   target: 62,   prefix: '',  suffix: 'K+', decimals: 0, label: 'Aerospace & Defense Employees' },
  { num: '1.3K+',  target: 1.3,  prefix: '',  suffix: 'K+', decimals: 1, label: 'Companies in the Supply Chain' },
  { num: '$29.5B', target: 29.5, prefix: '$', suffix: 'B',  decimals: 1, label: 'Statewide Economic Impact' },
];

const RANKINGS = [
  { rank: '#1', label: 'Guided Missile & Space Vehicle Manufacturing Jobs' },
  { rank: '#3', label: 'Aerospace Manufacturing Attractiveness' },
  { rank: '$120M/yr', label: 'Direct NASA Funding' },
];

const FACTS = [
  { title: 'Industry Leaders', body: "Arizona hosts operations from major aerospace and defense companies, including Lockheed Martin, Boeing, Honeywell Aerospace, General Dynamics Mission Systems, Rocket Lab, Northrop Grumman, Raytheon, General Electric, and Virgin Galactic." },
  { title: "University of Arizona's Space Leadership", body: "U of A ranks among the top 10 U.S. universities for NASA-funded research expenditures. History dates back to Lunar and Planetary Lab's Viking missions to Mars (1970s). In 2023 unveiled an $85M, 89,000-sq-ft Applied Research Building." },
  { title: "Aerospace & Defense Rankings", body: "Arizona ranks 8th in aviation maintenance ($2.4B economic impact, 11,700 workers). In FY 2023, received over $17B in federal defense spending, ranking 8th. Optics industry valued at ~$3B annually with Southern Arizona as a photonics research hub." },
  { title: "Arizona State University's Space Contributions", body: "ASU has contributed to Mars missions since NASA Viking (1970s). The School of Earth and Space Exploration has 40+ instrument facilities/labs, participates in 25+ active space missions, collaborates with 120+ industry partners." },
  { title: 'Starliner Landing Site', body: "Arizona's Willcox Playa is one of the designated landing sites for Boeing's Starliner spacecraft, alongside sites in New Mexico and Utah." },
];

const EDGE = [
  { name: 'Space Science', items: ['Planetary & Geological Sciences', 'Deep Space Missions', 'Microgravity Research', 'Observational Astronomy'] },
  { name: 'Manufacturing', items: ['Satellite Components', 'Spacecraft Launch Vehicles', 'Precision Subcomponents', 'In-Orbit Assembly'] },
  { name: 'Data & Comms', items: ['Space Domain Awareness', 'Debris Monitoring', 'Remote Sensing', 'Data Analytics', 'Satellite Comms'] },
  { name: 'Humans in Space', items: ['Space Medicine', 'Space Humanities', 'Business & Economy', 'Space Tourism', 'AR/VR'] },
];

export default function SRWArizonaStatsV2() {
  // polish-arizona-stats — count-up + amber-bar reveal on the BY THE NUMBERS
  // section. Same architecture as polish-directory-1 on /srw-v2 home: SSR-safe
  // initial state honors prefers-reduced-motion, IntersectionObserver triggers
  // a single 1.6s ease-out-cubic interpolation, rAF + setState per frame.
  const statsRef = useRef(null);
  const [statValues, setStatValues] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? STATS.map(s => s.target)
      : STATS.map(() => 0)
  );
  useEffect(() => {
    const sec = statsRef.current;
    if (!sec) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let fired = false;
    let raf = 0;
    const start = () => {
      const t0 = performance.now();
      const dur = 1600;
      const tick = (now) => {
        const t = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setStatValues(STATS.map(s => s.target * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fired) {
        fired = true;
        sec.setAttribute('data-stats-visible', 'true');
        start();
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(sec);
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const renderStatNumber = (s, i) => {
    const v = statValues[i];
    const formatted = s.decimals === 0 ? Math.round(v) : v.toFixed(s.decimals);
    return `${s.prefix}${formatted}${s.suffix}`;
  };

  return (
    <>
      <section ref={statsRef} className="srw-pg-section srw-arz-stats-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">BY THE NUMBERS</div>
            <h2 className="srw-pg-section-title">The Arizona space economy<span className="srw-pg-period">.</span></h2>
          </div>
          <div className="srw-pg-tile-grid">
            {STATS.map((s, i) => (
              <div className="srw-pg-tile srw-arz-stat-tile" key={s.label}>
                <div className="srw-pg-tile-num srw-arz-stat-label">{s.label.toUpperCase()}</div>
                <div className="srw-pg-tile-name srw-arz-stat-num">{renderStatNumber(s, i)}</div>
                <div className="srw-arz-stat-bar" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">RANKINGS</div>
            <h2 className="srw-pg-section-title">Where Arizona stands<span className="srw-pg-period">.</span></h2>
          </div>
          <div className="srw-pg-tile-grid">
            {RANKINGS.map((r) => (
              <div className="srw-pg-tile" key={r.label}>
                <div className="srw-pg-tile-name" style={{ fontSize: 40, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.03em' }}>{r.rank}</div>
                <div className="srw-pg-tile-body">{r.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">SPACE FACTS</div>
            <h2 className="srw-pg-section-title">The Arizona space story<span className="srw-pg-period">.</span></h2>
          </div>
          <div className="srw-pg-tile-grid">
            {FACTS.map((f) => (
              <div className="srw-pg-tile" key={f.title}>
                <div className="srw-pg-tile-name">{f.title}</div>
                <div className="srw-pg-tile-body">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">ARIZONA'S EDGE</div>
            <h2 className="srw-pg-section-title">Where we lead<span className="srw-pg-period">.</span></h2>
          </div>
          <div className="srw-pg-tile-grid">
            {EDGE.map((e) => (
              <div className="srw-pg-tile" key={e.name}>
                <div className="srw-pg-tile-name">{e.name}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {e.items.map((it) => (
                    <li key={it} style={{ fontSize: 13, color: 'rgba(232,228,218,0.65)', fontWeight: 300, paddingLeft: 14, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: '#E8A23A' }}>·</span>
                      {it}
                    </li>
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
