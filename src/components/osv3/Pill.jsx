import React from 'react'

/**
 * Pill — the quiet bordered tag under the profile bio, and (with `tone`) the
 * status chip in the admin table. One component, two sizes, no colour props:
 * the tone maps to a class that reads a token.
 */

const TONES = {
  verified: 'osv3p-pill--verified',
  pending: 'osv3p-pill--pending',
  unverified: 'osv3p-pill--unverified',
  rejected: 'osv3p-pill--rejected',
}

export default function Pill({ children, tone, status = false }) {
  const cls = ['osv3p-pill']
  if (status) cls.push('osv3p-pill--status')
  if (tone && TONES[tone]) cls.push(TONES[tone])
  return <span className={cls.join(' ')}>{children}</span>
}

export function PillRow({ items = [], children }) {
  return (
    <div className="osv3p-pill-row">
      {items.map((t) => <Pill key={t}>{t}</Pill>)}
      {children}
    </div>
  )
}
