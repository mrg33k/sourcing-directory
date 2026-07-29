import React, { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  Card, CardHeader, CardBody, CompletenessMeter, Button, EmptyState,
} from '../../components/osv3/index.js'
import { computeProfileCompleteness } from '../../lib/profileCompleteness.js'
import { getViewerContext } from '../../lib/profileWrite.js'
import '../../styles/osv3-profile.css'

/**
 * /profile — the signed-in user's own profile.
 *
 * A member WITH a person record goes straight to their real page at
 * /people/<slug> — one canonical profile URL, the same page other members see,
 * with the owner's edit affordances on it. This screen only renders for the
 * member who has no person row yet, and then it shows the truth: nothing is
 * published, here is exactly what a complete profile needs, and here is the
 * way to start filling it. No mocked-up "your profile" with someone else's
 * data.
 */

export default function OSMyProfile() {
  const navigate = useNavigate()
  useEffect(() => { document.title = 'Profile | SpaceOS' }, [])

  // null = still resolving; { personSlug, signedIn } once resolved. A resolve
  // FAILURE falls through to the get-started screen rather than a dead end —
  // wrong page beats no page, and every path off it survives the mistake.
  const [viewer, setViewer] = useState(null)
  useEffect(() => {
    let cancelled = false
    getViewerContext().then(({ data }) => {
      if (!cancelled) setViewer({ personSlug: data?.personSlug || null, signedIn: !!data?.signedIn })
    })
    return () => { cancelled = true }
  }, [])

  const completeness = computeProfileCompleteness(null)

  if (viewer === null) return null
  if (viewer.personSlug) return <Navigate to={`/people/${viewer.personSlug}`} replace />
  if (!viewer.signedIn) {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState
          icon="users"
          title="Sign in to see your profile"
          body="Your profile is how you appear across the Space Rising ecosystem. Sign in to view and edit it."
          action={<Button variant="primary" onClick={() => navigate('/login')}>Sign in</Button>}
        />
      </div>
    )
  }

  return (
    <div className="osv3p-screen osv3p-screen--profile">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Profile</h1>
          <p className="osv3p-pagehead-sub">How you appear across the Space Rising ecosystem.</p>
        </div>
        <Button icon="edit" variant="primary" onClick={() => navigate('/profile/edit')}>Edit profile</Button>
      </header>

      <Card>
        <CardHeader title="Your profile" />
        <CardBody>
          <CompletenessMeter percent={completeness.percent} missing={completeness.missing} />
        </CardBody>
      </Card>

      <EmptyState
        icon="users"
        title="You have not published a profile yet"
        body="Fill in the fields above and your profile becomes visible in the directory. To see the finished layout first, open the reference profile at /people/_preview."
      />
    </div>
  )
}
