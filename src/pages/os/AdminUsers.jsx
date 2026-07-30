import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, CardBody, Button, ButtonRow, DataTable, Pill, Avatar, EmptyState, Icon,
} from '../../components/osv3/index.js'
import { createAdminApiClient } from '../../lib/adminApi.js'
import { formatCount, formatDate, formatRelative } from '../../lib/adminStats.js'

/**
 * The Users tab of Admin Tools — every registered account, with approval and
 * role controls.
 *
 * ===========================================================================
 * WHAT THIS SCREEN IS FOR
 * ===========================================================================
 * An admin opens it to answer one question: who is waiting on me? Somebody
 * signed up, they cannot use the product until an admin approves them, and
 * nothing else on this platform tells you they are there. So the pending queue
 * is the screen, and everything else — role changes, revoking access, the full
 * roster — is secondary. That is why the filter defaults to Pending whenever
 * anyone is pending, and to Everyone when the queue is clear. The screen opens
 * on the work, not on a roster you have to filter yourself.
 *
 * ===========================================================================
 * THIS SCREEN DOES NOT LIE ABOUT WHETHER A WRITE LANDED  <- READ THIS FIRST
 * ===========================================================================
 * It was built the same day we found four admin tabs that report success on
 * failure, and one that renders "the report was NOT deleted" in a colour you
 * cannot read on the card it sits on. Two specific traps, both live in this
 * codebase today, both avoided here on purpose:
 *
 *   1. `adminApi` ALWAYS RESOLVES. It never rejects — it hands back
 *      `{ data, error }` and a caller that ignores `error` shows a green tick
 *      for a request that 403'd. There are ~21 such call sites in src/. Every
 *      mutation below reads `error` and stops on it.
 *
 *   2. A PostgREST UPDATE that RLS narrows to ZERO rows returns NO error.
 *      `api/sourcing/upgrade-membership.js` has reported `{success:true}` for
 *      writes that touched nothing since the day it was written. So every
 *      mutation here asks for the row back (`.select('id,role,status')`) and
 *      treats an empty array as a FAILURE, not a success. Local state is
 *      patched from the row the server returned, never from what we sent.
 *
 * The visible half of the same rule: an outcome line names the person and what
 * happened to them ("Ben Hardwick is approved" / "Could not approve Ben
 * Hardwick — ..."). A bare "Saved" cannot be checked against anything.
 *
 * ===========================================================================
 * WHY THERE IS NO "SUSPEND"
 * ===========================================================================
 * The tab's placeholder promised "approval, role and suspension controls".
 * `directory_members.status` is a plain text column whose only understood
 * values are pending / approved / rejected (migrations/006:13); nothing
 * enforces that at the DB level, so writing 'suspended' would succeed and then
 * be invisible to every gate in the app, which all test for 'approved'. That is
 * a silently locked-out user with no trace. Revoking access sets 'rejected',
 * which every gate already understands, and the button says exactly that.
 */

const api = createAdminApiClient()

const STATUS_TONE = {
  approved: 'verified',
  pending: 'pending',
  rejected: 'rejected',
}

const STATUS_LABEL = {
  approved: 'Approved',
  pending: 'Pending',
  rejected: 'No access',
}

/* The roster is small (70 rows today) and every filter is a plain field test,
   so filtering happens in the browser off one fetch. No refetch per tab click,
   and the counts stay honest because they are all counted from the same array. */
const SEGMENTS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'No access' },
  { id: 'all', label: 'Everyone' },
]

function statusOf(row) {
  const s = String(row?.status || '').toLowerCase()
  return STATUS_TONE[s] ? s : 'pending'
}

function nameOf(row) {
  return String(row?.full_name || '').trim() || String(row?.email || '').trim() || 'this account'
}

/** avatar + name over email, so the person is one thing rather than two columns. */
function PersonCell({ row }) {
  return (
    <div className="osv3p-usercell">
      <Avatar name={row.full_name || row.email} size="sm" />
      <span className="osv3p-usercell-text">
        <span className="osv3p-usercell-name">{row.full_name || '(no name given)'}</span>
        <span className="osv3p-usercell-mail">{row.email || '(no email)'}</span>
      </span>
    </div>
  )
}

export default function AdminUsers() {
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [seg, setSeg] = useState(null)          // null until the first load picks it
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [outcome, setOutcome] = useState(null)  // { ok, text }
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    setRows(null)
    setLoadError(null)
    ;(async () => {
      const { data, error } = await api
        .from('directory_members')
        .select('id,email,full_name,role,status,created_at,tenant_id')
        .order('created_at', { ascending: false })
        .limit(1000)
      if (!live) return
      if (error) { setLoadError(error.message || 'Could not read the account list.'); setRows([]); return }
      const list = Array.isArray(data) ? data : []
      setRows(list)
      // Open on the work: Pending if anyone is waiting, otherwise the roster.
      setSeg((prev) => prev ?? (list.some((r) => statusOf(r) === 'pending') ? 'pending' : 'all'))
    })()
    return () => { live = false }
  }, [attempt])

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, approved: 0, rejected: 0 }
    for (const r of rows || []) { c.all += 1; c[statusOf(r)] += 1 }
    return c
  }, [rows])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows || []).filter((r) => {
      if (seg && seg !== 'all' && statusOf(r) !== seg) return false
      if (!needle) return true
      return `${r.full_name || ''} ${r.email || ''}`.toLowerCase().includes(needle)
    })
  }, [rows, seg, q])

  /**
   * One write. Returns only after proving the row came back changed.
   *
   * `patch` is what we asked for; `confirmed` is what the server says the row
   * is now. We store `confirmed`. If those ever disagree, the screen shows the
   * database's version, which is the one that is true.
   */
  const mutate = useCallback(async (row, patch, verb) => {
    const who = nameOf(row)
    setBusyId(row.id)
    setOutcome(null)
    const { data, error } = await api
      .from('directory_members')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('id,role,status')
    setBusyId(null)

    if (error) {
      setOutcome({ ok: false, text: `Could not ${verb} ${who} — ${error.message || 'the change was refused.'}` })
      return
    }
    // The zero-row trap: no error, nothing written. See the header note.
    const confirmed = Array.isArray(data) ? data[0] : null
    if (!confirmed) {
      setOutcome({
        ok: false,
        text: `Could not ${verb} ${who} — the database accepted the request but changed no record, which usually means this account is outside your permissions. Nothing was saved.`,
      })
      return
    }
    setRows((cur) => (cur || []).map((r) => (r.id === confirmed.id ? { ...r, ...confirmed } : r)))
    setOutcome({ ok: true, text: `${who} — ${verb === 'approve' ? 'approved' : verb === 'revoke access for' ? 'access revoked' : 'updated'}.` })
  }, [])

  const columns = [
    { id: 'person', header: 'Person' },
    { id: 'role', header: 'Role' },
    { id: 'status', header: 'Status' },
    { id: 'joined', header: 'Joined' },
    { id: 'actions', header: 'Actions', align: 'right' },
  ]

  const tableRows = shown.map((r) => {
    const st = statusOf(r)
    const isAdmin = String(r.role || '').toLowerCase() === 'admin'
    const busy = busyId === r.id
    return {
      id: r.id,
      cells: {
        person: <PersonCell row={r} />,
        role: <span className="osv3p-usercell-role">{isAdmin ? 'Admin' : 'Member'}</span>,
        status: <Pill status tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Pill>,
        joined: (
          <span className="osv3p-usercell-joined" title={formatDate(r.created_at)}>
            {formatRelative(r.created_at)}
          </span>
        ),
        actions: (
          <ButtonRow>
            {/* `solid`, not `primary` (which is the accent OUTLINE): approving is
                the one thing this screen exists for and the common action, while
                revoking is rare and destructive. Equal weight would be a lie about
                which one you are meant to reach for. */}
            {st === 'pending' ? (
              <Button variant="solid" icon="check-circle" disabled={busy}
                onClick={() => mutate(r, { status: 'approved' }, 'approve')}>
                {busy ? 'Working…' : 'Approve'}
              </Button>
            ) : null}
            {st !== 'rejected' ? (
              <Button variant="quiet" disabled={busy}
                onClick={() => mutate(r, { status: 'rejected' }, 'revoke access for')}>
                Revoke access
              </Button>
            ) : (
              <Button variant="quiet" disabled={busy}
                onClick={() => mutate(r, { status: 'pending' }, 'restore')}>
                Restore
              </Button>
            )}
            {st === 'approved' ? (
              <Button variant="quiet" disabled={busy}
                onClick={() => mutate(r, { role: isAdmin ? 'member' : 'admin' }, isAdmin ? 'change the role of' : 'make an admin of')}>
                {isAdmin ? 'Remove admin' : 'Make admin'}
              </Button>
            ) : null}
          </ButtonRow>
        ),
      },
    }
  })

  if (rows === null) {
    return (
      <EmptyState
        icon="clock"
        title="Reading the account list"
        body="Every account on the platform is counted live. Nothing is shown until the whole list has been read, so no figure here is a stale one."
      />
    )
  }

  if (loadError) {
    return (
      <EmptyState
        icon="signal"
        title="This build cannot read the account list"
        body={loadError}
        action={<Button variant="quiet" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}
      />
    )
  }

  return (
    <div className="osv3p-users">
      <div className="osv3p-users-bar">
        <div className="osv3p-seg" role="group" aria-label="Filter accounts by status">
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
          <label className="osv3p-field-label" htmlFor="users-search">Find someone</label>
          <input
            id="users-search"
            className="osv3p-input"
            type="search"
            value={q}
            placeholder="Name or email"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {outcome ? (
        <p
          className={outcome.ok
            ? 'osv3p-savebar-msg osv3p-savebar-msg--ok'
            : 'osv3p-savebar-msg osv3p-savebar-msg--err'}
          role={outcome.ok ? 'status' : 'alert'}
        >
          {outcome.text}
        </p>
      ) : null}

      <Card>
        <CardBody>
          {tableRows.length === 0 ? (
            <EmptyState
              icon="grid"
              title={
                q.trim()
                  ? `Nobody matches "${q.trim()}"`
                  : seg === 'pending'
                    ? 'Nobody is waiting for approval'
                    : seg === 'rejected'
                      ? 'Nobody has had their access revoked'
                      : 'There are no accounts yet'
              }
              body={
                q.trim()
                  ? 'Clear the search to see the rest of the list.'
                  : seg === 'pending'
                    ? 'Every account that has asked for access has been dealt with. New sign-ups land here.'
                    : 'Accounts appear here as people sign up.'
              }
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
