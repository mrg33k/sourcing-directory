import React from 'react';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

// 2026-06-21 (Taryn): Strategy = the Six Space Missions from the home page.
const PILLARS = [
  { name: 'Build Space',      desc: 'Infrastructure' },
  { name: 'Move in Space',    desc: 'Mobility' },
  { name: 'Live in Space',    desc: 'Life' },
  { name: 'Prosper in Space', desc: 'Industry' },
  { name: 'Operate in Space', desc: 'Intelligence' },
  { name: 'Secure Space',     desc: 'Defense' },
];

const TEAM = [
  { name: 'Ben Smith', title: 'Chief Executive Officer', photo: 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/ab10ecec-d626-4788-9267-a42d6024fd2b/1714670486972.jpeg?format=750w' },
  { name: 'Taryn Struck', title: 'Chief Operating Officer, Co-Founder', photo: 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/f1f433e5-e351-46a0-92b7-e8ee44c63163/ChatGPT+Image+May+11%2C+2026%2C+06_57_11+PM.png?format=750w' },
  { name: 'Tim Struck', title: 'Chief Brand Officer, Co-Founder', photo: 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/346ebcfa-f0ba-45de-ad84-d686053108be/Tim_Struck-3x5.jpg?format=750w' },
  { name: 'Angelica Sirotin', title: 'Chief Communications Officer', photo: 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/091acca6-f199-42ba-978e-6c5776cf1814/Angelica_Sirotin_Headshot_2026.jpg?format=750w' },
  { name: 'Joseph Valdez', title: 'Chief Strategy Officer', photo: 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/395b7154-417d-41f0-b7bc-34cd1dfe9563/1701816599744.jpeg?format=750w' },
  { name: 'Patrik Matheson', title: 'Lead Systems & Media Architect', photo: 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/743491ab-a7c1-4f32-b0f2-ba73a4bafd0d/1766092136378.jpeg?format=750w' },
];

const PRINCIPLES = [
  'Creativity is our obligation',
  'Respect the rules — until they limit what\'s possible',
  'Selectivity is the strategy',
  'Integrity in every interaction',
  'Trust something bigger when the odds are stacked against you',
  'Action beats perfection — experiment',
  'Relationships are the work',
  'Progress compounds when capability is shared',
  'Raise standards — everywhere',
  'Growth comes through humility and service',
];

export default function SRWAboutV2() {
  useSRWTitle('About | Space Rising');

  return (
    <div data-srw="v2">
      <SRWNavV2 />

      <header
        className="srw-pg-hero"
        style={{ '--srw-pg-hero-bg': "url('/v2-assets/earth.png')" }}
      >
        <div className="srw-pg-hero-inner">
          <div className="srw-pg-eyebrow">ABOUT</div>
          <h1 className="srw-pg-title">
            A new way to space<span className="srw-pg-period">.</span>
          </h1>
          <p className="srw-pg-sub">
            Space Rising serves as the connective layer across the evolving space economy. We translate fragmented regional activity into coordinated strategy — and prepare the next generation to carry that future forward.
          </p>
        </div>
      </header>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">OUR VISION</div>
            <h2 className="srw-pg-section-title">
              A future where every region can participate in and benefit from the global space economy<span className="srw-pg-period">.</span>
            </h2>
          </div>
        </div>
      </section>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">STRATEGY</div>
            <h2 className="srw-pg-section-title">Six space missions<span className="srw-pg-period">.</span></h2>
          </div>
          <div className="srw-pg-tile-grid">
            {PILLARS.map((p, i) => (
              <div className="srw-pg-tile" key={p.name}>
                <div className="srw-pg-tile-num">MISSION {String(i + 1).padStart(2, '0')}</div>
                <div className="srw-pg-tile-name">{p.name}</div>
                {/* Market word shown as a deliberate label (matches the home page framing),
                    so it reads as the mission's market, not a thin sentence. */}
                <div className="srw-pg-tile-body" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: 1, background: '#E8A23A', flexShrink: 0 }} />
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 12, fontWeight: 700, color: '#E8A23A' }}>{p.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">LEADERSHIP</div>
            <h2 className="srw-pg-section-title">Six Operators. One Mission<span className="srw-pg-period">.</span></h2>
          </div>
          <div className="srw-pg-team">
            {TEAM.map((m) => (
              <div className="srw-pg-team-card" key={m.name}>
                <div className="srw-pg-team-photo">
                  {m.photo && <img src={m.photo} alt={m.name} />}
                </div>
                <div className="srw-pg-team-name">{m.name}</div>
                <div className="srw-pg-team-title">{m.title.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">PRINCIPLES</div>
            <h2 className="srw-pg-section-title">How we work<span className="srw-pg-period">.</span></h2>
          </div>
          <div className="srw-pg-principles">
            {PRINCIPLES.map((p, i) => (
              <div className="srw-pg-principle" key={i}>
                <span className="srw-pg-principle-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="srw-pg-principle-name">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SRWFooterV2 />
    </div>
  );
}
