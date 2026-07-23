/**
 * OSMagazinePage — Alive page engine for Space OS v3
 *
 * One config-driven component that renders the 7-ingredient "alive" pattern:
 *   1. Breadcrumb + page title + subtitle head
 *   2. Always-present rust "Add" pill (the anti-empty door)
 *   3. FEATURED hero with swappable media slot (left panel)
 *   4. Feature right-body: eyebrow, title, host, desc, meta, actions
 *   5. Filter pills
 *   6. Section eyebrow count + card grid
 *   7. Swappable card renderer (passed as `cardRenderer` prop)
 *
 * Props:
 *   breadcrumb       string  — e.g. "Space OS / Intelligence Hub / Podcasts"
 *   pageTitle        string  — e.g. "Podcasts"
 *   pageSubtitle     string  — e.g. "Conversations, briefings..."
 *   addLabel         string  — text for the rust Add pill
 *   onAdd            fn      — called when Add pill is clicked
 *   featuredItem     object  — the featured record (null = no feature shown)
 *   mediaSlot        node    — JSX for the hero's LEFT media panel
 *   featureEyebrow   string  — e.g. "FEATURED EPISODE"
 *   featureTitle     string  — featured record title
 *   featureHost      string  — host / author line (optional)
 *   featureHostTag   string  — secondary host label (optional)
 *   featureDesc      string  — featured description
 *   featureMeta      array   — [{label, value}] for the meta row
 *   featureActions   node    — JSX action buttons / links
 *   pills            array   — [{label, value}] for filter row
 *   activeFilter     string  — currently active pill value
 *   onFilter         fn      — called with filter value
 *   items            array   — card records (filtered)
 *   cardRenderer     fn      — (item, index) => <Node />
 *   isLoading        bool
 *   sectionLabel     string  — e.g. "ALL EPISODES"
 */

import React from 'react';
import './osv3-magazine.css';

function OSMagazinePage({
  breadcrumb = 'Space OS',
  pageTitle = '',
  pageSubtitle = '',
  addLabel = 'Add',
  onAdd,
  /* feature */
  featuredItem = null,
  mediaSlot = null,
  featureEyebrow = 'FEATURED',
  featureTitle = '',
  featureHost = '',
  featureHostTag = '',
  featureDesc = '',
  featureMeta = [],
  featureActions = null,
  /* grid */
  pills = [],
  activeFilter = 'all',
  onFilter,
  items = [],
  cardRenderer,
  isLoading = false,
  sectionLabel = 'ALL ITEMS',
}) {
  /* breadcrumb: split on "/" and render last segment plain, rest muted */
  const crumbParts = breadcrumb.split('/').map(s => s.trim());
  const crumbLast = crumbParts.pop();

  return (
    <div className="osv3-mag">
      {/* breadcrumb */}
      <div className="osv3-mag-crumb">
        {crumbParts.map((p, i) => (
          <span key={i}>{p} / </span>
        ))}
        {crumbLast}
      </div>

      {/* page head: title + subtitle LEFT, Add pill RIGHT */}
      <div className="osv3-mag-page-head">
        <div>
          <h1 className="osv3-mag-page-title">{pageTitle}</h1>
          {pageSubtitle && (
            <p className="osv3-mag-page-sub">{pageSubtitle}</p>
          )}
        </div>
        <button className="osv3-mag-add-btn" onClick={onAdd} type="button">
          <span className="osv3-mag-add-plus">+</span>
          {addLabel}
        </button>
      </div>

      {/* featured hero */}
      {featuredItem && (
        <div className="osv3-mag-feature">
          {/* left: swappable media slot; falls back to orbital design when null */}
          <div className="osv3-mag-feature-media">
            {mediaSlot ?? (
              /* Engine default — alive for any future fork (Reports, Marketplace, etc.)
                 Orbital rings + rust satellite dot + starfield. No empty rectangles. */
              <div className="osv3-mag-fmd">
                <div className="osv3-mag-fmd-stars" aria-hidden="true" />
                <div className="osv3-mag-fmd-inner">
                  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="120" height="120" aria-hidden="true">
                    <circle cx="60" cy="60" r="58" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                    <circle cx="60" cy="60" r="44" stroke="rgba(206,68,33,0.25)" strokeWidth="1"/>
                    <circle cx="60" cy="60" r="28" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
                    <circle cx="60" cy="60" r="10" fill="rgba(206,68,33,0.6)"/>
                    <circle cx="60" cy="2" r="4.5" fill="#CE4421"/>
                  </svg>
                  <div className="osv3-mag-fmd-label">FEATURED</div>
                </div>
              </div>
            )}
          </div>

          {/* right: content body */}
          <div className="osv3-mag-feature-body">
            <div className="osv3-mag-f-eyebrow">{featureEyebrow}</div>
            <h2 className="osv3-mag-f-title">{featureTitle}</h2>
            {featureHost && (
              <div className="osv3-mag-f-host">
                {featureHostTag && (
                  <span className="osv3-mag-f-host-tag">{featureHostTag}:</span>
                )}
                {featureHost}
              </div>
            )}
            {featureDesc && (
              <p className="osv3-mag-f-desc">{featureDesc}</p>
            )}
            {featureMeta.length > 0 && (
              <div className="osv3-mag-f-meta">
                {featureMeta.map((m, i) => (
                  <span key={i}>
                    {m.label && <span>{m.label}: </span>}
                    <b>{m.value}</b>
                  </span>
                ))}
              </div>
            )}
            {featureActions && (
              <div className="osv3-mag-f-actions">
                {featureActions}
              </div>
            )}
          </div>
        </div>
      )}

      {/* grid header: section eyebrow + filter pills */}
      <div className="osv3-mag-grid-head">
        <div className="osv3-mag-sec-eyebrow">
          {sectionLabel}
          {!isLoading && (
            <span>&nbsp;({items.length})</span>
          )}
        </div>
        {pills.length > 0 && (
          <div className="osv3-mag-pills">
            {pills.map(p => (
              <button
                key={p.value}
                className={`osv3-mag-pill${activeFilter === p.value ? ' osv3-mag-pill-active' : ''}`}
                onClick={() => onFilter && onFilter(p.value)}
                type="button"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* card grid */}
      {isLoading ? (
        <div className="osv3-mag-loading">Loading...</div>
      ) : (
        <div className="osv3-mag-card-grid">
          {items.map((item, i) => cardRenderer ? cardRenderer(item, i) : null)}
        </div>
      )}
    </div>
  );
}

export default OSMagazinePage;
