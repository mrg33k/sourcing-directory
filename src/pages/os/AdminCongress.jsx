import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, CardBody, Button, ButtonRow, DataTable, Pill, EmptyState,
} from '../../components/osv3/index.js'
import { createAdminApiClient } from '../../lib/adminApi.js'
import { supabase } from '../../lib/supabase.js'
import './osv3-congress.css'

/**
 * The Congress tab of Admin Tools — where the client fills in everything the
 * /congress page counts.
 *
 * ===========================================================================
 * WHY THIS SCREEN IS THE POINT, NOT THE GARNISH
 * ===========================================================================
 * /congress ships with an event and nothing else: zero sessions, zero speakers,
 * zero participating organizations. That is honest, but it is only USEFUL if the
 * people who run the Congress can fill it in themselves. A page backed by tables
 * that only an engineer can write to is not a finished page — it is a demo with
 * a database behind it.
 *
 * So this screen is CRUD, deliberately plain: four sections, a list and a form
 * each, no wizard, no drag-and-drop. An events manager should be able to add
 * tomorrow's agenda without being taught anything.
 *
 * ===========================================================================
 * IT DOES NOT LIE ABOUT WHETHER A WRITE LANDED
 * ===========================================================================
 * Copied deliberately from AdminUsers.jsx, which documents the two live traps:
 *   1. adminApi ALWAYS RESOLVES — it returns { data, error } and never rejects,
 *      so a caller that ignores `error` shows success for a request that 403'd.
 *   2. A PostgREST write that RLS narrows to ZERO rows returns NO error.
 * Every mutation here therefore asks for the row back with .select() and treats
 * an empty array as a FAILURE. Local state is patched from what the server
 * returned, never from what we sent, and the outcome line names the record
 * ("Opening Keynote saved" / "Could not save Opening Keynote — ...").
 *
 * The tenant is always sent explicitly. api/sourcing/admin.js injects it for a
 * tenant-scoped admin but requires it from a global admin, and this screen has
 * to work for both.
 */

const api = createAdminApiClient()
const TENANT_SLUG = 'space-rising'

const SECTIONS = [
  { id: 'event', label: 'Event' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'speakers', label: 'Speakers' },
  { id: 'organizations', label: 'Organizations' },
]

const ROLES = ['exhibitor', 'sponsor', 'academic', 'partner', 'attendee']

const ROLE_TONE = {
  exhibitor: 'verified',
  sponsor: 'pending',
  academic: undefined,
  partner: 'verified',
  attendee: 'unverified',
}

const EVENT_FIELDS = [
  { key: 'name', label: 'Event name', required: true },
  { key: 'starts_on', label: 'Start date', type: 'date', required: true },
  { key: 'ends_on', label: 'End date', type: 'date', hint: 'Same as the start date for a one-day Congress.' },
  { key: 'venue', label: 'Venue' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'website_url', label: 'Congress website', hint: 'The full address, including https://' },
  { key: 'hero_image_url', label: 'Hero image', hint: 'A path such as /images/space-rising/hero-banner.jpg, or a full URL.' },
  { key: 'summary', label: 'Short line', type: 'textarea', hint: 'One or two sentences, shown on the date card.' },
  { key: 'description', label: 'Description', type: 'textarea', hint: 'Shown in the hero. Its first sentence is what appears there.' },
]

const SESSION_FIELDS = [
  { key: 'title', label: 'Session title', required: true },
  { key: 'session_date', label: 'Date', type: 'date' },
  { key: 'starts_at', label: 'Starts', type: 'time' },
  { key: 'ends_at', label: 'Ends', type: 'time' },
  { key: 'room', label: 'Room', hint: 'For example: Main Stage, Summit Room 1.' },
  { key: 'track', label: 'Track' },
]

const SPEAKER_FIELDS = [
  { key: 'full_name', label: 'Full name', required: true },
  { key: 'title', label: 'Job title' },
  { key: 'org_name', label: 'Organization' },
  { key: 'headshot_url', label: 'Headshot URL', hint: 'Optional. Without one, their initials are shown.' },
]

/** '09:00:00' -> '9:00 AM'. The raw column value is unreadable in a list. */
function hhmm(t) {
  if (!t) return ''
  const [h, m] = String(t).split(':')
  const n = Number(h)
  if (Number.isNaN(n)) return ''
  return `${n % 12 === 0 ? 12 : n % 12}:${m || '00'} ${n >= 12 ? 'PM' : 'AM'}`
}

function blankFrom(fields) {
  return fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
}

/** Strip empty strings — an empty text input must write NULL, not ''. */
function clean(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined) continue
    out[k] = v
  }
  return out
}

/** One labelled control. No inline styles; classes come from osv3-profile.css. */
function Field({ field, value, onChange }) {
  const id = `cg-${field.key}`
  const common = {
    id,
    value: value ?? '',
    onChange: (e) => onChange(field.key, e.target.value),
  }
  return (
    <div className="osv3-cga-field">
      <label className="osv3p-field-label" htmlFor={id}>
        {field.label}{field.required ? ' *' : ''}
      </label>
      {field.type === 'textarea'
        ? <textarea className="osv3p-textarea" rows={3} {...common} />
        : <input className="osv3p-input" type={field.type || 'text'} {...common} />}
      {field.hint ? <p className="osv3-cga-hint">{field.hint}</p> : null}
    </div>
  )
}

export default function AdminCongress() {
  const [section, setSection] = useState('event')
  const [tenantId, setTenantId] = useState(null)
  const [event, setEvent] = useState(undefined)   // undefined = unread, null = none
  const [sessions, setSessions] = useState([])
  const [speakers, setSpeakers] = useState([])
  const [orgs, setOrgs] = useState([])
  const [companies, setCompanies] = useState([])
  const [links, setLinks] = useState([])          // congress_session_speakers
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [outcome, setOutcome] = useState(null)    // { ok, text }
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const [eventForm, setEventForm] = useState(blankFrom(EVENT_FIELDS))
  const [sessionForm, setSessionForm] = useState({ ...blankFrom(SESSION_FIELDS), is_featured: true, speaker_id: '' })
  const [speakerForm, setSpeakerForm] = useState(blankFrom(SPEAKER_FIELDS))
  const [orgForm, setOrgForm] = useState({ company_id: '', role: 'exhibitor', sponsor_tier: '', booth: '' })
  const [companyFilter, setCompanyFilter] = useState('')

  /* ------------------------------------------------------------------ load */
  useEffect(() => {
    let live = true
    setLoading(true)
    setLoadError(null)
    ;(async () => {
      if (!supabase) {
        if (live) { setLoadError('This build has no database connection configured.'); setLoading(false) }
        return
      }
      const { data: t } = await supabase.from('directory_tenants').select('id').eq('slug', TENANT_SLUG).single()
      const tid = t?.id || null

      /* READS go through the ordinary client, WRITES through adminApi.
         The congress_* tables carry public-read RLS policies, so this screen
         reads exactly what the /congress page reads and cannot drift from it.
         The one table with no public read — congress_registrations, which holds
         registrant names and emails — is deliberately not read here. */
      const { data: evs, error: evErr } = await supabase.from('congress_events')
        .select('id,tenant_id,name,slug,edition_year,starts_on,ends_on,venue,city,state,summary,description,website_url,hero_image_url,status')
        .order('starts_on', { ascending: false }).limit(10)
      if (!live) return
      if (evErr) { setLoadError(evErr.message || 'Could not read the Congress.'); setLoading(false); return }

      const ev = (evs || [])[0] || null
      setTenantId(tid)
      setEvent(ev)
      if (ev) {
        setEventForm(EVENT_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: ev[f.key] ?? '' }), {}))
        const [se, sp, og, co, lk] = await Promise.all([
          supabase.from('congress_sessions')
            .select('id,title,session_date,starts_at,ends_at,room,track,is_featured,status')
            .eq('event_id', ev.id).order('session_date', { ascending: true }).limit(200),
          supabase.from('congress_speakers')
            .select('id,full_name,title,org_name,headshot_url').eq('event_id', ev.id).limit(200),
          supabase.from('congress_organizations')
            .select('id,company_id,role,sponsor_tier,booth,status').eq('event_id', ev.id).limit(200),
          supabase.from('directory_companies')
            .select('id,name,vertical,city,state').eq('status', 'active').order('name').limit(500),
          supabase.from('congress_session_speakers').select('id,session_id,speaker_id').limit(500),
        ])
        if (!live) return
        setSessions(se.data || [])
        setSpeakers(sp.data || [])
        setOrgs(og.data || [])
        setCompanies(co.data || [])
        setLinks(lk.data || [])
      }
      setLoading(false)
    })()
    return () => { live = false }
  }, [attempt])

  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies])
  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers])
  const speakerForSession = useCallback((sessionId) => {
    const l = links.find((x) => x.session_id === sessionId)
    return l ? speakerById.get(l.speaker_id) : null
  }, [links, speakerById])

  const reload = () => setAttempt((n) => n + 1)

  /* ---------------------------------------------------------------- writes */

  /** Every mutation goes through here so none of them can skip the proof step. */
  const run = useCallback(async (label, build) => {
    setBusy(true)
    setOutcome(null)
    const { data, error } = await build()
    setBusy(false)
    if (error) {
      setOutcome({ ok: false, text: `Could not save ${label} — ${error.message || 'the change was refused.'}` })
      return null
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) {
      /* The zero-row trap: no error, nothing written. */
      setOutcome({
        ok: false,
        text: `Could not save ${label} — the database accepted the request but changed no record, which usually means it is outside your permissions. Nothing was saved.`,
      })
      return null
    }
    setOutcome({ ok: true, text: `${label} saved.` })
    return row
  }, [])

  const saveEvent = async () => {
    const payload = clean({ ...eventForm, tenant_id: tenantId, status: 'published' })
    if (!payload.name || !payload.starts_on) {
      setOutcome({ ok: false, text: 'An event needs at least a name and a start date.' }); return
    }
    const label = payload.name
    const row = event
      ? await run(label, () => api.from('congress_events').update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', event.id).select('id,name,starts_on,ends_on,venue,city,state,summary,description,website_url,hero_image_url,status'))
      : await run(label, () => api.from('congress_events').insert(payload)
          .select('id,name,starts_on,ends_on,venue,city,state,summary,description,website_url,hero_image_url,status'))
    if (row) { setEvent((cur) => ({ ...(cur || {}), ...row })); if (!event) reload() }
  }

  const addSession = async () => {
    if (!event) return
    if (!sessionForm.title) { setOutcome({ ok: false, text: 'A session needs a title.' }); return }
    const { speaker_id: speakerId, ...rest } = sessionForm
    const payload = clean({
      ...rest,
      is_featured: rest.is_featured !== false,
      tenant_id: tenantId,
      event_id: event.id,
      status: 'published',
    })
    const row = await run(sessionForm.title, () => api.from('congress_sessions').insert(payload)
      .select('id,title,session_date,starts_at,ends_at,room,track,is_featured,status'))
    if (!row) return
    setSessions((cur) => [...cur, row])
    if (speakerId) {
      const { data: linkRow } = await api.from('congress_session_speakers')
        .insert({ tenant_id: tenantId, session_id: row.id, speaker_id: speakerId })
        .select('id,session_id,speaker_id')
      const l = Array.isArray(linkRow) ? linkRow[0] : linkRow
      if (l) setLinks((cur) => [...cur, l])
      else setOutcome({ ok: false, text: `${row.title} was saved, but the speaker could not be attached to it.` })
    }
    setSessionForm({ ...blankFrom(SESSION_FIELDS), is_featured: true, speaker_id: '' })
  }

  const addSpeaker = async () => {
    if (!event) return
    if (!speakerForm.full_name) { setOutcome({ ok: false, text: 'A speaker needs a name.' }); return }
    const payload = clean({ ...speakerForm, tenant_id: tenantId, event_id: event.id })
    const row = await run(speakerForm.full_name, () => api.from('congress_speakers').insert(payload)
      .select('id,full_name,title,org_name,headshot_url'))
    if (!row) return
    setSpeakers((cur) => [...cur, row])
    setSpeakerForm(blankFrom(SPEAKER_FIELDS))
  }

  const addOrg = async () => {
    if (!event) return
    if (!orgForm.company_id) { setOutcome({ ok: false, text: 'Choose an organization first.' }); return }
    const name = companyById.get(orgForm.company_id)?.name || 'the organization'
    const payload = clean({ ...orgForm, tenant_id: tenantId, event_id: event.id, status: 'published' })
    const row = await run(name, () => api.from('congress_organizations').insert(payload)
      .select('id,company_id,role,sponsor_tier,booth,status'))
    if (!row) return
    setOrgs((cur) => [...cur, row])
    setOrgForm({ company_id: '', role: 'exhibitor', sponsor_tier: '', booth: '' })
  }

  const removeRow = async (table, id, label, setter) => {
    setBusy(true)
    setOutcome(null)
    const { data, error } = await api.from(table).delete().eq('id', id).select('id')
    setBusy(false)
    if (error) { setOutcome({ ok: false, text: `Could not remove ${label} — ${error.message}` }); return }
    if (!(Array.isArray(data) ? data[0] : data)) {
      setOutcome({ ok: false, text: `Could not remove ${label} — the database changed no record.` }); return
    }
    setter((cur) => cur.filter((r) => r.id !== id))
    setOutcome({ ok: true, text: `${label} removed.` })
  }

  /* ---------------------------------------------------------------- states */
  if (loading) {
    return <EmptyState icon="clock" title="Reading the Congress"
      body="The event, its agenda, its speakers and the organizations taking part are being read from the database." />
  }
  if (loadError) {
    return <EmptyState icon="signal" title="This build cannot read the Congress" body={loadError}
      action={<Button variant="quiet" onClick={reload}>Try again</Button>} />
  }

  const outcomeLine = outcome ? (
    <p className={outcome.ok ? 'osv3p-savebar-msg osv3p-savebar-msg--ok' : 'osv3p-savebar-msg osv3p-savebar-msg--err'}
      role={outcome.ok ? 'status' : 'alert'}>
      {outcome.text}
    </p>
  ) : null

  const filteredCompanies = companyFilter.trim()
    ? companies.filter((c) => c.name.toLowerCase().includes(companyFilter.trim().toLowerCase()))
    : companies

  return (
    <div className="osv3-cga">
      <div className="osv3p-seg" role="group" aria-label="Congress sections">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button"
            className={section === s.id ? 'osv3p-seg-btn osv3p-seg-btn--on' : 'osv3p-seg-btn'}
            aria-pressed={section === s.id} onClick={() => setSection(s.id)}>
            {s.label}
            {s.id === 'sessions' ? <span className="osv3p-seg-count">{sessions.length}</span> : null}
            {s.id === 'speakers' ? <span className="osv3p-seg-count">{speakers.length}</span> : null}
            {s.id === 'organizations' ? <span className="osv3p-seg-count">{orgs.length}</span> : null}
          </button>
        ))}
      </div>

      {outcomeLine}

      {/* ============================ EVENT ============================ */}
      {section === 'event' ? (
        <Card>
          <CardBody>
            <h3 className="osv3p-rail-title">{event ? 'Edit the Congress' : 'Create the Congress'}</h3>
            <p className="osv3-cga-hint">
              {event
                ? 'This one record is where every date, place and description on the Congress page comes from. Change it here and the whole page follows.'
                : 'Nothing appears on the Congress page until this record exists. It needs a name and a start date; everything else can be filled in later.'}
            </p>
            <div className="osv3-cga-grid">
              {EVENT_FIELDS.map((f) => (
                <Field key={f.key} field={f} value={eventForm[f.key]}
                  onChange={(k, v) => setEventForm((cur) => ({ ...cur, [k]: v }))} />
              ))}
            </div>
            <ButtonRow>
              <Button variant="solid" disabled={busy} onClick={saveEvent}>
                {busy ? 'Saving…' : event ? 'Save the Congress' : 'Create the Congress'}
              </Button>
            </ButtonRow>
          </CardBody>
        </Card>
      ) : null}

      {!event && section !== 'event' ? (
        <EmptyState icon="calendar" title="Create the Congress first"
          body="Sessions, speakers and participating organizations all hang off the event record, so there is nowhere to attach them until it exists."
          action={<Button variant="quiet" onClick={() => setSection('event')}>Go to the Event tab</Button>} />
      ) : null}

      {/* =========================== SESSIONS =========================== */}
      {section === 'sessions' && event ? (
        <>
          <Card>
            <CardBody>
              <h3 className="osv3p-rail-title">Add a session</h3>
              <p className="osv3-cga-hint">
                Sessions marked as featured appear in Featured Sessions on the Congress page; every session appears under the Sessions tab.
              </p>
              <div className="osv3-cga-grid">
                {SESSION_FIELDS.map((f) => (
                  <Field key={f.key} field={f} value={sessionForm[f.key]}
                    onChange={(k, v) => setSessionForm((cur) => ({ ...cur, [k]: v }))} />
                ))}
                <div className="osv3-cga-field">
                  <label className="osv3p-field-label" htmlFor="cg-session-speaker">Speaker</label>
                  <select id="cg-session-speaker" className="osv3p-select" value={sessionForm.speaker_id}
                    onChange={(e) => setSessionForm((cur) => ({ ...cur, speaker_id: e.target.value }))}>
                    <option value="">No speaker yet</option>
                    {speakers.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                  <p className="osv3-cga-hint">Add people under Speakers first, then pick one here.</p>
                </div>
                <div className="osv3-cga-field">
                  <label className="osv3p-field-label" htmlFor="cg-session-featured">Featured</label>
                  <select id="cg-session-featured" className="osv3p-select"
                    value={sessionForm.is_featured === false ? 'no' : 'yes'}
                    onChange={(e) => setSessionForm((cur) => ({ ...cur, is_featured: e.target.value === 'yes' }))}>
                    <option value="yes">Yes — show in Featured Sessions</option>
                    <option value="no">No — agenda only</option>
                  </select>
                </div>
              </div>
              <ButtonRow>
                <Button variant="solid" icon="plus" disabled={busy} onClick={addSession}>
                  {busy ? 'Saving…' : 'Add session'}
                </Button>
              </ButtonRow>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="osv3p-rail-title">Sessions on the agenda</h3>
              {sessions.length === 0 ? (
                <EmptyState icon="calendar" title="No sessions yet"
                  body="The agenda is empty, and the Congress page says so rather than showing an invented one." />
              ) : (
                <DataTable
                  columns={[
                    { id: 'title', header: 'Session' },
                    { id: 'when', header: 'When' },
                    { id: 'room', header: 'Room' },
                    { id: 'speaker', header: 'Speaker' },
                    { id: 'featured', header: 'Featured' },
                    { id: 'actions', header: 'Actions', align: 'right' },
                  ]}
                  rows={sessions.map((s) => ({
                    id: s.id,
                    cells: {
                      title: <span className="osv3p-iconlist-title">{s.title}</span>,
                      when: [s.session_date, [s.starts_at, s.ends_at].map(hhmm).filter(Boolean).join(' – ')].filter(Boolean).join(' · ') || '—',
                      room: s.room || '—',
                      speaker: speakerForSession(s.id)?.full_name || '—',
                      featured: s.is_featured ? <Pill status tone="verified">Featured</Pill> : <Pill status tone="unverified">Agenda</Pill>,
                      actions: (
                        <Button variant="quiet" disabled={busy}
                          onClick={() => removeRow('congress_sessions', s.id, s.title, setSessions)}>Remove</Button>
                      ),
                    },
                  }))}
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      {/* =========================== SPEAKERS =========================== */}
      {section === 'speakers' && event ? (
        <>
          <Card>
            <CardBody>
              <h3 className="osv3p-rail-title">Add a speaker</h3>
              <p className="osv3-cga-hint">
                A speaker does not have to be in the Space OS directory — a name is enough. Without a headshot their initials are shown, which is the normal case.
              </p>
              <div className="osv3-cga-grid">
                {SPEAKER_FIELDS.map((f) => (
                  <Field key={f.key} field={f} value={speakerForm[f.key]}
                    onChange={(k, v) => setSpeakerForm((cur) => ({ ...cur, [k]: v }))} />
                ))}
              </div>
              <ButtonRow>
                <Button variant="solid" icon="plus" disabled={busy} onClick={addSpeaker}>
                  {busy ? 'Saving…' : 'Add speaker'}
                </Button>
              </ButtonRow>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="osv3p-rail-title">Speakers</h3>
              {speakers.length === 0 ? (
                <EmptyState icon="megaphone" title="No speakers yet"
                  body="Add the people speaking at the Congress here, then attach them to sessions." />
              ) : (
                <DataTable
                  columns={[
                    { id: 'name', header: 'Speaker' },
                    { id: 'title', header: 'Title' },
                    { id: 'org', header: 'Organization' },
                    { id: 'actions', header: 'Actions', align: 'right' },
                  ]}
                  rows={speakers.map((s) => ({
                    id: s.id,
                    cells: {
                      name: <span className="osv3p-iconlist-title">{s.full_name}</span>,
                      title: s.title || '—',
                      org: s.org_name || '—',
                      actions: (
                        <Button variant="quiet" disabled={busy}
                          onClick={() => removeRow('congress_speakers', s.id, s.full_name, setSpeakers)}>Remove</Button>
                      ),
                    },
                  }))}
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      {/* ======================== ORGANIZATIONS ======================== */}
      {section === 'organizations' && event ? (
        <>
          <Card>
            <CardBody>
              <h3 className="osv3p-rail-title">Add an organization to the Congress</h3>
              <p className="osv3-cga-hint">
                Pick an organization already in Space OS and give it a role. Exhibitors, sponsors and academic institutions all appear in the
                Organizations Attending carousel with their badge; sponsors and partners also fill the Sponsors &amp; Partners tab.
              </p>
              <div className="osv3-cga-grid">
                <div className="osv3-cga-field">
                  <label className="osv3p-field-label" htmlFor="cg-org-filter">Find an organization</label>
                  <input id="cg-org-filter" className="osv3p-input" type="search" value={companyFilter}
                    placeholder="Type part of the name" onChange={(e) => setCompanyFilter(e.target.value)} />
                  <p className="osv3-cga-hint">{filteredCompanies.length} of {companies.length} shown.</p>
                </div>
                <div className="osv3-cga-field">
                  <label className="osv3p-field-label" htmlFor="cg-org-company">Organization *</label>
                  <select id="cg-org-company" className="osv3p-select" value={orgForm.company_id}
                    onChange={(e) => setOrgForm((cur) => ({ ...cur, company_id: e.target.value }))}>
                    <option value="">Choose an organization</option>
                    {filteredCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.city ? ` — ${c.city}${c.state ? `, ${c.state}` : ''}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="osv3-cga-field">
                  <label className="osv3p-field-label" htmlFor="cg-org-role">Role *</label>
                  <select id="cg-org-role" className="osv3p-select" value={orgForm.role}
                    onChange={(e) => setOrgForm((cur) => ({ ...cur, role: e.target.value }))}>
                    {ROLES.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div className="osv3-cga-field">
                  <label className="osv3p-field-label" htmlFor="cg-org-tier">Sponsor tier</label>
                  <input id="cg-org-tier" className="osv3p-input" type="text" value={orgForm.sponsor_tier}
                    placeholder="Platinum, Gold…"
                    onChange={(e) => setOrgForm((cur) => ({ ...cur, sponsor_tier: e.target.value }))} />
                </div>
                <div className="osv3-cga-field">
                  <label className="osv3p-field-label" htmlFor="cg-org-booth">Booth</label>
                  <input id="cg-org-booth" className="osv3p-input" type="text" value={orgForm.booth}
                    onChange={(e) => setOrgForm((cur) => ({ ...cur, booth: e.target.value }))} />
                </div>
              </div>
              <ButtonRow>
                <Button variant="solid" icon="plus" disabled={busy} onClick={addOrg}>
                  {busy ? 'Saving…' : 'Add to Congress'}
                </Button>
              </ButtonRow>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="osv3p-rail-title">Organizations at the Congress</h3>
              {orgs.length === 0 ? (
                <EmptyState icon="building" title="No organizations on this Congress yet"
                  body="Space OS holds 165 organizations. Marking one here is what puts it on the Congress page and moves the Organizations Represented count off zero." />
              ) : (
                <DataTable
                  columns={[
                    { id: 'org', header: 'Organization' },
                    { id: 'role', header: 'Role' },
                    { id: 'tier', header: 'Tier / booth' },
                    { id: 'actions', header: 'Actions', align: 'right' },
                  ]}
                  rows={orgs.map((o) => {
                    const c = companyById.get(o.company_id)
                    const name = c?.name || o.company_id
                    return {
                      id: o.id,
                      cells: {
                        org: (
                          <div>
                            <div className="osv3p-iconlist-title">{name}</div>
                            {c ? <div className="osv3p-iconlist-sub">{[c.vertical, c.city].filter(Boolean).join(' · ')}</div> : null}
                          </div>
                        ),
                        role: <Pill status tone={ROLE_TONE[o.role]}>{o.role[0].toUpperCase() + o.role.slice(1)}</Pill>,
                        tier: [o.sponsor_tier, o.booth].filter(Boolean).join(' · ') || '—',
                        actions: (
                          <Button variant="quiet" disabled={busy}
                            onClick={() => removeRow('congress_organizations', o.id, name, setOrgs)}>Remove</Button>
                        ),
                      },
                    }
                  })}
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  )
}
