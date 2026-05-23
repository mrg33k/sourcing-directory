import React from 'react';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

// TODO: replace placeholder media items with real source names, headlines, and links.
function placeholders(year, count) {
  return Array.from({ length: count }, (_, i) => ({
    source: 'Press Outlet',
    headline: `${year} coverage highlight #${i + 1}`,
  }));
}

const MEDIA_BY_YEAR = [
  { year: '2026', items: placeholders('2026', 16) },
  { year: '2025', items: placeholders('2025', 11) },
  { year: '2024', items: placeholders('2024', 6) },
  { year: '2023', items: placeholders('2023', 7) },
];

export default function SRWMedia() {
  return (
    <div data-srw>
      <SRWNav />

      <header className="srw-hero srw-hero-sm">
        <div className="srw-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-hero-veil" />
        <div className="srw-wrap srw-hero-inner">
          <div className="srw-eyebrow">In the News</div>
          <h1>Reports & Media</h1>
          <p className="srw-hero-sub">
            Coverage of Space Rising, Space Congress™, and Arizona's growing space economy.
          </p>
        </div>
      </header>

      <section className="srw-section">
        <div className="srw-wrap">
          {MEDIA_BY_YEAR.map((group) => (
            <div key={group.year}>
              <h3 className="srw-year-head">{group.year} Media Highlights</h3>
              <div className="srw-list">
                {group.items.map((m, i) => (
                  <div className="srw-list-item" key={i}>
                    <span className="srw-list-title">{m.headline}</span>
                    <span className="srw-list-meta">{m.source}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="srw-contact">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Press</div>
          <h2>Media Inquiries</h2>
          <a href="mailto:info@spacerising.org" className="srw-email">info@spacerising.org</a>
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
