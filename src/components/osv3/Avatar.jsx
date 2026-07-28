import React, { useState } from 'react'

/**
 * Avatar with an initials fallback that is the DEFAULT path, not the error
 * path — most directory people have no photo. A broken src swaps to initials
 * via onError rather than showing the browser's broken-image glyph.
 *
 * size: 'xl' (hero) | 'md' | 'sm'
 * status: true -> the availability dot the reference draws on the hero avatar
 */

function initialsOf(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : ''
  return (first + last).toUpperCase() || '?'
}

export default function Avatar({ src, name, size = 'md', status = false, alt }) {
  const [failed, setFailed] = useState(false)
  const showImg = Boolean(src) && !failed
  const avatar = (
    <span className={`osv3p-avatar osv3p-avatar--${size}`}>
      {showImg
        ? <img src={src} alt={alt || name || ''} onError={() => setFailed(true)} />
        : <span aria-hidden="true">{initialsOf(name)}</span>}
    </span>
  )
  if (!status) return avatar
  return (
    <span className="osv3p-avatar-wrap">
      {avatar}
      <span className="osv3p-avatar-status" aria-hidden="true" />
    </span>
  )
}

export { initialsOf }
