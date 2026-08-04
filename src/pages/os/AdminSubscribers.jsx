import React, { useEffect, useMemo, useState } from 'react'
import {
  Card, CardBody, Button, ButtonRow, DataTable, Pill, EmptyState,
} from '../../components/osv3/index.js'
import { createAdminApiClient } from '../../lib/adminApi.js'
import { formatCount, formatDate, formatRelative } from '../../lib/adminStats.js'

/**
 * The Subscribers tab of Admin Tools — every email the Space Rising forms have
 * captured, in one exportable list.
 *
 * Three forms feed the same `srw_subscribers` table and the rows tell you which:
 *   source 'directory'     — the "Stay Connected" box on the OS Directory page
 *   form_type 'subscribe'  — the site's sign-up form (srw-v2)
 *   form_type 'contact'    — the site's contact form (these carry a message)
 *
 * The tab exists because the answer to "who subscribed?" used to be "an
 * engineer queries the database". Read-only on purpose: a submission is a
 * record of something a visitor did, and nothing here should be able to edit
 * that. The one action is Export CSV, which downloads exactly the rows the
 * current filter shows — filtered view, filtered file.
 */

const api = createAdminApiClient()

const SEGMENTS = [
  { id: 'all', label: 'Everyone' },
  { id: 'directory', label: 'OS Directory' },
  { id: 'site', label: 'Site sign-up' },
  { id: 'contact', label: 'Contact form' },
]

function originOf(row) {
  if (String(row?.form_type || '').toLowerCase() === 'contact') return 'contact'
  if (String(row?.source || '').toLowerCase() === 'directory') return 'directory'
  return 'site'
}

const ORIGIN_LABEL = {
  directory: 'OS Directory',
  site: 'Site sign-up',
  contact: 'Contact',
}

const ORIGIN_TONE = {
  directory: 'verified',
  site: 'pending',
  contact: 'rejected',
}

function nameOf(row) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
  return name || null
}

/* CSV per RFC 4180: fields with commas, quotes or newlines get quoted, quotes
   doubled. Excel and Google Sheets both open the result cleanly. */
function csvField(v) {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows) {
  const header = ['email', 'first_name', 'last_name', 'organization', 'origin', 'interests', 'message', 'date']
  const lines = rows.map((r) => [
    r.email,
    r.first_name,
    r.last_name,
    r.organization,
    ORIGIN_LABEL[originOf(r)],
    Array.isArray(r.areas_of_interest) ? r.areas_of_interest.join(' · ') : '',
    r.message,
    r.created_at ? String(r.created_at).slice(0, 10) : '',
  ].map(csvField).join(','))
  return [header.join(','), ...lines].join('\n')
}

export default function AdminSubscribers() {
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [seg, setSeg] = useState('all')
  const [q, setQ] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    setRows(null)
    setLoadError(null)
    ;(async () => {
      const { data, error } = await api
        .from('srw_subscribers')
        .select('id,created_at,form_type,first_name,last_name,email,organization,areas_of_interest,newsletter_opt_in,message,source')
        .order('created_at', { ascending: false })
        .limit(1000)
      if (!live) return
      if (error) { setLoadError(error.message || 'Could not read the subscriber list.'); setRows([]); return }
      setRows(Array.isArray(data) ? data : [])
    })()
    return () => { live = false }
  }, [attempt])

  const counts = useMemo(() => {
    const c = { all: 0, directory: 0, site: 0, contact: 0 }
    for (const r of rows || []) { c.all += 1; c[originOf(r)] += 1 }
    return c
  }, [rows])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows || []).filter((r) => {
      if (seg !== 'all' && originOf(r) !== seg) return false
      if (!needle) return true
      return `${nameOf(r) || ''} ${r.email || ''} ${r.organization || ''}`.toLowerCase().includes(needle)
    })
  }, [rows, seg, q])

  const exportCsv = () => {
    const blob = new Blob([toCsv(shown)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `space-rising-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const columns = [
    { id: 'who', header: 'Subscriber' },
    { id: 'origin', header: 'Came from' },
    { id: 'detail', header: 'Details' },
    { id: 'when', header: 'Date' },
  ]

  const tableRows = shown.map((r) => {
    const origin = originOf(r)
    const detail = origin === 'contact'
      ? (r.message || '(no message)')
      : [r.organization, Array.isArray(r.areas_of_interest) && r.areas_of_interest.length ? r.areas_of_interest.join(' · ') : null]
          .filter(Boolean).join(' — ') || '—'
    return {
      id: r.id,
      cells: {
        who: (
          <span className="osv3p-usercell-text">
            <span className="osv3p-usercell-name">{nameOf(r) || r.email}</span>
            {nameOf(r) ? <span className="osv3p-usercell-mail">{r.email}</span> : null}
          </span>
        ),
        origin: <Pill status tone={ORIGIN_TONE[origin]}>{ORIGIN_LABEL[origin]}</Pill>,
        detail: <span className="osv3p-usercell-role">{detail}</span>,
        when: (
          <span className="osv3p-usercell-joined" title={formatDate(r.created_at)}>
            {formatRelative(r.created_at)}
          </span>
        ),
      },
    }
  })

  if (rows === null) {
    return (
      <EmptyState
        icon="clock"
        title="Reading the subscriber list"
        body="Every form submission is read live from the database. Nothing is shown until the whole list has been read."
      />
    )
  }

  if (loadError) {
    return (
      <EmptyState
        icon="signal"
        title="This build cannot read the subscriber list"
        body={loadError}
        action={<Button variant="quiet" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}
      />
    )
  }

  return (
    <div className="osv3p-users">
      <div className="osv3p-users-bar">
        <div className="osv3p-seg" role="group" aria-label="Filter subscribers by origin">
          {SEGMENTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={seg === s.id ? 'osv3p-seg-btn osv3p-seg-btn--on' : 'osv3p-seg-btn'}
              aria-pressed={seg === s.id}
              onClick={() => setSeg(s.id)}
            >
              {s.label}
              <span className="osv3p-seg-count">{formatCount(counts[s.id] || 0)}</span>
            </button>
          ))}
        </div>
        <div className="osv3p-users-search">
          <label className="osv3p-field-label" htmlFor="subscribers-search">Find a subscriber</label>
          <input
            id="subscribers-search"
            className="osv3p-input"
            type="search"
            value={q}
            placeholder="Name, email or organization"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ButtonRow>
          <Button icon="download" variant="primary" disabled={shown.length === 0} onClick={exportCsv}>
            Export CSV ({formatCount(shown.length)})
          </Button>
        </ButtonRow>
      </div>

      <Card>
        <CardBody>
          {tableRows.length === 0 ? (
            <EmptyState
              icon="grid"
              title={q.trim() ? `Nobody matches "${q.trim()}"` : 'No submissions yet'}
              body={q.trim()
                ? 'Clear the search to see the rest of the list.'
                : 'Emails land here from the Stay Connected box on the OS Directory and the sign-up and contact forms on the website.'}
              action={q.trim() ? <Button variant="quiet" onClick={() => setQ('')}>Clear search</Button> : null}
            />
          ) : (
            <DataTable columns={columns} rows={tableRows} />
          )}
        </CardBody>
      </Card>
    </div>
  )
}
