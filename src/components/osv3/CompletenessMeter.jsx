import React from 'react'
import Bar from './Bar.jsx'
import Pill from './Pill.jsx'

/**
 * Profile completeness: one number, one bar, and the named gaps.
 *
 * Listing WHAT is missing is the whole point — a bare percentage tells someone
 * they are at 60% and nothing about how to move. Feed it the result of
 * computeProfileCompleteness() from src/lib/profileCompleteness.js.
 */

export default function CompletenessMeter({ percent = 0, missing = [], label = 'Profile completeness' }) {
  const v = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)))
  return (
    <div>
      <div className="osv3p-meter-head">
        <span className="osv3p-card-title">{label}</span>
        <span className="osv3p-meter-pct">{v}%</span>
      </div>
      <Bar pct={v} label={label} />
      {missing.length ? (
        <div className="osv3p-meter-missing">
          {missing.map((m) => <Pill key={m.field || m}>{m.label || m}</Pill>)}
        </div>
      ) : null}
    </div>
  )
}
