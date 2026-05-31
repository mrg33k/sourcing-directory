// V2ChipNav.jsx
// nat-geo-uplift R5f — shared category-chip navigation for /space-rising-v2/*.
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
  { slug: 'companies',  label: 'Companies',  to: '/space-rising-v2' },
  { slug: 'jobs',       label: 'Jobs',       to: '/space-rising-v2/jobs' },
  { slug: 'events',     label: 'Events',     to: '/space-rising-v2/events' },
  { slug: 'reports',    label: 'Reports',    to: '/space-rising-v2/reports' },
  { slug: 'marketplace',label: 'Marketplace',to: '/space-rising-v2/marketplace' },
  { slug: 'membership', label: 'Membership', to: '/space-rising-v2/membership' },
  { slug: 'deal-bank',  label: 'Deal Bank',  to: '/space-rising-v2/deal-bank' },
];

export function V2ChipNav({ active }) {
  return (
    <div className="chips" style={{ paddingBottom: 4 }}>
      {CHIPS.map((c) =>
        c.slug === active ? (
          <div key={c.slug} className="chip on">{c.label}</div>
        ) : (
          <Link key={c.slug} to={c.to} className="chip" style={{ textDecoration: 'none' }}>
            {c.label}
          </Link>
        )
      )}
    </div>
  );
}

export default V2ChipNav;
