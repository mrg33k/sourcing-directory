import React from 'react'

/**
 * The "I'm seeking" / "I can provide" / "Looking for" list: an ALL-CAPS
 * subhead over a tight bulleted column. SplitList pairs two of them, which is
 * exactly how both profile screens lay that card out.
 */

export default function BulletList({ heading, items = [] }) {
  return (
    <div>
      {heading ? <div className="osv3p-subhead">{heading}</div> : null}
      <ul className="osv3p-bullets">
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  )
}

export function SplitList({ left, right }) {
  return (
    <div className="osv3p-split">
      <BulletList heading={left.heading} items={left.items} />
      <BulletList heading={right.heading} items={right.items} />
    </div>
  )
}
