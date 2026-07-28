import React from 'react'
import Icon from './Icon.jsx'

/**
 * Button.
 *
 * variant: 'primary' (accent outline, the CONNECT treatment)
 *        | 'solid'   (accent fill)
 *        | 'secondary' (ink outline, the FOLLOW treatment)
 *        | 'quiet'   (border-only, neutral)
 *
 * The accent itself is inherited from the screen: --p-screen-accent is rust on
 * the profiles and the existing link blue on the admin screen, per
 * design-decisions.md D2. No colour prop, ever.
 *
 * Renders <a> when given href, <button> otherwise — a nav element that is not
 * a link, or a link that does not navigate, are both worse than no control.
 */

export default function Button({
  children,
  icon,
  variant = 'primary',
  block = false,
  href,
  onClick,
  type = 'button',
  disabled = false,
  ariaLabel,
}) {
  const cls = ['osv3p-btn', `osv3p-btn--${variant}`]
  if (block) cls.push('osv3p-btn--block')
  const inner = (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </>
  )
  if (href && !disabled) {
    return <a className={cls.join(' ')} href={href} aria-label={ariaLabel}>{inner}</a>
  }
  return (
    <button className={cls.join(' ')} type={type} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {inner}
    </button>
  )
}

export function ButtonRow({ children }) {
  return <div className="osv3p-btn-row">{children}</div>
}
