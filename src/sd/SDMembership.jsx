// Membership — free right now (Patrik, 2026-09-24). One offer, one action:
// create a free account → onboarding.

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { V2ChipNav } from '../pages/V2ChipNav.jsx';
import { SDHeroLogo } from './SDChrome.jsx';
import '../space-rising-theme-v2.css';

const PERKS = [
  ['Get listed', 'Put your company in front of buyers searching by capability and certification.'],
  ['Search everything', 'Every supplier, job, event, report, grant, and deal in your industry.'],
  ['Post for free', 'Share open roles, events, equipment, and articles with the whole directory.'],
  ['Pick your industries', 'Aerospace and semiconductors today. Manufacturing and construction next.'],
];

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D71920" strokeWidth="2.6" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export default function SDMembership() {
  useEffect(() => { document.title = 'Membership | Sourcing Directory'; }, []);

  return (
    <div data-tenant="space-rising-v2" style={{ minHeight: '100dvh' }}>
      <div className="browse-hero sd-hero--nosearch">
        <div className="browse-hero-bg" />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <div className="browse-hero-toprow"><SDHeroLogo /></div>
          <div className="sd-eyebrow">Membership</div>
          <div className="browse-title">Free to join<span className="sd-dot">.</span></div>
          <div className="browse-sub">Membership is free right now. Create your account and start sourcing.</div>
        </div>
      </div>

      <V2ChipNav active="membership" />

      <section className="sd-member">
        <div className="sd-member__card">
          <div className="sd-member__tag">Free membership</div>
          <div className="sd-member__price">$0<span> / right now</span></div>
          <ul className="sd-member__perks">
            {PERKS.map(([t, d]) => (
              <li key={t}><Check /><span><strong>{t}</strong>{d}</span></li>
            ))}
          </ul>
          <Link to="/get-started" className="sd-btn sd-btn--block sd-member__cta">
            Create your free account
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg>
          </Link>
          <p className="sd-member__note">No card. Takes a minute.</p>
        </div>
      </section>
    </div>
  );
}
