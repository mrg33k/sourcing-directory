import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// Space Rising website navigation — mirrors the Squarespace nav exactly.
// Logo left, centered links, cart + SUBSCRIBE button right.
// SpaceOS links to the live Space Rising directory at /space-rising.
const LINKS = [
  { label: 'Home', to: '/srw' },
  { label: 'SpaceOS™', to: '/space-rising' },
  { label: 'Space Congress™', to: '/srw/space-congress' },
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
            <img
              src="https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/82e43967-ce2d-47fc-9d5d-efe3433d1876/SpaceRising_LOGO-WHT.png?format=500w"
              alt="Space Rising"
            />
          </Link>

          <div className="srw-nav-links">
            {LINKS.map((l) => (
              <Link key={l.label} to={l.to}>{l.label}</Link>
            ))}
          </div>

          <div className="srw-nav-actions">
            <a href="#" className="srw-nav-cart" aria-label="Cart">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
              </svg>
              <span className="srw-nav-cart-count">0</span>
            </a>
            <Link to="/srw/about" className="srw-nav-subscribe">SUBSCRIBE</Link>
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
