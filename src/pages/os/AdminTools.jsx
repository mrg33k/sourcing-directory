import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card, CardBody, CardFooter, CardLink,
  Tabs, Pill, LogoTile, Icon,
  KpiTile, LineChart, DonutChart, DonutLegend, DataTable, IconList,
  Button, ButtonRow, EmptyState,
} from '../../components/osv3/index.js'
import { ADMIN_FIXTURE } from '../../lib/profileFixtures.js'
import AdminUsers from './AdminUsers.jsx'
import AdminBlueprint from './AdminBlueprint.jsx'
import AdminSubscribers from './AdminSubscribers.jsx'
import { useAdmin } from '../../hooks/useAdmin.js'
import {
  loadAdminStats, emptyAdminStats, windowDelta, formatCount, formatDate, WINDOW_DAYS,
} from '../../lib/adminStats.js'
import '../../styles/osv3-profile.css'

/**
 * Admin Tools — the DASHBOARD tab, reading the live platform.
 *
 * Every number on this screen is counted in the database at load. The fixture
 * that used to supply them (ADMIN_FIXTURE) still supplies the COPY — the title,
 * the tab set, the KPI labels, the column headers, the quick actions — because
 * that copy is the approved design and is transcribed from the reference PNG.
 * What it no longer supplies is a single figure. Numbers come from
 * `src/lib/adminStats.js`; words come from the design and from this file.
 *
 * Accent: the screen wears `osv3p-screen--admin`, which repoints
 * --p-screen-accent at the existing --v3-link blue. That is the design — the
 * management surface's own tabs and buttons are blue while the shared navy
 * sidebar keeps the rust accent (design-decisions.md D2). Nothing here sets a
 * colour, a size, or a position directly: no inline styles anywhere, every
 * value comes from a class in src/styles/osv3-profile.css reading a --v3-* token.
 *
 * ---------------------------------------------------------------------------
 * THE ASK, AND WHY IT IS A FEATURE OF THIS SCREEN
 * ---------------------------------------------------------------------------
 * Some of what the design asks for has no column behind it yet. Capability
 * submissions is the clearest: no capability table in this database has a
 * status, a submitted_at or a reviewer, so there is no queue to count. A dash
 * would look broken; a 0 would be a lie that says "the queue is empty" when the
 * truth is "there is no queue".
 *
 * So those places run the ASK treatment (`AskForData` below), and it is built
 * to look intended rather than failed:
 *   - it names WHAT the tile measures, in the user's terms
 *   - it says plainly that nothing is recorded yet
 *   - it gives the one next step that would make the number real
 * It reuses `EmptyState`, whose dashed rule already reads across this design
 * system as "a space waiting to be filled" rather than "something went wrong",
 * so three of them on one dashboard still compose as a finished screen.
 *
 * The rule for choosing: a real zero is a NUMBER (nothing is waiting for review
 * today is a fact worth printing), and a missing mechanism is an ASK. They are
 * never rendered the same way.
 *
 * ---------------------------------------------------------------------------
 * THE DELTA ARROW IS GREEN AND POINTS UP, SO IT ONLY EVER COUNTS ADDITIONS
 * ---------------------------------------------------------------------------
 * KpiTile's delta row is a hardcoded green up-arrow (the component is shared and
 * frozen this round). It can say "6 added" honestly. It cannot say "82% fewer"
 * honestly — the glyph would contradict the sentence. So the bold slot ALWAYS
 * carries the count ADDED in the last 30 days, which is never negative, and the
 * muted note carries the comparison against the 30 days before it, in words.
 *
 * Every tile gets the row, including the ones that added nothing ("0 added in
 * the last 30 days"). Two reasons, and the second is the load-bearing one:
 *   - 0 added is a fact, and an arrow beside a 0 claims nothing.
 *   - the stylesheet reserves two lines on the delta AND two on the link so all
 *     five "View all ->" links land on one baseline. That only holds if every
 *     tile has the row. Dropping it on three tiles floats their links 60px up
 *     and the KPI strip reads as a broken grid — which is precisely the defect
 *     the reserved heights were added to fix.
 *
 * ---------------------------------------------------------------------------
 * STATES
 * ---------------------------------------------------------------------------
 *   (default)      live — counted at load
 *   ?state=empty   the design state for a platform with nothing in it yet.
 *                  Kept, and now driven by a real-shaped zeroed payload rather
 *                  than fixture numbers, so reviewing the empty design never
 *                  means reading numbers that could be mistaken for live ones.
 *   ?state=loading the in-flight state, held open for review
 *
 * There is deliberately no notFound: this screen does not address a record. A
 * build with no database connection gets its own state, because "we cannot read
 * the platform" and "the platform is empty" are different sentences.
 * ---------------------------------------------------------------------------
 */

const TABS_LABEL = 'Admin sections'

/* ADMIN_FIXTURE reads "View verification"; the reference PNG and
   reference/measurements-admin.json both read "View verifications" (verified on
   a 3x crop of the fifth KPI tile). The fixture is a shared file this screen
   does not own, so the correction lands here and is on the handoff list. */
const KPI_LINK_CORRECTIONS = { verified: 'View verifications' }

/* Which tab each KPI's "View all ->" opens. The link then does something real —
   it moves the screen — instead of being a href to nowhere. */
const KPI_TAB = {
  users: 'users',
  orgs: 'organizations',
  capabilities: 'content',
  locations: 'organizations',
  verified: 'verification',
}

/* What each unbuilt tab will hold. One honest sentence each beats one generic
   "coming soon" repeated seven times — an admin should be able to tell from the
   empty panel whether this is the tab they wanted. */
/* Users is BUILT — see AdminUsers.jsx. It is off this list on purpose: a promise
   left next to a delivered screen is how the next reader learns the wrong thing. */
const TAB_PROMISES = {
  organizations: 'The organization directory: create, merge, transfer ownership, archive.',
  verification: 'The verification queue — evidence, reviewer notes, approve or reject.',
  content: 'Submitted capabilities, listings and resources awaiting an editor.',
  activity: 'The full system log this dashboard summarises, searchable and filterable.',
  settings: 'Platform configuration: roles, domains, notifications, data retention.',
}

const VERIFICATION_LABELS = {
  verified: 'Verified',
  pending: 'Pending Review',
  unverified: 'Unverified',
  rejected: 'Rejected',
}

/**
 * A card heading on this screen: mixed case, dark, with an optional muted note
 * on the same baseline and an optional "View all ->" hard right.
 *
 * Not CardHeader, on purpose. CardHeader renders `.osv3p-card-title`, which is
 * the 11px ALL-CAPS treatment the two profile screens use. Every heading on the
 * admin reference is mixed case and dark ("Platform Activity", "Recent
 * Organizations", "Pending Items"), which is `.osv3p-rail-title`. The pairing
 * below also lands the measured spacing exactly: `.osv3p-card-header` (12px)
 * plus `.osv3p-rail-title` (12px) = the 24px the reference measures from the
 * heading to the first content row, and the rail cards' own 12 + 8 = 20px.
 *
 * The note carries two classes because it needs weight 400 from
 * `.osv3p-card-count` and 13px/muted from `.osv3p-pagehead-sub`; neither has
 * both, and adding a class would mean editing a shared stylesheet.
 */
function PanelHead({ title, note, link, onLink }) {
  return (
    <header className="osv3p-card-header">
      <h2 className="osv3p-rail-title">
        {title}
        {note ? <span className="osv3p-card-count osv3p-pagehead-sub"> {note}</span> : null}
      </h2>
      {link ? <CardLink onClick={onLink}>{link}</CardLink> : null}
    </header>
  )
}

/**
 * The ASK. Not an error, not a spinner, not a dash: the tile states what it
 * measures, that the platform records nothing for it yet, and the one step that
 * would change that. See the header note for when this is used instead of a
 * number.
 */
function AskForData({ icon = 'signal', measures, why, cta, ctaIcon, onCta }) {
  return (
    <EmptyState
      icon={icon}
      title={measures}
      body={why}
      action={cta ? <Button icon={ctaIcon} variant="quiet" onClick={onCta}>{cta}</Button> : null}
    />
  )
}

/** The delta props for one KPI tile. See the header note on the arrow. */
function deltaProps(added, prior) {
  const d = windowDelta(added, prior)
  if (d.direction === 'none') return { delta: null, deltaNote: null }
  if (d.direction === 'quiet') return { delta: '0', deltaNote: `added in the last ${WINDOW_DAYS} days` }
  const trend = d.direction === 'first'
    ? 'the first on record'
    : d.direction === 'flat'
      ? 'level'
      : `${d.direction} ${d.percent}%`
  return { delta: formatCount(d.added), deltaNote: `new in ${WINDOW_DAYS} days · ${trend}` }
}

export default function AdminTools() {
  const a = ADMIN_FIXTURE
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const previewState = params.get('state') === 'empty'
    ? 'empty'
    : params.get('state') === 'loading' ? 'loading' : null
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState(previewState === 'empty' ? emptyAdminStats() : null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const previous = document.title
    document.title = `${a.title} | SpaceOS`
    return () => { document.title = previous }
  }, [a.title])

  useEffect(() => {
    if (previewState === 'empty') { setStats(emptyAdminStats()); return undefined }
    if (previewState === 'loading') { setStats(null); return undefined }
    let live = true
    setStats(null)
    loadAdminStats().then((next) => { if (live) setStats(next) })
    return () => { live = false }
  }, [previewState, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const openTab = useCallback((id) => () => setTab(id), [])

  /* --- KPI tiles: fixture copy, live values ------------------------------ */
  const kpis = useMemo(() => {
    if (!stats?.ok) return []
    const { metrics, locations, verification } = stats
    const values = {
      users: metrics.users,
      orgs: metrics.organizations,
      capabilities: metrics.capabilities,
      locations: locations.ok ? locations : null,
      verified: metrics.verified,
    }
    return a.kpis.map((k) => {
      const m = values[k.id]
      const label = KPI_LINK_CORRECTIONS[k.id] || k.linkLabel
      if (!m) {
        // A read that failed. Say so and offer the only useful action.
        return { ...k, value: 'Not read', delta: null, deltaNote: null, linkLabel: 'Try again', onLink: retry }
      }
      /* Locations counts a place as new on the date its FIRST organization
         registered — see distinctLocations(). A city that already had a company
         is never new again, so a place cannot be added twice. */
      const delta = deltaProps(m.added, m.prior)
      /* Verification has never been run: the useful link is the one that starts
         it, not one that lists an empty result. */
      const linkLabel = k.id === 'verified' && verification.recorded === false
        ? 'Start verification'
        : label
      return { ...k, value: formatCount(m.total), ...delta, linkLabel, onLink: openTab(KPI_TAB[k.id]) }
    })
  }, [stats, a.kpis, retry, openTab])

  /* --- Recent Organizations --------------------------------------------- */
  const tableRows = useMemo(() => (stats?.recentOrganizations?.rows || []).map((r) => ({
    id: r.id,
    cells: {
      organization: (
        <div className="osv3p-table-org">
          <LogoTile name={r.name} size="sm" />
          <div>
            <div className="osv3p-iconlist-title">{r.name}</div>
            {r.sub ? <div className="osv3p-iconlist-sub">{r.sub}</div> : null}
          </div>
        </div>
      ),
      location: r.location,
      status: (
        <Pill status tone={r.verification}>
          {VERIFICATION_LABELS[r.verification] || VERIFICATION_LABELS.unverified}
        </Pill>
      ),
      since: formatDate(r.createdAt),
      actions: (
        <button type="button" className="osv3p-icon-btn" aria-label={`Actions for ${r.name}`}>
          <Icon name="dots" />
        </button>
      ),
    },
  })), [stats])

  /* --- Platform Activity ------------------------------------------------- */
  const series = useMemo(() => {
    const points = stats?.activity?.points || {}
    return a.platformActivity.series
      .filter((s) => Array.isArray(points[s.id]))
      .map((s) => ({ ...s, points: points[s.id] }))
  }, [stats, a.platformActivity.series])

  /**
   * Two series that match on every day draw the same polyline, and the one
   * underneath disappears — the legend then promises three lines and the chart
   * shows two, which reads as a broken chart rather than as a coincidence. It
   * is a coincidence: today every member arrived with an organization, so New
   * Users and New Organizations are the same six days. Nothing is nudged to
   * separate them (that would be drawing a number that is not the number); the
   * chart says so underneath instead, and the sentence disappears by itself the
   * first day the two diverge.
   */
  const overlappingSeries = useMemo(() => {
    for (let i = 0; i < series.length; i += 1) {
      const a1 = series[i].points || []
      if (!a1.some((v) => v > 0)) continue // two flat-zero lines are not news
      for (let j = i + 1; j < series.length; j += 1) {
        const b1 = series[j].points || []
        if (a1.length === b1.length && a1.every((v, k) => v === b1[k])) {
          return [series[i].label, series[j].label]
        }
      }
    }
    return null
  }, [series])

  /* --- Verification split ------------------------------------------------ */
  const verificationSegments = useMemo(() => {
    const v = stats?.verification
    if (!v?.ok) return []
    return a.verificationSplit.segments.map((s) => ({ ...s, value: v[s.id] ?? 0 }))
  }, [stats, a.verificationSplit.segments])

  /* --- Pending Items ----------------------------------------------------- *
   * Fixture order and fixture labels; live values. A null value is a metric the
   * platform has no column for — see the ASK note in the header.              */
  const pendingRows = useMemo(() => {
    const p = stats?.pending
    if (!p) return []
    const byId = {
      'orgs-awaiting': p.organizationsAwaitingVerification,
      'user-registrations': p.registrationsAwaitingApproval,
      'capability-submissions': p.capabilitySubmissions,
      'content-submissions': p.contentSubmissions,
    }
    return a.pendingItems.rows.map((r) => ({ ...r, value: byId[r.id] ?? null }))
  }, [stats, a.pendingItems.rows])

  const pendingTotal = pendingRows.reduce((n, r) => n + (r.value || 0), 0)
  const pendingMeasured = pendingRows.filter((r) => r.value !== null).length

  /* Blueprint and Subscribers are appended here rather than added to
     ADMIN_FIXTURE.tabs: the fixture is a shared file this screen does not own,
     and the tab set is the only thing about it that changes when a new admin
     section ships. Subscribers is global admins only — srw_subscribers is
     tenant-less, so the server (tablePolicy) refuses it to tenant admins; a tab
     that can only error is not rendered. */
  const { isGlobalAdmin } = useAdmin()
  const tabs = useMemo(() => [
    ...a.tabs,
    { id: 'blueprint', label: 'Blueprint' },
    ...(isGlobalAdmin ? [{ id: 'subscribers', label: 'Subscribers' }] : []),
  ], [a.tabs, isGlobalAdmin])

  const activeTab = tabs.find((t) => t.id === tab)
  const loading = !stats
  const disconnected = stats && !stats.ok
  const verification = stats?.verification

  /* A platform that has never had a user, an organization or a capability. The
     chart is drawn for a QUIET platform (30 real zeros is a measurement) but not
     for an EMPTY one — 30 days of zero for a platform that has never had a
     record is a chart about nothing, and the panel says what will fill it. */
  const platformHasRecords = ['users', 'organizations', 'capabilities']
    .some((k) => (stats?.metrics?.[k]?.total || 0) > 0)

  return (
    <div className="osv3p-screen osv3p-screen--admin">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">{a.title}</h1>
          <p className="osv3p-pagehead-sub">{a.subtitle}</p>
        </div>
        <ButtonRow>
          {/* The legacy panel still owns the working management flows (add
              company, uploads, tenant settings). Until the tabs above absorb
              them, the door to it stays one click from the stats. */}
          <Button variant="quiet" onClick={() => navigate('/admin/panel')}>Management panel</Button>
          <Button icon="download" variant="primary">{a.exportCta}</Button>
        </ButtonRow>
      </header>

      <Tabs items={tabs} value={tab} onChange={setTab} label={TABS_LABEL} />

      {tab === 'users' ? (
        <AdminUsers />
      ) : tab === 'blueprint' ? (
        <AdminBlueprint />
      ) : tab === 'subscribers' ? (
        <AdminSubscribers />
      ) : tab !== 'dashboard' ? (
        <EmptyState
          icon="gear"
          title={`${activeTab.label} is not built yet`}
          body={TAB_PROMISES[tab]}
          action={<Button variant="quiet" onClick={() => navigate('/admin/panel')}>Do this in the management panel</Button>}
        />
      ) : loading ? (
        <EmptyState
          icon="clock"
          title="Counting the platform"
          body="Reading users, organizations, capabilities and locations straight from the database. Nothing on this screen is shown until every figure has been counted, so no number here is ever a stale one."
        />
      ) : disconnected ? (
        <EmptyState
          icon="signal"
          title="This build cannot reach the platform database"
          body="Every figure on this dashboard is counted live, and this copy of the site has no database connection configured, so there is nothing honest to show. The screen itself is fine — point it at the platform and the numbers appear."
          action={<Button variant="quiet" onClick={retry}>Try again</Button>}
        />
      ) : (
        <div className="osv3p-admin-body">
          <div className="osv3p-admin-main">
            <div className="osv3p-kpi-row">
              {kpis.map((k) => (
                <KpiTile
                  key={k.id}
                  icon={k.icon}
                  label={k.label}
                  value={k.value}
                  delta={k.delta}
                  deltaNote={k.deltaNote}
                  linkLabel={k.linkLabel}
                  onLink={k.onLink}
                />
              ))}
            </div>

            <div className="osv3p-grid osv3p-grid--halves">
              <Card>
                <PanelHead
                  title={a.platformActivity.heading}
                  note={a.platformActivity.note}
                  link={series.length && platformHasRecords ? a.platformActivity.footerLink : null}
                  onLink={openTab('activity')}
                />
                <CardBody>
                  {!series.length ? (
                    <AskForData
                      icon="signal"
                      measures="Day by day signups, for the last 30 days"
                      why="This chart plots new users, organizations and capabilities against the calendar. Those counts could not be read just now."
                      cta="Try again"
                      onCta={retry}
                    />
                  ) : !platformHasRecords ? (
                    <AskForData
                      icon="signal"
                      measures="Day by day signups, for the last 30 days"
                      why="This chart plots new users, organizations and capabilities against the calendar. It draws itself as soon as the platform has its first week of signups."
                    />
                  ) : (
                    <>
                      <LineChart
                        series={series}
                        xLabels={stats.activity.xLabels}
                        yTicks={stats.activity.yTicks}
                        ariaLabel="New users, new organizations and new capabilities over the last 30 days"
                      />
                      <div className="osv3p-footnote">
                        {stats.activity.events === 0
                          ? `Nothing was added in the last ${WINDOW_DAYS} days, so every day reads zero.`
                          : `${formatCount(stats.activity.events)} added across the last ${WINDOW_DAYS} days, never more than ${formatCount(stats.activity.peak)} on one day.`}
                        {overlappingSeries
                          ? ` ${overlappingSeries[0]} and ${overlappingSeries[1]} match on every one of those days, so their two lines sit exactly on top of each other.`
                          : ''}
                      </div>
                    </>
                  )}
                </CardBody>
              </Card>

              <Card>
                {/* The header link stays the design's short "View all": this
                    heading already wraps to two lines and a longer label wraps
                    with it, leaving an arrow stranded on its own line. The
                    call to action lives under the donut instead, where there is
                    a full card width for it. */}
                <PanelHead
                  title={a.verificationSplit.heading}
                  link={verification?.ok && verification.total ? a.verificationSplit.footerLink : null}
                  onLink={openTab('verification')}
                />
                <CardBody>
                  {!verification?.ok || !verification.total ? (
                    <AskForData
                      icon="shield"
                      measures="Organizations by verification status"
                      why="Once organizations register, this splits them into verified, pending review, unverified and rejected so the queue is visible at a glance."
                    />
                  ) : (
                    <>
                      <div className="osv3p-donut">
                        <DonutChart
                          segments={verificationSegments}
                          total={verification.total}
                          totalLabel={a.verificationSplit.totalLabel}
                        />
                        <DonutLegend segments={verificationSegments} total={verification.total} />
                      </div>
                      {/* The truthful reading of a single full ring. Without this
                          line, 100% unverified looks like a verdict; it is the
                          absence of one. */}
                      {verification.recorded === false ? (
                        <div className="osv3p-footnote">
                          No organization has been through verification yet, so all {formatCount(verification.total)} sit at the default.
                          Verifying one records who checked it and when.{' '}
                          <CardLink onClick={openTab('verification')}>Start verification</CardLink>
                        </div>
                      ) : null}
                    </>
                  )}
                </CardBody>
              </Card>
            </div>

            <Card>
              <PanelHead
                title={a.recentOrganizations.heading}
                link={tableRows.length ? a.recentOrganizations.footerLink : null}
                onLink={openTab('organizations')}
              />
              <CardBody>
                {!tableRows.length ? (
                  <AskForData
                    icon="building"
                    measures="The five most recently joined organizations"
                    why="Each one arrives here with its location, verification status and join date the moment it registers."
                    cta="Add new organization"
                    ctaIcon="plus"
                    onCta={openTab('organizations')}
                  />
                ) : (
                  <DataTable columns={a.recentOrganizations.columns} rows={tableRows} />
                )}
              </CardBody>
              {tableRows.length ? (
                /* The reference draws this link centred under a full-width
                   hairline, below the last table row — which is exactly what
                   `.osv3p-footnote` is: rule on top, centred, 16px of air. */
                <div className="osv3p-footnote">
                  <CardLink onClick={openTab('organizations')}>{a.recentOrganizations.footerLink}</CardLink>
                </div>
              ) : null}
            </Card>
          </div>

          <aside className="osv3p-admin-rail">
            <Card>
              <h2 className="osv3p-rail-title">{a.pendingItems.heading}</h2>
              <CardBody>
                {pendingRows.map((r) => (
                  <div className="osv3p-rail-row" key={r.id}>
                    <span>{r.label}</span>
                    {r.value === null ? (
                      /* Not a number, because there is no mechanism to count.
                         Muted and lower-case so it never masquerades as one. */
                      <b><span className="osv3p-pagehead-sub">Not recorded</span></b>
                    ) : (
                      <b>{formatCount(r.value)}</b>
                    )}
                  </div>
                ))}
              </CardBody>
              <CardFooter>
                {pendingTotal > 0 ? (
                  <CardLink onClick={openTab('verification')}>{a.pendingItems.footerLink}</CardLink>
                ) : (
                  <span className="osv3p-pagehead-sub">
                    {pendingMeasured
                      ? 'Nothing is waiting for review.'
                      : 'None of these are recorded yet.'}
                  </span>
                )}
              </CardFooter>
            </Card>

            <Card>
              <h2 className="osv3p-rail-title">{a.recentActivity.heading}</h2>
              <CardBody>
                {!stats.recentActivity.items.length ? (
                  <AskForData
                    icon="clock"
                    measures="Registrations, verifications and edits"
                    why="Each one lands here the moment it happens, newest first."
                  />
                ) : (
                  <IconList
                    items={stats.recentActivity.items.map((e) => ({
                      id: e.id,
                      icon: e.kind === 'organization' ? 'building' : 'user-plus',
                      title: e.kind === 'organization' ? 'New organization registered' : 'New profile published',
                      sub: e.subject,
                      time: e.time,
                    }))}
                  />
                )}
              </CardBody>
              {stats.recentActivity.items.length ? (
                <CardFooter><CardLink onClick={openTab('activity')}>{a.recentActivity.footerLink}</CardLink></CardFooter>
              ) : null}
            </Card>

            <Card>
              <h2 className="osv3p-rail-title">{a.quickActions.heading}</h2>
              <CardBody>
                <div className="osv3p-quick">
                  {a.quickActions.items.map((q) => (
                    <button type="button" className="osv3p-quick-item" key={q.id}>
                      <Icon name={q.icon} />
                      {q.label}
                    </button>
                  ))}
                </div>
              </CardBody>
            </Card>
          </aside>
        </div>
      )}

      {/* One line, deliberately. It says which parts of the screen are real, so
          nobody has to guess which numbers to trust. */}
      {stats?.ok && !previewState ? (
        <p className="osv3p-footnote">
          Live: every figure counted in the database at {stats.readAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          {stats.failures.length ? `. Could not read: ${stats.failures.join(', ')}` : ''}
          . Export and the quick actions are not wired yet.
        </p>
      ) : previewState ? (
        <p className="osv3p-footnote">
          Design state preview ({previewState}) — no live figures on this screen.
        </p>
      ) : null}
    </div>
  )
}
