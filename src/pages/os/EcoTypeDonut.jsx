import React from 'react'

/**
 * EcoTypeDonut — a donut for a category split of unknown size.
 *
 * The shared DonutChart is deliberately a four-colour component: its tones are
 * verified / pending / unverified / rejected, the four states the admin screen
 * shows, and colour comes from `.osv3p-status--<tone>`. Organization type is not
 * four things — it is however many things the admins end up typing into the
 * "Organization type" box on the company edit form. Reusing a four-tone scale
 * for six categories would repeat a colour and quietly make two different types
 * look like the same one, so this takes the eight mission accents already in
 * osv3-tokens.css instead, by series index.
 *
 * It is a page-local file rather than a component-library addition on purpose:
 * a second agent is building the neighbouring screen against the same shared
 * folder this week, and a new shared file is a merge conflict waiting to happen.
 * If both screens end up wanting it, it promotes cleanly.
 *
 * Geometry is stroke-dasharray attributes on one circle per segment — the same
 * technique DonutChart uses, and for the same reason: no inline styles, so the
 * whole thing stays machine-checkable.
 *
 * segments: [{ id, label, value }] — colour is assigned by position, never
 * passed in.
 */

const R = 64
const CIRC = 2 * Math.PI * R
const SERIES = 8

export default function EcoTypeDonut({ segments = [], total, totalLabel = 'Total' }) {
  const live = segments.filter((s) => Number(s.value) > 0)
  const sum = live.reduce((a, s) => a + Number(s.value), 0) || 1
  let offset = 0
  return (
    <svg
      className="osv3-ecomap-donut"
      viewBox="0 0 180 180"
      role="img"
      aria-label={`${totalLabel}: ${total ?? sum}`}
    >
      <g transform="translate(90 90) rotate(-90)">
        {live.map((s, i) => {
          const len = (Number(s.value) / sum) * CIRC
          const el = (
            <circle
              key={s.id || s.label}
              className={`osv3-ecomap-seg osv3-ecomap-seg--${(i % SERIES) + 1}`}
              cx="0"
              cy="0"
              r={R}
              strokeDasharray={`${len} ${CIRC - len}`}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return el
        })}
      </g>
      <text className="osv3-ecomap-donut-total" x="90" y="88" textAnchor="middle">{total ?? sum}</text>
      <text className="osv3-ecomap-donut-cap" x="90" y="103" textAnchor="middle">{totalLabel}</text>
    </svg>
  )
}

export function EcoTypeLegend({ segments = [], total }) {
  const sum = total || segments.reduce((a, s) => a + Number(s.value || 0), 0) || 1
  return (
    <ul className="osv3-ecomap-legend">
      {segments.map((s, i) => (
        <li className="osv3-ecomap-legend-row" key={s.id || s.label}>
          <span className={`osv3-ecomap-legend-dot osv3-ecomap-seg--${(i % SERIES) + 1}`} />
          <span className="osv3-ecomap-legend-label">{s.label}</span>
          <span className="osv3-ecomap-legend-value">
            {Math.round((Number(s.value) / sum) * 100)}%
            <span className="osv3-ecomap-legend-n"> ({s.value})</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
