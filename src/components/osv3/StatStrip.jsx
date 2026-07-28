import React from 'react'
import Icon from './Icon.jsx'

/**
 * Activity Highlights — equal columns divided by hairlines, no outer rules.
 * The divider is a left border on every column except the first, so the strip
 * never ends in a stray line.
 *
 * items: [{ id, icon, label, value, note? }]
 * The person screen has no `note`; the company screen carries "Last 30 days"
 * under each number, which is why the note is optional rather than two
 * components.
 */

export default function StatStrip({ items = [] }) {
  return (
    <div className="osv3p-stats">
      {items.map((s) => (
        <div className="osv3p-stat" key={s.id || s.label}>
          <span className="osv3p-stat-icon"><Icon name={s.icon || 'grid'} /></span>
          <div className="osv3p-stat-text">
            <div className="osv3p-stat-label">{s.label}</div>
            <div className="osv3p-stat-value">{s.value}</div>
            {s.note ? <div className="osv3p-stat-note">{s.note}</div> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
