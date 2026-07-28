import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, CardHeader, CardBody, CardFooter, Button, Icon,
} from '../../components/osv3/index.js'
import '../../styles/osv3-profile.css'

/**
 * /add-profile — where the sidebar's "+ ADD PROFILE" button lands.
 *
 * Two honest doors: a person profile and an organization profile. Each one
 * shows the screen you are about to fill, rendered from the approved design, so
 * nobody starts a form without knowing what it produces.
 */

export default function OSAddProfile() {
  const navigate = useNavigate()
  useEffect(() => { document.title = 'Add profile | SpaceOS' }, [])

  return (
    <div className="osv3p-screen osv3p-screen--profile">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Add a profile</h1>
          <p className="osv3p-pagehead-sub">Put yourself, or your organization, on the Space Rising map.</p>
        </div>
      </header>

      <div className="osv3p-grid osv3p-grid--halves">
        <Card>
          <CardHeader title="Person profile" />
          <CardBody>
            <p className="osv3p-prose">
              Your role, capabilities, mission alignment and what you are looking for. This is the
              profile other members find you by.
            </p>
          </CardBody>
          <CardFooter>
            <Button icon="users" variant="primary" onClick={() => navigate('/people/_preview')}>
              See the person profile
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader title="Organization profile" />
          <CardBody>
            <p className="osv3p-prose">
              What your organization builds, who it works with, where it operates, and the
              opportunities it is open to.
            </p>
          </CardBody>
          <CardFooter>
            <Button icon="building" variant="primary" onClick={() => navigate('/company/_preview')}>
              See the organization profile
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader title="Before you start" />
        <CardBody>
          <div className="osv3p-iconlist">
            <div className="osv3p-iconlist-item">
              <span className="osv3p-iconlist-media"><Icon name="check-circle" /></span>
              <div className="osv3p-iconlist-text">
                <div className="osv3p-iconlist-title">A profile is reviewed before it is verified</div>
                <div className="osv3p-iconlist-sub">Unverified profiles are visible; the verified badge is granted after review.</div>
              </div>
            </div>
            <div className="osv3p-iconlist-item">
              <span className="osv3p-iconlist-media"><Icon name="rocket" /></span>
              <div className="osv3p-iconlist-text">
                <div className="osv3p-iconlist-title">Capabilities and mission alignment do the matching</div>
                <div className="osv3p-iconlist-sub">They are what the directory searches on, so they are worth the time.</div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
