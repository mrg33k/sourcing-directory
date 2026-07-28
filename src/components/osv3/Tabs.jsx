import React from 'react'

/**
 * Controlled tab bar. The caller owns the active id.
 *
 * items: [{ id, label, count? }]
 * Renders a real role="tablist" with aria-selected on each tab, so the bar is
 * operable by keyboard and announced correctly — the reference draws the state
 * as an accent underline only, which on its own tells a screen reader nothing.
 */

export default function Tabs({ items = [], value, onChange, label = 'Sections' }) {
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = items.findIndex((t) => t.id === value)
    if (i < 0) return
    const next = e.key === 'ArrowRight' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    e.preventDefault()
    if (onChange) onChange(items[next].id)
  }

  return (
    <div className="osv3p-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((t) => {
        const selected = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`osv3p-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`osv3p-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            className="osv3p-tab"
            onClick={() => onChange && onChange(t.id)}
          >
            {t.label}
            {t.count == null ? null : <span className="osv3p-tab-count">({t.count})</span>}
          </button>
        )
      })}
    </div>
  )
}
