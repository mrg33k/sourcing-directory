import React from 'react';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import SRWArizonaStatsV2 from './SRWArizonaStatsV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

// 2026-06-21 (Taryn): hero chips are the four Space Congress pages from the
// original site. Removed the interim Photos/Media/Events chips. These point to
// the existing spacerising.org pages, so they open as external links.
const QUICK_LINKS = [
  { label: 'Agenda',     href: 'https://spacerising.org/agenda2026' },
  { label: 'Speakers',   href: 'https://spacerising.org/26speakers' },
  { label: 'Scholars',   href: 'https://spacerising.org/spacerisingstars' },
  { label: 'Collective', href: 'https://spacerising.org/about-1' },
];

export default function SRWArizonaV2() {
  useSRWTitle('Arizona | Space Rising');

  return (
    <div data-srw="v2">
      <SRWNavV2 />

      <header
        className="srw-pg-hero"
        style={{ '--srw-pg-hero-bg': "url('/v2-assets/sun.png')" }}
      >
        <div className="srw-pg-hero-inner">
          <div className="srw-pg-eyebrow">APRIL 29, 2026 · HYATT REGENCY · PHOENIX</div>
          <h1 className="srw-pg-title">Arizona Space Congress<span className="srw-pg-period">.</span></h1>
          <p className="srw-pg-sub">
            The annual Arizona convening. Cross-sector. Mission-forward. A method to translate collective input into actionable strategy.
          </p>
          <div className="srw-pg-chips">
            {QUICK_LINKS.map((q) => (
              <a key={q.label} href={q.href} target="_blank" rel="noreferrer" className="srw-pg-chip">{q.label}</a>
            ))}
          </div>
        </div>
      </header>

      <SRWArizonaStatsV2 />

      <SRWFooterV2 />
    </div>
  );
}
