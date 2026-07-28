import React from 'react'
import { STATE_PATHS } from '../../lib/usStatesPaths.js'

/**
 * MapPanel — the US map the reference draws on both profile screens.
 *
 * It renders the repo's OWN geography: src/lib/usStatesPaths.js, real albersUsa
 * state paths fitted to a 960x600 viewBox, already shipping on the directory
 * page. No map library is added and the Google Maps key is NOT revived — that
 * key compiles into the public bundle, which is exactly how it leaked before.
 *
 * markers: [{ id, x, y, label }] in that same 960x600 space.
 * highlight: ['AZ'] — state codes drawn in the accent tint.
 *
 * A location that is not in the US (Rocket Lab's Mahia complex) simply has no
 * marker; it still appears in the list beside the map. Better an honest gap
 * than a pin dropped in the wrong ocean.
 */

const PIN = 'M0,0 c-3.6,-4.6 -6.4,-8 -6.4,-11.4 a6.4,6.4 0 1 1 12.8,0 C6.4,-8 3.6,-4.6 0,0 z'

export default function MapPanel({ markers = [], highlight = [], onExpand, ariaLabel = 'Location map' }) {
  const hot = new Set(highlight)
  return (
    <div className="osv3p-map">
      <svg
        className="osv3p-map-svg"
        viewBox="0 0 960 600"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={ariaLabel}
      >
        <g>
          {Object.keys(STATE_PATHS).map((code) => (
            <path
              key={code}
              d={STATE_PATHS[code]}
              className={hot.has(code) ? 'osv3p-map-land osv3p-map-land--active' : 'osv3p-map-land'}
            />
          ))}
        </g>
        {markers.map((m) => (
          <g key={m.id || m.label} transform={`translate(${m.x} ${m.y}) scale(2.2)`}>
            <title>{m.label}</title>
            <path className="osv3p-map-pin" d={PIN} />
            <circle className="osv3p-map-pin-dot" cx="0" cy="-11.4" r="2.4" />
          </g>
        ))}
      </svg>
      {onExpand ? (
        <button type="button" className="osv3p-map-expand" onClick={onExpand} aria-label="Expand map">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
