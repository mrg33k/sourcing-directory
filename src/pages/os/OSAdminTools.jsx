import React, { useState, useEffect } from 'react'
import {
  Card, CardHeader, CardBody, CardFooter, CardLink, CardAction,
  Tabs, Pill, LogoTile, Icon,
  KpiTile, LineChart, DonutChart, DonutLegend, DataTable, IconList,
  Button, EmptyState,
} from '../../components/osv3/index.js'
import { ADMIN_FIXTURE } from '../../lib/profileFixtures.js'
import '../../styles/osv3-profile.css'

/**
 * Admin Tools — /admin-tools/_preview.
 *
 * A PREVIEW route on purpose. It renders the transcribed reference fixture and
 * reads nothing real, so it is safe to leave unguarded; the live admin surface
 * stays at /admin behind RequireAdmin. When this screen is signed off, it moves
 * behind that guard and swaps the fixture for a query.
 *
 * The screen wears `osv3p-screen--admin`, which repoints --p-screen-accent at
 * the existing link blue. That is the design: the admin surface's own tabs and
 * buttons are blue while the shared navy sidebar keeps the rust accent
 * (design-decisions.md D2). Nothing here sets a colour directly.
 */

export default function OSAdminTools() {
  const a = ADMIN_FIXTURE
  const [tab, setTab] = useState('dashboard')

  useEffect(() => { document.title = 'Admin Tools | SpaceOS' }, [])

  const tableRows = a.recentOrganizations.rows.map((r) => ({
    id: r.id,
    cells: {
      organization: (
        <div className="osv3p-table-org">
          <LogoTile name={r.name} size="sm" />
          <div>
            <div className="osv3p-iconlist-title">{r.name}</div>
            <div className="osv3p-iconlist-sub">{r.sub}</div>
          </div>
        </div>
      ),
      location: r.location,
      status: <Pill status tone={r.tone}>{r.status}</Pill>,
      since: r.since,
      actions: (
        <button type="button" className="osv3p-icon-btn" aria-label={`Actions for ${r.name}`}>
          <Icon name="dots" />
        </button>
      ),
    },
  }))

  return (
    <div className="osv3p-screen osv3p-screen--admin">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">{a.title}</h1>
          <p className="osv3p-pagehead-sub">{a.subtitle}</p>
        </div>
        <Button icon="download" variant="primary">{a.exportCta}</Button>
      </header>

      <Tabs items={a.tabs} value={tab} onChange={setTab} label="Admin sections" />

      {tab !== 'dashboard' ? (
        <EmptyState
          icon="gear"
          title={`${a.tabs.find((t) => t.id === tab).label} is not built yet`}
          body="The dashboard tab is the screen under design. The rest arrive with the sections they manage."
        />
      ) : (
        <div className="osv3p-admin-body">
          <div className="osv3p-admin-main">
            <div className="osv3p-kpi-row">
              {a.kpis.map((k) => (
                <KpiTile
                  key={k.id}
                  icon={k.icon}
                  label={k.label}
                  value={k.value}
                  delta={k.delta}
                  deltaNote={k.deltaNote}
                  linkLabel={k.linkLabel}
                />
              ))}
            </div>

            <div className="osv3p-grid osv3p-grid--halves">
              <Card>
                <CardHeader
                  title={`${a.platformActivity.heading} ${a.platformActivity.note}`}
                  action={<CardAction>{a.platformActivity.footerLink}</CardAction>}
                />
                <CardBody>
                  <LineChart
                    series={a.platformActivity.series}
                    xLabels={a.platformActivity.xLabels}
                    yTicks={a.platformActivity.yTicks}
                    ariaLabel="New users, organizations and capabilities over the last 30 days"
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title={a.verificationSplit.heading}
                  action={<CardAction>{a.verificationSplit.footerLink}</CardAction>}
                />
                <CardBody>
                  <div className="osv3p-donut">
                    <DonutChart
                      segments={a.verificationSplit.segments}
                      total={a.verificationSplit.total}
                      totalLabel={a.verificationSplit.totalLabel}
                    />
                    <DonutLegend
                      segments={a.verificationSplit.segments}
                      total={a.verificationSplit.total}
                    />
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader
                title={a.recentOrganizations.heading}
                action={<CardAction>{a.recentOrganizations.footerLink}</CardAction>}
              />
              <CardBody>
                <DataTable columns={a.recentOrganizations.columns} rows={tableRows} />
              </CardBody>
            </Card>
          </div>

          <aside className="osv3p-admin-rail">
            <Card>
              <h2 className="osv3p-rail-title">{a.pendingItems.heading}</h2>
              <CardBody>
                {a.pendingItems.rows.map((r) => (
                  <div className="osv3p-rail-row" key={r.id}>
                    <span>{r.label}</span>
                    <b>{r.value}</b>
                  </div>
                ))}
              </CardBody>
              <CardFooter><CardLink>{a.pendingItems.footerLink}</CardLink></CardFooter>
            </Card>

            <Card>
              <h2 className="osv3p-rail-title">{a.recentActivity.heading}</h2>
              <CardBody>
                <IconList items={a.recentActivity.items} />
              </CardBody>
              <CardFooter><CardLink>{a.recentActivity.footerLink}</CardLink></CardFooter>
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

      <p className="osv3p-footnote">
        Reference admin screen. Every figure here is transcribed from the approved design and reads
        nothing live, which is why this preview is safe to open without the admin guard. The working
        admin surface stays at /admin.
      </p>
    </div>
  )
}
