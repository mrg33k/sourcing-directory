/**
 * OSHubAlivePage — Alive hub landing page for Space OS v3
 *
 * Replaces OSHubPlaceholder for all 5 hub pages.
 * Layout: cinematic navy hero + section portal card grid.
 *
 * Props:
 *   title     string  — hub name, e.g. "Ecosystem"
 *   subtitle  string  — one-line hero tagline
 *   eyebrow   string  — e.g. "SPACE OS // ECOSYSTEM"
 *   accent    string  — hub accent hex, drives strip gradients
 *   sections  array   — [{ label, description, href, icon, comingSoon }]
 */

import React from 'react';
import { Link } from 'react-router-dom';
import './osv3-hub-alive.css';

/* SVG icon map — 24×24 viewBox, single-stroke, white on accent strip */
const ICONS = {
  company: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="7" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 21V10M16 21V10M3 12h18M7 3h10a1 1 0 0 1 1 1v3H6V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  org: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="4" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="20" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 7.5v5M6.5 18l5.5-5.5M17.5 18L12 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="17" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M21 20c0-2.21-1.79-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 20h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 20V13M10 20V9M14 20V11M18 20V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  article: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 8h10M7 12h6M7 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  discovery: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9 11l1.5 1.5L13 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  podcast: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  news: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 12h3M19 12h3M12 3v3M12 18v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M16 10l6-4v12l-6-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  rfp: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 8h8M8 12h6M8 16h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="18" cy="18" r="4" fill="white" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M16.5 18l1 1 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  grant: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="9" r="5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9 12l2 2 4-4M8.5 14L6 21h12l-2.5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  deal: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 19V14M8 19V10M12 19V7M16 19V4M20 19V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4 14l4-4 4-3 4-3 4 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  learn: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3L2 8l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M6 11v5c0 2 2.686 3 6 3s6-1 6-3v-5M22 8v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  bookmark: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  follow: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
};

/* SectionCard — portal card for one hub section */
function SectionCard({ section, accentColor }) {
  const icon = ICONS[section.icon] || ICONS.report;

  const inner = (
    <>
      {/* accent strip with icon */}
      <div
        className="osv3-hub-alive-card-strip"
        style={{ background: `linear-gradient(135deg, ${accentColor}28 0%, ${accentColor}08 100%)` }}
      >
        <div className="osv3-hub-alive-card-icon" style={{ color: accentColor }}>
          {icon}
        </div>
        {section.comingSoon && (
          <div className="osv3-hub-alive-coming-chip">Coming soon</div>
        )}
      </div>

      {/* body */}
      <div className="osv3-hub-alive-card-body">
        <div className="osv3-hub-alive-card-title">{section.label}</div>
        {section.description && (
          <div className="osv3-hub-alive-card-desc">{section.description}</div>
        )}
        <div className="osv3-hub-alive-card-cta">
          {section.comingSoon ? (
            <span className="osv3-hub-alive-cta-soon">Not yet available</span>
          ) : (
            <span className="osv3-hub-alive-cta-live">Explore &rarr;</span>
          )}
        </div>
      </div>
    </>
  );

  if (section.comingSoon || !section.href) {
    return (
      <div className={`osv3-hub-alive-card${section.comingSoon ? ' osv3-hub-alive-card--soon' : ''}`}>
        {inner}
      </div>
    );
  }

  return (
    <Link to={section.href} className="osv3-hub-alive-card osv3-hub-alive-card--live">
      {inner}
    </Link>
  );
}

/* OSHubAlivePage */
function OSHubAlivePage({
  title,
  subtitle,
  eyebrow,
  accent = '#3B82F6',
  sections = [],
  ctaBand,       // { text, ctaLabel, href } — navy bar rendered below the grid
  emptyStateBanner, // { icon, title, subtitle, ctaLabel, ctaHref } — shown between hero + grid
}) {
  const liveCount = sections.filter(s => !s.comingSoon).length;
  const allComingSoon = liveCount === 0;
  const gridLabel = allComingSoon
    ? "WHAT'S COMING"
    : `EXPLORE  ${liveCount} LIVE ${liveCount === 1 ? 'SECTION' : 'SECTIONS'}`;

  return (
    <div className="osv3-hub-alive">
      {/* breadcrumb */}
      <div className="osv3-hub-alive-crumb">
        <span>Space OS / </span>{title}
      </div>

      {/* cinematic navy hero */}
      <div className="osv3-hub-alive-hero">
        <div className="osv3-hub-alive-hero-stars" aria-hidden="true" />
        <div className="osv3-hub-alive-hero-body">
          <div className="osv3-hub-alive-eyebrow">{eyebrow}</div>
          <h1 className="osv3-hub-alive-title">{title}</h1>
          <p className="osv3-hub-alive-subtitle">{subtitle}</p>
        </div>
        <div className="osv3-hub-alive-hero-accent" style={{ background: accent }} />
      </div>

      {/* empty state banner — shown between hero and grid when provided */}
      {emptyStateBanner && (
        <div className="osv3-hub-alive-empty-banner">
          {emptyStateBanner.icon && ICONS[emptyStateBanner.icon] && (
            <div className="osv3-hub-alive-empty-banner-icon" style={{ color: accent }}>
              {ICONS[emptyStateBanner.icon]}
            </div>
          )}
          <h2 className="osv3-hub-alive-empty-banner-title">{emptyStateBanner.title}</h2>
          {emptyStateBanner.subtitle && (
            <p className="osv3-hub-alive-empty-banner-subtitle">{emptyStateBanner.subtitle}</p>
          )}
          {emptyStateBanner.ctaHref && (
            <a
              href={emptyStateBanner.ctaHref}
              className="osv3-hub-alive-empty-banner-cta"
              style={{ background: accent }}
            >
              {emptyStateBanner.ctaLabel}
            </a>
          )}
        </div>
      )}

      {/* grid header */}
      <div className="osv3-hub-alive-grid-head">
        <div className="osv3-hub-alive-grid-eyebrow">{gridLabel}</div>
      </div>

      {/* section portal cards */}
      <div className="osv3-hub-alive-grid">
        {sections.map((s, i) => (
          <SectionCard key={i} section={s} accentColor={accent} />
        ))}
      </div>

      {/* CTA band — navy bar with rust CTA below the grid */}
      {ctaBand && (
        <div className="osv3-hub-alive-cta-band">
          <p className="osv3-hub-alive-cta-band-text">{ctaBand.text}</p>
          <a href={ctaBand.href} className="osv3-hub-alive-cta-band-btn">
            {ctaBand.ctaLabel}
          </a>
        </div>
      )}
    </div>
  );
}

export default OSHubAlivePage;
