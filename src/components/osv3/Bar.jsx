import React from 'react'

/**
 * The one bar primitive: an SVG track + fill.
 *
 * It is an SVG on purpose. A percentage fill needs a dynamic width, and inline
 * styles are banned on these screens (design_spacing_check.py cannot read them,
 * which makes an inline-styled screen unverifiable). An SVG rect takes its
 * width as a geometry ATTRIBUTE, so the bar stays fully class-styled.
 *
 * width = the stated percentage, exactly. The reference PNGs draw all 12 bars
 * short of their own printed labels, by 1.6-10.0pp, inconsistently between the
 * two screens for the same value — design-decisions.md D3 rules that a
 * hand-sizing bug in the source, not intent, so it is not reproduced.
 */

export default function Bar({ pct = 0, label }) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0))
  return (
    <svg
      className="osv3p-bar"
      viewBox="0 0 100 4"
      preserveAspectRatio="none"
      role={label ? 'img' : 'presentation'}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      {label ? <title>{`${label}: ${v}%`}</title> : null}
      <rect className="osv3p-bar-track" x="0" y="0" width="100" height="4" rx="2" />
      {v > 0 ? <rect className="osv3p-bar-fill" x="0" y="0" width={v} height="4" rx="2" /> : null}
    </svg>
  )
}
