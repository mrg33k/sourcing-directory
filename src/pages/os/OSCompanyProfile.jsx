import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Card, CardHeader, CardBody, CardFooter, CardLink, CardAction,
  Tabs, PillRow, VerifiedBadge, LogoTile, Icon,
  MissionBars, StatStrip, CheckList, KeyValueList, CountGrid, IconList, SplitList,
  Button, ButtonRow, EmptyState, MapPanel,
} from '../../components/osv3/index.js'
import { fetchCompanyProfile } from '../../lib/profileApi.js'
import '../../styles/osv3-profile.css'

/**
 * Company profile — /company/_preview renders the fixture; /company/:slug keeps
 * pointing at the existing company page until this screen is signed off, so
 * nothing live changes underneath anyone.
 */

export default function OSCompanyProfile({ slug: slugProp }) {
  // /company/_preview is a LITERAL route and carries no param, so the slug
  // arrives as a prop. Never default it here — a paramless mount would then
  // silently serve the fixture as if it were a real organization.
  const { slug: routeSlug } = useParams()
  const slug = slugProp || routeSlug
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
        const data = await fetchCompanyProfile(slug)
        if (cancelled) return
        if (!data) { setNotFound(true); setProfile(null) }
        else { setProfile(data); setTab('overview') }
      } catch (err) {
        console.error('Company profile load failed:', err)
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
        <p className="osv3p-prose">Loading organization…</p>
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState
          icon="building"
          title="No organization at this address"
          body="Open /company/_preview to see the organization screen rendered from the reference data."
        />
      </div>
    )
  }

  const c = profile

  return (
    <div className="osv3p-screen osv3p-screen--profile">
      {/* ---- identity ---- */}
      <div className="osv3p-identity">
        <div className="osv3p-identity-main">
          <LogoTile src={c.logoUrl} name={c.name} size="xl" />
          <div className="osv3p-identity-text">
            <VerifiedBadge verified={c.verified} label={c.verifiedLabel} />
            <h1 className="osv3p-identity-name osv3p-identity-name--org">{c.name}</h1>
            {c.categories && c.categories.length ? (
              <div className="osv3p-identity-role">{c.categories.join('  •  ')}</div>
            ) : null}
            <div className="osv3p-identity-meta">
              {c.location && <span className="osv3p-meta-item"><Icon name="location" />{c.location}</span>}
              {c.website && (
                <span className="osv3p-meta-item">
                  <Icon name="globe" />
                  <a href={`https://${String(c.website).replace(/^https?:\/\//, '')}`}>{c.website}</a>
                </span>
              )}
              {c.email && (
                <span className="osv3p-meta-item">
                  <Icon name="mail" />
                  <a href={`mailto:${c.email}`}>{c.email}</a>
                </span>
              )}
              {c.linkedin && (
                <a className="osv3p-meta-item" href={c.linkedin} aria-label={`${c.name} on LinkedIn`}>
                  <Icon name="linkedin" />
                </a>
              )}
            </div>
            {c.description ? <p className="osv3p-identity-bio">{c.description}</p> : null}
            {c.tags && c.tags.length ? <PillRow items={c.tags} /> : null}
          </div>
        </div>

        <aside className="osv3p-sidepanel">
          <h2 className="osv3p-card-title">{c.connect.heading}</h2>
          {c.connect.status ? (
            <span className="osv3p-sidepanel-status">
              {c.connect.status}
              <span className="osv3p-sidepanel-dot" />
            </span>
          ) : null}
          {c.connect.body ? <p className="osv3p-sidepanel-body">{c.connect.body}</p> : null}
          <ButtonRow>
            <Button icon="send" variant="primary" block>{c.connect.primaryCta}</Button>
            <Button icon="bookmark" variant="secondary" block>{c.connect.secondaryCta}</Button>
          </ButtonRow>
        </aside>
      </div>

      {/* ---- tabs ---- */}
      <div className="osv3p-tabbar">
        <Tabs items={c.tabs} value={tab} onChange={setTab} label="Organization sections" />
      </div>

      {tab === 'overview' && (
        <>
          <div className="osv3p-grid osv3p-grid--company-a">
            <Card>
              <CardHeader title={c.atAGlance.heading} />
              <CardBody>
                {c.atAGlance.rows.length
                  ? <KeyValueList rows={c.atAGlance.rows} />
                  : <EmptyState icon="file" title="No company facts yet" body="Founded, size and type appear here once the record carries them." />}
              </CardBody>
              {c.atAGlance.footerLink ? (
                <CardFooter><CardLink>{c.atAGlance.footerLink}</CardLink></CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                title={c.capabilities.heading}
                count={c.capabilities.total || null}
                action={c.capabilities.footerLink ? <CardAction>{c.capabilities.footerLink}</CardAction> : null}
              />
              <CardBody>
                {c.capabilities.shown.length
                  ? <CheckList items={c.capabilities.shown} />
                  : <EmptyState icon="rocket" title="No capabilities listed" body="Add what this organization builds, launches or operates." />}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={c.missions.heading} />
              <CardBody>
                {c.missions.rows.length
                  ? <MissionBars rows={c.missions.rows} />
                  : <EmptyState icon="mission-build" title="No mission alignment yet" body="Map this organization to the six space missions." />}
              </CardBody>
              {c.missions.footerLink ? (
                <CardFooter><CardLink>{c.missions.footerLink}</CardLink></CardFooter>
              ) : null}
            </Card>
          </div>

          <div className="osv3p-grid osv3p-grid--company-b">
            <Card>
              <CardHeader title={c.whatWeDo.heading} />
              <CardBody>
                <p className="osv3p-prose">{c.whatWeDo.body}</p>
              </CardBody>
              {c.whatWeDo.link ? (
                <CardFooter><CardLink>{c.whatWeDo.link}</CardLink></CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                title={c.whoWeWorkWith.heading}
                action={c.whoWeWorkWith.footerLink ? <CardAction>{c.whoWeWorkWith.footerLink}</CardAction> : null}
              />
              <CardBody>
                {c.whoWeWorkWith.counts.length
                  ? <CountGrid items={c.whoWeWorkWith.counts} />
                  : <EmptyState icon="handshake" title="No relationships listed" body="Suppliers, partners and customers appear here." />}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title={c.lookingFor.heading}
                action={c.lookingFor.action ? <CardAction>{c.lookingFor.action}</CardAction> : null}
              />
              <CardBody>
                <SplitList left={c.lookingFor.left} right={c.lookingFor.right} />
              </CardBody>
              {c.lookingFor.footerLink ? (
                <CardFooter><CardLink>{c.lookingFor.footerLink}</CardLink></CardFooter>
              ) : null}
            </Card>
          </div>

          <div className="osv3p-grid osv3p-grid--company-c">
            <Card>
              <CardHeader title={c.locations.heading} />
              <CardBody>
                <div className="osv3p-grid osv3p-grid--halves">
                  <MapPanel
                    markers={c.locations.markers}
                    highlight={c.locations.highlight}
                    ariaLabel={`Map of ${c.name} locations`}
                  />
                  <IconList items={c.locations.items} />
                </div>
              </CardBody>
              {c.locations.footerLink ? (
                <CardFooter><CardLink>{c.locations.footerLink}</CardLink></CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                title={c.activity.heading}
                action={c.activity.footerLink ? <CardAction>{c.activity.footerLink}</CardAction> : null}
              />
              <CardBody>
                <StatStrip items={c.activity.stats} />
              </CardBody>
            </Card>
          </div>
        </>
      )}

      {tab === 'capabilities' && (
        <Card>
          <CardHeader title={c.capabilities.heading} count={c.capabilities.total || null} />
          <CardBody>
            {c.capabilities.shown.length
              ? <CheckList items={c.capabilities.shown} />
              : <EmptyState icon="rocket" title="No capabilities listed" body="Add what this organization builds, launches or operates." />}
          </CardBody>
        </Card>
      )}

      {tab === 'people' && (
        <EmptyState
          icon="users"
          title="People are not published yet"
          body="Team members will appear here once person records are linked to this organization."
        />
      )}

      {tab === 'location' && (
        <Card>
          <CardHeader title={c.locations.heading} />
          <CardBody>
            <div className="osv3p-grid osv3p-grid--halves">
              <MapPanel markers={c.locations.markers} highlight={c.locations.highlight} ariaLabel={`Map of ${c.name} locations`} />
              <IconList items={c.locations.items} />
            </div>
          </CardBody>
        </Card>
      )}

      {tab === 'affiliations' && (
        <EmptyState
          icon="building"
          title="Affiliations are not published yet"
          body="Councils, programs and memberships will appear here once the record carries them."
        />
      )}

      {c.footer ? <p className="osv3p-footnote">{c.footer}</p> : null}

      {c.source === 'fixture' ? (
        <p className="osv3p-footnote">
          Reference organization. Every name, figure and list on this page is transcribed from the
          approved company-profile design, so the screen can be reviewed before the live record
          carries this much detail.
        </p>
      ) : null}
    </div>
  )
}
