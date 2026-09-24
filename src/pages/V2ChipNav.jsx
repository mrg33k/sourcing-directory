// V2ChipNav.jsx
// nat-geo-uplift R5f — shared category-chip navigation for /os/*.
// Single source of truth for the chip order, labels, routes, and active-state
// behavior. Pages pass `active` as the slug of the chip that should be lit.
//
// To add a new chip: append to CHIPS below. All consuming pages pick it up
// automatically — no per-file edit needed.

import React from 'react';
import { Link } from 'react-router-dom';

// Order locked: Companies → Jobs → Events → Reports → Marketplace →
// Membership → Deal Bank. Patrik 2026-05-30 chip row.
const CHIPS = [
  { slug: 'companies',  label: 'Companies',  to: '/os' },
  { slug: 'jobs',       label: 'Jobs',       to: '/os/jobs' },
  { slug: 'events',     label: 'Events',     to: '/os/events' },
  { slug: 'reports',    label: 'Reports',    to: '/os/reports' },
  { slug: 'articles',   label: 'Articles',   to: '/os/articles' },
  // Discovery hidden from the menu (Ben, 2026-09-22). Route still exists.
  { slug: 'grants',     label: 'Grants',     to: '/os/grants' },
  { slug: 'marketplace',label: 'Marketplace',to: '/os/marketplace' },
  { slug: 'membership', label: 'Membership', to: '/os/membership' },
  { slug: 'deal-bank',  label: 'Deal Bank',  to: '/os/deal-bank' },
];

export function V2ChipNav({ active }) {
  // 2026-09-24 redesign: underlined tab bar (was pill chips).
  return (
    <nav className="sd-tabs" aria-label="Directory sections">
      {CHIPS.map((c) => (
        <Link
          key={c.slug}
          to={c.to}
          className={`sd-tabs__tab${c.slug === active ? ' is-on' : ''}`}
          aria-current={c.slug === active ? 'page' : undefined}
        >
          {c.label}
        </Link>
      ))}
    </nav>
  );
}

export default V2ChipNav;
