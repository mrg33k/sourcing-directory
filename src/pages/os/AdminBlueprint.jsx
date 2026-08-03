import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, CardBody, Button, ButtonRow, DataTable, Pill, EmptyState, Icon,
} from '../../components/osv3/index.js'
import { createAdminApiClient } from '../../lib/adminApi.js'
import { formatCount, formatDate } from '../../lib/adminStats.js'
import './osv3-blueprint-admin.css'

/**
 * The Blueprint tab of Admin Tools — the thing that turns /blueprint from a
 * shell into a page the client can fill in.
 *
 * ===========================================================================
 * WHY THIS EXISTS AND WHY IT SHIPPED BEFORE THE POLISH
 * ===========================================================================
 * /blueprint prints a real zero for Goals, Initiatives and KPIs, because the
 * Blueprint report defines none and inventing them would be a lie under the
 * client's own flagship document. A zero is only an honest answer if somebody
 * can turn it into a one without an engineer. That is this screen. Without it
 * the page is a permanently empty dashboard; with it, the first goal an admin
 * writes tomorrow morning shows up in the tile, the tab, the priority card and
 * the activity feed inside a minute.
 *
 * ===========================================================================
 * IT DOES NOT LIE ABOUT WHETHER A WRITE LANDED  <- READ THIS FIRST
 * ===========================================================================
 * Same two traps AdminUsers.jsx documents, both still live in this codebase:
 *
 *   1. `adminApi` ALWAYS RESOLVES. It never rejects — it returns
 *      `{ data, error }`, and a caller that ignores `error` shows a success
 *      message for a request that 403'd. Every mutation below reads `error`
 *      and stops on it.
 *
 *   2. A PostgREST write that RLS or the tenant scope narrows to ZERO rows
 *      returns NO error. So every mutation here asks for the row back with
 *      `.select(...)` and treats an empty array as a FAILURE. Local state is
 *      patched from the row the server returned, never from what was sent.
 *
 * The activity row is written AFTER the primary write comes back confirmed, and
 * only then. That ordering is the whole point: the feed on /blueprint can never
 * claim a change that did not happen. If the activity insert itself fails the
 * outcome line says so — the edit still landed, and saying "saved, but not
 * logged" is more useful than a silent gap in the feed.
 *
 * ===========================================================================
 * WHY THE PRIORITY NAME FIELD LOOKS ODD
 * ===========================================================================
 * The six priorities' names live on `directory_tags` — the same rows the
 * Directory's category filter reads. blueprint_priorities.name is an OVERRIDE:
 * blank means "use the ecosystem tag's name". So the field is optional and its
 * placeholder shows the inherited name. Typing here changes this page only;
 * clearing it hands the name back to the tag. That is deliberate — two editable
 * copies of "Move in Space" is exactly how a platform ends up with two
 * spellings of it.
 */

const api = createAdminApiClient()
const TENANT_SLUG = 'space-rising'

const PRIORITY_ICONS = [
  'mission-build', 'mission-move', 'mission-operate',
  'mission-live', 'mission-prosper', 'mission-secure',
  'rocket', 'satellite', 'shield', 'layers', 'gauge', 'grid',
]

const GOAL_STATUS = [
  { id: 'not_started', label: 'Not started' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'complete', label: 'Complete' },
  { id: 'on_hold', label: 'On hold' },
]

const INITIATIVE_STATUS = [
  { id: 'proposed', label: 'Proposed' },
  { id: 'active', label: 'Active' },
  { id: 'complete', label: 'Complete' },
  { id: 'on_hold', label: 'On hold' },
]

const KPI_UNITS = [
  { id: 'count', label: 'Count' },
  { id: 'percent', label: 'Percent' },
  { id: 'currency', label: 'Currency' },
  { id: 'ratio', label: 'Ratio' },
  { id: 'text', label: 'Text' },
]

/* The pills render a LABEL, never the raw column value: an admin reading
   "in_progress" in a status pill is reading a database identifier, not a word. */
const STATUS_LABEL = {
  complete: 'Complete',
  in_progress: 'In progress',
  active: 'Active',
  not_started: 'Not started',
  proposed: 'Proposed',
  on_hold: 'On hold',
  archived: 'Archived',
}

const STATUS_TONE = {
  complete: 'verified',
  in_progress: 'pending',
  active: 'pending',
  not_started: 'unverified',
  proposed: 'unverified',
  on_hold: 'rejected',
  archived: 'rejected',
}

/**
 * One spec per entity: the table, the columns to read, the form fields, and how
 * to write the one sentence that lands in the activity feed. Four near-identical
 * CRUD screens would drift apart by the third change; one spec-driven screen
 * cannot.
 */
const ENTITIES = {
  priorities: {
    label: 'Priorities',
    table: 'blueprint_priorities',
    entityType: 'priority',
    noun: 'priority',
    select: 'id,tenant_id,tag_id,name,slug,theme,blurb,summary,source_note,icon,sort_order,status,updated_at',
    order: ['sort_order', true],
    titleOf: (r, ctx) => r.name || ctx.tagName?.[r.tag_id] || r.slug,
    fields: [
      { id: 'name', label: 'Display name', type: 'text',
        help: 'Leave blank to use the ecosystem tag name. Typing here overrides it on this page only.' },
      { id: 'slug', label: 'Slug', type: 'text', required: true },
      { id: 'theme', label: 'Theme', type: 'text', help: 'The one-word theme, e.g. Infrastructure.' },
      { id: 'blurb', label: 'Card line', type: 'textarea', rows: 2,
        help: 'One sentence. This is what the six cards on the Overview show.' },
      { id: 'summary', label: 'Full description', type: 'textarea', rows: 4,
        help: 'The paragraph on the Priorities tab.' },
      { id: 'source_note', label: 'Source', type: 'text',
        help: 'Where this description came from, e.g. the report section. Shown under it.' },
      { id: 'icon', label: 'Icon', type: 'select', options: PRIORITY_ICONS.map((i) => ({ id: i, label: i }) ) },
      { id: 'sort_order', label: 'Order', type: 'number', notNull: true, fallback: 0 },
      { id: 'status', label: 'Status', type: 'select',
        options: [{ id: 'active', label: 'Active' }, { id: 'archived', label: 'Archived' }] },
    ],
    columns: [
      { id: 'name', header: 'Priority' },
      { id: 'theme', header: 'Theme' },
      { id: 'counts', header: 'Under it' },
      { id: 'status', header: 'Status' },
      { id: 'actions', header: '', align: 'right' },
    ],
  },

  goals: {
    label: 'Goals',
    table: 'blueprint_goals',
    entityType: 'goal',
    noun: 'goal',
    select: 'id,tenant_id,priority_id,code,title,description,owner,status,progress_pct,target_date,sort_order',
    order: ['sort_order', true],
    titleOf: (r) => r.title,
    fields: [
      { id: 'priority_id', label: 'Strategic priority', type: 'priority', required: true },
      { id: 'code', label: 'Reference', type: 'text', help: 'Optional, e.g. 2.1' },
      { id: 'title', label: 'Goal', type: 'text', required: true },
      { id: 'description', label: 'Description', type: 'textarea', rows: 3 },
      { id: 'owner', label: 'Owner', type: 'text' },
      { id: 'status', label: 'Status', type: 'select', options: GOAL_STATUS },
      { id: 'progress_pct', label: 'Progress %', type: 'number', min: 0, max: 100, notNull: true, fallback: 0,
        help: 'Drives the Top Goals by Progress bars in the sidebar.' },
      { id: 'target_date', label: 'Target date', type: 'date' },
      { id: 'sort_order', label: 'Order', type: 'number', notNull: true, fallback: 0 },
    ],
    columns: [
      { id: 'code', header: 'Ref' },
      { id: 'title', header: 'Goal' },
      { id: 'priority', header: 'Priority' },
      { id: 'status', header: 'Status' },
      { id: 'progress', header: 'Progress', align: 'right' },
      { id: 'actions', header: '', align: 'right' },
    ],
  },

  initiatives: {
    label: 'Initiatives',
    table: 'blueprint_initiatives',
    entityType: 'initiative',
    noun: 'initiative',
    select: 'id,tenant_id,priority_id,goal_id,title,description,lead_org,owner,status,start_date,target_date,sort_order',
    order: ['sort_order', true],
    titleOf: (r) => r.title,
    fields: [
      { id: 'priority_id', label: 'Strategic priority', type: 'priority', required: true },
      { id: 'goal_id', label: 'Goal', type: 'goal', help: 'Optional — an initiative can sit straight under a priority.' },
      { id: 'title', label: 'Initiative', type: 'text', required: true },
      { id: 'description', label: 'Description', type: 'textarea', rows: 3 },
      { id: 'lead_org', label: 'Lead organization', type: 'text' },
      { id: 'owner', label: 'Owner', type: 'text' },
      { id: 'status', label: 'Status', type: 'select', options: INITIATIVE_STATUS },
      { id: 'start_date', label: 'Start date', type: 'date' },
      { id: 'target_date', label: 'Target date', type: 'date' },
      { id: 'sort_order', label: 'Order', type: 'number', notNull: true, fallback: 0 },
    ],
    columns: [
      { id: 'title', header: 'Initiative' },
      { id: 'priority', header: 'Priority' },
      { id: 'lead', header: 'Lead' },
      { id: 'status', header: 'Status' },
      { id: 'actions', header: '', align: 'right' },
    ],
  },

  kpis: {
    label: 'KPIs',
    table: 'blueprint_kpis',
    entityType: 'kpi',
    noun: 'KPI',
    select: 'id,tenant_id,priority_id,goal_id,name,description,unit,baseline_value,current_value,target_value,as_of,source,sort_order',
    order: ['sort_order', true],
    titleOf: (r) => r.name,
    fields: [
      { id: 'priority_id', label: 'Strategic priority', type: 'priority', required: true },
      { id: 'goal_id', label: 'Goal', type: 'goal', help: 'Optional.' },
      { id: 'name', label: 'Measure', type: 'text', required: true },
      { id: 'description', label: 'What it measures', type: 'textarea', rows: 2 },
      { id: 'unit', label: 'Unit', type: 'select', options: KPI_UNITS },
      { id: 'baseline_value', label: 'Baseline', type: 'number',
        help: 'Where it started. Leave blank if there is no baseline yet.' },
      { id: 'current_value', label: 'Current', type: 'number',
        help: 'Leave blank if it has never been measured — the page says "Not measured" rather than showing a zero.' },
      { id: 'target_value', label: 'Target', type: 'number' },
      { id: 'as_of', label: 'Measured on', type: 'date' },
      { id: 'source', label: 'Source', type: 'text', help: 'Where the number comes from, in words.' },
      { id: 'sort_order', label: 'Order', type: 'number', notNull: true, fallback: 0 },
    ],
    columns: [
      { id: 'name', header: 'Measure' },
      { id: 'priority', header: 'Priority' },
      { id: 'current', header: 'Current', align: 'right' },
      { id: 'target', header: 'Target', align: 'right' },
      { id: 'actions', header: '', align: 'right' },
    ],
  },
}

const ENTITY_IDS = ['priorities', 'goals', 'initiatives', 'kpis']

/** Blank string -> null. A NOT NULL numeric column will not take ''. */
function clean(value, field) {
  if (value === '' || value === undefined) return null
  if (field.type === 'number') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  return value
}

/**
 * Turn the form into a payload the database will actually accept.
 *
 * Found by driving this screen for real: leaving "Order" blank sent
 * `sort_order: null`, and an explicit null OVERRIDES a column default — so the
 * insert died on `violates not-null constraint` even though the column has
 * `default 0`. A blank optional field must mean "I did not set this", never
 * "set this to null".
 *
 *   insert -> drop the key entirely, and the column default applies
 *   update -> null is a legitimate "clear this field", EXCEPT on a NOT NULL
 *             column, where the field's declared fallback is used instead
 */
function buildPayload(fields, form, isNew) {
  const payload = {}
  for (const f of fields) {
    const v = clean(form[f.id], f)
    if (v === null) {
      if (isNew) continue
      if (f.notNull) { payload[f.id] = f.fallback ?? 0; continue }
    }
    payload[f.id] = v
  }
  return payload
}

export default function AdminBlueprint() {
  const [entity, setEntity] = useState('goals')
  const [tenantId, setTenantId] = useState(null)
  const [rows, setRows] = useState(null)
  const [priorities, setPriorities] = useState([])
  const [goals, setGoals] = useState([])
  const [tagName, setTagName] = useState({})
  const [childCounts, setChildCounts] = useState({})
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  const [editing, setEditing] = useState(null)   // row being edited, or 'new'
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState(null)   // { ok, text }

  const spec = ENTITIES[entity]

  /* --- Load the selects' source data once, and the list per entity -------- */
  useEffect(() => {
    let live = true
    ;(async () => {
      if (!api) { setLoadError('This build has no database connection configured.'); setRows([]); return }
      const [{ data: tenants }, { data: tags }] = await Promise.all([
        api.from('directory_tenants').select('id,slug').eq('slug', TENANT_SLUG),
        api.from('directory_tags').select('id,name').eq('category', 'market_goal'),
      ])
      if (!live) return
      setTenantId(Array.isArray(tenants) && tenants[0] ? tenants[0].id : null)
      const map = {}
      for (const t of tags || []) map[t.id] = t.name
      setTagName(map)
    })()
    return () => { live = false }
  }, [])

  useEffect(() => {
    let live = true
    setRows(null)
    setLoadError(null)
    setEditing(null)
    ;(async () => {
      if (!api) { setLoadError('This build has no database connection configured.'); setRows([]); return }
      const [list, pris, gls, counts] = await Promise.all([
        api.from(spec.table).select(spec.select).order(spec.order[0], { ascending: spec.order[1] }).limit(500),
        api.from('blueprint_priorities').select('id,tag_id,name,slug,sort_order').order('sort_order', { ascending: true }),
        api.from('blueprint_goals').select('id,title,priority_id').order('sort_order', { ascending: true }),
        Promise.all([
          api.from('blueprint_goals').select('priority_id').limit(2000),
          api.from('blueprint_initiatives').select('priority_id').limit(2000),
          api.from('blueprint_kpis').select('priority_id').limit(2000),
        ]),
      ])
      if (!live) return
      if (list.error) { setLoadError(list.error.message || `Could not read the ${spec.label.toLowerCase()}.`); setRows([]); return }
      setRows(Array.isArray(list.data) ? list.data : [])
      setPriorities(Array.isArray(pris.data) ? pris.data : [])
      setGoals(Array.isArray(gls.data) ? gls.data : [])
      const tally = {}
      const keys = ['goals', 'initiatives', 'kpis']
      counts.forEach((res, i) => {
        for (const r of res.data || []) {
          if (!r.priority_id) continue
          tally[r.priority_id] = tally[r.priority_id] || { goals: 0, initiatives: 0, kpis: 0 }
          tally[r.priority_id][keys[i]] += 1
        }
      })
      setChildCounts(tally)
    })()
    return () => { live = false }
  }, [entity, spec, attempt])

  const priorityLabel = useCallback((id) => {
    const p = priorities.find((x) => x.id === id)
    if (!p) return '—'
    return p.name || tagName[p.tag_id] || p.slug
  }, [priorities, tagName])

  const openNew = useCallback(() => {
    const blank = {}
    for (const f of spec.fields) {
      blank[f.id] = f.type === 'number' ? '' : (f.type === 'select' ? (f.options[0]?.id ?? '') : '')
    }
    setForm(blank)
    setEditing('new')
    setOutcome(null)
  }, [spec])

  const openEdit = useCallback((row) => {
    const next = {}
    for (const f of spec.fields) next[f.id] = row[f.id] === null || row[f.id] === undefined ? '' : String(row[f.id])
    setForm(next)
    setEditing(row)
    setOutcome(null)
  }, [spec])

  /**
   * Write one row to the activity feed. Runs ONLY after the primary write has
   * come back confirmed, so the feed can never describe a change that did not
   * land. `actor_email` is set server-side from the verified caller; sending it
   * here would be ignored, which is why it is not sent.
   */
  const logActivity = useCallback(async (action, entityId, summary) => {
    if (!tenantId) return { ok: false, why: 'no tenant resolved' }
    const { data, error } = await api
      .from('blueprint_activity')
      .insert({
        tenant_id: tenantId,
        action,
        entity_type: spec.entityType,
        entity_id: entityId,
        summary,
      })
      .select('id')
    if (error) return { ok: false, why: error.message }
    if (!Array.isArray(data) || !data.length) return { ok: false, why: 'the log accepted the row but stored nothing' }
    return { ok: true }
  }, [tenantId, spec])

  /* --- Save (insert or update) ------------------------------------------- */
  const save = useCallback(async (e) => {
    e.preventDefault()
    setOutcome(null)

    const missing = spec.fields.filter((f) => f.required && !String(form[f.id] ?? '').trim())
    if (missing.length) {
      setOutcome({ ok: false, text: `${missing.map((f) => f.label).join(' and ')} ${missing.length > 1 ? 'are' : 'is'} required.` })
      return
    }
    if (!tenantId) {
      setOutcome({ ok: false, text: 'Could not resolve the Space Rising tenant, so nothing was saved.' })
      return
    }

    const isNew = editing === 'new'
    const payload = buildPayload(spec.fields, form, isNew)

    setBusy(true)
    const write = isNew
      ? api.from(spec.table).insert({ ...payload, tenant_id: tenantId }).select(spec.select)
      : api.from(spec.table).update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editing.id).select(spec.select)

    const { data, error } = await write
    setBusy(false)

    if (error) {
      setOutcome({ ok: false, text: `Could not save — ${error.message || 'the change was refused.'} Nothing was written.` })
      return
    }
    // The zero-row trap: no error, nothing written. See the header note.
    const confirmed = Array.isArray(data) ? data[0] : null
    if (!confirmed) {
      setOutcome({
        ok: false,
        text: 'The database accepted the request but changed no record, which usually means this row is outside your permissions. Nothing was saved.',
      })
      return
    }

    const title = spec.titleOf(confirmed, { tagName })
    setRows((cur) => (isNew
      ? [...(cur || []), confirmed]
      : (cur || []).map((r) => (r.id === confirmed.id ? confirmed : r))))
    setEditing(null)

    const summary = isNew
      ? `${spec.noun[0].toUpperCase()}${spec.noun.slice(1)} added${confirmed.priority_id ? ` under ${priorityLabel(confirmed.priority_id)}` : ''}: ${title}`
      : `${spec.noun[0].toUpperCase()}${spec.noun.slice(1)} updated: ${title}`
    const logged = await logActivity(isNew ? 'created' : 'updated', confirmed.id, summary)

    setOutcome({
      ok: true,
      text: logged.ok
        ? `${title} — ${isNew ? 'added' : 'saved'}. It is live on the Blueprint page now.`
        : `${title} — ${isNew ? 'added' : 'saved'}, but it could not be written to the activity feed (${logged.why}).`,
    })
  }, [spec, form, editing, tenantId, tagName, priorityLabel, logActivity])

  /* --- Delete ------------------------------------------------------------- */
  const remove = useCallback(async (row) => {
    const title = spec.titleOf(row, { tagName })
    setBusy(true)
    setOutcome(null)
    const { data, error } = await api.from(spec.table).delete().eq('id', row.id).select('id')
    setBusy(false)
    if (error) {
      setOutcome({ ok: false, text: `Could not remove ${title} — ${error.message}. Nothing was deleted.` })
      return
    }
    if (!Array.isArray(data) || !data.length) {
      setOutcome({ ok: false, text: `The database accepted the request but removed no record, so ${title} is still there.` })
      return
    }
    setRows((cur) => (cur || []).filter((r) => r.id !== row.id))
    await logActivity('deleted', row.id, `${spec.noun[0].toUpperCase()}${spec.noun.slice(1)} removed: ${title}`)
    setOutcome({ ok: true, text: `${title} — removed.` })
  }, [spec, tagName, logActivity])

  /* --- Table -------------------------------------------------------------- */
  const tableRows = useMemo(() => (rows || []).map((r) => {
    const actions = (
      <ButtonRow>
        <Button variant="quiet" icon="edit" disabled={busy} onClick={() => openEdit(r)}>Edit</Button>
        {entity === 'priorities' ? null : (
          <Button variant="quiet" disabled={busy} onClick={() => remove(r)}>Remove</Button>
        )}
      </ButtonRow>
    )
    const base = { actions }
    if (entity === 'priorities') {
      const c = childCounts[r.id] || { goals: 0, initiatives: 0, kpis: 0 }
      return {
        id: r.id,
        cells: {
          ...base,
          name: (
            <div className="osv3p-table-org">
              <Icon name={r.icon || 'grid'} />
              <div>
                <div className="osv3p-iconlist-title">{r.name || tagName[r.tag_id] || r.slug}</div>
                <div className="osv3p-iconlist-sub">
                  {r.name ? 'name overridden here' : 'name from the ecosystem tag'}
                </div>
              </div>
            </div>
          ),
          theme: r.theme || '—',
          counts: `${c.goals} goals · ${c.initiatives} initiatives · ${c.kpis} KPIs`,
          status: <Pill status tone={STATUS_TONE[r.status] || 'unverified'}>{STATUS_LABEL[r.status] || r.status}</Pill>,
        },
      }
    }
    if (entity === 'goals') {
      return {
        id: r.id,
        cells: {
          ...base,
          code: r.code || '—',
          title: (
            <div>
              <div className="osv3p-iconlist-title">{r.title}</div>
              {r.owner ? <div className="osv3p-iconlist-sub">{r.owner}</div> : null}
            </div>
          ),
          priority: priorityLabel(r.priority_id),
          status: <Pill status tone={STATUS_TONE[r.status] || 'unverified'}>{STATUS_LABEL[r.status] || r.status}</Pill>,
          progress: `${r.progress_pct ?? 0}%`,
        },
      }
    }
    if (entity === 'initiatives') {
      return {
        id: r.id,
        cells: {
          ...base,
          title: <div className="osv3p-iconlist-title">{r.title}</div>,
          priority: priorityLabel(r.priority_id),
          lead: r.lead_org || <span className="osv3p-pagehead-sub">Unassigned</span>,
          status: <Pill status tone={STATUS_TONE[r.status] || 'unverified'}>{STATUS_LABEL[r.status] || r.status}</Pill>,
        },
      }
    }
    return {
      id: r.id,
      cells: {
        ...base,
        name: (
          <div>
            <div className="osv3p-iconlist-title">{r.name}</div>
            {r.source ? <div className="osv3p-iconlist-sub">Source: {r.source}</div> : null}
          </div>
        ),
        priority: priorityLabel(r.priority_id),
        /* Never a 0 for a measure nobody has taken. */
        current: r.current_value === null || r.current_value === undefined
          ? <span className="osv3p-pagehead-sub">Not measured</span>
          : formatCount(Number(r.current_value)),
        target: r.target_value === null || r.target_value === undefined
          ? '—'
          : formatCount(Number(r.target_value)),
      },
    }
  }), [rows, entity, busy, childCounts, tagName, priorityLabel, openEdit, remove])

  /* --- Form field renderer ------------------------------------------------ */
  const renderField = (f) => {
    const id = `bp-${entity}-${f.id}`
    const value = form[f.id] ?? ''
    const set = (v) => setForm((cur) => ({ ...cur, [f.id]: v }))

    let control
    if (f.type === 'textarea') {
      control = <textarea id={id} className="osv3p-textarea" rows={f.rows || 3} value={value} onChange={(e) => set(e.target.value)} />
    } else if (f.type === 'select') {
      control = (
        <select id={id} className="osv3p-select" value={value} onChange={(e) => set(e.target.value)}>
          {f.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      )
    } else if (f.type === 'priority') {
      control = (
        <select id={id} className="osv3p-select" value={value} onChange={(e) => set(e.target.value)}>
          <option value="">Choose a priority…</option>
          {priorities.map((p) => (
            <option key={p.id} value={p.id}>{p.name || tagName[p.tag_id] || p.slug}</option>
          ))}
        </select>
      )
    } else if (f.type === 'goal') {
      const scoped = goals.filter((g) => !form.priority_id || g.priority_id === form.priority_id)
      control = (
        <select id={id} className="osv3p-select" value={value} onChange={(e) => set(e.target.value)}>
          <option value="">No goal — sits under the priority</option>
          {scoped.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      )
    } else {
      control = (
        <input
          id={id}
          className="osv3p-input"
          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
          min={f.min}
          max={f.max}
          value={value}
          placeholder={f.id === 'name' && editing !== 'new' && editing?.tag_id ? (tagName[editing.tag_id] || '') : undefined}
          onChange={(e) => set(e.target.value)}
        />
      )
    }

    return (
      <div className="osv3-bpadmin-field" key={f.id}>
        <label className="osv3p-field-label" htmlFor={id}>
          {f.label}{f.required ? ' *' : ''}
        </label>
        {control}
        {f.help ? <p className="osv3-bpadmin-help">{f.help}</p> : null}
      </div>
    )
  }

  if (rows === null) {
    return (
      <EmptyState
        icon="clock"
        title={`Reading the ${spec.label.toLowerCase()}`}
        body="Read straight from the database. Nothing is shown until the whole list is back, so no figure here is a stale one."
      />
    )
  }

  if (loadError) {
    return (
      <EmptyState
        icon="signal"
        title="This build cannot read the Blueprint tables"
        body={loadError}
        action={<Button variant="quiet" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}
      />
    )
  }

  return (
    <div className="osv3-bpadmin">
      <div className="osv3p-users-bar">
        <div className="osv3p-seg" role="group" aria-label="Choose what to edit">
          {ENTITY_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={entity === id ? 'osv3p-seg-btn osv3p-seg-btn--on' : 'osv3p-seg-btn'}
              aria-pressed={entity === id}
              onClick={() => setEntity(id)}
            >
              {ENTITIES[id].label}
              {entity === id ? <span className="osv3p-seg-count">{formatCount(rows.length)}</span> : null}
            </button>
          ))}
        </div>
        {/* Priorities are created by the migration and bound to the ecosystem
            tags, so there is no "Add priority" here — a seventh pillar is a
            decision about the ecosystem's categories, not a form fill. Editing
            the six is fully supported. */}
        {entity === 'priorities' ? null : (
          <Button variant="solid" icon="plus" onClick={openNew}>Add {spec.noun}</Button>
        )}
      </div>

      {outcome ? (
        <p
          className={outcome.ok ? 'osv3p-savebar-msg osv3p-savebar-msg--ok' : 'osv3p-savebar-msg osv3p-savebar-msg--err'}
          role={outcome.ok ? 'status' : 'alert'}
        >
          {outcome.text}
        </p>
      ) : null}

      {editing ? (
        <Card>
          <header className="osv3p-card-header">
            <h2 className="osv3p-rail-title">
              {editing === 'new' ? `New ${spec.noun}` : `Edit ${spec.titleOf(editing, { tagName })}`}
            </h2>
          </header>
          <CardBody>
            <form onSubmit={save}>
              <div className="osv3-bpadmin-form">
                {spec.fields.map(renderField)}
              </div>
              <ButtonRow>
                <Button variant="solid" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : editing === 'new' ? `Add ${spec.noun}` : 'Save changes'}
                </Button>
                <Button variant="quiet" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
              </ButtonRow>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody>
          {tableRows.length === 0 ? (
            <EmptyState
              icon="grid"
              title={`No ${spec.label.toLowerCase()} yet`}
              body={`Nothing has been written under the Blueprint yet. The first ${spec.noun} you add here appears on the Blueprint page immediately — in the count tile, in its priority's card, and in the activity feed.`}
              action={<Button variant="solid" icon="plus" onClick={openNew}>Add the first {spec.noun}</Button>}
            />
          ) : (
            <DataTable
              caption={`Every ${spec.label.toLowerCase().replace(/s$/, '')} recorded under the Blueprint`}
              columns={spec.columns}
              rows={tableRows}
            />
          )}
        </CardBody>
      </Card>

      <p className="osv3p-footnote">
        Changes here are live the moment they save — the Blueprint page counts these tables at
        every load and holds no cache. Every save and removal is written to the Blueprint
        activity feed with who did it and when.
        {' '}Last read {formatDate(new Date().toISOString())}.
      </p>
    </div>
  )
}
