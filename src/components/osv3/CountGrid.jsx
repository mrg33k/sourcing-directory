import React from 'react'
import Icon from './Icon.jsx'

/**
 * "Who We Work With" — a 3-across grid of icon + number + noun.
 * items: [{ id, icon, value, label }]
 */

export default function CountGrid({ items = [] }) {
  return (
    <div className="osv3p-counts">
      {items.map((c) => (
        <div className="osv3p-count" key={c.id || c.label}>
          <span className="osv3p-count-icon"><Icon name={c.icon || 'users'} /></span>
          <div>
            <div className="osv3p-count-value">{c.value}</div>
            <div className="osv3p-count-label">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
