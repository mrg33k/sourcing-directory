import React from 'react'
import Icon from './Icon.jsx'
import Bar from './Bar.jsx'

/**
 * The six Space Missions rows: badge icon, label, track+fill, right-aligned %.
 *
 * rows: [{ id, label, pct, icon? }] — order is the caller's, because the two
 * reference screens order the same six missions differently (person puts Live
 * in Space fourth, company puts it last).
 */

const DEFAULT_ICON = {
  build: 'mission-build',
  operate: 'mission-operate',
  prosper: 'mission-prosper',
  live: 'mission-live',
  move: 'mission-move',
  secure: 'mission-secure',
}

export default function MissionBars({ rows = [] }) {
  return (
    <div className="osv3p-missions">
      {rows.map((r) => (
        <div className="osv3p-mission" key={r.id || r.label}>
          <span className="osv3p-mission-icon">
            <Icon name={r.icon || DEFAULT_ICON[r.id] || 'mission-build'} />
          </span>
          <span className="osv3p-mission-label">{r.label}</span>
          <Bar pct={r.pct} label={r.label} />
          <span className="osv3p-mission-pct">{r.pct}%</span>
        </div>
      ))}
    </div>
  )
}
