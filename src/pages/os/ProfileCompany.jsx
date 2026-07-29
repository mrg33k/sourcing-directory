import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Card, CardHeader, CardBody, CardFooter, CardLink, CardAction,
  Tabs, PillRow, VerifiedBadge, LogoTile, Icon,
  MissionBars, StatStrip, CheckList, KeyValueList, CountGrid, IconList, SplitList,
  Button, ButtonRow, EmptyState, CompletenessMeter, MapPanel,
} from '../../components/osv3/index.js'
import { fetchCompanyProfile } from '../../lib/profileApi.js'
import { computeCompanyCompleteness } from '../../lib/profileCompleteness.js'
import { COMPANY_FIXTURE } from '../../lib/profileFixtures.js'
import '../../styles/osv3-profile.css'

/**
 * The company profile screen.
 *
 * Built from the approved reference (reference/design-company-profile.png) and
 * its pixel measurements. Every string, number and list order comes from
 * profileFixtures.js, which was transcribed from measurements-company.json —
 * nothing on this screen was retyped off the image.
 *
 * Composition only. Every element is an osv3 primitive reading a --v3-* token
 * through src/styles/osv3-profile.css. There is not one inline style on this
 * screen, by rule: scripts/design_spacing_check.py cannot read inline styles,
 * and a screen it cannot read is a screen nobody can verify.
 *
 * ---------------------------------------------------------------------------
 * THE EMPTY PROFILE IS THE COMMON CASE, NOT THE EDGE CASE
 * ---------------------------------------------------------------------------
 * Every member gets an organization record the moment they join, and is then
 * prompted to fill it in. So the 10%-complete profile is what most people will
 * actually look at, and it has to read as deliberate — a shape waiting to be
 * filled — rather than as a page that failed to load.
 *
 * Three things carry that:
 *   1. Every card owns its own EmptyState. A card never renders a blank body,
 *      an empty <ul>, or a map with no pins on it.
 *   2. A materially incomplete profile (< 80%) gets a CompletenessMeter in the
 *      identity column, where the missing categories/location/description would
 *      have been. It names the gaps rather than just scoring them, and it sits
 *      in the hole instead of leaving one: a 144px logo tile beside a single
 *      line of name leaves an L-shaped void that reads as a failed render.
 *   3. The grid never collapses. The owner sees the shape of what to fill.
 *
 * `?state=new` renders exactly that: the same organization as a record that has
 * just been created, carrying nothing but its name. It is how the empty state
 * gets reviewed before a thin live record is routed here. Explicit param only —
 * never the default, and never mistaken for a real profile.
 */

/** The route that owns the "finish your record" flow. */
const EDIT_HREF = '/profile/edit'

/** Below this, a profile is materially incomplete and says so. Above it, the
 *  record is essentially there and a progress band would just be nagging —
 *  the reference fixture sits at 94% (no logo) and correctly shows none. */
const INCOMPLETE_BELOW = 80

/**
 * A brand-new organization record: the name its owner typed, and nothing else.
 * Same organization as the fixture on purpose, so the full screen and the empty
 * screen are directly comparable and no second company is invented to fill it.
 * Shape mirrors what profileApi's companyFromRow() returns for a thin live row.
 */
function newOrganizationPreview() {
  const name = COMPANY_FIXTURE.name
  return {
    slug: '_preview',
    kind: 'company',
    source: 'preview-new',
    name,
    verified: false,
    verifiedLabel: 'Verified Organization',
    categories: [],
    location: '',
    website: '',
    email: '',
    linkedin: '',
    logoUrl: null,
    description: '',
    tags: [],
    tabs: COMPANY_FIXTURE.tabs.map((t) => (t.id === 'people' ? { id: t.id, label: t.label } : t)),
    connect: {
      heading: `CONNECT WITH ${name.toUpperCase()}`,
      status: '',
      body: '',
      primaryCta: 'CONNECT',
      secondaryCta: 'FOLLOW',
    },
    atAGlance: { heading: 'AT A GLANCE', rows: [], footerLink: '' },
    capabilities: { heading: 'CAPABILITIES', total: 0, shown: [], footerLink: '' },
    missions: { heading: 'SPACE MISSIONS', rows: [], footerLink: '' },
    whatWeDo: { heading: 'WHAT WE DO', body: '', link: '' },
    whoWeWorkWith: { heading: 'WHO WE WORK WITH', counts: [], footerLink: '' },
    lookingFor: {
      heading: 'LOOKING FOR',
      action: 'Edit',
      left: { heading: '', items: [] },
      right: { heading: '', items: [] },
      footerLink: '',
    },
    locations: { heading: 'LOCATIONS', items: [], footerLink: '', highlight: [], markers: [] },
    activity: { heading: 'ACTIVITY HIGHLIGHTS', stats: [], footerLink: '' },
    footer: COMPANY_FIXTURE.footer,
  }
}

/** The locations map + the list beside it. Shared by the OVERVIEW card and the
 *  LOCATION tab so the two can never drift; `stacked` is the expanded reading,
 *  where the map takes the full card width and the list sits under it. */
function LocationsBody({ company, stacked, onExpand }) {
  const loc = company.locations
  if (!loc.items.length) {
    return (
      <EmptyState
        icon="location"
        title="No locations added"
        body="Headquarters, launch sites and facilities appear here, pinned on the map."
      />
    )
  }
  return (
    <div className={stacked ? 'osv3p-grid' : 'osv3p-grid osv3p-grid--halves'}>
      <MapPanel
        markers={loc.markers}
        highlight={loc.highlight}
        onExpand={onExpand}
        ariaLabel={`Map of ${company.name} locations`}
      />
      <IconList items={loc.items} />
    </div>
  )
}

/** The capabilities grid, shared by the OVERVIEW card and the CAPABILITIES tab. */
function CapabilitiesBody({ company }) {
  if (!company.capabilities.shown.length) {
    return (
      <EmptyState
        icon="rocket"
        title="No capabilities listed"
        body="Say what this organization builds, launches or operates. Capabilities are how it gets found."
      />
    )
  }
  return <CheckList items={company.capabilities.shown} />
}

export default function ProfileCompany({ slug: slugProp }) {
  // /company/_preview is a LITERAL route and carries no param, so the slug
  // arrives as a prop. Never default it here — a paramless mount would then
  // silently serve the fixture as if it were a real organization.
  const { slug: routeSlug } = useParams()
  const [params] = useSearchParams()
  const slug = slugProp || routeSlug
  const wantsNew = params.get('state') === 'new'

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)

    if (wantsNew) {
      setProfile(newOrganizationPreview())
      setTab('overview')
      setLoading(false)
      return () => { cancelled = true }
    }

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
  }, [slug, wantsNew])

  useEffect(() => {
    if (!profile) return
    const previous = document.title
    document.title = `${profile.name} | SpaceOS`
    return () => { document.title = previous }
  }, [profile])

  const completeness = useMemo(
    () => (profile ? computeCompanyCompleteness(profile) : null),
    [profile],
  )

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
          body="This link does not match an organization on SpaceOS. It may have been renamed, or the record may not be published yet."
        />
      </div>
    )
  }

  const c = profile
  const showCompleteness = completeness && completeness.percent < INCOMPLETE_BELOW

  // The meta line: pin, globe, envelope — hairline-separated, exactly as the
  // reference draws it — then the LinkedIn mark appended with no separator.
  const meta = []
  if (c.location) {
    meta.push(<span className="osv3p-meta-item" key="location"><Icon name="location" />{c.location}</span>)
  }
  if (c.website) {
    const href = `https://${String(c.website).replace(/^https?:\/\//, '')}`
    meta.push(
      <span className="osv3p-meta-item" key="website">
        <Icon name="globe" /><a href={href} rel="noreferrer">{c.website}</a>
      </span>,
    )
  }
  if (c.email) {
    meta.push(
      <span className="osv3p-meta-item" key="email">
        <Icon name="mail" /><a href={`mailto:${c.email}`}>{c.email}</a>
      </span>,
    )
  }

  return (
    <div className="osv3p-screen osv3p-screen--profile">
      {/* ---- finish-your-record band: only when the record is materially thin ---- */}
      {showCompleteness ? (
        <Card>
          <CardBody>
            <CompletenessMeter
              percent={completeness.percent}
              missing={completeness.missing}
              label="Profile completeness"
            />
          </CardBody>
          <CardFooter>
            <CardLink href={EDIT_HREF}>Complete this profile</CardLink>
          </CardFooter>
        </Card>
      ) : null}

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
            {meta.length || c.linkedin ? (
              <div className="osv3p-identity-meta">
                {meta.map((node, i) => (i === 0 ? node : (
                  <React.Fragment key={`sep-${i}`}>
                    <span className="osv3p-identity-sep" aria-hidden="true">|</span>
                    {node}
                  </React.Fragment>
                )))}
                {c.linkedin ? (
                  <a
                    className="osv3p-meta-item"
                    href={c.linkedin}
                    rel="noreferrer"
                    aria-label={`${c.name} on LinkedIn`}
                  >
                    <Icon name="linkedin" />
                  </a>
                ) : null}
              </div>
            ) : null}
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
          <p className="osv3p-sidepanel-body">
            {c.connect.body
              ? c.connect.body
              : `Reach ${c.name} through SpaceOS, or follow the record to be told when it changes.`}
          </p>
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
                  : (
                    <EmptyState
                      icon="file"
                      title="No company facts yet"
                      body="Founded, size, organization type and headquarters appear here."
                    />
                  )}
              </CardBody>
              {c.atAGlance.footerLink ? (
                <CardFooter><CardLink>{c.atAGlance.footerLink}</CardLink></CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                title={c.capabilities.heading}
                count={c.capabilities.total || null}
                action={c.capabilities.footerLink
                  ? <CardLink onClick={() => setTab('capabilities')}>{c.capabilities.footerLink}</CardLink>
                  : null}
              />
              <CardBody><CapabilitiesBody company={c} /></CardBody>
            </Card>

            <Card>
              <CardHeader title={c.missions.heading} />
              <CardBody>
                {c.missions.rows.length
                  ? <MissionBars rows={c.missions.rows} />
                  : (
                    <EmptyState
                      icon="mission-build"
                      title="No mission alignment yet"
                      body="Map this organization to the six space missions to show where its work lands."
                    />
                  )}
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
                {c.whatWeDo.body
                  ? <p className="osv3p-prose">{c.whatWeDo.body}</p>
                  : (
                    <EmptyState
                      icon="file"
                      title="No description yet"
                      body="A few lines on what this organization does, in its own words."
                    />
                  )}
              </CardBody>
              {c.whatWeDo.link ? (
                <CardFooter><CardLink>{c.whatWeDo.link}</CardLink></CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                title={c.whoWeWorkWith.heading}
                action={c.whoWeWorkWith.footerLink
                  ? <CardLink>{c.whoWeWorkWith.footerLink}</CardLink>
                  : null}
              />
              <CardBody>
                {c.whoWeWorkWith.counts.length
                  ? <CountGrid items={c.whoWeWorkWith.counts} />
                  : (
                    <EmptyState
                      icon="handshake"
                      title="No relationships listed"
                      body="Suppliers, partners, customers, universities and investors are counted here."
                    />
                  )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title={c.lookingFor.heading}
                action={c.lookingFor.action
                  ? <CardAction href={EDIT_HREF}>{c.lookingFor.action}</CardAction>
                  : null}
              />
              <CardBody>
                {c.lookingFor.left.items.length || c.lookingFor.right.items.length
                  ? <SplitList left={c.lookingFor.left} right={c.lookingFor.right} />
                  : (
                    <EmptyState
                      icon="search"
                      title="No stated needs"
                      body="Suppliers, partners, talent or investment — what this organization is looking for."
                    />
                  )}
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
                <LocationsBody company={c} onExpand={() => setTab('location')} />
              </CardBody>
              {c.locations.footerLink ? (
                <CardFooter><CardLink>{c.locations.footerLink}</CardLink></CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                title={c.activity.heading}
                action={c.activity.footerLink
                  ? <CardLink>{c.activity.footerLink}</CardLink>
                  : null}
              />
              <CardBody>
                {c.activity.stats.length
                  ? <StatStrip items={c.activity.stats} />
                  : (
                    <EmptyState
                      icon="eye"
                      title="No activity yet"
                      body="Views, connection requests and posted opportunities are counted once the record is live."
                    />
                  )}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      {tab === 'capabilities' && (
        <Card>
          <CardHeader title={c.capabilities.heading} count={c.capabilities.total || null} />
          <CardBody><CapabilitiesBody company={c} /></CardBody>
        </Card>
      )}

      {tab === 'people' && (
        <Card>
          <CardHeader title="People" />
          <CardBody>
            <EmptyState
              icon="users"
              title="People are not published yet"
              body="Team members appear here once person records are linked to this organization. Until then the count comes from the organization's own record, not from profiles we can show."
            />
          </CardBody>
        </Card>
      )}

      {tab === 'location' && (
        <Card>
          <CardHeader title={c.locations.heading} />
          <CardBody><LocationsBody company={c} stacked /></CardBody>
          {c.locations.footerLink ? (
            <CardFooter><CardLink>{c.locations.footerLink}</CardLink></CardFooter>
          ) : null}
        </Card>
      )}

      {tab === 'affiliations' && (
        <Card>
          <CardHeader title="Affiliations" />
          <CardBody>
            <EmptyState
              icon="building"
              title="No affiliations listed"
              body="Councils, programs and memberships this organization belongs to appear here."
            />
          </CardBody>
        </Card>
      )}

      {c.footer ? <p className="osv3p-footnote">{c.footer}</p> : null}

      {c.source === 'fixture' ? (
        <p className="osv3p-footnote">
          Reference organization. Every name, figure and list on this page is transcribed from the
          approved company-profile design, so the screen can be reviewed before a live record
          carries this much detail.
        </p>
      ) : null}

      {c.source === 'preview-new' ? (
        <p className="osv3p-footnote">
          Preview of a newly created organization record — name only, nothing else filled in. This
          is what a member sees the day they join, and what the prompts above are asking them to
          finish.
        </p>
      ) : null}
    </div>
  )
}
