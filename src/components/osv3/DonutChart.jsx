import React from 'react'

/**
 * DonutChart — verification status split, with the total in the hole.
 *
 * segments: [{ id, label, value, tone }] where tone is one of
 * verified | pending | unverified | rejected (the four states the admin screen
 * shows). Colour comes from `.osv3p-status--<tone>`, never from a prop.
 *
 * Geometry is stroke-dasharray on one circle per segment — attributes, so no
 * inline styles. Zero-value segments are dropped rather than drawn as a
 * hairline nobody can read.
 */

const R = 68
const C = 2 * Math.PI * R

export default function DonutChart({ segments = [], total, totalLabel = 'Total' }) {
  const live = segments.filter((s) => Number(s.value) > 0)
  const sum = live.reduce((a, s) => a + Number(s.value), 0) || 1
  let offset = 0
  return (
    <svg className="osv3p-donut-svg" viewBox="0 0 200 200" role="img" aria-label={`${totalLabel}: ${total ?? sum}`}>
      <g transform="translate(100 100) rotate(-90)">
        {live.map((s) => {
          const len = (Number(s.value) / sum) * C
          const dash = `${len} ${C - len}`
          const el = (
            <circle
              key={s.id || s.label}
              className={`osv3p-donut-seg osv3p-status--${s.tone || 'unverified'}`}
              cx="0"
              cy="0"
              r={R}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return el
        })}
      </g>
      <text className="osv3p-donut-total" x="100" y="98" textAnchor="middle">{total ?? sum}</text>
      <text className="osv3p-donut-caption" x="100" y="114" textAnchor="middle">{totalLabel}</text>
    </svg>
  )
}

export function DonutLegend({ segments = [], total }) {
  const sum = total || segments.reduce((a, s) => a + Number(s.value || 0), 0) || 1
  return (
    <div className="osv3p-legend">
      {segments.map((s) => (
        <div className="osv3p-legend-row" key={s.id || s.label}>
          <span className={`osv3p-legend-dot osv3p-status--${s.tone || 'unverified'}`} />
          <span>{s.label}</span>
          <span className="osv3p-legend-value">
            {s.value}
            <span className="osv3p-legend-share"> ({Math.round((Number(s.value) / sum) * 100)}%)</span>
          </span>
        </div>
      ))}
    </div>
  )
}
