import React from 'react'
import Icon from './Icon.jsx'

/**
 * "At a Glance" — icon, key on the left, value hard right.
 * rows: [{ id, icon, key, value }]
 */

export default function KeyValueList({ rows = [] }) {
  return (
    <dl className="osv3p-kv">
      {rows.map((r) => (
        <div className="osv3p-kv-row" key={r.id || r.key}>
          <span className="osv3p-kv-icon"><Icon name={r.icon || 'file'} /></span>
          <dt className="osv3p-kv-key">{r.key}</dt>
          <dd className="osv3p-kv-value">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}
