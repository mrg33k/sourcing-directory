import React from 'react'
import Icon from './Icon.jsx'

/**
 * "Verified" (person) / "Verified Organization" (company). Shield + word, in
 * the green the reference uses for both. Renders nothing when not verified —
 * an unverified profile shows no badge rather than a greyed-out one.
 */

export default function VerifiedBadge({ verified = false, label = 'Verified' }) {
  if (!verified) return null
  return (
    <span className="osv3p-verified">
      <Icon name="shield-check" />
      {label}
    </span>
  )
}
