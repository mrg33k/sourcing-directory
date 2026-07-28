import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, CardHeader, CardBody, CompletenessMeter, Button, EmptyState,
} from '../../components/osv3/index.js'
import { computeProfileCompleteness } from '../../lib/profileCompleteness.js'
import '../../styles/osv3-profile.css'

/**
 * /profile — the signed-in user's own profile.
 *
 * There is no person record to read yet, so this shows the truth: nothing is
 * published, here is exactly what a complete profile needs, and here is the way
 * to start filling it. No mocked-up "your profile" with someone else's data.
 */

export default function OSMyProfile() {
  const navigate = useNavigate()
  useEffect(() => { document.title = 'Profile | SpaceOS' }, [])

  const completeness = computeProfileCompleteness(null)

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
