import React from 'react';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

const EVENTS = [
  {
    date: 'May 26 – May 29',
    title: 'State of the Space Industrial Base Conference',
    meta: 'Tue, May 26, 2026 8:00 AM – Fri, May 29, 2026 9:00 PM · Sheraton Albuquerque Airport Hotel',
  },
  {
    date: 'Jun 2',
    title: 'Arizona Space Business Roundtable',
    meta: 'Tuesday, June 2, 2026 5:00 PM – 6:30 PM · Pima Community College',
  },
  {
    date: 'Jun 26 – Jun 27',
    title: 'Asteroid Day with NASA Astronauts',
    meta: 'Fri, Jun 26, 2026 8:00 AM – Sat, Jun 27, 2026 5:00 PM · Meteor Crater Rd',
  },
];

export default function SRWEvents() {
  useSRWTitle('Events | Space Rising');

  return (
    <div data-srw>
      <SRWNav />

      <header className="srw-hero srw-hero-sm">
        <div className="srw-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-hero-veil" />
        <div className="srw-wrap srw-hero-inner">
          <div className="srw-eyebrow">Events</div>
          <h1>Arizona Events</h1>
          <p className="srw-hero-sub">
            Share your events with Arizona's space community.
          </p>
        </div>
      </header>

      <section className="srw-section">
        <div className="srw-wrap">
          <div className="srw-list" style={{ marginTop: 0 }}>
            {EVENTS.map((e) => (
              <div className="srw-list-item srw-event-item" key={e.title}>
                <div className="srw-event-date">{e.date}</div>
                <div>
                  <div className="srw-list-title">{e.title}</div>
                  <div className="srw-list-meta">{e.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-contact">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Submit an Event</div>
          <h2>Share your events with Arizona's space community</h2>
          <a href="mailto:info@spacerising.org" className="srw-email">info@spacerising.org</a>
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
