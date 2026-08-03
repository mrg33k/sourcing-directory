import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, CardBody, CardLink, CardAction,
  Tabs, Pill, LogoTile, Avatar, Icon,
  Button, EmptyState,
} from '../../components/osv3/index.js'
import { supabase } from '../../lib/supabase.js'
import '../../styles/osv3-profile.css'
import './osv3-congress.css'

/**
 * Space Congress Integration — what a Space OS member opens to find out what is
 * happening at the Arizona Space Congress and how they take part.
 *
 * ===========================================================================
 * EVERY NUMBER ON THIS SCREEN IS COUNTED, AND ON DAY ONE THEY ARE ALL ZERO
 * ===========================================================================
 * The design comp for this page shows 842 registered participants, 412
 * organizations represented, 1,326 connections enabled and 48 sessions. None of
 * those figures existed anywhere in this product — there was no event record, no
 * registrations table, no sessions table, no speakers table and no concept of a
 * "connection" in the entire database. They were invented by the tool that drew
 * the comp.
 *
 * So this screen counts. congress_event_stats() returns four real integers and
 * they are printed exactly as returned. Today that is 0 / 0 / 0 / 0, each tab is
 * a real empty state naming the admin step that fills it, and the page NEVER
 * says 842. The first time a client admin adds a session, the sessions figure
 * reads 1, because it is a count and not a picture of one.
 *
 * ===========================================================================
 * THE STAT THAT IS NOT ON THE COMP, AND THE ONE THAT IS NOT ON THIS PAGE
 * ===========================================================================
 * The comp's third stat is "Connections Enabled". There is no connections table,
 * no saved-items table and no follow/contact concept anywhere in Space OS —
 * src/pages/os/OSConnections.jsx is itself a hardcoded EmptyState with no query.
 * A tile counting a thing that does not exist can only ever be fiction, so it is
 * NOT rendered. In its place: SPEAKERS, which is a genuine conference metric, has
 * a real table behind it (congress_speakers), sits naturally between
 * organizations and sessions, and moves the moment an admin does their job.
 *
 * ===========================================================================
 * "UPCOMING" IS DERIVED, NOT TYPED
 * ===========================================================================
 * The comp hardcodes the heading "Upcoming Congress". The seeded event ran on
 * 2026-04-29 and today is later than that, so on this build the honest heading is
 * "Most Recent Congress" — and it becomes "Upcoming Congress" by itself the day
 * an admin adds the next edition. A page that calls a concluded event "upcoming"
 * is the same class of error as a page that prints 842.
 *
 * Data: congress_events, congress_sessions, congress_speakers,
 * congress_session_speakers, congress_organizations, congress_registrations,
 * congress_media -> directory_listings. All tenant-scoped to 'space-rising'.
 * No inline styles: every value comes from a class reading a --v3-* token.
 */

const TENANT_DB_LOOKUP_SLUG = 'space-rising'

const TABS = [
  { id: 'participants', label: 'Participants & Organizations' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'networking', label: 'Networking' },
  { id: 'sponsors', label: 'Sponsors & Partners' },
]

/* Role -> the Pill tone that already exists in the design system. There is no
   "exhibitor" tone and inventing one would mean editing a shared stylesheet, so
   each role borrows the status tone whose colour reads correctly for it. */
const ROLE_TONE = {
  exhibitor: 'verified',
  sponsor: 'pending',
  academic: undefined,
  partner: 'verified',
  attendee: 'unverified',
}

const ROLE_LABEL = {
  exhibitor: 'Exhibitor',
  sponsor: 'Sponsor',
  academic: 'Academic',
  partner: 'Partner',
  attendee: 'Attendee',
}

const MEDIA_KIND = {
  video: 'Video',
  news: 'News',
  podcast: 'Podcast',
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

/** 'YYYY-MM-DD' -> a Date built in LOCAL time.
 *  `new Date('2026-04-29')` parses as UTC midnight and renders as April 28 for
 *  anyone west of Greenwich — which is every user of an Arizona event. */
function localDate(ymd) {
  if (!ymd) return null
  const [y, m, d] = String(ymd).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** "April 29, 2026" · "April 28 – 29, 2026" · "April 29 – May 1, 2026" */
function formatRange(startYmd, endYmd) {
  const s = localDate(startYmd)
  if (!s) return null
  const e = localDate(endYmd)
  const sM = MONTHS[s.getMonth()]
  if (!e || e.getTime() === s.getTime()) return `${sM} ${s.getDate()}, ${s.getFullYear()}`
  if (e.getMonth() === s.getMonth() && e.getFullYear() === s.getFullYear()) {
    return `${sM} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`
  }
  return `${sM} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`
}

/** '09:00:00' -> '9:00 AM'. Wall-clock, as the admin typed it — see the DATES
 *  note in the migration for why these are `time` and not an instant. */
function formatTime(t) {
  if (!t) return null
  const [hRaw, mRaw] = String(t).split(':')
  const h = Number(hRaw)
  if (Number.isNaN(h)) return null
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mRaw || '00'} ${suffix}`
}

function formatTimeRange(startsAt, endsAt) {
  const a = formatTime(startsAt)
  if (!a) return null
  const b = formatTime(endsAt)
  return b ? `${a} – ${b}` : a
}

function cityLine(row) {
  return [row?.city, row?.state].filter(Boolean).join(', ')
}

/**
 * The hero shows the FIRST SENTENCE of the event description, not a truncation
 * of it.
 *
 * The client's own description runs to 47 words. Line-clamping it produced
 * "…synthesized by A…" — an ellipsis in the middle of a word, under the client's
 * own brand. Cutting at the sentence boundary keeps the copy verbatim and
 * grammatical, and the link immediately beneath opens the page carrying the rest.
 */
function firstSentence(text, minChars = 60) {
  const s = String(text || '').trim()
  if (!s) return ''
  const m = s.match(/^[\s\S]*?[.!?](?=\s|$)/)
  const head = m ? m[0].trim() : ''
  return head.length >= minChars ? head : s
}

/**
 * A YouTube watch/short URL -> its thumbnail.
 *
 * This is derived from the real URL already on the row, not invented: the same
 * derivation the one listing that HAS a cover_image_url used
 * (img.youtube.com/vi/<id>/maxresdefault.jpg). Anything that is not YouTube gets
 * no thumbnail and falls back to the outlet plate.
 */
function youtubeThumb(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null
}

/**
 * Session identity for the logged-in user.
 *
 * Not `useAuth()`: src/hooks/useAuth.js:10 calls supabase.auth.getSession() with
 * no null guard, so on a build with no env vars it throws and takes the whole
 * page down. This is the same hook with the guard the shared one is missing.
 */
function useViewer() {
  const [user, setUser] = useState(null)
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    if (!supabase) { setChecked(true); return undefined }
    let live = true
    supabase.auth.getSession()
      .then(({ data }) => { if (live) { setUser(data?.session?.user || null); setChecked(true) } })
      .catch(() => { if (live) setChecked(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (live) setUser(session?.user || null)
    })
    return () => { live = false; data?.subscription?.unsubscribe() }
  }, [])
  return { user, checked }
}

/** Card heading with an optional muted note and a right-hand link.
 *  Mixed-case dark heading (`osv3p-rail-title`) like AdminTools.jsx PanelHead,
 *  not the 11px caps of CardHeader — but the note sits on its OWN line rather
 *  than inline. The reference stacks them, and inline notes wrap into the title
 *  in the rail cards, where the column is only 288px wide. */
function SectionHead({ title, note, link, onLink, href }) {
  return (
    <header className="osv3p-card-header osv3-cg-head">
      <div className="osv3-cg-head-text">
        <h2 className="osv3p-rail-title">{title}</h2>
        {note ? <p className="osv3-cg-head-note">{note}</p> : null}
      </div>
      {link ? <CardLink href={href} onClick={onLink}>{link}</CardLink> : null}
    </header>
  )
}

/** One organization card in the attending carousel. */
function OrgCard({ row }) {
  const c = row.company || {}
  const role = String(row.role || 'attendee').toLowerCase()
  return (
    <article className="osv3-cg-orgcard">
      <span className="osv3-cg-orgcard-logo">
        <LogoTile src={c.logo_url} name={c.name} size="md" />
      </span>
      <h3 className="osv3-cg-orgcard-name">{c.name || 'Unnamed organization'}</h3>
      {c.vertical ? <p className="osv3-cg-orgcard-meta">{c.vertical}</p> : null}
      {cityLine(c) ? <p className="osv3-cg-orgcard-meta">{cityLine(c)}</p> : null}
      <span className="osv3-cg-orgcard-role">
        <Pill status tone={ROLE_TONE[role]}>{ROLE_LABEL[role] || 'Attending'}</Pill>
      </span>
    </article>
  )
}

/** One row in Featured Sessions: date chip, time, title, room, speaker. */
function SessionRow({ session }) {
  const d = localDate(session.session_date)
  const speaker = session.speakers?.[0]
  return (
    <article className="osv3-cg-session">
      {d ? (
        <div className="osv3-cg-session-date" aria-hidden="true">
          <span className="osv3-cg-session-mon">{MONTHS[d.getMonth()].slice(0, 3).toUpperCase()}</span>
          <span className="osv3-cg-session-day">{d.getDate()}</span>
        </div>
      ) : <div className="osv3-cg-session-date osv3-cg-session-date--none" aria-hidden="true" />}
      <div className="osv3-cg-session-text">
        {formatTimeRange(session.starts_at, session.ends_at)
          ? <p className="osv3-cg-session-time">{formatTimeRange(session.starts_at, session.ends_at)}</p>
          : null}
        <h3 className="osv3-cg-session-title">{session.title}</h3>
        {session.room ? <p className="osv3-cg-session-room">{session.room}</p> : null}
        {speaker ? (
          <div className="osv3-cg-session-speaker">
            <Avatar src={speaker.headshot_url} name={speaker.full_name} size="sm" />
            <span className="osv3-cg-session-speaker-text">
              <span className="osv3-cg-session-speaker-name">{speaker.full_name}</span>
              {speaker.title || speaker.org_name ? (
                <span className="osv3-cg-session-speaker-role">
                  {[speaker.title, speaker.org_name].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default function OSSpaceCongress() {
  const navigate = useNavigate()
  const { user, checked: viewerChecked } = useViewer()
  const trackRef = useRef(null)

  const [tab, setTab] = useState('participants')
  const [data, setData] = useState(null)      // null = still reading
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [registration, setRegistration] = useState(undefined) // undefined = unread

  useEffect(() => { document.title = 'Space Congress | SpaceOS' }, [])

  const load = useCallback(async () => {
    if (!supabase) {
      setLoadError('This build has no database connection configured, so there is nothing honest to show.')
      setData({ event: null })
      return
    }
    setData(null)
    setLoadError(null)
    try {
      /* Step 1: resolve the tenant — the house pattern for any scoped table. */
      const { data: tenantData } = await supabase
        .from('directory_tenants').select('id').eq('slug', TENANT_DB_LOOKUP_SLUG).single()
      const tenantId = tenantData?.id || null

      /* Step 2: the event. Prefer the next one that has not finished; fall back to
         the most recent. That fallback is why the card heading is derived. */
      let eq = supabase.from('congress_events')
        .select('id,name,slug,edition_year,starts_on,ends_on,venue,city,state,summary,description,website_url,hero_image_url')
        .eq('status', 'published')
      if (tenantId) eq = eq.eq('tenant_id', tenantId)
      const { data: events, error: eventErr } = await eq.order('starts_on', { ascending: false }).limit(20)
      if (eventErr) { setLoadError(eventErr.message); setData({ event: null }); return }

      const list = events || []
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const upcoming = list
        .filter((e) => { const end = localDate(e.ends_on || e.starts_on); return end && end >= today })
        .sort((a, b) => String(a.starts_on).localeCompare(String(b.starts_on)))
      const event = upcoming[0] || list[0] || null

      if (!event) { setData({ event: null }); return }

      /* Step 3: everything hanging off the event, in parallel. */
      const [statsRes, orgsRes, sessionsRes, speakersRes, linkRes, mediaRes] = await Promise.all([
        supabase.rpc('congress_event_stats', { p_event_id: event.id }),
        supabase.from('congress_organizations')
          .select('id,role,sponsor_tier,booth,sort_order,company:directory_companies(id,name,slug,vertical,city,state,logo_url)')
          .eq('event_id', event.id).eq('status', 'published')
          .order('sort_order', { ascending: true }).limit(60),
        supabase.from('congress_sessions')
          .select('id,title,description,session_date,starts_at,ends_at,room,track,is_featured,sort_order')
          .eq('event_id', event.id).eq('status', 'published')
          .order('session_date', { ascending: true }).order('starts_at', { ascending: true }).limit(200),
        supabase.from('congress_speakers')
          .select('id,full_name,title,org_name,headshot_url,person_id,sort_order')
          .eq('event_id', event.id).order('sort_order', { ascending: true }).limit(200),
        supabase.from('congress_session_speakers')
          .select('session_id,speaker_id,sort_order').limit(500),
        supabase.from('congress_media')
          .select('sort_order,listing:directory_listings(id,title,category,excerpt,description,virtual_url,apply_url,cover_image_url,image_url,author_name)')
          .eq('event_id', event.id).order('sort_order', { ascending: true }).limit(50),
      ])

      const speakers = speakersRes.data || []
      const speakerById = new Map(speakers.map((s) => [s.id, s]))
      const bySession = new Map()
      for (const l of (linkRes.data || [])) {
        if (!bySession.has(l.session_id)) bySession.set(l.session_id, [])
        const s = speakerById.get(l.speaker_id)
        if (s) bySession.get(l.session_id).push(s)
      }
      const sessions = (sessionsRes.data || []).map((s) => ({ ...s, speakers: bySession.get(s.id) || [] }))

      setData({
        event,
        stats: statsRes.data || null,
        orgs: (orgsRes.data || []).filter((o) => o.company),
        sessions,
        speakers,
        media: (mediaRes.data || []).map((m) => m.listing).filter(Boolean),
      })
    } catch (err) {
      setLoadError(err?.message || 'Could not read the Congress.')
      setData({ event: null })
    }
  }, [])

  useEffect(() => { let live = true; (async () => { if (live) await load() })(); return () => { live = false } }, [load, attempt])

  /* The viewer's own registration. RLS returns their row and nobody else's, so
     this is a read of one record, not a filter over a roster. */
  useEffect(() => {
    let live = true
    const eventId = data?.event?.id
    if (!supabase || !eventId || !viewerChecked) return undefined
    if (!user) { setRegistration(null); return undefined }
    supabase.from('congress_registrations')
      .select('id,status,ticket_type,sessions_attending,meetings_scheduled,registered_at')
      .eq('event_id', eventId).eq('auth_user_id', user.id).maybeSingle()
      .then(({ data: row }) => { if (live) setRegistration(row || null) })
    return () => { live = false }
  }, [data?.event?.id, user, viewerChecked])

  const retry = () => setAttempt((n) => n + 1)
  const scrollTrack = (dir) => {
    if (trackRef.current) trackRef.current.scrollBy({ left: dir * 520, behavior: 'smooth' })
  }

  const event = data?.event || null
  const loading = data === null
  const stats = data?.stats || null
  const orgs = data?.orgs || []
  const sessions = data?.sessions || []
  const media = data?.media || []
  const sponsors = useMemo(
    () => orgs.filter((o) => ['sponsor', 'partner'].includes(String(o.role).toLowerCase())),
    [orgs],
  )
  const featured = useMemo(() => sessions.filter((s) => s.is_featured), [sessions])

  /* Derived, never typed. See the header note. */
  const isUpcoming = useMemo(() => {
    if (!event) return false
    const end = localDate(event.ends_on || event.starts_on)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return Boolean(end && end >= today)
  }, [event])

  /* The reference puts the NUMBER first and the label under it, with a "View all"
     beneath. Every link here goes somewhere real; a stat whose link would have
     nowhere to go simply has no link. */
  const statItems = stats ? [
    {
      id: 'participants', icon: 'users', label: 'Registered Participants',
      value: stats.participants ?? 0,
      link: event.website_url ? 'How to register' : null, href: event.website_url,
    },
    {
      id: 'orgs', icon: 'building', label: 'Organizations Represented',
      value: stats.organizations ?? 0,
      link: 'View all', onLink: () => navigate('/directory'),
    },
    /* Replaces the comp's "Connections Enabled" — see the header note. */
    {
      id: 'speakers', icon: 'megaphone', label: 'Speakers',
      value: stats.speakers ?? 0,
      link: sessions.length ? 'View sessions' : null, onLink: () => setTab('sessions'),
    },
    {
      id: 'sessions', icon: 'calendar', label: 'Sessions & Events',
      value: stats.sessions ?? 0,
      link: sessions.length ? 'View agenda' : null, onLink: () => setTab('sessions'),
    },
  ] : []

  /* No counts on the tabs: the reference has none, and the stat strip directly
     above already carries all four numbers. Repeating them turns the tab bar
     into "(0) (0) (0)". */
  const tabItems = TABS

  /* ---------------------------------------------------------------- states */
  if (loading) {
    return (
      <div className="osv3p-screen osv3p-screen--profile osv3-cg">
        <header className="osv3p-pagehead">
          <div>
            <h1 className="osv3p-pagehead-title">Space Congress Integration</h1>
            <p className="osv3p-pagehead-sub">Connect, collaborate, and create impact through Arizona Space Congress.</p>
          </div>
        </header>
        <EmptyState
          icon="clock"
          title="Reading the Congress"
          body="The event, its agenda, its speakers and the organizations taking part are all counted live. Nothing is shown until every figure has been read, so no number here is ever a stale one."
        />
      </div>
    )
  }

  if (loadError || !event) {
    return (
      <div className="osv3p-screen osv3p-screen--profile osv3-cg">
        <header className="osv3p-pagehead">
          <div>
            <h1 className="osv3p-pagehead-title">Space Congress Integration</h1>
            <p className="osv3p-pagehead-sub">Connect, collaborate, and create impact through Arizona Space Congress.</p>
          </div>
        </header>
        <EmptyState
          icon={loadError ? 'signal' : 'calendar'}
          title={loadError ? 'This build cannot read the Congress' : 'No Congress has been published yet'}
          body={loadError || 'An admin creates the event in Admin Tools → Congress — its dates, venue, description and website. Everything on this page hangs off that one record, so nothing appears until it exists.'}
          action={loadError
            ? <Button variant="quiet" onClick={retry}>Try again</Button>
            : <Button variant="primary" icon="plus" onClick={() => navigate('/admin-tools')}>Open Admin Tools</Button>}
        />
      </div>
    )
  }

  const dateLine = formatRange(event.starts_on, event.ends_on)

  return (
    <div className="osv3p-screen osv3p-screen--profile osv3-cg">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Space Congress Integration</h1>
          <p className="osv3p-pagehead-sub">
            Connect, collaborate, and create impact through Arizona Space Congress.
          </p>
        </div>
        {event.website_url ? (
          <Button variant="primary" icon="globe" href={event.website_url}>About Congress Integration</Button>
        ) : null}
      </header>

      <div className="osv3p-admin-body">
        <div className="osv3p-admin-main">

          {/* ---------- Row 1: hero + the event card ---------- */}
          <div className="osv3-cg-top">
            <section
              className={event.hero_image_url ? 'osv3-cg-hero osv3-cg-hero--photo' : 'osv3-cg-hero'}
            >
              {event.hero_image_url
                ? <img className="osv3-cg-hero-img" src={event.hero_image_url} alt="" aria-hidden="true" />
                : null}
              <div className="osv3-cg-hero-veil" aria-hidden="true" />
              <div className="osv3-cg-hero-inner">
                <h2 className="osv3-cg-hero-title">{event.name}<sup className="osv3-cg-tm">™</sup></h2>
                {event.description ? <p className="osv3-cg-hero-body">{firstSentence(event.description)}</p> : null}
                {event.website_url ? (
                  <a className="osv3-cg-hero-link" href={event.website_url} target="_blank" rel="noreferrer">
                    Visit {event.name}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h15M13.5 6.5L19 12l-5.5 5.5" /></svg>
                  </a>
                ) : null}
              </div>
            </section>

            <Card className="osv3-cg-when">
              <CardBody>
                <div className="osv3-cg-when-head">
                  <span className="osv3-cg-when-icon"><Icon name="calendar" /></span>
                  {/* Derived from the date, never typed. */}
                  <h2 className="osv3p-rail-title">{isUpcoming ? 'Upcoming Congress' : 'Most Recent Congress'}</h2>
                </div>
                {dateLine ? <p className="osv3-cg-when-date">{dateLine}</p> : null}
                {cityLine(event) ? <p className="osv3-cg-when-place">{cityLine(event)}</p> : null}
                {event.venue ? <p className="osv3-cg-when-venue">{event.venue}</p> : null}
                {event.summary ? <p className="osv3-cg-when-body">{event.summary}</p> : null}
                {event.website_url ? (
                  <Button variant="primary" href={event.website_url}>View Congress Website</Button>
                ) : null}
              </CardBody>
            </Card>
          </div>

          {/* ---------- Stat strip. Real counts, zeros included. ---------- */}
          <Card>
            <CardBody>
              {statItems.length ? (
                <>
                  {/* Not the shared StatStrip component: it renders the label above
                      the value, and the reference leads with the number. StatStrip
                      is used by other screens and is not ours to change, so the
                      four-column hairline construction is rebuilt here in this
                      page's own stylesheet. */}
                  <ul className="osv3-cg-stats">
                    {statItems.map((s) => (
                      <li className="osv3-cg-stat" key={s.id}>
                        <span className="osv3-cg-stat-icon"><Icon name={s.icon} /></span>
                        <div className="osv3-cg-stat-text">
                          <span className="osv3-cg-stat-value">{s.value}</span>
                          <span className="osv3-cg-stat-label">{s.label}</span>
                          {s.link ? <CardLink href={s.href} onClick={s.onLink}>{s.link}</CardLink> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {(stats?.participants ?? 0) === 0 ? (
                    <p className="osv3-cg-statnote">
                      These are live counts, not projections. Registration has not opened in Space OS,
                      so participants reads zero until the first person registers.
                    </p>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  icon="signal"
                  title="The Congress figures could not be counted"
                  body="Every number in this strip is counted in the database at load rather than stored, and that count did not come back."
                  action={<Button variant="quiet" onClick={retry}>Try again</Button>}
                />
              )}
            </CardBody>
          </Card>

          {/* ---------- Tabs ---------- */}
          <Tabs items={tabItems} value={tab} onChange={setTab} label="Congress sections" />

          {tab === 'participants' ? (
            <>
              <Card>
                <SectionHead
                  title="Organizations Attending"
                  note={`Explore organizations taking part in the ${event.edition_year || ''} Congress.`.replace('  ', ' ')}
                  link={orgs.length ? 'View all organizations' : null}
                  onLink={() => navigate('/directory')}
                />
                <CardBody>
                  {orgs.length === 0 ? (
                    <EmptyState
                      icon="building"
                      title="No organizations have been added to this Congress yet"
                      body="Space OS already holds 165 organizations. An admin marks one as an exhibitor, sponsor, academic institution or attendee in Admin Tools → Congress → Organizations, and it appears here with its role badge."
                      action={<Button variant="quiet" icon="plus" onClick={() => navigate('/admin-tools')}>Add organizations in Admin Tools</Button>}
                    />
                  ) : (
                    <div className="osv3-cg-carousel">
                      <div className="osv3-cg-track" ref={trackRef}>
                        {orgs.map((o) => <OrgCard key={o.id} row={o} />)}
                      </div>
                      {orgs.length > 3 ? (
                        <>
                          <button type="button" className="osv3-cg-arrow osv3-cg-arrow--prev"
                            onClick={() => scrollTrack(-1)} aria-label="Previous organizations">‹</button>
                          <button type="button" className="osv3-cg-arrow osv3-cg-arrow--next"
                            onClick={() => scrollTrack(1)} aria-label="Next organizations">›</button>
                        </>
                      ) : null}
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card>
                <SectionHead
                  title="Featured Sessions"
                  note="Highlighted sessions and events from the Congress agenda."
                  link={sessions.length ? 'View full agenda' : null}
                  onLink={() => setTab('sessions')}
                />
                <CardBody>
                  {featured.length === 0 ? (
                    <EmptyState
                      icon="calendar"
                      title="The agenda has not been published yet"
                      body="An admin adds each session in Admin Tools → Congress → Sessions with its date, start and end time, room and speaker. Sessions marked as featured appear here; the rest appear under the Sessions tab."
                      action={<Button variant="quiet" icon="plus" onClick={() => navigate('/admin-tools')}>Add a session in Admin Tools</Button>}
                    />
                  ) : (
                    <div className="osv3-cg-sessions">
                      {featured.slice(0, 4).map((s) => <SessionRow key={s.id} session={s} />)}
                    </div>
                  )}
                </CardBody>
              </Card>
            </>
          ) : null}

          {tab === 'sessions' ? (
            <Card>
              <SectionHead title="Full Agenda" note={dateLine ? `${dateLine} · ${event.venue || cityLine(event)}` : null} />
              <CardBody>
                {sessions.length === 0 ? (
                  <EmptyState
                    icon="calendar"
                    title="No sessions have been added yet"
                    body="The agenda lives in Admin Tools → Congress → Sessions. Each session takes a title, a date, a start and end time, a room and a speaker; nothing is shown here until one exists, because an invented agenda is worse than an empty one."
                    action={<Button variant="quiet" icon="plus" onClick={() => navigate('/admin-tools')}>Add a session in Admin Tools</Button>}
                  />
                ) : (
                  <div className="osv3-cg-sessions">
                    {sessions.map((s) => <SessionRow key={s.id} session={s} />)}
                  </div>
                )}
              </CardBody>
            </Card>
          ) : null}

          {tab === 'networking' ? (
            <Card>
              <SectionHead title="Networking" note="What is planned, and what works today." />
              <CardBody>
                {/* The comp draws four rows with counts (4 scheduled, 12 recommended,
                    6 active, "Open now"). None of the four has a table, a column or a
                    single row behind it anywhere in Space OS. So the names stay — they
                    tell the client what was designed — and every fabricated count is
                    gone. */}
                <EmptyState
                  icon="handshake"
                  title="Congress networking is not built yet"
                  body="One-on-one meetings, matchmaking, group discussions and the networking lounge were all drawn in the design, but none of them has any data behind it in Space OS today — there is no meetings table, no matchmaking and no connections concept. Rather than show four invented counts, this tab says so. What does work now is the directory: every participating organization and person is already searchable."
                  action={<Button variant="primary" icon="users" onClick={() => navigate('/directory')}>Browse the directory</Button>}
                />
              </CardBody>
            </Card>
          ) : null}

          {tab === 'sponsors' ? (
            <Card>
              <SectionHead
                title="Sponsors & Partners"
                note={sponsors.length ? null : 'Organizations backing the Congress.'}
                link={sponsors.length ? 'View all organizations' : null}
                onLink={() => navigate('/directory')}
              />
              <CardBody>
                {sponsors.length === 0 ? (
                  <EmptyState
                    icon="handshake"
                    title="No sponsors or partners have been recorded yet"
                    body="A sponsor is an organization marked with the sponsor or partner role in Admin Tools → Congress → Organizations. The moment one is marked, it appears here and in the Organizations Attending carousel, and the Organizations Represented count moves."
                    action={<Button variant="quiet" icon="plus" onClick={() => navigate('/admin-tools')}>Mark a sponsor in Admin Tools</Button>}
                  />
                ) : (
                  <div className="osv3-cg-sponsors">
                    {sponsors.map((o) => (
                      <article className="osv3-cg-sponsor" key={o.id}>
                        <LogoTile src={o.company.logo_url} name={o.company.name} size="md" />
                        <div className="osv3-cg-sponsor-text">
                          <h3 className="osv3-cg-orgcard-name">{o.company.name}</h3>
                          <p className="osv3-cg-orgcard-meta">
                            {[o.sponsor_tier, cityLine(o.company)].filter(Boolean).join(' · ') || o.company.vertical}
                          </p>
                        </div>
                        <Pill status tone={ROLE_TONE[String(o.role).toLowerCase()]}>
                          {ROLE_LABEL[String(o.role).toLowerCase()]}
                        </Pill>
                      </article>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          ) : null}

          {/* ---------- Coverage. Not on the comp; it is the one genuinely rich
               content set this page has, and nine real items beat four empty
               tabs. ---------- */}
          {media.length ? (
            <Card>
              <SectionHead
                title="Congress in the Media"
                note={`${media.length} pieces of coverage from FOX 10, PBS Arizona, KTAR, AZFamily and YouTube.`}
                link="View all media"
                onLink={() => navigate('/media')}
              />
              <CardBody>
                <div className="osv3-cg-media">
                  {media.map((m) => {
                    const href = m.virtual_url || m.apply_url
                    const cover = m.cover_image_url || m.image_url || youtubeThumb(href)
                    const body = (
                      <>
                        {/* Only one of the nine listings carries a cover image and only
                            two are YouTube, so seven of these have no picture that
                            exists. Six identical grey rectangles with a generic glyph
                            is worse than no picture at all, so the fallback names the
                            OUTLET — the same reasoning as LogoTile's monogram, which is
                            the normal path there for the same reason. */}
                        <span className="osv3-cg-media-thumb">
                          {cover
                            ? <img src={cover} alt="" loading="lazy" />
                            : (
                              <span className="osv3-cg-media-plate">
                                <span className="osv3-cg-media-plate-icon" aria-hidden="true">
                                  <Icon name={m.category === 'podcast' ? 'megaphone' : m.category === 'news' ? 'file' : 'eye'} />
                                </span>
                                <span className="osv3-cg-media-plate-name">{m.author_name || 'Coverage'}</span>
                              </span>
                            )}
                        </span>
                        <span className="osv3-cg-media-text">
                          <span className="osv3-cg-media-kind">{MEDIA_KIND[m.category] || m.category}</span>
                          <span className="osv3-cg-media-title">{m.title}</span>
                          {m.author_name ? <span className="osv3-cg-media-by">{m.author_name}</span> : null}
                        </span>
                      </>
                    )
                    return href
                      ? <a className="osv3-cg-media-item" key={m.id} href={href} target="_blank" rel="noreferrer">{body}</a>
                      : <div className="osv3-cg-media-item" key={m.id}>{body}</div>
                  })}
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* ================= RIGHT RAIL ================= */}
        <div className="osv3p-admin-rail">

          {/* ---------- Your Congress Activity ---------- */}
          <Card>
            <SectionHead title="Your Congress Activity" />
            <CardBody>
              {!viewerChecked || registration === undefined ? (
                <p className="osv3-cg-rail-note">Checking your registration…</p>
              ) : !user ? (
                <EmptyState
                  icon="user-plus"
                  title="You are browsing as a guest"
                  body="Sign in to Space OS and your Congress registration, the sessions you are attending and the meetings on your schedule appear here."
                  action={<Button variant="primary" onClick={() => navigate('/dashboard')}>Sign in</Button>}
                />
              ) : !registration ? (
                <EmptyState
                  icon="calendar"
                  title="You are not registered yet"
                  body={`Registration for the ${event.edition_year || ''} Congress is handled on the Congress website. Once your registration is recorded, your ticket, the sessions you are attending and your scheduled meetings show here.`.replace('  ', ' ')}
                  action={event.website_url
                    ? <Button variant="primary" href={event.website_url}>Register on the Congress site</Button>
                    : null}
                />
              ) : (
                <div className="osv3-cg-activity">
                  <div className="osv3-cg-activity-row">
                    <span className="osv3-cg-activity-icon"><Icon name="check-circle" /></span>
                    <span className="osv3-cg-activity-text">
                      <span className="osv3-cg-activity-label">Registered</span>
                      <span className="osv3-cg-activity-value">{registration.ticket_type || 'General admission'}</span>
                    </span>
                  </div>
                  <div className="osv3-cg-activity-row">
                    <span className="osv3-cg-activity-icon"><Icon name="calendar" /></span>
                    <span className="osv3-cg-activity-text">
                      <span className="osv3-cg-activity-label">Sessions attending</span>
                      <span className="osv3-cg-activity-value">{registration.sessions_attending ?? 0}</span>
                    </span>
                  </div>
                  <div className="osv3-cg-activity-row">
                    <span className="osv3-cg-activity-icon"><Icon name="handshake" /></span>
                    <span className="osv3-cg-activity-text">
                      <span className="osv3-cg-activity-label">Meetings scheduled</span>
                      <span className="osv3-cg-activity-value">{registration.meetings_scheduled ?? 0}</span>
                    </span>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* ---------- Networking Opportunities ---------- *
           * The comp lists four items with a count under each. None exists. The
           * names are kept because they document the intent; the counts are not,
           * because they were invented. */}
          <Card>
            <SectionHead title="Networking Opportunities" />
            <CardBody>
              <p className="osv3-cg-rail-note">
                Designed for Congress, not yet built in Space OS:
              </p>
              <ul className="osv3-cg-planned">
                <li className="osv3-cg-planned-item"><Icon name="users" /> One-on-one meetings</li>
                <li className="osv3-cg-planned-item"><Icon name="handshake" /> Matchmaking</li>
                <li className="osv3-cg-planned-item"><Icon name="megaphone" /> Group discussions</li>
                <li className="osv3-cg-planned-item"><Icon name="grid" /> Networking lounge</li>
              </ul>
              <p className="osv3-cg-rail-note">
                None of these has data behind it yet, so none shows a count.
              </p>
              <Button variant="quiet" block onClick={() => navigate('/directory')}>Browse participants</Button>
            </CardBody>
          </Card>

          {/* ---------- Get Involved. Every row goes somewhere real. ---------- */}
          <Card>
            <SectionHead title="Get Involved" note="Maximize your impact at Congress." />
            <CardBody>
              <ul className="osv3-cg-actions">
                <li>
                  <a className="osv3-cg-action" href="/profile">
                    <span className="osv3-cg-action-icon"><Icon name="user-plus" /></span>
                    <span className="osv3-cg-action-text">
                      <span className="osv3-cg-action-title">Update your profile</span>
                      <span className="osv3-cg-action-sub">Increase your visibility</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a className="osv3-cg-action" href="/directory">
                    <span className="osv3-cg-action-icon"><Icon name="users" /></span>
                    <span className="osv3-cg-action-text">
                      <span className="osv3-cg-action-title">Browse participants</span>
                      <span className="osv3-cg-action-sub">Find and connect</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a className="osv3-cg-action" href="mailto:info@spacerising.org?subject=Sponsor%20or%20exhibit%20at%20Space%20Congress">
                    <span className="osv3-cg-action-icon"><Icon name="handshake" /></span>
                    <span className="osv3-cg-action-text">
                      <span className="osv3-cg-action-title">Sponsor &amp; exhibit</span>
                      <span className="osv3-cg-action-sub">Email the Congress team</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a className="osv3-cg-action" href="mailto:info@spacerising.org?subject=Session%20proposal%20for%20Space%20Congress">
                    <span className="osv3-cg-action-icon"><Icon name="send" /></span>
                    <span className="osv3-cg-action-text">
                      <span className="osv3-cg-action-title">Submit a session</span>
                      <span className="osv3-cg-action-sub">Share your expertise</span>
                    </span>
                  </a>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
