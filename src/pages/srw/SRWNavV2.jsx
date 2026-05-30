import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Space Rising website navigation — mirrors the Squarespace nav exactly.
// Logo left, centered links, cart + SUBSCRIBE button right.
// V2 (nat-geo-uplift) — Home + SpaceOS rewired to the cloned routes so the
// flow walks on copies. Sub-pages (Space Congress, Partnerships, About) stay
// pointing at V1 since they're out of scope for this uplift.
const LINKS = [
  { label: 'Home', to: '/srw-v2' },
  { label: 'SpaceOS™', to: '/space-rising-v2' },
  {
    label: 'Space Congress™',
    to: '/srw/space-congress',
    children: [
      { label: 'Arizona', to: '/srw/arizona' },
    ],
  },
  { label: 'Partnerships', to: '/srw/partnerships' },
  { label: 'About', to: '/srw/about' },
];

export default function SRWNavV2() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav className={`srw-nav${scrolled ? ' is-scrolled' : ''}`}>
        <div className="srw-nav-inner">
          <Link to="/srw-v2" className="srw-logo" aria-label="Space Rising home">
            <img
              src="https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/82e43967-ce2d-47fc-9d5d-efe3433d1876/SpaceRising_LOGO-WHT.png?format=500w"
              alt="Space Rising"
            />
          </Link>

          <div className="srw-nav-links">
            {LINKS.map((l) => {
              const hasChildren = Array.isArray(l.children) && l.children.length > 0;
              if (!hasChildren) {
                return <Link key={l.label} to={l.to}>{l.label}</Link>;
              }
              return (
                <div key={l.label} className="srw-nav-item srw-nav-item-dropdown">
                  <Link to={l.to}>{l.label}</Link>
                  <div className="srw-nav-submenu" role="menu">
                    {l.children.map((c) => (
                      <Link key={c.label} to={c.to} role="menuitem">{c.label}</Link>
                    ))}
                  </div>
                </div>
              );
            })}
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
            <Link to="/srw/sign-up" className="srw-nav-subscribe">SUBSCRIBE</Link>
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
        {LINKS.map((l) => {
          const hasChildren = Array.isArray(l.children) && l.children.length > 0;
          return (
            <React.Fragment key={l.label}>
              <Link to={l.to} onClick={() => setOpen(false)}>{l.label}</Link>
              {hasChildren && (
                <div className="srw-mobile-submenu">
                  {l.children.map((c) => (
                    <Link key={c.label} to={c.to} onClick={() => setOpen(false)}>{c.label}</Link>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
}
