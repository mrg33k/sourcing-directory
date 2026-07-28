import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Card, CardHeader, CardBody, CardFooter, CardLink, CardAction,
  Tabs, PillRow, VerifiedBadge, Avatar, Icon,
  MissionBars, StatStrip, CheckList, IconList, SplitList,
  Button, EmptyState, CompletenessMeter, MapPanel,
} from '../../components/osv3/index.js'
import { fetchPersonProfile } from '../../lib/profileApi.js'
import { computePersonCompleteness } from '../../lib/profileCompleteness.js'
import '../../styles/osv3-profile.css'

/**
 * Person profile — /people/:slug, plus /people/_preview for the fixture render.
 *
 * The screen holds no data logic of its own: profileApi.js is the seam, every
 * visible piece is one of the shared osv3 primitives, and every rule is a class
 * in osv3-profile.css. No supabase import, no inline styles, no new card style.
 *
 * THE STATE THAT MATTERS MOST IS THE UNFINISHED ONE. Every member gets a
 * profile the moment they join, so the common case is not the transcribed
 * reference below — it is a person with a name, an email, and nothing else.
 * That profile keeps the full structure (so they can see the shape of what they
 * are filling in), swaps the AVAILABILITY panel for the completeness meter, and
 * gives every empty card a named next action. It reads as unfinished on
 * purpose, never as broken.
 */

// The three fields that make a profile do its job in the directory: who you
// are, what you can do, and where your work sits against the six missions.
// Missing any one of them and the completeness prompt appears. A threshold
// percentage would have been arbitrary; these three are the reason the page
// exists.
const LOAD_BEARING = ['bio', 'capabilities', 'missions']

/** The preview-only sparse render: /people/_preview?state=empty.
 *
 *  It exists because there is no person table yet, so the day-one profile has
 *  no other way to be reviewed. Gated on source === 'fixture', so a live record
 *  can never be blanked by a query string. */
const SPARSE_QUERY = 'empty'

function sparse(p) {
  // What a member actually has the minute they sign up: their name and the
  // address they signed up with. Nothing else has been filled in yet.
  return {
    ...p,
    verified: false,
    role: '',
    organization: '',
    location: '',
    linkedin: '',
    photoUrl: null,
    bio: '',
    tags: [],
    availability: { heading: 'AVAILABILITY', status: '', body: '', primaryCta: 'CONNECT' },
    about: { heading: 'ABOUT ME', body: '', link: '' },
    capabilities: { heading: 'CAPABILITIES', action: 'Edit', total: 0, shown: [], footerLink: '' },
    missions: { heading: 'SPACE MISSIONS', action: 'Edit', rows: [] },
    lookingFor: {
      heading: "WHAT I'M LOOKING FOR",
      action: 'Edit',
      left: { heading: "I'M SEEKING", items: [] },
      right: { heading: 'I CAN PROVIDE', items: [] },
    },
    affiliations: { heading: 'AFFILIATIONS', action: '+ Add', items: [], footerLink: '' },
    locationCard: { heading: 'LOCATION', city: '', note: '', highlight: [], markers: [] },
    activity: { heading: 'ACTIVITY HIGHLIGHTS', stats: [] },
  }
}

/** A live row fills in a subset. Every section this screen renders is given a
 *  shape here so a half-written record renders its empty state rather than
 *  throwing on a missing sub-object. */
function normalize(p) {
  const list = (v) => (Array.isArray(v) ? v : [])
  return {
    ...p,
    tags: list(p.tags),
    tabs: list(p.tabs).length ? p.tabs : [{ id: 'overview', label: 'Overview' }],
    availability: { heading: 'AVAILABILITY', status: '', body: '', primaryCta: 'CONNECT', ...(p.availability || {}) },
    about: { heading: 'ABOUT ME', body: '', link: '', ...(p.about || {}) },
    capabilities: { heading: 'CAPABILITIES', total: 0, footerLink: '', ...(p.capabilities || {}), shown: list(p.capabilities && p.capabilities.shown) },
    missions: { heading: 'SPACE MISSIONS', ...(p.missions || {}), rows: list(p.missions && p.missions.rows) },
    lookingFor: {
      heading: "WHAT I'M LOOKING FOR",
      ...(p.lookingFor || {}),
      left: { heading: "I'M SEEKING", ...((p.lookingFor && p.lookingFor.left) || {}), items: list(p.lookingFor && p.lookingFor.left && p.lookingFor.left.items) },
      right: { heading: 'I CAN PROVIDE', ...((p.lookingFor && p.lookingFor.right) || {}), items: list(p.lookingFor && p.lookingFor.right && p.lookingFor.right.items) },
    },
    affiliations: { heading: 'AFFILIATIONS', footerLink: '', ...(p.affiliations || {}), items: list(p.affiliations && p.affiliations.items) },
    locationCard: { heading: 'LOCATION', city: '', note: '', ...(p.locationCard || {}), highlight: list(p.locationCard && p.locationCard.highlight), markers: list(p.locationCard && p.locationCard.markers) },
    activity: { heading: 'ACTIVITY HIGHLIGHTS', ...(p.activity || {}), stats: list(p.activity && p.activity.stats) },
  }
}

/** The completeness panel: the number, the bar, and the named gaps, over the
 *  one button that closes them. A bare percentage tells a member they are at
 *  13% and nothing about what to do next. */
function FinishPanel({ completeness }) {
  return (
    <>
      <CompletenessMeter
        percent={completeness.percent}
        missing={completeness.missing}
        label="PROFILE COMPLETENESS"
      />
      <Button icon="edit" variant="primary" block href="/profile/edit">
        Complete profile
      </Button>
    </>
  )
}

export default function ProfilePerson({ slug: slugProp }) {
  // /people/:slug supplies the param. /people/_preview is a LITERAL route with
  // no param, so it hands the slug in as a prop — reading useParams alone there
  // yields undefined and the screen renders not-found.
  const { slug: routeSlug } = useParams()
  const [params] = useSearchParams()
  const slug = slugProp || routeSlug
  const wantSparse = params.get('state') === SPARSE_QUERY

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
        if (!data) {
          setNotFound(true)
          setProfile(null)
        } else {
          setProfile(data)
          setTab('overview')
        }
      } catch (err) {
        console.error('Person profile load failed:', err)
        if (!cancelled) {
          setNotFound(true)
          setProfile(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  useEffect(() => {
    if (!profile) return
    const title = [profile.name, profile.role].filter(Boolean).join(' — ')
    document.title = `${title} | SpaceOS`
    if (profile.bio) {
      let el = document.querySelector('meta[name="description"]')
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('name', 'description')
        document.head.appendChild(el)
      }
      el.setAttribute('content', profile.bio)
    }
    return () => { document.title = 'Space Rising' }
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
          body="Member profiles are not published yet. Open /people/_preview to see the profile screen rendered from the approved reference data."
        />
      </div>
    )
  }

  const isFixture = profile.source === 'fixture'
  const showSparse = isFixture && wantSparse
  const p = normalize(showSparse ? sparse(profile) : profile)

  const completeness = computePersonCompleteness(p)
  const incomplete = completeness.missing.some((m) => LOAD_BEARING.includes(m.field))
  const hasAvailability = Boolean(p.availability.status)
  // The 296px slot beside the identity block. It carries AVAILABILITY when the
  // person has published one — that is the reference. When they have not, it
  // carries the reason it is blank and the way to fix it, rather than 296px of
  // white.
  const sidePanel = hasAvailability || incomplete

  const identity = (
    <div className="osv3p-identity-main">
      <Avatar src={p.photoUrl} name={p.name} size="xl" status={hasAvailability} />
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
        {(p.location || p.email || p.linkedin) && (
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
        )}
        {p.bio ? <p className="osv3p-identity-bio">{p.bio}</p> : null}
        {p.tags.length ? <PillRow items={p.tags} /> : null}
      </div>
    </div>
  )

  return (
    <div className="osv3p-screen osv3p-screen--profile">
      {/* ---- identity ---- */}
      {sidePanel ? (
        <div className="osv3p-identity">
          {identity}
          <aside className="osv3p-sidepanel">
            {hasAvailability ? (
              <>
                <h2 className="osv3p-card-title">{p.availability.heading}</h2>
                <span className="osv3p-sidepanel-status">
                  {p.availability.status}
                  <span className="osv3p-sidepanel-dot" />
                </span>
                {p.availability.body ? <p className="osv3p-sidepanel-body">{p.availability.body}</p> : null}
                <Button icon="send" variant="primary" block>{p.availability.primaryCta}</Button>
              </>
            ) : (
              <FinishPanel completeness={completeness} />
            )}
          </aside>
        </div>
      ) : (
        identity
      )}

      {/* A profile that has published its availability but is still missing the
          load-bearing sections gets the prompt on its own row — the side panel
          is already spoken for. */}
      {hasAvailability && incomplete ? (
        <Card>
          <CardBody>
            <FinishPanel completeness={completeness} />
          </CardBody>
        </Card>
      ) : null}

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
                {p.about.body
                  ? <p className="osv3p-prose">{p.about.body}</p>
                  : <EmptyState icon="file" title="No bio yet" body="A few sentences on what you do and why is the first thing anyone reads here." />}
              </CardBody>
              {p.about.body && p.about.link ? (
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
              {p.capabilities.shown.length && p.capabilities.footerLink ? (
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
                {p.lookingFor.left.items.length || p.lookingFor.right.items.length
                  ? <SplitList left={p.lookingFor.left} right={p.lookingFor.right} />
                  : <EmptyState icon="handshake" title="Nothing listed yet" body="Say what you are looking for and what you can offer — this is what connects you to other members." />}
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
              {p.affiliations.items.length && p.affiliations.footerLink ? (
                <CardFooter><CardLink>{p.affiliations.footerLink}</CardLink></CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader title={p.locationCard.heading} />
              <CardBody>
                {p.locationCard.city ? (
                  <>
                    <MapPanel
                      markers={p.locationCard.markers}
                      highlight={p.locationCard.highlight}
                      viewBox={p.locationCard.viewBox}
                      ariaLabel={`Map showing ${p.locationCard.city}`}
                    />
                    <div className="osv3p-map-caption">
                      <span className="osv3p-iconlist-media"><Icon name="globe" /></span>
                      <div className="osv3p-iconlist-text">
                        <div className="osv3p-iconlist-title">{p.locationCard.city}</div>
                        {p.locationCard.note ? <div className="osv3p-iconlist-sub">{p.locationCard.note}</div> : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState icon="location" title="No location yet" body="Members search this directory by region more than by anything else." />
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title={p.activity.heading} />
            <CardBody>
              {p.activity.stats.length
                ? <StatStrip items={p.activity.stats} />
                : <EmptyState icon="grid" title="No activity yet" body="Connections, organizations and events show up here as you use SpaceOS." />}
            </CardBody>
          </Card>
        </>
      )}

      {tab === 'capabilities' && (
        <Card>
          <CardHeader
            title={p.capabilities.heading}
            count={p.capabilities.total || null}
            action={p.capabilities.action ? <CardAction>{p.capabilities.action}</CardAction> : null}
          />
          <CardBody>
            {p.capabilities.shown.length
              ? <CheckList items={p.capabilities.shown} />
              : <EmptyState icon="check-circle" title="No capabilities listed" body="Add the work you do so the directory can match you to it." />}
          </CardBody>
        </Card>
      )}

      {tab === 'needs' && (
        <Card>
          <CardHeader
            title={p.lookingFor.heading}
            action={p.lookingFor.action ? <CardAction>{p.lookingFor.action}</CardAction> : null}
          />
          <CardBody>
            {p.lookingFor.left.items.length || p.lookingFor.right.items.length
              ? <SplitList left={p.lookingFor.left} right={p.lookingFor.right} />
              : <EmptyState icon="handshake" title="Nothing listed yet" body="Say what you are looking for and what you can offer — this is what connects you to other members." />}
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
          <CardHeader
            title={p.affiliations.heading}
            action={p.affiliations.action ? <CardAction>{p.affiliations.action}</CardAction> : null}
          />
          <CardBody>
            {p.affiliations.items.length
              ? <IconList items={p.affiliations.items} />
              : <EmptyState icon="building" title="No affiliations yet" body="Link the organizations you are part of." />}
          </CardBody>
        </Card>
      )}

      {isFixture ? (
        <p className="osv3p-footnote">
          {showSparse
            ? 'Day-one profile. The same screen the moment a member joins — name and email only, every section still to fill in. '
            : 'Reference profile. Every name, figure and list on this page is transcribed from the approved person-profile design, so the screen can be reviewed before real profile records exist. '}
          <CardLink href={showSparse ? '/people/_preview' : '/people/_preview?state=empty'}>
            {showSparse ? 'See the completed profile' : 'See a day-one profile'}
          </CardLink>
        </p>
      ) : null}
    </div>
  )
}
