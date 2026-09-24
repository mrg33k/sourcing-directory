// Shared Sourcing Directory chrome for the directory pages (2026-09-24 redesign):
// hero logo, red SEARCH button, building placeholder, and Explore-more tiles.
// The Home · Directory · Search · More bottom bar is the site's existing v10-nav.

import React from 'react';
import { Link } from 'react-router-dom';
import SDLogo from './SDLogo.jsx';

export function SDHeroLogo() {
  return (
    <Link to="/start" className="sd-hero-logo" aria-label="Sourcing Directory, choose a directory">
      <SDLogo size="sm" />
    </Link>
  );
}

// Fires the page's own search (every page searches on Enter in its input).
export function SDSearchButton() {
  const onClick = (e) => {
    const input = e.currentTarget.parentElement?.querySelector('input');
    if (!input) return;
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  };
  return <button type="button" className="sd-search-btn" onClick={onClick}>Search</button>;
}

export function SDBuilding({ size = 22 }) {
  return (
    <span className="sd-ph" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 21V5.5L12 3v18M12 21V8l8 2.5V21M2.5 21h19" />
        <path d="M7 8h2M7 11h2M7 14h2M7 17h2M15 13h2M15 16h2" />
      </svg>
    </span>
  );
}

const EXPLORE = [
  { to: '/spaceos/jobs', img: '/sd/jobs.jpg', eyebrow: 'Jobs', title: 'Explore open roles' },
  { to: '/spaceos/events', img: '/sd/events.jpg', eyebrow: 'Events', title: 'See industry events' },
  { to: '/spaceos/reports', img: '/sd/reports.jpg', eyebrow: 'Reports', title: 'Read industry reports' },
];

export function SDExploreMore() {
  return (
    <section className="sd-explore" aria-label="Explore more">
      <h2 className="sd-h2">Explore more<span className="sd-dot">.</span></h2>
      <div className="sd-explore__row">
        {EXPLORE.map((t, i) => (
          <Link key={t.to} to={t.to} className={`sd-explore__tile${i === 0 ? ' is-first' : ''}`}>
            <img src={t.img} alt="" loading="lazy" />
            <span className="sd-explore__txt">
              <span className="sd-explore__eyebrow">{t.eyebrow}</span>
              <span className="sd-explore__title">{t.title}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
