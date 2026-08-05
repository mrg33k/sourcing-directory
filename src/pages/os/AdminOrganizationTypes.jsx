import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, CardBody, DataTable, Pill, LogoTile, EmptyState, Button, Icon,
} from '../../components/osv3/index.js'
import { createAdminApiClient } from '../../lib/adminApi.js'
import { supabase } from '../../lib/supabase.js'
import { formatCount, formatRelative } from '../../lib/adminStats.js'
import './osv3-admin-org-types.css'

/**
 * The Organizations tab of Admin Tools — organization TYPE, and who owns it.
 *
 * ===========================================================================
 * WHY THIS SCREEN EXISTS
 * ===========================================================================
 * /ecosystem/overview draws a chart of organizations by type, and until
 * 2026-08-03 no organization had one: `org_type` sat on a table with zero rows.
 * scripts/backfill-org-type.mjs now derives a type for every company from its
 * name and its website domain. Derivation is not truth — it is a good first
 * guess with a rule attached — and a good first guess that nobody can overrule
 * is worse than no guess at all, because it looks like a fact.
 *
 * So this screen does two things and only two:
 *   1. shows what the classifier decided AND WHY, per organization
 *   2. lets an admin change it, permanently
 *
 * "Permanently" is the load-bearing word. Setting a type here stamps
 * org_type_reviewed_at, and the backfill script SKIPS every row that carries
 * it. Re-running the script after a correction cannot undo the correction.
 *
 * ===========================================================================
 * THIS SCREEN DOES NOT LIE ABOUT WHETHER A WRITE LANDED
 * ===========================================================================
 * Two traps AdminUsers.decision.md documents, both live in this codebase, both
 * avoided here for the same reasons:
 *
 *   1. `adminApi` ALWAYS RESOLVES — it hands back `{ data, error }` and never
 *      rejects. A caller that ignores `error` shows a tick for a request that
 *      403'd. Every write below reads `error` first.
 *
 *   2. A PostgREST write that RLS or the endpoint's tenant scope narrows to
 *      ZERO rows returns NO error. So the write asks for the row back and
 *      treats an empty array as a FAILURE. Local state is patched from the row
 *      the server returned, never from what was sent.
 *
 * The outcome line names the organization and what happened to it. A bare
 * "Saved" cannot be checked against anything.
 *
 * ===========================================================================
 * READS GO DIRECT, WRITES GO THROUGH THE ENDPOINT
 * ===========================================================================
 * AdminUsers reads through /api/sourcing/admin because directory_members holds
 * email addresses RLS does not publish. Neither table here is like that:
 * directory_companies is `public read companies` (qual true) and
 * directory_company_profile is published for every company whose listing is
 * live. There is nothing on this screen a visitor could not already read off
 * /directory, so the READ is the plain Supabase client — which also means this
 * screen renders under `npm run dev`, where api/ is not served at all and an
 * endpoint read would 404 with no way to tell that from a permissions failure.
 *
 * The WRITE is the endpoint, and has to be: it is the only path that verifies a
 * JWT server-side, checks the column allowlist, and records an audit row. The
 * anon key cannot write this table (`approved members or admin write` requires
 * directory_is_platform_admin() or company membership), so there is no shortcut
 * to take even by accident.
 *
 * ===========================================================================
 * WHO IS RECORDED
 * ===========================================================================
 * org_type_reviewed_by is filled from the browser's own session id, which is a
 * convenience, not an attestation. The authoritative record of who changed what
 * is the audit row /api/sourcing/admin writes with the JWT it verified server
 * side. If the two ever disagree, believe directory_audit.
 */

const api = createAdminApiClient()

/* The six the database's CHECK constraint allows. Keeping this list in the same
   order the donut draws them means an admin scanning the column sees the chart's
   own vocabulary rather than an alphabetised one. */
const ORG_TYPES = ['Private Company', 'Nonprofit', 'Government', 'Academic', 'Investor', 'Other']

/* Plain-English readings of the classifier's `source` strings. The raw string is
   stable and machine-sortable; this is what a non-engineer needs to see, and an
   unknown source falls back to the raw string rather than to "Unknown" — a rule
   we have not named yet is still information. */
const SOURCE_COPY = {
  'domain-tld:.edu': 'Website is a .edu',
  'domain-tld:.gov': 'Website is a .gov or .mil',
  'domain-tld:.org': 'Website is a .org',
  'domain-tld:commercial': 'Commercial website, no institutional signal',
  'name:academic': 'Name says university, college or school',
  'name:government': 'Name says a public body',
  'name:government-authority': 'Name contains "Authority"',
  'name:nonprofit': 'Name says foundation, coalition or alliance',
  'name:investor': 'Name says ventures, capital or wealth',
  'name:legal-suffix': 'Name carries a private legal form (Inc, LLC, Corp)',
  unclassified: 'No signal identified a type',
  'admin:manual': 'Set by an admin',
}

const CONFIDENCE_TONE = {
  high: 'verified',
  medium: 'pending',
  low: 'unverified',
  none: 'unverified',
}

const FILTERS = [
  { id: 'all', label: 'Everyone' },
  { id: 'review', label: 'Needs review' },
  { id: 'derived', label: 'Auto-derived' },
  { id: 'manual', label: 'Admin-set' },
]

/** A row's bucket. "Needs review" is the only one that is a judgement, and it
 *  is a narrow one: nothing a human has confirmed, and only the rows the
 *  classifier itself reported as unsure. */
function bucketOf(row) {
  if (row.org_type_reviewed_at) return 'manual'
  if (!row.org_type || row.org_type_confidence === 'none' || row.org_type_confidence === 'low') return 'review'
  return 'derived'
}

export default function AdminOrganizationTypes() {
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [filter, setFilter] = useState(null) // null until the first load picks it
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [outcome, setOutcome] = useState(null) // { ok, text }
  const [attempt, setAttempt] = useState(0)
  const [viewerId, setViewerId] = useState(null)

  useEffect(() => {
    if (!supabase) return undefined
    let live = true
    supabase.auth.getSession()
      .then(({ data }) => { if (live) setViewerId(data?.session?.user?.id || null) })
      .catch(() => {})
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!supabase) { setLoadError('This build has no database connection configured.'); setRows([]); return undefined }
    let live = true
    setRows(null)
    setLoadError(null)
    ;(async () => {
      // Two reads, joined here rather than embedded: the name an admin
      // recognises lives on the company row and the type lives on the profile
      // row, and PostgREST embeds are one more thing to get wrong for 165 rows.
      const [companies, profiles] = await Promise.all([
        supabase.from('directory_companies')
          .select('id,name,slug,website,vertical,city,state,status')
          .order('name', { ascending: true })
          .limit(1000),
        supabase.from('directory_company_profile')
          .select('company_id,org_type,org_type_source,org_type_confidence,org_type_derived_at,org_type_reviewed_at')
          .limit(1000),
      ])
      if (!live) return
      if (companies.error) {
        setLoadError(companies.error.message || 'Could not read the organization list.')
        setRows([])
        return
      }
      // A failed profile read is NOT fatal: the list still renders with every
      // type blank, which is a truthful "we do not know" rather than a blank
      // screen. It is called out in the outcome line so it is not mistaken for
      // "no organization has a type".
      if (profiles.error) {
        setOutcome({ ok: false, text: `Types could not be read — ${profiles.error.message}. The list below shows organizations only.` })
      }
      /* A company whose listing is not live yet has no readable profile row —
         RLS publishes directory_company_profile only for status='active'. Its
         type column stays blank and it lands in "Needs review", which is the
         truthful reading: nobody can see a type for it, including us. */
      const byId = new Map((profiles.data || []).map((p) => [p.company_id, p]))
      setRows((companies.data || []).map((c) => ({ ...c, ...(byId.get(c.id) || {}) })))
      setFilter((prev) => prev ?? 'all')
    })()
    return () => { live = false }
  }, [attempt])

  const counts = useMemo(() => {
    const c = { all: 0, review: 0, derived: 0, manual: 0 }
    for (const r of rows || []) { c.all += 1; c[bucketOf(r)] += 1 }
    return c
  }, [rows])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows || []).filter((r) => {
      if (filter && filter !== 'all' && bucketOf(r) !== filter) return false
      if (!needle) return true
      return `${r.name || ''} ${r.website || ''} ${r.city || ''}`.toLowerCase().includes(needle)
    })
  }, [rows, filter, q])

  /**
   * Set one organization's type. Returns only after the database has handed the
   * row back changed — see the header note on the two traps.
   */
  const setType = useCallback(async (row, value) => {
    const next = value || null
    if (next === (row.org_type || null)) return
    setBusyId(row.id)
    setOutcome(null)

    if (!api) {
      setBusyId(null)
      setOutcome({ ok: false, text: 'This build has no database connection configured, so nothing can be saved.' })
      return
    }
    const now = new Date().toISOString()
    const { data, error } = await api
      .from('directory_company_profile')
      .upsert({
        company_id: row.id,
        org_type: next,
        /* The provenance the whole screen exists for. 'admin:manual' is what
           the classifier's own report groups these under, and the reviewed_at
           stamp is what makes the backfill script leave the row alone
           forever. */
        org_type_source: 'admin:manual',
        org_type_confidence: 'high',
        org_type_reviewed_by: viewerId,
        org_type_reviewed_at: now,
        updated_at: now,
      }, { onConflict: 'company_id' })
      .select('company_id,org_type,org_type_source,org_type_confidence,org_type_reviewed_at')
    setBusyId(null)

    if (error) {
      setOutcome({ ok: false, text: `Could not set the type for ${row.name} — ${error.message || 'the change was refused.'}` })
      return
    }
    const confirmed = Array.isArray(data) ? data[0] : data
    if (!confirmed) {
      setOutcome({
        ok: false,
        text: `Could not set the type for ${row.name} — the database accepted the request but changed no record, which usually means this organization is outside your permissions. Nothing was saved.`,
      })
      return
    }
    setRows((cur) => (cur || []).map((r) => (r.id === row.id ? { ...r, ...confirmed } : r)))
    setOutcome({ ok: true, text: `${row.name} is now ${confirmed.org_type || 'untyped'}. The bulk classifier will not change it again.` })
  }, [viewerId])

  const retry = () => setAttempt((n) => n + 1)

  const columns = [
    { id: 'organization', header: 'Organization' },
    { id: 'type', header: 'Type' },
    { id: 'derived', header: 'Derived from' },
    { id: 'confidence', header: 'Confidence' },
  ]

  const tableRows = shown.map((r) => {
    const bucket = bucketOf(r)
    const source = r.org_type_source || null
    return {
      id: r.id,
      cells: {
        organization: (
          <div className="osv3p-table-org">
            <LogoTile name={r.name} size="sm" />
            <div>
              <div className="osv3p-iconlist-title">{r.name}</div>
              <div className="osv3p-iconlist-sub">
                {[r.city && r.state ? `${r.city}, ${r.state}` : r.city || r.state, r.website].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        ),
        type: (
          <label className="osv3-orgtype-field">
            <span className="osv3-orgtype-sronly">Type for {r.name}</span>
            <select
              className="osv3p-select"
              value={r.org_type || ''}
              disabled={busyId === r.id}
              onChange={(e) => setType(r, e.target.value)}
            >
              <option value="">Not set</option>
              {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        ),
        derived: (
          <span className="osv3-orgtype-source">
            {source ? (SOURCE_COPY[source] || source) : 'Nothing has set this yet'}
            {r.org_type_reviewed_at ? (
              <span className="osv3-orgtype-when"> · {formatRelative(r.org_type_reviewed_at)}</span>
            ) : r.org_type_derived_at ? (
              <span className="osv3-orgtype-when"> · {formatRelative(r.org_type_derived_at)}</span>
            ) : null}
          </span>
        ),
        confidence: bucket === 'manual'
          ? <Pill status tone="verified">Admin-set</Pill>
          : r.org_type_confidence
            ? <Pill status tone={CONFIDENCE_TONE[r.org_type_confidence] || 'unverified'}>{r.org_type_confidence}</Pill>
            : <Pill status tone="unverified">none</Pill>,
      },
    }
  })

  return (
    <div className="osv3-orgtype">
      <Card>
        <h2 className="osv3p-rail-title">Organization type</h2>
        <CardBody>
          <p className="osv3p-pagehead-sub osv3-orgtype-lede">
            Every organization&rsquo;s type was worked out from its own name and website domain, and each
            one shows the rule that produced it. Change any of them here and it stays changed — the bulk
            classifier never touches an organization an admin has set.
          </p>

          {rows === null ? (
            <EmptyState
              icon="clock"
              title="Reading the directory"
              body="Loading every organization and the type on record for it."
            />
          ) : loadError ? (
            <EmptyState
              icon="signal"
              title="Could not read the organization list"
              body={loadError}
              action={<Button variant="quiet" onClick={retry}>Try again</Button>}
            />
          ) : (
            <>
              <div className="osv3-orgtype-controls">
                <div className="osv3p-seg" role="group" aria-label="Filter organizations">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`osv3p-seg-btn ${filter === f.id ? 'osv3p-seg-btn--on' : ''}`}
                      aria-pressed={filter === f.id}
                      onClick={() => setFilter(f.id)}
                    >
                      {f.label}
                      <span className="osv3p-seg-count">{formatCount(counts[f.id])}</span>
                    </button>
                  ))}
                </div>
                <label className="osv3-orgtype-search">
                  <span className="osv3p-field-label">Search</span>
                  <input
                    className="osv3p-input"
                    type="search"
                    value={q}
                    placeholder="Name, website or city"
                    onChange={(e) => setQ(e.target.value)}
                  />
                </label>
              </div>

              {outcome ? (
                <p className={`osv3-orgtype-outcome ${outcome.ok ? 'osv3-orgtype-outcome--ok' : 'osv3-orgtype-outcome--bad'}`} role="status">
                  <Icon name={outcome.ok ? 'check-circle' : 'cross'} />
                  {outcome.text}
                </p>
              ) : null}

              {!tableRows.length ? (
                <EmptyState
                  icon="building"
                  title="Nothing matches"
                  body="No organization matches this filter and search. Clear the search to see the rest."
                />
              ) : (
                <DataTable columns={columns} rows={tableRows} caption="Organizations and their type" />
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
