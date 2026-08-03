import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, CardBody, CardFooter, CardLink, CardAction,
  Tabs, Pill, Bar, Icon, StatStrip, DataTable, IconList,
  Button, ButtonRow, EmptyState,
} from '../../components/osv3/index.js'
import { loadBlueprint } from '../../lib/blueprintApi.js'
import { formatCount, formatDate, formatRelative } from '../../lib/adminStats.js'
import '../../styles/osv3-profile.css'
import './osv3-blueprint.css'

/**
 * The Arizona Space Action Blueprint — the client's flagship strategy document,
 * as a working surface rather than a PDF link.
 *
 * ===========================================================================
 * WHY MOST OF THIS SCREEN IS ZERO, AND WHY THAT IS THE FEATURE
 * ===========================================================================
 * The approved comp for this page prints 24 Goals, 78 Initiatives, 128 KPIs and
 * 342 aligned Organizations. Every one of those figures was invented by the tool
 * that generated the comp. The real 40-page Blueprint contains THREE total
 * occurrences of the words goal / initiative / KPI / objective, defines no
 * hierarchy of any of them, and `directory_mission_scores` — the alignment
 * table that already existed — holds seven rows of which zero are companies.
 *
 * So this screen counts the real tables and prints what it finds. Today that is
 * 6 / 0 / 0 / 0 / 0. Under a client's own flagship report, a tile reading 24
 * when the truth is 0 is the fastest way to lose them; a tile reading 0 next to
 * a button that adds the first one is a product.
 *
 * What IS real and IS shown:
 *   - the six strategic priorities, joined to the directory_tags rows that have
 *     always defined them (so the spelling on this page is the platform's
 *     spelling — "Move in Space", not the comp's "Move Through Space")
 *   - the Mobilization Method's six phases, verbatim from the report (Roadmap)
 *   - the four positions and five gaps, verbatim from the report (Overview)
 *   - all eight report PDFs, live from Storage (Documents)
 *   - the ecosystem's real organization count, as the denominator beside the
 *     aligned count and never in place of it
 *
 * ===========================================================================
 * THE HONESTY RULES THIS FILE FOLLOWS
 * ===========================================================================
 *   1. A real zero is a NUMBER. A missing mechanism is an ASK — an EmptyState
 *      naming what would fill it and the one step that does. They never render
 *      the same way. (Same rule as AdminTools.jsx:38-53.)
 *   2. A count that could not be READ is `null`, and renders "Not read" with a
 *      retry — never 0. blueprintApi.js keeps those separate on purpose.
 *   3. Nothing in the right rail prints a number without a table behind it.
 *      Contributors and Total Engagements have no source anywhere in this
 *      database, so they say so rather than showing a plausible figure.
 *   4. No inline styles. Every value comes from a class in osv3-blueprint.css
 *      reading a --v3-* / --p-* token, so the screen stays machine-checkable.
 *
 * Data: blueprint_priorities / _goals / _initiatives / _kpis / _milestones /
 * _findings / _alignments / _activity, plus directory_tags, directory_reports
 * and directory_companies. All tenant-scoped to 'space-rising'.
 * Admin CRUD: Admin Tools -> Blueprint (src/pages/os/AdminBlueprint.jsx).
 */

const TABS_LABEL = 'Blueprint sections'

const STATUS_TONE = {
  complete: 'verified',
  in_progress: 'pending',
  not_started: 'unverified',
  planned: 'unverified',
  proposed: 'unverified',
  active: 'pending',
  on_hold: 'rejected',
}

const STATUS_LABEL = {
  complete: 'Complete',
  in_progress: 'In progress',
  not_started: 'Not started',
  planned: 'Planned',
  proposed: 'Proposed',
  active: 'Active',
  on_hold: 'On hold',
}

/** A KPI with no current_value is named but not yet measured. Not a zero. */
function kpiValue(k) {
  if (k.current_value === null || k.current_value === undefined) return null
  const n = Number(k.current_value)
  if (Number.isNaN(n)) return String(k.current_value)
  if (k.unit === 'percent') return `${n}%`
  if (k.unit === 'currency') return `$${formatCount(n)}`
  return formatCount(n)
}

/**
 * A card heading: mixed case, dark, optional muted note, optional right link.
 * Same pairing AdminTools uses — `.osv3p-card-header` + `.osv3p-rail-title`
 * lands the measured 24px from heading to first row.
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
 * The ASK: what this section measures, that nothing is recorded yet, and the
 * one step that changes it. Never a spinner, never a dash, never a fake row.
 */
function AskForData({ icon = 'grid', measures, why, cta, onCta }) {
  return (
    <EmptyState
      icon={icon}
      title={measures}
      body={why}
      action={cta ? <Button variant="quiet" onClick={onCta}>{cta}</Button> : null}
    />
  )
}

/**
 * One number in a priority card's footer. `null` means the read failed, which
 * is never rendered as 0.
 *
 * `label` is the singular noun and the plural is derived, because "1 Goals" on
 * the card the moment an admin adds their first goal is the first thing they
 * would see and the first thing they would not trust.
 */
function CountChip({ n, label, plural, tone }) {
  const noun = n === 1 ? label : (plural || `${label}s`)
  return (
    <span className={`osv3-bp-count osv3-bp-count--${tone}`}>
      <span className="osv3-bp-count-dot" aria-hidden="true" />
      {n === null ? 'Not read' : `${formatCount(n)} ${noun}`}
    </span>
  )
}

export default function OSBlueprint() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [bp, setBp] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const previous = document.title
    document.title = 'Blueprint | SpaceOS'
    return () => { document.title = previous }
  }, [])

  useEffect(() => {
    let live = true
    setBp(null)
    loadBlueprint().then((next) => { if (live) setBp(next) })
    return () => { live = false }
  }, [attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const openTab = useCallback((id) => () => setTab(id), [])

  const loading = !bp
  const disconnected = bp && !bp.ok

  const priorityName = useMemo(() => {
    const map = {}
    for (const p of bp?.priorities || []) map[p.id] = p.displayName
    return map
  }, [bp])

  /* --- The stat strip. Real counts only; `null` is a failed read. ---------- */
  const statItems = useMemo(() => {
    if (!bp?.ok) return []
    const t = bp.totals
    const say = (n) => (n === null ? 'Not read' : formatCount(n))
    /* Only ONE tile carries a note. Three tiles reading "none added yet" under
       three zeros said nothing the zero had not already said and pushed every
       label onto a fourth line, which is what actually made the strip look
       broken. The zeros are explained once, properly, in the page footnote. */
    return [
      { id: 'priorities', icon: 'layers', value: say(t.priorities), label: 'Strategic Priorities' },
      { id: 'goals', icon: 'check-circle', value: say(t.goals), label: t.goals === 1 ? 'Goal' : 'Goals' },
      { id: 'initiatives', icon: 'rocket', value: say(t.initiatives), label: t.initiatives === 1 ? 'Initiative' : 'Initiatives' },
      { id: 'kpis', icon: 'gauge', value: say(t.kpis), label: 'KPIs' },
      {
        id: 'orgs',
        icon: 'building',
        value: say(t.alignedOrganizations),
        label: t.alignedOrganizations === 1 ? 'Aligned Org' : 'Aligned Orgs',
        /* The only note worth the space: the DENOMINATOR. It is the directory's
           real active-company count and is never shown as the aligned figure. */
        note: t.ecosystemOrganizations === null
          ? null
          : `of ${formatCount(t.ecosystemOrganizations)}`,
      },
    ]
  }, [bp])

  const tabItems = useMemo(() => {
    const t = bp?.totals
    return [
      { id: 'overview', label: 'Overview' },
      { id: 'priorities', label: 'Priorities', count: t?.priorities ?? undefined },
      { id: 'goals', label: 'Goals', count: t?.goals ?? undefined },
      { id: 'initiatives', label: 'Initiatives', count: t?.initiatives ?? undefined },
      { id: 'kpis', label: 'KPIs', count: t?.kpis ?? undefined },
      { id: 'roadmap', label: 'Roadmap', count: bp?.milestones?.length ?? undefined },
      { id: 'documents', label: 'Documents', count: bp?.reports?.length ?? undefined },
    ]
  }, [bp])

  const report = bp?.blueprintReport || null

  /* ======================================================================== */
  /* Shells: head + tabs are always drawn, so the page never flashes empty.    */
  /* ======================================================================== */
  const head = (
    <header className="osv3p-pagehead">
      <div>
        <h1 className="osv3p-pagehead-title">Arizona Space Action Blueprint&trade;</h1>
        <p className="osv3p-pagehead-sub">
          A shared strategy to build a thriving commercial space economy.
        </p>
      </div>
      <ButtonRow>
        <Button
          variant="primary"
          icon="check-circle"
          onClick={() => setAboutOpen((v) => !v)}
        >
          {aboutOpen ? 'Hide the Blueprint' : 'About the Blueprint'}
        </Button>
      </ButtonRow>
    </header>
  )

  if (loading) {
    return (
      <div className="osv3p-screen osv3p-screen--profile osv3-bp">
        {head}
        <EmptyState
          icon="clock"
          title="Reading the Blueprint"
          body="Priorities, goals, initiatives, KPIs and the report library are all counted in the database at load. Nothing is shown until every figure has been counted, so no number on this page is ever a stale one."
        />
      </div>
    )
  }

  if (disconnected) {
    return (
      <div className="osv3p-screen osv3p-screen--profile osv3-bp">
        {head}
        <EmptyState
          icon="signal"
          title="This build cannot reach the platform database"
          body="Every figure on this page is counted live, and this copy of the site has no database connection configured, so there is nothing honest to show. The page itself is fine — point it at the platform and the Blueprint appears."
          action={<Button variant="quiet" onClick={retry}>Try again</Button>}
        />
      </div>
    )
  }

  /* ======================================================================== */
  /* HERO — the dark card. The image already ships at
     public/v2-assets/earth.png (dark on the left, lit limb on the right),
     which is why the copy sits left: it lands on the unlit half at every
     width instead of fighting the terminator.                                */
  /* ======================================================================== */
  const hero = (
    <section className="osv3-bp-hero">
      <div className="osv3-bp-hero-inner">
        <h2 className="osv3-bp-hero-title">The Arizona Space Action Blueprint&trade;</h2>
        <p className="osv3-bp-hero-body">
          Aligning leaders, resources, and opportunities to accelerate Arizona&rsquo;s
          commercial space economy.
        </p>
        {report?.file_url ? (
          <a className="osv3-bp-hero-cta" href={report.file_url} target="_blank" rel="noreferrer">
            <Icon name="download" />
            View full Blueprint document
          </a>
        ) : (
          /* No link rather than a dead one. The report row exists; if its
             file_url is ever cleared this says so instead of 404ing. */
          <p className="osv3-bp-hero-note">
            The Blueprint PDF is not attached to its report record yet.
          </p>
        )}
      </div>
    </section>
  )

  /* ======================================================================== */
  /* PRIORITY CARDS                                                           */
  /* ======================================================================== */
  const priorityCards = (
    <div className="osv3-bp-pri-grid">
      {bp.priorities.map((p) => (
        <article className="osv3-bp-pri" key={p.id}>
          <div className="osv3-bp-pri-head">
            <span className={`osv3-bp-pri-icon osv3-bp-pri-icon--${p.number}`}>
              <Icon name={p.icon} />
            </span>
            <h3 className="osv3-bp-pri-title">{p.number}. {p.displayName}</h3>
          </div>
          {/* The card gets the one-liner. The full sourced paragraph is one
              click away on the Priorities tab, where there is room for it and
              for the citation that makes it checkable. */}
          <p className="osv3-bp-pri-body">{p.blurb || p.summary}</p>
          <div className="osv3-bp-pri-counts">
            <CountChip n={p.counts.goals} label="Goal" tone="a" />
            <CountChip n={p.counts.initiatives} label="Initiative" tone="b" />
            <CountChip n={p.counts.kpis} label="KPI" plural="KPIs" tone="c" />
          </div>
        </article>
      ))}
    </div>
  )

  /* ======================================================================== */
  /* TAB PANELS                                                               */
  /* ======================================================================== */

  const goalsTable = bp.goals.length ? (
    <DataTable
      caption="Every goal recorded under the Blueprint"
      columns={[
        { id: 'code', header: 'Ref' },
        { id: 'title', header: 'Goal' },
        { id: 'priority', header: 'Priority' },
        { id: 'owner', header: 'Owner' },
        { id: 'status', header: 'Status' },
        { id: 'progress', header: 'Progress', align: 'right' },
      ]}
      rows={bp.goals.map((g) => ({
        id: g.id,
        cells: {
          code: <span className="osv3-bp-ref">{g.code || '—'}</span>,
          title: (
            <div>
              <div className="osv3p-iconlist-title">{g.title}</div>
              {g.description ? <div className="osv3p-iconlist-sub">{g.description}</div> : null}
            </div>
          ),
          priority: priorityName[g.priority_id] || '—',
          owner: g.owner || <span className="osv3p-pagehead-sub">Unassigned</span>,
          status: <Pill status tone={STATUS_TONE[g.status]}>{STATUS_LABEL[g.status] || g.status}</Pill>,
          progress: <span className="osv3-bp-pct">{g.progress_pct}%</span>,
        },
      }))}
    />
  ) : null

  /* The report's own read of where the state stands. Nine rows, all verbatim
     from "Where Arizona has a real advantage" (p.17) and "Where Arizona is
     falling short" (p.18).

     Rendered FULL WIDTH, below the two-column body rather than inside its main
     column. Inside it, two columns of findings were squeezed into ~780px and
     ran ~700px tall against a rail that had already ended, which left a void
     down the whole right-hand side. Nine findings want the width, and the rail
     wants something beside it that ends when it does. */
  const findingsCard = (bp.positions.length || bp.gaps.length) ? (
    <Card>
      <PanelHead
        title="Where Arizona Stands"
        note="Straight from the Blueprint's own findings."
      />
      <CardBody>
        <div className="osv3-bp-findings">
          <div className="osv3-bp-findcol">
            <h3 className="osv3-bp-findhead osv3-bp-findhead--up">
              {bp.positions.length} positions where Arizona leads
            </h3>
            {bp.positions.map((f) => (
              <div className="osv3-bp-find" key={f.id}>
                <span className="osv3-bp-find-code osv3-bp-find-code--up">{f.code}</span>
                <div>
                  <div className="osv3-bp-find-title">{f.title}</div>
                  <p className="osv3-bp-find-body">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="osv3-bp-findcol">
            <h3 className="osv3-bp-findhead osv3-bp-findhead--down">
              {bp.gaps.length} gaps holding the ecosystem back
            </h3>
            {bp.gaps.map((f) => (
              <div className="osv3-bp-find" key={f.id}>
                <span className="osv3-bp-find-code osv3-bp-find-code--down">{f.code}</span>
                <div>
                  <div className="osv3-bp-find-title">{f.title}</div>
                  <p className="osv3-bp-find-body">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  ) : null

  const activityCard = (
    <Card>
      <PanelHead
        title="Recent Blueprint Activity"
        link={bp.activity.length ? 'View all activity' : null}
        onLink={openTab('overview')}
      />
      <CardBody>
        {bp.activity.length ? (
          <div className="osv3-bp-feed">
            {bp.activity.slice(0, 4).map((e) => (
              <div className="osv3-bp-feeditem" key={e.id}>
                <span className="osv3-bp-feedicon">
                  <Icon name={e.entity_type === 'kpi' ? 'gauge' : e.entity_type === 'initiative' ? 'rocket' : 'check-circle'} />
                </span>
                <div>
                  <p className="osv3-bp-feedtext">{e.summary}</p>
                  <span className="osv3-bp-feedtime">{formatRelative(e.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AskForData
            icon="clock"
            measures="Every change to the Blueprint, newest first"
            why="Nothing has been recorded yet — this Blueprint has never been edited inside SpaceOS. The moment an admin adds or changes a priority, goal, initiative or KPI in Admin Tools, it lands here with who did it and when."
            cta="Open Admin Tools"
            onCta={() => navigate('/admin-tools')}
          />
        )}
      </CardBody>
    </Card>
  )

  const panels = {
    overview: (
      <>
      <div className="osv3p-admin-body osv3-bp-body">
        <div className="osv3p-admin-main">
          <div className="osv3-bp-toprow">
            {hero}
            <Card className="osv3-bp-statcard">
              <StatStrip items={statItems} />
            </Card>
          </div>

          <Card>
            <PanelHead
              title="Strategic Priorities"
              note="Six pillars guiding Arizona's commercial space future."
              link="View all priorities"
              onLink={openTab('priorities')}
            />
            <CardBody>{priorityCards}</CardBody>
          </Card>

          {/* In the main column, as the comp has it: the rail's third card ends
              below the priorities grid, and this is what sits beside it. */}
          {activityCard}
        </div>

        <aside className="osv3p-admin-rail">
          <Card>
            <h2 className="osv3p-rail-title">Blueprint Summary</h2>
            <CardBody>
              <p className="osv3-bp-railnote">
                A living framework shaped by Arizona leaders and maintained in SpaceOS.
              </p>
              <div className="osv3p-rail-row">
                <span>Blueprint published</span>
                <b>{report?.published_at ? formatDate(report.published_at) : <span className="osv3p-pagehead-sub">Not recorded</span>}</b>
              </div>
              <div className="osv3p-rail-row">
                <span>Content last updated</span>
                <b>{bp.contentTouchedAt ? formatDate(bp.contentTouchedAt) : <span className="osv3p-pagehead-sub">Not recorded</span>}</b>
              </div>
              <div className="osv3p-rail-row">
                <span>Strategic priorities</span>
                <b>{formatCount(bp.totals.priorities)}</b>
              </div>
              <div className="osv3p-rail-row">
                <span>Organizations in the ecosystem</span>
                <b>{bp.totals.ecosystemOrganizations === null
                  ? <span className="osv3p-pagehead-sub">Not read</span>
                  : formatCount(bp.totals.ecosystemOrganizations)}</b>
              </div>
              <div className="osv3p-rail-row">
                <span>Aligned to a priority</span>
                <b>{bp.totals.alignedOrganizations === null
                  ? <span className="osv3p-pagehead-sub">Not read</span>
                  : formatCount(bp.totals.alignedOrganizations)}</b>
              </div>
              {/* Two rows the comp prints numbers for and this database has no
                  column for anywhere. Muted and lower-case so neither can ever
                  be mistaken for a count. */}
              <div className="osv3p-rail-row">
                <span>Contributors</span>
                <b><span className="osv3p-pagehead-sub">Not recorded</span></b>
              </div>
              <div className="osv3p-rail-row">
                <span>Total engagements</span>
                <b><span className="osv3p-pagehead-sub">Not recorded</span></b>
              </div>
            </CardBody>
            {report?.file_url ? (
              <CardFooter>
                <CardLink href={report.file_url}>View summary report</CardLink>
              </CardFooter>
            ) : null}
          </Card>

          <Card>
            <header className="osv3p-card-header">
              <h2 className="osv3p-rail-title">Top Goals by Progress</h2>
              {bp.topGoals.length ? <CardAction onClick={openTab('goals')}>View all</CardAction> : null}
            </header>
            <CardBody>
              {bp.topGoals.length ? (
                <div className="osv3-bp-goals">
                  {bp.topGoals.map((g) => (
                    <div className="osv3-bp-goal" key={g.id}>
                      <div className="osv3-bp-goal-top">
                        <span className="osv3-bp-goal-label">{g.title}</span>
                        <span className="osv3-bp-goal-pct">{g.progress_pct}%</span>
                      </div>
                      <Bar pct={g.progress_pct} label={g.title} />
                    </div>
                  ))}
                </div>
              ) : (
                <AskForData
                  icon="check-circle"
                  measures="The five goals furthest along"
                  why="No goals have been written under the Blueprint yet. Each one ranks itself here as soon as it has a percentage against it."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <h2 className="osv3p-rail-title">Get Involved</h2>
            <CardBody>
              <p className="osv3-bp-railnote">
                Help advance the Blueprint by connecting, contributing, and taking action.
              </p>
              <Button variant="primary" icon="users" block onClick={() => navigate('/directory')}>
                Browse the directory
              </Button>
            </CardBody>
          </Card>
        </aside>
      </div>

      {/* Full width, below the rail: nine findings in two columns were squeezed
          into the ~780px main column and ran ~700px tall against a rail that had
          already ended. */}
      {findingsCard}
      </>
    ),

    priorities: (
      <div className="osv3-bp-prilist">
        {bp.priorities.map((p) => (
          <Card key={p.id}>
            <CardBody>
              <div className="osv3-bp-prirow">
                <span className={`osv3-bp-pri-icon osv3-bp-pri-icon--${p.number}`}>
                  <Icon name={p.icon} />
                </span>
                <div className="osv3-bp-prirow-main">
                  <div className="osv3-bp-prirow-head">
                    <h3 className="osv3-bp-pri-title">{p.number}. {p.displayName}</h3>
                    {p.theme ? <Pill>{p.theme}</Pill> : null}
                  </div>
                  <p className="osv3-bp-pri-body">{p.summary}</p>
                  {/* The cite is the point: every sentence above can be checked
                      against a named section of the real report. */}
                  {p.source_note ? (
                    <p className="osv3-bp-cite">Source: {p.source_note}</p>
                  ) : null}
                  <div className="osv3-bp-pri-counts">
                    <CountChip n={p.counts.goals} label="Goal" tone="a" />
                    <CountChip n={p.counts.initiatives} label="Initiative" tone="b" />
                    <CountChip n={p.counts.kpis} label="KPI" plural="KPIs" tone="c" />
                    <CountChip n={p.counts.organizations} label="Organization" tone="d" />
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
        <p className="osv3p-footnote">
          The six priorities are the platform&rsquo;s own ecosystem categories — this page reads
          their names from the same record the Directory filters use, so the two can never
          disagree. Prose is drawn from the Blueprint report and cited per priority.
        </p>
      </div>
    ),

    goals: (
      <Card>
        <PanelHead title="Goals" note={`${formatCount(bp.goals.length)} recorded`} />
        <CardBody>
          {goalsTable || (
            <AskForData
              icon="check-circle"
              measures="Goals under each of the six strategic priorities"
              why="There are none yet, and the Blueprint report does not define any — across 40 pages it never sets out a goals hierarchy, so nothing has been imported. An admin writes the first one in Admin Tools, picks the priority it sits under, and it appears here and in the counts above within the same minute."
              cta="Add the first goal"
              onCta={() => navigate('/admin-tools')}
            />
          )}
        </CardBody>
      </Card>
    ),

    initiatives: (
      <Card>
        <PanelHead title="Initiatives" note={`${formatCount(bp.initiatives.length)} recorded`} />
        <CardBody>
          {bp.initiatives.length ? (
            <DataTable
              caption="Every initiative recorded under the Blueprint"
              columns={[
                { id: 'title', header: 'Initiative' },
                { id: 'priority', header: 'Priority' },
                { id: 'lead', header: 'Lead organization' },
                { id: 'status', header: 'Status' },
                { id: 'target', header: 'Target', align: 'right' },
              ]}
              rows={bp.initiatives.map((i) => ({
                id: i.id,
                cells: {
                  title: (
                    <div>
                      <div className="osv3p-iconlist-title">{i.title}</div>
                      {i.description ? <div className="osv3p-iconlist-sub">{i.description}</div> : null}
                    </div>
                  ),
                  priority: priorityName[i.priority_id] || '—',
                  lead: i.lead_org || <span className="osv3p-pagehead-sub">Unassigned</span>,
                  status: <Pill status tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status] || i.status}</Pill>,
                  target: i.target_date ? formatDate(i.target_date) : '—',
                },
              }))}
            />
          ) : (
            <AskForData
              icon="rocket"
              measures="The work being run under each goal"
              why="None have been adopted yet. The Blueprint's Phase III does list 32 prioritized tactics across eight lanes — governance, economic development, workforce, defense, commercial, outreach, partnerships and infrastructure — but the report ties them to its four investigation pillars, not to these six priorities, so mapping them across is a decision for Space Rising rather than something to assume. An admin adopts them one at a time in Admin Tools."
              cta="Add the first initiative"
              onCta={() => navigate('/admin-tools')}
            />
          )}
        </CardBody>
      </Card>
    ),

    kpis: (
      <Card>
        <PanelHead title="KPIs" note={`${formatCount(bp.kpis.length)} recorded`} />
        <CardBody>
          {bp.kpis.length ? (
            <DataTable
              caption="Every KPI recorded under the Blueprint"
              columns={[
                { id: 'name', header: 'Measure' },
                { id: 'priority', header: 'Priority' },
                { id: 'current', header: 'Current', align: 'right' },
                { id: 'target', header: 'Target', align: 'right' },
                { id: 'asof', header: 'As of', align: 'right' },
              ]}
              rows={bp.kpis.map((k) => {
                const cur = kpiValue(k)
                return {
                  id: k.id,
                  cells: {
                    name: (
                      <div>
                        <div className="osv3p-iconlist-title">{k.name}</div>
                        {k.source ? <div className="osv3p-iconlist-sub">Source: {k.source}</div> : null}
                      </div>
                    ),
                    priority: priorityName[k.priority_id] || '—',
                    /* A KPI nobody has measured is not a zero. */
                    current: cur === null
                      ? <span className="osv3p-pagehead-sub">Not measured</span>
                      : <span className="osv3-bp-pct">{cur}</span>,
                    target: k.target_value === null || k.target_value === undefined
                      ? '—'
                      : formatCount(Number(k.target_value)),
                    asof: k.as_of ? formatDate(k.as_of) : '—',
                  },
                }
              })}
            />
          ) : (
            <AskForData
              icon="gauge"
              measures="The numbers the Blueprint is judged on"
              why="No KPIs have been defined yet. The report names plenty of figures about Arizona — first nationally in space manufacturing employment, $2.8B of expansion investment, 25+ active ASU missions — but it never sets a target against any of them, and a measure with no target is not a KPI. An admin defines the first one, with its baseline and target, in Admin Tools."
              cta="Add the first KPI"
              onCta={() => navigate('/admin-tools')}
            />
          )}
        </CardBody>
      </Card>
    ),

    roadmap: (
      <Card>
        <PanelHead
          title="The Mobilization Method"
          note="The six-stage framework that produced this Blueprint."
        />
        <CardBody>
          {bp.milestones.length ? (
            <>
              <ol className="osv3-bp-phases">
                {bp.milestones.map((m) => (
                  <li className={`osv3-bp-phase osv3-bp-phase--${m.status}`} key={m.id}>
                    <span className="osv3-bp-phase-code">{m.phase_code || '—'}</span>
                    <div className="osv3-bp-phase-main">
                      <div className="osv3-bp-phase-head">
                        <h3 className="osv3-bp-phase-title">{m.title}</h3>
                        <Pill status tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status] || m.status}</Pill>
                      </div>
                      {m.description ? <p className="osv3-bp-phase-body">{m.description}</p> : null}
                      {m.horizon ? <span className="osv3-bp-phase-horizon">{m.horizon}</span> : null}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="osv3p-footnote">
                Phases and their wording are the report&rsquo;s own. Status follows the report&rsquo;s
                statement of scope: it covers Phases I through IV, Phase V is the work that
                follows it, and Phase VI is what Space Rising measures itself against over the
                next decade. Dated milestones under each phase are added in Admin Tools.
              </p>
            </>
          ) : (
            <AskForData
              icon="calendar"
              measures="The Blueprint's delivery phases"
              why="None are recorded. The six phases of the Mobilization Method are seeded with the Blueprint; if this is empty the seed has not been applied to this environment."
            />
          )}
        </CardBody>
      </Card>
    ),

    documents: (
      <Card>
        <PanelHead
          title="Blueprint Library"
          note={`${formatCount(bp.reports.length)} published`}
        />
        <CardBody>
          {bp.reports.length ? (
            <div className="osv3-bp-docs">
              {bp.reports.map((r) => (
                <article className="osv3-bp-doc" key={r.id}>
                  <span className="osv3-bp-doc-icon"><Icon name="file" /></span>
                  <div className="osv3-bp-doc-main">
                    <h3 className="osv3-bp-doc-title">{r.title}</h3>
                    <div className="osv3-bp-doc-meta">
                      {r.category ? <Pill>{r.category}</Pill> : null}
                      <span className="osv3-bp-doc-date">
                        {r.published_at ? formatDate(r.published_at) : 'Undated'}
                      </span>
                    </div>
                    {r.description ? <p className="osv3-bp-doc-body">{r.description}</p> : null}
                  </div>
                  {r.file_url ? (
                    <Button variant="quiet" icon="download" href={r.file_url}>Open</Button>
                  ) : (
                    <span className="osv3p-pagehead-sub">No file attached</span>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <AskForData
              icon="file"
              measures="Every published Space Rising report"
              why="None are published yet. Reports uploaded through Admin Tools appear here, newest first."
            />
          )}
        </CardBody>
      </Card>
    ),
  }

  return (
    <div className="osv3p-screen osv3p-screen--profile osv3-bp">
      {head}

      {aboutOpen ? (
        <Card className="osv3-bp-about">
          <PanelHead title="About the Blueprint" />
          <CardBody>
            <p className="osv3-bp-about-lead">
              The Arizona Space Action Blueprint is a strategic plan for Arizona&rsquo;s space
              economy, developed from collective input gathered during the 2026 Arizona Space
              Congress workshops together with statewide industry data, and reviewed and curated
              by the Space Rising team. First edition, version 1.0.
            </p>
            <div className="osv3-bp-about-grid">
              <div>
                <h3 className="osv3-bp-about-head">The window</h3>
                <p className="osv3-bp-about-body">
                  Arizona has roughly three to five years to establish itself as one of the
                  nation&rsquo;s defining space economy hubs. The orbital economy is projected to
                  grow from around $630 billion in 2023 to $1.8 trillion by 2035, but the
                  leadership positions are set well before the market reaches full scale.
                </p>
              </div>
              <div>
                <h3 className="osv3-bp-about-head">The constraint</h3>
                <p className="osv3-bp-about-body">
                  Across every workshop the conclusion was the same: Arizona has the capability
                  but not coordinated execution across it. The constraints are no longer
                  technical — they are scale, integration, commercialization, talent retention
                  and execution.
                </p>
              </div>
              <div>
                <h3 className="osv3-bp-about-head">How it is run</h3>
                <p className="osv3-bp-about-body">
                  The Mobilization Method is the six-stage framework that produced this
                  Blueprint and runs the alignment work going forward. Its phases, and where
                  the work currently sits, are on the Roadmap tab.
                </p>
              </div>
            </div>
            <ButtonRow>
              {report?.file_url ? (
                <Button variant="primary" icon="download" href={report.file_url}>
                  Read the full report
                </Button>
              ) : null}
              <Button variant="quiet" onClick={openTab('roadmap')}>See the six phases</Button>
            </ButtonRow>
          </CardBody>
        </Card>
      ) : null}

      <Tabs items={tabItems} value={tab} onChange={setTab} label={TABS_LABEL} />

      <div
        role="tabpanel"
        id={`osv3p-panel-${tab}`}
        aria-labelledby={`osv3p-tab-${tab}`}
        className="osv3-bp-panel"
      >
        {panels[tab]}
      </div>

      <section className="osv3-bp-banner">
        <span className="osv3-bp-banner-icon"><Icon name="users" /></span>
        <div className="osv3-bp-banner-text">
          <h2 className="osv3-bp-banner-title">This Blueprint Works Because We Work Together</h2>
          <p className="osv3-bp-banner-body">
            Join organizations across Arizona building the future of space.
          </p>
        </div>
        {/* Both actions go to routes that exist. The comp's "Invite Connections"
            is dropped rather than wired to a dead link: there is no connections
            table and no invite flow in this product yet. */}
        <ButtonRow>
          <Button variant="quiet" icon="building" onClick={() => navigate('/directory')}>
            Find organizations
          </Button>
          <Button variant="quiet" icon="file" onClick={openTab('documents')}>
            Read the reports
          </Button>
        </ButtonRow>
      </section>

      <p className="osv3p-footnote">
        Live: every figure on this page counted in the database at{' '}
        {bp.readAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        {bp.failures.length ? `. Could not read: ${bp.failures.join(', ')}` : ''}
        . Goals, initiatives and KPIs are zero because none have been written yet — the
        Blueprint report defines none, and nothing here is filled in on its behalf.
      </p>
    </div>
  )
}
