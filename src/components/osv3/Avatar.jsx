import React, { useState } from 'react'

/**
 * Avatar with an initials fallback that is the DEFAULT path, not the error
 * path — most directory people have no photo. A broken src swaps to initials
 * via onError rather than showing the browser's broken-image glyph.
 *
 * Because the fallback is the common view rather than the rare one, it gets
 * its own modifier (osv3p-avatar--empty) and its own design instead of
 * inheriting the photo case's shape. The styling lives in the AVATAR block of
 * osv3-profile.css, which explains the value choice; the only thing this file
 * decides is that "no photo" is a state worth naming in the markup.
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
  const cls = `osv3p-avatar osv3p-avatar--${size}${showImg ? '' : ' osv3p-avatar--empty'}`
  const avatar = (
    <span className={cls}>
      {showImg
        ? <img src={src} alt={alt || name || ''} onError={() => setFailed(true)} />
        : <span className="osv3p-avatar-initials" aria-hidden="true">{initialsOf(name)}</span>}
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
