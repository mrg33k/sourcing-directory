import React from 'react'
import Icon from './Icon.jsx'

/**
 * Honest empty state. Says what is not here and what happens next — never a
 * greyed-out fake row, never a spinner that has stopped meaning anything.
 */

export default function EmptyState({ icon = 'grid', title, body, action }) {
  return (
    <div className="osv3p-empty">
      <span className="osv3p-empty-icon"><Icon name={icon} /></span>
      {title ? <div className="osv3p-empty-title">{title}</div> : null}
      {body ? <p className="osv3p-empty-body">{body}</p> : null}
      {action || null}
    </div>
  )
}
