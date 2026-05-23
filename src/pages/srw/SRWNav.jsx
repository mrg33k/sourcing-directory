import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// Space Rising website navigation.
// SpaceOS links to the live Space Rising directory at /space-rising.
const LINKS = [
  { label: 'Home', to: '/srw' },
  { label: 'SpaceOS™', to: '/space-rising' },
  { label: 'Space Congress™', to: '/srw/space-congress' },
  { label: 'Arizona', to: '/srw/arizona' },
  { label: 'Partnerships', to: '/srw/partnerships' },
  { label: 'About', to: '/srw/about' },
];

export default function SRWNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="srw-nav">
        <div className="srw-nav-inner">
          <Link to="/srw" className="srw-logo" aria-label="Space Rising home">
            <img src="/images/space-rising/logo-white.png" alt="Space Rising" />
          </Link>

          <div className="srw-nav-links">
            {LINKS.map((l) => (
              <Link key={l.label} to={l.to}>{l.label}</Link>
            ))}
          </div>

          <button
            className="srw-nav-toggle"
            aria-label="Toggle menu"
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open
                ? <path d="M18 6L6 18M6 6l12 12" />
                : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
            </svg>
          </button>
        </div>
      </nav>

      <div className={`srw-mobile-menu${open ? ' open' : ''}`}>
        {LINKS.map((l) => (
          <Link key={l.label} to={l.to} onClick={() => setOpen(false)}>{l.label}</Link>
        ))}
      </div>
    </>
  );
}
