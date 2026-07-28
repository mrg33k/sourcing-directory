/**
 * RequireAdmin — route wrapper that keeps non-admins out of the admin panel UI.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEFENCE IN DEPTH, NOT SECURITY. Read the header of `src/hooks/useAdmin.js`.
 * ─────────────────────────────────────────────────────────────────────────────
 * This stops an honest signed-in non-admin (including a brand-new `pending`
 * signup) from rendering the admin panel and the rows it loads. It stops nobody
 * who is willing to edit their own JavaScript, and it does nothing at all about
 * the service-role key that ships in the public bundle. The real fix is the
 * server-side authorization endpoint (Agent B) plus key rotation
 * (`docs/security/key-rotation-runbook.md`).
 *
 * Usage — wrap the element, never replace the route path:
 *   <Route path="/admin" element={<RequireAdmin><SourcingAdmin /></RequireAdmin>} />
 *
 * Renders a not-authorized state rather than redirecting: a silent bounce to "/"
 * is indistinguishable from a broken link, and a real admin hitting a transient
 * failure needs to see why.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { useAdmin } from '../hooks/useAdmin.js'

// Inline tokens mirroring osv3 / the admin panel's V object. Kept local on
// purpose: this file must not depend on any theme provider being mounted above
// it, because it renders before the admin panel does.
const T = {
  bg: '#FEFDFD',
  card: '#FFFFFF',
  ink: '#010B13',
  muted: '#6B7280',
  border: '#D7DEE2',
  accent: '#CE4421',
  font: "'Roboto', system-ui, -apple-system, sans-serif",
}

// Shared button box. Both buttons carry a 1px border (the primary's just matches
// its own fill) so the two compute to the same height and their text baselines
// line up — a solid button with no border sits 2px shorter than an outlined one.
const btn = {
  display: 'inline-block',
  padding: '10px 18px',
  border: '1px solid transparent',
  borderRadius: '6px',
  fontSize: '14px',
  lineHeight: '20px',
  fontWeight: 500,
  textDecoration: 'none',
}

function Frame({ children }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: T.bg,
        color: T.ink,
        fontFamily: T.font,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {children}
    </div>
  )
}

function Checking() {
  return (
    <Frame>
      <p style={{ margin: 0, color: T.muted, fontSize: '14px', letterSpacing: '0.02em' }}>
        Checking access…
      </p>
    </Frame>
  )
}

function NotAuthorized({ signedIn }) {
  return (
    <Frame>
      <div
        style={{
          maxWidth: '440px',
          width: '100%',
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: '10px',
          padding: '32px',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '3px',
            background: T.accent,
            marginBottom: '20px',
            borderRadius: '2px',
          }}
        />
        <h1 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 600, color: T.ink }}>
          {signedIn ? 'Not authorized' : 'Sign in required'}
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: '14px', lineHeight: 1.6, color: T.muted }}>
          {signedIn
            ? 'This account does not have admin access to any directory. If you think that is wrong, ask an existing administrator to approve your membership.'
            : 'The admin panel is only available to approved administrators. Sign in to continue.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {!signedIn && (
            <Link to="/login" style={{ ...btn, background: T.accent, color: '#FFFFFF', borderColor: T.accent }}>
              Sign in
            </Link>
          )}
          <Link to="/" style={{ ...btn, background: 'transparent', color: T.ink, borderColor: T.border }}>
            Back to Space OS
          </Link>
        </div>
      </div>
    </Frame>
  )
}

export default function RequireAdmin({ children, fallback }) {
  const { isAdmin, loading, signedIn } = useAdmin()

  if (loading) return <Checking />
  if (!isAdmin) return fallback !== undefined ? fallback : <NotAuthorized signedIn={signedIn} />

  return children
}

export { RequireAdmin }
