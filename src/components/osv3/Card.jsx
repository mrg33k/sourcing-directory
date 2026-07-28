import React from 'react'

/**
 * Card + Header/Body/Footer.
 *
 * Purely presentational. The header carries a RIGHT SLOT (`action`) — that is
 * where "View all ->", "Edit" and "+ Add" live on every card in the reference
 * screens. Page and card share one near-white ground; the card is delineated
 * by its 1px --v3-border and nothing else (design-decisions.md D5).
 */

export function Card({ children, className }) {
  return <section className={className ? `osv3p-card ${className}` : 'osv3p-card'}>{children}</section>
}

export function CardHeader({ title, count, action }) {
  return (
    <header className="osv3p-card-header">
      <h2 className="osv3p-card-title">
        {title}
        {count == null ? null : <span className="osv3p-card-count"> ({count})</span>}
      </h2>
      {action || null}
    </header>
  )
}

export function CardBody({ children }) {
  return <div className="osv3p-card-body">{children}</div>
}

export function CardFooter({ children }) {
  return <footer className="osv3p-card-footer">{children}</footer>
}

/** The "View all ->" / "View full bio ->" link. Renders a button when it has
 *  an onClick and no href, so a non-navigating action is never a fake link. */
export function CardLink({ children, href, onClick, withArrow = true }) {
  const inner = (
    <>
      {children}
      {withArrow ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M4 12h15M13.5 6.5L19 12l-5.5 5.5" />
        </svg>
      ) : null}
    </>
  )
  if (href) {
    return <a className="osv3p-card-link" href={href}>{inner}</a>
  }
  return (
    <button type="button" className="osv3p-card-link" onClick={onClick}>
      {inner}
    </button>
  )
}

/** The compact header action ("Edit", "+ Add", "View all") — no arrow. */
export function CardAction({ children, href, onClick }) {
  if (href) return <a className="osv3p-card-action" href={href}>{children}</a>
  return <button type="button" className="osv3p-card-action" onClick={onClick}>{children}</button>
}

export default Card
