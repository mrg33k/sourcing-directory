import React from 'react'

/**
 * LineChart — the admin "Platform Activity (Last 30 Days)" panel.
 *
 * series: [{ id, label, tone: 'a'|'b'|'c', points: number[] }] (equal length)
 * xLabels: strings placed evenly under the plot
 *
 * Plain SVG, no chart library. Every coordinate is an attribute, colour is a
 * class (.osv3p-series--a/b/c), so the whole thing stays inside the stylesheet
 * the floor check reads.
 */

const W = 640
const H = 260
const PAD_L = 32
const PAD_R = 8
const PAD_T = 8
const PAD_B = 32

export default function LineChart({ series = [], xLabels = [], yTicks = [0, 25, 50, 75, 100], ariaLabel = 'Activity over time' }) {
  const all = series.flatMap((s) => s.points || [])
  const max = Math.max(...yTicks, ...(all.length ? all : [0])) || 1
  const n = Math.max(...series.map((s) => (s.points || []).length), 1)
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const x = (i) => PAD_L + (n <= 1 ? 0 : (i / (n - 1)) * plotW)
  const y = (v) => PAD_T + plotH - (v / max) * plotH

  return (
    <div>
      <div className="osv3p-chart-legend">
        {series.map((s) => (
          <span className="osv3p-chart-key" key={s.id || s.label}>
            <span className={`osv3p-chart-rule osv3p-rule--${s.tone || 'a'}`} />
            {s.label}
          </span>
        ))}
      </div>
      <svg className="osv3p-chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {yTicks.map((t) => (
          <g key={t}>
            <line className="osv3p-chart-grid" x1={PAD_L} y1={y(t)} x2={W - PAD_R} y2={y(t)} />
            <text className="osv3p-chart-tick" x={PAD_L - 6} y={y(t) + 3} textAnchor="end">{t}</text>
          </g>
        ))}
        {series.map((s) => (
          <polyline
            key={s.id || s.label}
            className={`osv3p-chart-line osv3p-series--${s.tone || 'a'}`}
            points={(s.points || []).map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          />
        ))}
        {series.map((s) => (
          <g key={`${s.id || s.label}-dots`}>
            {(s.points || []).map((v, i) => (
              <circle key={i} className={`osv3p-chart-dot--${s.tone || 'a'}`} cx={x(i)} cy={y(v)} r="2.4" />
            ))}
          </g>
        ))}
        {xLabels.map((l, i) => (
          <text
            key={l}
            className="osv3p-chart-tick"
            x={PAD_L + (xLabels.length <= 1 ? 0 : (i / (xLabels.length - 1)) * plotW)}
            y={H - 8}
            textAnchor="middle"
          >
            {l}
          </text>
        ))}
      </svg>
    </div>
  )
}
