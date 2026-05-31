import React from 'react';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

// R10b (nat-geo-uplift) — scraped live from spacerising.org/events 2026-05-31.
// Each item links to its spacerising.org event detail page (internal external
// link — opens in new tab to preserve our editorial chrome).
const EVENTS = [
  {
    date: 'Jun 2',
    title: 'Arizona Space Business Roundtable',
    meta: 'Tuesday, June 2, 2026 5:00 PM – 6:30 PM · Pima Community College',
    type: 'ROUNDTABLE',
    url: 'https://spacerising.org/events/arizona-space-business-roundtable-3',
  },
  {
    date: 'TBA',
    title: 'Why Study Space? UofA CATalyst Chat',
    meta: 'University of Arizona — date TBA',
    type: 'TALK',
    url: 'https://spacerising.org/events/why-study-space-uofa-catalyst-chat',
  },
  {
    date: 'TBA',
    title: 'Arizona Space Commission Meeting',
    meta: 'State commission convening — public.',
    type: 'COMMISSION',
    url: 'https://spacerising.org/events/arizona-space-commission-meeting-hk4xp-gxesh',
  },
  {
    date: 'TBA',
    title: 'Space Roundtable',
    meta: 'Industry + public discussion — see event page.',
    type: 'ROUNDTABLE',
    url: 'https://spacerising.org/events/space-roundtable',
  },
];

export default function SRWEventsV2() {
  useSRWTitle('Events | Space Rising');

  return (
    <div data-srw="v2">
      <SRWNavV2 />

      <header
        className="srw-pg-hero"
        style={{ '--srw-pg-hero-bg': "url('/v2-assets/rocket-ascent.png')" }}
      >
        <div className="srw-pg-hero-inner">
          <div className="srw-pg-eyebrow">EVENTS</div>
          <h1 className="srw-pg-title">Where we gather<span className="srw-pg-period">.</span></h1>
          <p className="srw-pg-sub">
            Conferences, roundtables, and convenings keeping the Arizona space ecosystem connected. Share your event with the community.
          </p>
        </div>
      </header>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          <ul className="srw-pg-list">
            {EVENTS.map((e) => (
              <li className="srw-pg-list-item srw-pg-list-item-link" key={e.title}>
                <a className="srw-pg-list-link" href={e.url} target="_blank" rel="noopener noreferrer">
                  <div className="srw-pg-list-date">{e.date.toUpperCase()}</div>
                  <div>
                    <div className="srw-pg-list-title">{e.title}</div>
                    <div className="srw-pg-list-meta">{e.meta}</div>
                  </div>
                  <div className="srw-pg-list-type">{e.type}</div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="srw-pg-cta-stripe">
        <div className="srw-wrap">
          <div className="srw-pg-eyebrow">SUBMIT AN EVENT</div>
          <h2>Share your event with Arizona's space community<span className="srw-pg-period">.</span></h2>
          <a href="mailto:info@spacerising.org" className="srw-pg-cta-stripe-email">info@spacerising.org</a>
        </div>
      </section>

      <SRWFooterV2 />
    </div>
  );
}
