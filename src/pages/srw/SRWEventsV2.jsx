import React from 'react';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

const EVENTS = [
  {
    date: 'May 26 – May 29',
    title: 'State of the Space Industrial Base Conference',
    meta: 'Tue, May 26, 2026 8:00 AM – Fri, May 29, 2026 9:00 PM · Sheraton Albuquerque Airport Hotel',
    type: 'CONFERENCE',
  },
  {
    date: 'Jun 2',
    title: 'Arizona Space Business Roundtable',
    meta: 'Tuesday, June 2, 2026 5:00 PM – 6:30 PM · Pima Community College',
    type: 'ROUNDTABLE',
  },
  {
    date: 'Jun 26 – Jun 27',
    title: 'Asteroid Day with NASA Astronauts',
    meta: 'Fri, Jun 26, 2026 8:00 AM – Sat, Jun 27, 2026 5:00 PM · Meteor Crater Rd',
    type: 'PUBLIC',
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
              <li className="srw-pg-list-item" key={e.title}>
                <div className="srw-pg-list-date">{e.date.toUpperCase()}</div>
                <div>
                  <div className="srw-pg-list-title">{e.title}</div>
                  <div className="srw-pg-list-meta">{e.meta}</div>
                </div>
                <div className="srw-pg-list-type">{e.type}</div>
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
