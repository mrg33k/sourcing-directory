import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Card, CardHeader, CardBody, CardFooter, CardLink, CardAction,
  Tabs, PillRow, VerifiedBadge, Avatar, Icon,
  MissionBars, StatStrip, CheckList, IconList, SplitList,
  Button, EmptyState, MapPanel,
} from '../../components/osv3/index.js'
import { fetchPersonProfile } from '../../lib/profileApi.js'
import '../../styles/osv3-profile.css'

/**
 * Person profile — /people/:slug, and /people/_preview for the fixture render.
 *
 * The screen holds no data logic of its own: profileApi.js is the seam, and
 * every visible piece is one of the shared primitives. No supabase import here,
 * no inline styles anywhere.
 */

export default function OSPersonProfile() {
  const { slug } = useParams()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    ;(async () => {
      try {
        const data = await fetchPersonProfile(slug)
        if (cancelled) return
        if (!data) { setNotFound(true); setProfile(null) }
        else { setProfile(data); setTab('overview') }
      } catch (err) {
        console.error('Person profile load failed:', err)
        if (!cancelled) { setNotFound(true); setProfile(null) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  useEffect(() => {
    if (!profile) return
    document.title = `${profile.name} | SpaceOS`
  }, [profile])

  if (loading) {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <p className="osv3p-prose">Loading profile…</p>
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState
          icon="users"
          title="No profile at this address"
          body="People profiles are not published yet. Open /people/_preview to see the profile screen rendered from the reference data."
        />
      </div>
    )
  }

  const p = profile

  return (
    <div className="osv3p-screen osv3p-screen--profile">
      {/* ---- identity ---- */}
      <div className="osv3p-identity">
        <div className="osv3p-identity-main">
          <Avatar src={p.photoUrl} name={p.name} size="xl" status={Boolean(p.availability && p.availability.status)} />
          <div className="osv3p-identity-text">
            <div className="osv3p-identity-titleline">
              <h1 className="osv3p-identity-name">{p.name}</h1>
              <VerifiedBadge verified={p.verified} label={p.verifiedLabel} />
            </div>
            {(p.role || p.organization) && (
              <div className="osv3p-identity-role">
                {p.role}
                {p.role && p.organization ? <span className="osv3p-identity-sep">|</span> : null}
                {p.organization ? <b>{p.organization}</b> : null}
              </div>
            )}
            <div className="osv3p-identity-meta">
              {p.location && (
                <span className="osv3p-meta-item"><Icon name="location" />{p.location}</span>
              )}
              {p.email && (
                <span className="osv3p-meta-item">
                  <Icon name="mail" />
                  <a href={`mailto:${p.email}`}>{p.email}</a>
                </span>
              )}
              {p.linkedin && (
                <a className="osv3p-meta-item" href={p.linkedin} aria-label={`${p.name} on LinkedIn`}>
                  <Icon name="linkedin" />
                </a>
              )}
            </div>
            {p.bio ? <p className="osv3p-identity-bio">{p.bio}</p> : null}
            {p.tags && p.tags.length ? <PillRow items={p.tags} /> : null}
          </div>
        </div>

        <aside className="osv3p-sidepanel">
          <h2 className="osv3p-card-title">{p.availability.heading}</h2>
          {p.availability.status ? (
            <span className="osv3p-sidepanel-status">
              {p.availability.status}
              <span className="osv3p-sidepanel-dot" />
            </span>
          ) : null}
          {p.availability.body ? <p className="osv3p-sidepanel-body">{p.availability.body}</p> : null}
          <Button icon="send" variant="primary" block>{p.availability.primaryCta}</Button>
        </aside>
      </div>

      {/* ---- tabs ---- */}
      <div className="osv3p-tabbar">
        <Tabs items={p.tabs} value={tab} onChange={setTab} label="Profile sections" />
      </div>

      {tab === 'overview' && (
        <>
          <div className="osv3p-grid osv3p-grid--person-a">
            <Card>
              <CardHeader title={p.about.heading} />
              <CardBody>
                <p className="osv3p-prose">{p.about.body}</p>
              </CardBody>
              {p.about.link ? (
                <CardFooter><CardLink>{p.about.link}</CardLink></CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                title={p.capabilities.heading}
                action={p.capabilities.action ? <CardAction>{p.capabilities.action}</CardAction> : null}
              />
              <CardBody>
                {p.capabilities.shown.length
                  ? <CheckList items={p.capabilities.shown} />
                  : <EmptyState icon="check-circle" title="No capabilities listed" body="Add the work you do so the directory can match you to it." />}
              </CardBody>
              {p.capabilities.footerLink ? (
                <CardFooter><CardLink>{p.capabilities.footerLink}</CardLink></CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                title={p.missions.heading}
                action={p.missions.action ? <CardAction>{p.missions.action}</CardAction> : null}
              />
              <CardBody>
                {p.missions.rows.length
                  ? <MissionBars rows={p.missions.rows} />
                  : <EmptyState icon="mission-build" title="No mission alignment yet" body="Rate how your work maps to the six space missions." />}
              </CardBody>
            </Card>
          </div>

          <div className="osv3p-grid osv3p-grid--person-b">
            <Card>
              <CardHeader
                title={p.lookingFor.heading}
                action={p.lookingFor.action ? <CardAction>{p.lookingFor.action}</CardAction> : null}
              />
              <CardBody>
                <SplitList left={p.lookingFor.left} right={p.lookingFor.right} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title={p.affiliations.heading}
                action={p.affiliations.action ? <CardAction>{p.affiliations.action}</CardAction> : null}
              />
              <CardBody>
                {p.affiliations.items.length
                  ? <IconList items={p.affiliations.items} />
                  : <EmptyState icon="building" title="No affiliations yet" body="Link the organizations you are part of." />}
              </CardBody>
              {p.affiliations.footerLink ? (
                <CardFooter><CardLink>{p.affiliations.footerLink}</CardLink></CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader title={p.locationCard.heading} />
              <CardBody>
                <MapPanel
                  markers={p.locationCard.markers}
                  highlight={p.locationCard.highlight}
                  ariaLabel={`Map showing ${p.locationCard.city || 'this location'}`}
                />
                <div className="osv3p-map-caption">
                  <span className="osv3p-iconlist-media"><Icon name="globe" /></span>
                  <div className="osv3p-iconlist-text">
                    <div className="osv3p-iconlist-title">{p.locationCard.city}</div>
                    <div className="osv3p-iconlist-sub">{p.locationCard.note}</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title={p.activity.heading} />
            <CardBody>
              <StatStrip items={p.activity.stats} />
            </CardBody>
          </Card>
        </>
      )}

      {tab === 'capabilities' && (
        <Card>
          <CardHeader title={p.capabilities.heading} count={p.capabilities.total || null} />
          <CardBody>
            {p.capabilities.shown.length
              ? <CheckList items={p.capabilities.shown} />
              : <EmptyState icon="check-circle" title="No capabilities listed" body="Add the work you do so the directory can match you to it." />}
          </CardBody>
        </Card>
      )}

      {tab === 'needs' && (
        <Card>
          <CardHeader title={p.lookingFor.heading} />
          <CardBody>
            <SplitList left={p.lookingFor.left} right={p.lookingFor.right} />
          </CardBody>
        </Card>
      )}

      {tab === 'experience' && (
        <EmptyState
          icon="briefcase"
          title="Experience is not published yet"
          body="Roles and history will appear here once the profile record carries them."
        />
      )}

      {tab === 'affiliations' && (
        <Card>
          <CardHeader title={p.affiliations.heading} />
          <CardBody>
            {p.affiliations.items.length
              ? <IconList items={p.affiliations.items} />
              : <EmptyState icon="building" title="No affiliations yet" body="Link the organizations you are part of." />}
          </CardBody>
        </Card>
      )}

      {p.source === 'fixture' ? (
        <p className="osv3p-footnote">
          Reference profile. Every name, figure and list on this page is transcribed from the approved
          person-profile design, so the screen can be reviewed before real profile records exist.
        </p>
      ) : null}
    </div>
  )
}
