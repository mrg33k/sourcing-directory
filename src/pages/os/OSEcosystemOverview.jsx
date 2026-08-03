import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, CardBody, CardFooter, CardLink,
  KpiTile, DonutChart, DonutLegend, Bar, IconList, LogoTile, VerifiedBadge,
  MapPanel, Button, EmptyState, Icon,
} from '../../components/osv3/index.js'
import {
  loadEcosystemOverview, windowDelta, formatCount, formatRelative, WINDOW_DAYS,
} from '../../lib/ecosystemOverview.js'
import '../../styles/osv3-profile.css'
import './osv3-ecosystem-overview.css'

/**
 * Ecosystem Overview — what a member opens to see the state of Arizona's
 * commercial space ecosystem in one screen.
 *
 * Every figure here is counted in the database at load (src/lib/
 * ecosystemOverview.js). Nothing is hardcoded, nothing is a fixture, and the
 * numbers on the reference comp — 812 organizations, 2,843 people, 1,426
 * connections — appear nowhere in this file. The real figures are 165 and 73.
 *
 * No inline styles: every value comes from a class in osv3-profile.css or this
 * page's own sheet reading a --v3-* token.
 *
 * ---------------------------------------------------------------------------
 * FOUR PLACES THE DESIGN ASKS FOR SOMETHING THIS PLATFORM DOES NOT RECORD
 * ---------------------------------------------------------------------------
 * Each one is a decision, not an omission, and each is visible on the screen
 * rather than only in this comment.
 *
 * 1. "Connections Made" — the comp's sixth stat tile. There is no connections
 *    table, no saved-items table, no registrations table; /connections is a
 *    hardcoded empty state with no query behind it. A tile reading 1,426 under
 *    a real client's brand is the fastest way to lose their trust, and a tile
 *    reading 0 would claim a mechanism that does not exist. The sixth tile is
 *    ECOSYSTEM REPORTS: 8 published reports including the Blueprint, with a
 *    real 30-day window and a real page to open.
 *
 * 2. "Capabilities by Category", seven categories. directory_certifications has
 *    cert_name, cert_value and vertical — no category column and no taxonomy,
 *    just 30 flat names. Seven categories cannot be drawn without inventing the
 *    mapping. The bars keep the comp's shape and rank the real names by how
 *    many organizations hold each, and the heading says exactly that.
 *
 * 3. "Top Capabilities in Demand". directory_company_needs has 0 rows, so
 *    nothing on this platform records demand at all. The card ranks the other
 *    real thing — which organizations hold the most capabilities — under a
 *    heading that says supply, not demand.
 *
 * 4. The "Verified" badge on every Recent Organizations row. Verification lives
 *    on directory_company_profile.verification, which defaults to 'unverified',
 *    and not one of the 164 has been through review. VerifiedBadge already
 *    renders null when not verified, which is the honest behaviour; the row
 *    shows the join date instead and one line under the card says why no badge
 *    is there. The day an admin verifies one, its badge appears by itself.
 *
 * ---------------------------------------------------------------------------
 * THE ONE CONTROL, AND WHY IT IS NOT A DATE PICKER
 * ---------------------------------------------------------------------------
 * The comp puts "May 1 - May 31, 2025" top right. A date picker that filters
 * nothing is a button that does nothing, and there is genuinely nothing on this
 * screen a start/end date could filter: five of the six tiles are totals, the
 * donut is a snapshot, the map is a snapshot. What a date range CAN honestly
 * drive is the comparison window under each tile, so that is what the control
 * is: 30 / 90 days / 12 months, re-read from the database on change, with both
 * ends of the comparison moving together so it stays like for like.
 */

/* Which page each card's "View all" opens. Every one of these is a route that
   exists in src/main.jsx today; a card whose destination does not exist yet
   shows no link rather than a dead one. */
const LINKS = {
  organizations: '/organizations',
  directory: '/directory',
  people: '/people',
  reports: '/reports',
  addOrganization: '/add-profile',
  addCapability: '/profile/edit?section=capabilities',
}

const WINDOWS = [
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
  { id: 365, label: '12 months' },
]

/**
 * A card heading on this screen: mixed case, dark, with an optional "View all"
 * hard right. Not CardHeader — that renders `.osv3p-card-title`, the 11px
 * ALL-CAPS treatment the profile screens use, and every heading on this comp is
 * mixed case and dark. `.osv3p-rail-title` is that treatment and already
 * exists. Local to this page on purpose: AdminTools.jsx has the same helper and
 * duplicating four lines beats editing a shared component another agent is
 * building against.
 */
function PanelHead({ title, note, link, to, onLink }) {
  const navigate = useNavigate()
  return (
    <header className="osv3p-card-header osv3-eco-head">
      <h2 className="osv3p-rail-title">
        {title}
        {note ? <span className="osv3p-card-count osv3p-pagehead-sub"> {note}</span> : null}
      </h2>
      {link ? (
        <CardLink onClick={onLink || (to ? () => navigate(to) : undefined)}>{link}</CardLink>
      ) : null}
    </header>
  )
}

/**
 * The delta props for one KPI tile.
 *
 * KpiTile's delta row is a hardcoded GREEN UP-ARROW (KpiTile.jsx:24-28) and the
 * component is shared and frozen this round. It can say "5 added" honestly. It
 * cannot say "82% fewer" honestly — the glyph would contradict the sentence,
 * and Organizations is genuinely down 81% on the previous 30 days. So the bold
 * slot ALWAYS carries the count added, which is never negative, and the muted
 * note carries the direction in words. AdminTools.jsx:56-71 is where this
 * workaround is documented; this is the same one.
 *
 * The two edge cases windowDelta names, both live on this screen right now:
 *   'first' — People. All 73 profiles were created on one day inside the
 *             window, so the prior window is 0 and there is no percentage to
 *             state. Not Infinity, not 100%. "the first on record".
 *   'quiet' — Capabilities. 0 added this window against 10 before it. A real
 *             -100% that reads as the platform losing its capabilities, so the
 *             count is printed and the percentage is not.
 */
function deltaProps(metric, days, noun = 'new') {
  const span = days === 365 ? '12 months' : `${days} days`
  if (!metric || metric.added == null || metric.prior == null) return { delta: null, deltaNote: null }
  const d = windowDelta(metric.added, metric.prior)
  if (d.direction === 'none') return { delta: null, deltaNote: null }
  /* A window that added nothing still gets the row. 0 is a measurement, an
     arrow beside a 0 claims nothing, and — the load-bearing half — the
     stylesheet reserves this row's height so all six numbers and all six notes
     sit on one baseline. Drop it on two tiles and the strip reads as a broken
     grid, which is the exact defect the reserved height exists to prevent. */
  if (d.direction === 'quiet') return { delta: '0', deltaNote: `${noun} in ${span}` }
  const trend = d.direction === 'first'
    ? 'the first on record'
    : d.direction === 'flat'
      ? 'level'
      : `${d.direction} ${d.percent}%`
  return { delta: formatCount(d.added), deltaNote: `${noun} in ${span} · ${trend}` }
}

export default function OSEcosystemOverview() {
  const navigate = useNavigate()
  const [days, setDays] = useState(WINDOW_DAYS)
  const [stats, setStats] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => { document.title = 'Ecosystem Overview | SpaceOS' }, [])

  // The repo's cancellation convention is a local flag, not AbortController
  // (AdminUsers.jsx:114-132, ProfilePerson.jsx:158-182).
  useEffect(() => {
    let live = true
    setStats(null)
    loadEcosystemOverview({ windowDays: days }).then((next) => { if (live) setStats(next) })
    return () => { live = false }
  }, [days, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const go = useCallback((to) => () => navigate(to), [navigate])

  const loading = !stats
  const disconnected = stats && !stats.ok

  /* --- the six tiles ----------------------------------------------------- *
   * Five real counts and one derived one, in the comp's order. Every tile
   * either has a number behind it or is not on the screen.                  */
  const kpis = useMemo(() => {
    if (!stats?.ok) return []
    const m = stats.metrics
    return [
      { id: 'orgs', icon: 'building', label: 'Organizations', metric: m.organizations },
      { id: 'people', icon: 'users', label: 'People', metric: m.people },
      { id: 'capabilities', icon: 'shield-check', label: 'Capabilities', metric: m.capabilities },
      { id: 'az-orgs', icon: 'org-check', label: 'Arizona Organizations', metric: m.arizonaCompanies },
      /* "new" would be wrong on this one: the count is of CITIES that were not
         on the map before, not of organizations. A place is new on the date its
         first organization registered. */
      { id: 'az-cities', icon: 'location', label: 'Arizona Cities', metric: m.arizonaLocations, noun: 'first placed' },
      { id: 'reports', icon: 'file', label: 'Ecosystem Reports', metric: m.reports, noun: 'published' },
    ].map((k) => {
      const value = k.metric ? formatCount(k.metric.total) : null
      if (value == null) {
        return { ...k, value: 'Not read', delta: null, deltaNote: 'this figure could not be counted' }
      }
      return { ...k, value, ...deltaProps(k.metric, days, k.noun) }
    })
  }, [stats, days])

  const t = stats?.ok ? stats : null
  const donutTotal = t?.orgTypes?.typed || 0
  const spanWord = days === 365 ? '12 months' : `${days} days`

  return (
    <div className="osv3p-screen osv3p-screen--profile osv3-eco">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Ecosystem Overview</h1>
          <p className="osv3p-pagehead-sub">Real-time snapshot of Arizona&rsquo;s commercial space ecosystem.</p>
        </div>
        {/* The comp's date control. It changes what every "new in ___" line
            underneath is measured against, and re-reads the database — see the
            header note on why it is a window and not a start/end picker. */}
        <div className="osv3-eco-window">
          <span className="osv3-eco-window-label" id="eco-window-label">
            <Icon name="calendar" />
            Compared against
          </span>
          <div className="osv3p-seg" role="group" aria-labelledby="eco-window-label">
            {WINDOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                className={`osv3p-seg-btn ${days === w.id ? 'osv3p-seg-btn--on' : ''}`}
                aria-pressed={days === w.id}
                onClick={() => setDays(w.id)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {loading ? (
        <EmptyState
          icon="clock"
          title="Counting the ecosystem"
          body="Reading organizations, people, capabilities and locations straight from the database. Nothing on this screen is shown until every figure has been counted, so no number here is ever a stale one."
        />
      ) : disconnected ? (
        <EmptyState
          icon="signal"
          title="This build cannot reach the platform database"
          body="Every figure on this page is counted live, and this copy of the site has no database connection configured, so there is nothing honest to show. The screen itself is fine — point it at the platform and the numbers appear."
          action={<Button variant="quiet" onClick={retry}>Try again</Button>}
        />
      ) : (
        <>
          <div className="osv3p-kpi-row osv3-eco-kpis">
            {kpis.map((k) => (
              <KpiTile
                key={k.id}
                icon={k.icon}
                label={k.label}
                value={k.value}
                delta={k.delta}
                deltaNote={k.deltaNote}
              />
            ))}
          </div>

          <div className="osv3p-grid osv3-eco-thirds">
            {/* ---------------- Organizations by Type ---------------- */}
            <Card>
              <PanelHead title="Organizations by Type" />
              <CardBody>
                {!t.orgTypes.ok ? (
                  <EmptyState
                    icon="building"
                    title="No organization has a type on record"
                    body="Type is set from Admin Tools, or derived in bulk by scripts/backfill-org-type.mjs. The chart draws itself the moment the first one is set."
                  />
                ) : (
                  <>
                    <div className="osv3p-donut">
                      <DonutChart segments={t.orgTypes.segments} total={donutTotal} totalLabel="Typed" />
                      <DonutLegend segments={t.orgTypes.segments} total={donutTotal} />
                    </div>
                  </>
                )}
              </CardBody>
              {/* The comp puts the "View all" of the three chart cards at the
                  BOTTOM of the card, not in the header, and CardBody's flex:1
                  pins it there. The caption above it is the honest reading of a
                  ring dominated by one arc: 87% Private Company is not a
                  rounding of the comp's 51%, it is what a business directory
                  actually contains. */}
              {t.orgTypes.ok ? (
                <div className="osv3-eco-foot">
                  <p className="osv3-eco-note">
                    Each type is derived from the organization&rsquo;s own name and website domain, and
                    stores the rule that produced it so an admin can audit and correct it.
                    &lsquo;Other&rsquo; means the signals did not identify one.
                    {t.orgTypes.notCovered > 0
                      ? ` ${formatCount(t.orgTypes.notCovered)} have no type on record yet.`
                      : ''}
                  </p>
                  <CardLink onClick={go(LINKS.organizations)}>View all organizations</CardLink>
                </div>
              ) : null}
            </Card>

            {/* ---------------- Capabilities ---------------- */}
            <Card>
              <PanelHead
                title="Most Held Capabilities"
                note={t.capabilities.ok ? `${t.capabilities.distinct} recorded` : null}
              />
              <CardBody>
                {!t.capabilities.ok ? (
                  <EmptyState
                    icon="shield-check"
                    title="No capabilities recorded yet"
                    body="Every certification and capability an organization adds to its profile is counted here, ranked by how many organizations hold it."
                  />
                ) : (
                  <>
                    <div className="osv3-eco-bars">
                      {t.capabilities.rows.map((row) => (
                        <div className="osv3-eco-bar-row" key={row.id}>
                          <span className="osv3-eco-bar-label" title={row.label}>{row.label}</span>
                          <Bar pct={row.pct} label={`${row.label}, held by ${row.count} organizations`} />
                          <span className="osv3-eco-bar-value">{formatCount(row.count)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardBody>
              {/* The comp reads "Capabilities by Category". There is no category
                  column and no taxonomy on this table — 30 flat names — so the
                  axis is what is actually stored, and the heading and this line
                  both say so. */}
              {t.capabilities.ok ? (
                <div className="osv3-eco-foot">
                  <p className="osv3-eco-note">
                    Organizations holding each capability. Capabilities are not grouped into
                    categories on this platform, so these are the individual certifications on record.
                  </p>
                  <CardLink onClick={go(LINKS.directory)}>Browse the directory</CardLink>
                </div>
              ) : null}
            </Card>

            {/* ---------------- Region map ---------------- */}
            <Card>
              <PanelHead title="Organizations by Region" note="(Arizona)" />
              <CardBody>
                {!t.places.ok ? (
                  <EmptyState
                    icon="location"
                    title="No Arizona locations on record"
                    body="Each organization's city places it on this map as soon as it registers."
                  />
                ) : (
                  <>
                    <MapPanel
                      markers={t.places.markers}
                      highlight={['AZ']}
                      viewBox="0 0 960 420"
                      ariaLabel={`Arizona, with a marker on each of the ${t.places.markers.length} cities that has a member organization`}
                    />
                    {/* MapPanel draws state outlines and unlabelled pins — it is
                        a locator, not a street map, and it takes no count prop.
                        The comp puts the number inside the bubble; here it sits
                        in the list, which is also the only place a reader can
                        tell Tempe from Mesa at this scale. */}
                    <ul className="osv3-eco-places">
                      {t.places.rows.slice(0, 6).map((p) => (
                        <li className="osv3-eco-place" key={p.key}>
                          <span className="osv3-eco-place-name">
                            {p.marker ? null : <Icon name="cross" />}
                            {p.label}
                          </span>
                          <b>{formatCount(p.count)}</b>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardBody>
              {t.places.ok ? (
                <div className="osv3-eco-foot">
                  <p className="osv3-eco-note">
                    {formatCount(t.places.placed)} of {formatCount(t.places.arizonaTotal)} Arizona
                    organizations are placed, across {t.places.cities}{' '}
                    {t.places.cities === 1 ? 'city' : 'cities'}. The Phoenix metro reads as one cluster
                    because it is one.
                    {t.places.unplaceable > 0
                      ? ` ${formatCount(t.places.unplaceable)} did not name a city.`
                      : ''}
                    {t.places.unmapped.length > 0
                      ? ` No coordinates on file for ${t.places.unmapped.map((u) => u.label).join(', ')}.`
                      : ''}
                  </p>
                  <CardLink onClick={go(LINKS.organizations)}>View all organizations</CardLink>
                </div>
              ) : null}
            </Card>
          </div>

          <div className="osv3p-grid osv3-eco-thirds">
            {/* ---------------- Recent Organizations ---------------- */}
            <Card>
              <PanelHead title="Recent Organizations" link="View all" to={LINKS.organizations} />
              <CardBody>
                {!t.recentOrganizations.rows.length ? (
                  <EmptyState
                    icon="building"
                    title="No organizations yet"
                    body="Each one arrives here with its type, city and join date the moment it registers."
                  />
                ) : (
                  <ul className="osv3-eco-orgs">
                    {t.recentOrganizations.rows.map((r) => (
                      <li className="osv3-eco-org" key={r.id}>
                        <LogoTile name={r.name} size="sm" />
                        <div className="osv3-eco-org-text">
                          <button
                            type="button"
                            className="osv3-eco-org-name"
                            onClick={() => navigate(`/${r.slug}`)}
                          >
                            {r.name}
                          </button>
                          <div className="osv3p-iconlist-sub">
                            {[r.type, r.location].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <span className="osv3-eco-org-meta">
                          {/* Renders null for every row today, by design —
                              nothing has been verified. It appears by itself
                              the day one is. */}
                          <VerifiedBadge verified={r.verified} />
                          <span className="osv3p-iconlist-time">{formatRelative(r.createdAt, stats.readAt.getTime())}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
              {t.recentOrganizations.rows.length && t.recentOrganizations.verifiedCount === 0 ? (
                <p className="osv3-eco-note">
                  No organization has completed verification yet, so no verified badge appears on any row.
                </p>
              ) : null}
            </Card>

            {/* ---------------- Ecosystem Activity ---------------- */}
            <Card>
              <PanelHead title="Ecosystem Activity" />
              <CardBody>
                {!t.activity.items.length ? (
                  <EmptyState
                    icon="clock"
                    title="Nothing recorded yet"
                    body="Approvals and directory listing changes land here the moment they happen, newest first."
                  />
                ) : (
                  /* Two lines per row, not three: the sentence, then the
                     time. Splitting the company name and the verb across
                     `title` and `sub` made every row 3 lines and this card 90px
                     taller than the two beside it, which is what pulled the
                     whole row's cards out of proportion. The comp's rows are
                     the sentence and the time. */
                  <IconList
                    items={t.activity.items.map((e) => ({
                      id: e.id,
                      icon: e.icon,
                      title: <><b>{e.subject}</b> {e.verb}</>,
                      time: formatRelative(e.at, stats.readAt.getTime()),
                    }))}
                  />
                )}
              </CardBody>
              {/* The comp's feed says things like "Tim Struck connected with 5
                  new organizations". Nothing on this platform records that. The
                  ONE event stream that exists is the moderation log, and this
                  line names it rather than letting an approval read as an
                  organization spontaneously joining. */}
              <p className="osv3-eco-note">
                Approvals and listing changes from the directory&rsquo;s own record. Member activity
                — connections, messages, saves — is not recorded on this platform.
              </p>
            </Card>

            {/* ---------------- Capability leaders ---------------- */}
            <Card>
              <PanelHead title="Most Certified Organizations" link="View all" to={LINKS.directory} />
              <CardBody>
                {!t.leaders.rows.length ? (
                  <EmptyState
                    icon="shield-check"
                    title="No capabilities recorded yet"
                    body="Organizations are ranked here by how many certifications they hold."
                  />
                ) : (
                  <ol className="osv3-eco-rank">
                    {t.leaders.rows.map((r, i) => (
                      <li className="osv3-eco-rank-row" key={r.id}>
                        <span className="osv3-eco-rank-num">{i + 1}</span>
                        <button
                          type="button"
                          className="osv3-eco-rank-name"
                          onClick={() => navigate(`/${r.slug}`)}
                        >
                          {r.name}
                        </button>
                        <b>{formatCount(r.count)}</b>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
              {/* The comp reads "Top Capabilities in Demand".
                  directory_company_needs has 0 rows — nothing here records
                  demand — so this ranks supply and says so. */}
              <p className="osv3-eco-note">
                Ranked by capabilities held. What the ecosystem is looking FOR is not recorded on this
                platform yet.
              </p>
            </Card>
          </div>

          {/* ---------------- Grow the Ecosystem ---------------- */}
          <section className="osv3-eco-banner">
            <span className="osv3-eco-banner-icon"><Icon name="user-plus" /></span>
            <div className="osv3-eco-banner-text">
              <h2 className="osv3-eco-banner-title">Grow the Ecosystem</h2>
              <p className="osv3-eco-banner-body">
                Add an organization or list what yours can do, and it appears on this page the next
                time it loads.
              </p>
            </div>
            {/* The comp has three buttons. "Invite Connections" is not one of
                them here: there is no invitation flow, no connections table and
                no /connections query on this platform, so the button would have
                nowhere to go. Two buttons that work beat three where one is a
                decoration. */}
            <div className="osv3-eco-banner-actions">
              <Button icon="building" variant="secondary" onClick={go(LINKS.addOrganization)}>
                Add Organization
              </Button>
              <Button icon="plus" variant="secondary" onClick={go(LINKS.addCapability)}>
                Add Capability
              </Button>
            </div>
          </section>

          {/* One line, so nobody has to guess which numbers to trust. */}
          <p className="osv3p-footnote">
            Live: every figure counted in the database at{' '}
            {stats.readAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}, compared
            against the previous {spanWord}. Organizations counts the live directory, so an application
            still awaiting approval is not in these figures
            {stats.failures.length ? `. Could not read: ${stats.failures.join(', ')}` : ''}.
          </p>
        </>
      )}
    </div>
  )
}
