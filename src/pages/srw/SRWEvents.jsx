import React from 'react';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

// TODO: confirm dates/venues against spacerising.org as the calendar firms up.
const EVENTS = [
  { title: 'Arizona Space Congress™', meta: 'April 29, 2026 · Hyatt Regency, Phoenix' },
  { title: 'Space Tank™ Innovation Competition', meta: 'April 29, 2026 · Phoenix, AZ' },
  { title: 'Space Symposium', meta: 'April 13–16, 2026 · Colorado Springs, CO' },
  { title: 'State of the Space Industrial Base Conference', meta: 'May 26–29, 2026' },
  { title: 'Asteroid Day with NASA Astronauts', meta: 'June 26–27, 2026' },
  { title: 'Arizona Aerospace Summit', meta: 'July 15, 2026 · Arizona' },
  { title: 'SpaceFest 2026', meta: 'July 23–26, 2026' },
  { title: 'Arizona Space Business Roundtable', meta: 'Recurring · Statewide' },
];

export default function SRWEvents() {
  return (
    <div data-srw>
      <SRWNav />

      <header className="srw-hero srw-hero-sm">
        <div className="srw-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-hero-veil" />
        <div className="srw-wrap srw-hero-inner">
          <div className="srw-eyebrow">Events</div>
          <h1>Share Your Events with Arizona's Space Community</h1>
          <p className="srw-hero-sub">
            Conferences, competitions, and convenings keeping the ecosystem connected.
          </p>
        </div>
      </header>

      <section className="srw-section">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Upcoming</div>
          <h2>Calendar</h2>
          <div className="srw-list" style={{ marginTop: 40 }}>
            {EVENTS.map((e) => (
              <div className="srw-list-item" key={e.title}>
                <span className="srw-list-title">{e.title}</span>
                <span className="srw-list-meta">{e.meta}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="srw-contact">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Submit an Event</div>
          <h2>Have something to add?</h2>
          <a href="mailto:info@spacerising.org" className="srw-email">info@spacerising.org</a>
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
