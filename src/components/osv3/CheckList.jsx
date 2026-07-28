import React from 'react'
import Icon from './Icon.jsx'

/**
 * Capabilities list — two columns, one ticked item per row.
 *
 * items: [{ id, title, sub?, icon? }]
 * The person screen uses a plain ring-check per capability; the company screen
 * uses a per-capability glyph plus a second line. Same component, two shapes of
 * the same data, so the two screens cannot drift apart.
 *
 * columns: 2 (default) | 1
 */

export default function CheckList({ items = [], columns = 2 }) {
  return (
    <div className={columns === 1 ? 'osv3p-checklist osv3p-checklist--single' : 'osv3p-checklist'}>
      {items.map((it) => (
        <div className="osv3p-check" key={it.id || it.title}>
          <span className="osv3p-check-icon"><Icon name={it.icon || 'check-circle'} /></span>
          <div className="osv3p-check-text">
            <div className="osv3p-check-title">{it.title}</div>
            {it.sub ? <div className="osv3p-check-sub">{it.sub}</div> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
