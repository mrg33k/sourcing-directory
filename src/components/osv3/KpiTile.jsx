import React from 'react'
import Icon from './Icon.jsx'
import { Card, CardLink } from './Card.jsx'

/**
 * The admin KPI tile: glyph, label, number, 30-day delta, and a "View all ->"
 * link out to the section it summarises.
 *
 * The delta is optional. A tile with no comparison shows no arrow rather than
 * a 0% that reads as "flat" when it actually means "we have no baseline".
 */

export default function KpiTile({ icon = 'grid', label, value, delta, deltaNote, linkLabel, href, onLink }) {
  return (
    <Card>
      <div className="osv3p-kpi-top">
        <span className="osv3p-kpi-icon"><Icon name={icon} /></span>
        <div>
          <div className="osv3p-kpi-label">{label}</div>
          <div className="osv3p-kpi-value">{value}</div>
        </div>
      </div>
      {delta ? (
        <div className="osv3p-kpi-delta">
          <Icon name="arrow-up" />
          <b>{delta}</b>
          {deltaNote ? <span>{deltaNote}</span> : null}
        </div>
      ) : null}
      {linkLabel ? (
        <div className="osv3p-card-footer">
          <CardLink href={href} onClick={onLink}>{linkLabel}</CardLink>
        </div>
      ) : null}
    </Card>
  )
}
