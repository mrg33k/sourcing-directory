import React from 'react'
import Icon from './Icon.jsx'
import LogoTile from './LogoTile.jsx'

/**
 * A titled row list with a leading mark. Three shapes of the same thing in the
 * reference: affiliations (org logo + role), locations (pin + city), and the
 * admin recent-activity feed (glyph + subject + relative time).
 *
 * items: [{ id, title, sub?, time?, icon?, logo? }]
 * `logo: true` renders the LogoTile monogram instead of a line glyph — that is
 * the affiliations treatment, where each row is an organisation.
 */

export default function IconList({ items = [] }) {
  return (
    <ul className="osv3p-iconlist">
      {items.map((it) => (
        <li className="osv3p-iconlist-item" key={it.id || it.title}>
          <span className="osv3p-iconlist-media">
            {it.logo
              ? <LogoTile src={it.logoUrl} name={it.title} size="sm" />
              : <Icon name={it.icon || 'building'} />}
          </span>
          <div className="osv3p-iconlist-text">
            <div className="osv3p-iconlist-title">{it.title}</div>
            {it.sub ? <div className="osv3p-iconlist-sub">{it.sub}</div> : null}
            {it.time ? <div className="osv3p-iconlist-time">{it.time}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
