import React, { useState } from 'react'

/**
 * Company logo tile.
 *
 * The fallback is MANDATORY and is the common case: 165 of the 166 companies
 * in the directory have no logo_url. So the monogram tile is the design, and
 * the image is the exception layered on top of it. A src that 404s swaps back
 * to the monogram via onError instead of leaving a broken-image box.
 *
 * The monogram takes up to two initials from the company name, skipping the
 * legal-suffix noise ("Inc.", "LLC") that would otherwise become the letters.
 */

const SUFFIXES = new Set(['inc', 'inc.', 'llc', 'ltd', 'ltd.', 'corp', 'corp.', 'co', 'co.', 'plc', 'gmbh', 'sa', 'nv', 'usa', 'the', 'and', '&'])

export function monogramOf(name) {
  if (!name) return '?'
  const words = String(name)
    .replace(/[,]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w && !SUFFIXES.has(w.toLowerCase()))
  if (!words.length) return String(name).trim().charAt(0).toUpperCase() || '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export default function LogoTile({ src, name, size = 'md', alt }) {
  const [failed, setFailed] = useState(false)
  const showImg = Boolean(src) && !failed
  return (
    <span className={`osv3p-logo osv3p-logo--${size}`}>
      {showImg
        ? <img src={src} alt={alt || name || ''} onError={() => setFailed(true)} />
        : <span className="osv3p-logo-fallback" aria-hidden="true">{monogramOf(name)}</span>}
    </span>
  )
}
