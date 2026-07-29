/**
 * profileApi.js — the data seam for the person and company profile screens.
 *
 * The screens never import supabase. They call these two functions and get back
 * either a profile object or null. That keeps the primitives presentational and
 * makes the whole screen renderable from fixtures.
 *
 * Two paths:
 *   slug === '_preview'  -> the transcribed reference fixture. Always resolves,
 *                           and NEVER touches the database. Those two routes are
 *                           the design reference and the pixel-verification
 *                           target; a profile screen that can only be reviewed
 *                           when Supabase is reachable cannot be reviewed.
 *   anything else        -> one RPC call, one payload.
 *
 * THE REAL READ CAN LEGITIMATELY RETURN NULL. A slug with no active record, an
 * unreachable database, a migration that has not landed — all of them answer
 * null, and every caller treats null as not-found: never as a crash, and never
 * as an empty shell pretending to be a profile.
 *
 * Every returned object carries `source`:
 *   'fixture'     — the transcribed reference (preview routes only)
 *   'live'        — get_person_profile / get_company_profile (the real path)
 *   'live-legacy' — the pre-RPC company read, see LEGACY COMPANY READ below
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY FIELD IS REBUILT HERE INSTEAD OF SPREAD THROUGH
 * ---------------------------------------------------------------------------
 * ProfilePerson.jsx normalizes what it is handed. ProfileCompany.jsx does NOT —
 * it dereferences `c.atAGlance.rows.length`, `c.lookingFor.left.items.length`,
 * `c.locations.items.length` and a dozen more straight off the object. One
 * missing sub-object on that screen is a white page, not a degraded card. So
 * this file guarantees the full shape rather than trusting the payload: every
 * list arrives as an array, every scalar as a string or an explicit null, and
 * nothing is ever undefined-that-throws.
 *
 * A real profile is mostly empty. That is the common case, not the edge case,
 * and the screens already draw a named empty state for every card — but only if
 * the key is present and empty. An absent key is what breaks them.
 *
 * ---------------------------------------------------------------------------
 * TWO PLACES THE RPC PAYLOAD AND THE SCREENS DISAGREE
 * ---------------------------------------------------------------------------
 * 1. MISSION ICONS. migrations/033 returns `id` as the directory_tags UUID.
 *    MissionBars picks its glyph with `DEFAULT_ICON[row.id]`, keyed on
 *    'build' | 'operate' | 'prosper' | 'live' | 'move' | 'secure', so a UUID
 *    misses every time and all six missions render the same rocket. The tag
 *    table has no slug column to fix it at the source, so the icon is resolved
 *    here from the tag NAME — the live names are "Build Space", "Move in
 *    Space", "Prosper in Space", "Live in Space", "Operate in Space",
 *    "Secure Space", and their first word is the key. The UUID stays on `id`
 *    where it is still the stable React key.
 *
 * 2. THE PEOPLE TAB COUNT. The RPC always emits `count` for the People tab, and
 *    Tabs.jsx prints any count that is not null — so today, with no person
 *    linked to any organization, all 166 companies would advertise "People (0)".
 *    033 omits zero-valued ACTIVITY stats for exactly this reason ("a card of
 *    six zeros is not data, it is a shrug"); the tab is held to the same rule
 *    here, and the count reappears by itself once people are linked.
 *
 * ---------------------------------------------------------------------------
 * LEGACY COMPANY READ
 * ---------------------------------------------------------------------------
 * If get_company_profile is not in the schema cache (PostgREST PGRST202, i.e.
 * migration 033 has not been applied to this project), the company path falls
 * back to the plain directory_companies read that served these 166 rows before
 * the RPC existed. That fallback is narrow on purpose:
 *   - it fires on ONE error code, never on a generic failure
 *   - it warns by name, so a missing migration is diagnosable rather than masked
 *   - it stamps source 'live-legacy', so the payload is identifiable downstream
 *   - it names its columns, so no stripe/membership column can ride along
 * Delete `COMPANY_LEGACY_ON_MISSING_RPC` and the fallback goes with it.
 *
 * There is deliberately NO equivalent for people: before 033 there is no person
 * table at all, so null is the only honest answer.
 */

import { supabase } from './supabase.js'
import { PERSON_FIXTURE, COMPANY_FIXTURE, PREVIEW_SLUG } from './profileFixtures.js'

/** Set false once 033 is applied everywhere; the fallback is a bridge, not a feature. */
const COMPANY_LEGACY_ON_MISSING_RPC = true

/** PostgREST: "no function with that name/signature in the schema cache." */
const FN_NOT_FOUND = 'PGRST202'

/* ------------------------------------------------------------------------ *
 * Shape guards. Every one of these is total: it returns a usable value for
 * undefined, null, and the wrong type, so no caller has to check first.
 * ------------------------------------------------------------------------ */

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** An object, always. Never null, never an array. */
const obj = (v) => (isPlain(v) ? v : {})

/** An array with the holes taken out, always. */
const list = (v) => (Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined) : [])

/** A string, always. null/undefined become '' — what every screen tests for. */
const text = (v) => (v === null || v === undefined ? '' : String(v))

/** An image URL or an explicit null, so Avatar/LogoTile fall back to a monogram. */
const imageUrl = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** A count for a card header. 0 and null both mean "do not print a number". */
const count = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Comma-joined strings or a real array — both appear in legacy columns. */
function asArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(text)
  if (typeof v === 'string' && v.trim()) {
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

/* ------------------------------------------------------------------------ *
 * Tabs. The ids are structural — both screens switch on them — so they live
 * here rather than being borrowed from the fixture, which is design data.
 * ------------------------------------------------------------------------ */

const PERSON_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'needs', label: 'Needs' },
  { id: 'experience', label: 'Experience' },
  { id: 'affiliations', label: 'Affiliations' },
]

const COMPANY_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'people', label: 'People' },
  { id: 'location', label: 'Location' },
  { id: 'affiliations', label: 'Affiliations' },
]

/** Keeps ids and labels, drops a zero count (see disagreement 2 above). */
function tabsFrom(raw, fallback) {
  const rows = list(raw)
    .map((t) => {
      const tab = obj(t)
      const id = text(tab.id)
      if (!id) return null
      const out = { id, label: text(tab.label) || id }
      if (count(tab.count) > 0) out.count = count(tab.count)
      return out
    })
    .filter(Boolean)
  return rows.length ? rows : fallback
}

/* ------------------------------------------------------------------------ *
 * Missions.
 * ------------------------------------------------------------------------ */

const MISSION_ICONS = {
  build: 'mission-build',
  operate: 'mission-operate',
  prosper: 'mission-prosper',
  live: 'mission-live',
  move: 'mission-move',
  secure: 'mission-secure',
}

/** id first (the fixture uses slugs), then the tag name's first word. */
function missionIcon(row) {
  if (text(row.icon)) return text(row.icon)
  const byId = MISSION_ICONS[text(row.id).toLowerCase()]
  if (byId) return byId
  const first = text(row.label).trim().toLowerCase().split(/\s+/)[0]
  return MISSION_ICONS[first] || 'mission-build'
}

function missionRows(raw) {
  return list(raw)
    .map((r) => {
      const row = obj(r)
      const label = text(row.label)
      if (!label) return null
      const pct = Number(row.pct)
      return {
        id: text(row.id) || label,
        label,
        pct: Number.isFinite(pct) ? pct : 0,
        icon: missionIcon(row),
      }
    })
    .filter(Boolean)
}

/* ------------------------------------------------------------------------ *
 * Row shapes the osv3 primitives consume.
 * ------------------------------------------------------------------------ */

/** CheckList: { id, title, sub?, icon? } */
function checkRows(raw) {
  return list(raw)
    .map((r, i) => {
      const row = obj(r)
      const title = text(row.title || row.name)
      if (!title) return null
      const out = { id: text(row.id) || `cap-${i}`, title }
      if (text(row.sub)) out.sub = text(row.sub)
      if (text(row.icon)) out.icon = text(row.icon)
      return out
    })
    .filter(Boolean)
}

/** IconList: { id, title, sub?, icon?, logo?, logoUrl? } */
function iconRows(raw, fallbackIcon) {
  return list(raw)
    .map((r, i) => {
      const row = obj(r)
      const title = text(row.title)
      if (!title) return null
      const out = { id: text(row.id) || `item-${i}`, title }
      if (text(row.sub)) out.sub = text(row.sub)
      if (row.logo) {
        out.logo = true
        out.logoUrl = imageUrl(row.logoUrl)
      } else {
        out.icon = text(row.icon) || fallbackIcon
      }
      return out
    })
    .filter(Boolean)
}

/** KeyValueList: { id, icon, key, value } — a row with no value is not a fact. */
function keyValueRows(raw) {
  return list(raw)
    .map((r, i) => {
      const row = obj(r)
      const key = text(row.key)
      const value = text(row.value)
      if (!key || !value) return null
      return { id: text(row.id) || `row-${i}`, icon: text(row.icon) || 'file', key, value }
    })
    .filter(Boolean)
}

/** StatStrip: { id, icon, label, value, note? } */
function statRows(raw) {
  return list(raw)
    .map((r, i) => {
      const row = obj(r)
      const label = text(row.label)
      const value = text(row.value)
      if (!label || !value) return null
      const out = { id: text(row.id) || `stat-${i}`, icon: text(row.icon) || 'grid', label, value }
      if (text(row.note)) out.note = text(row.note)
      return out
    })
    .filter(Boolean)
}

/** CountGrid: { id, icon, value, label } */
function countRows(raw) {
  return list(raw)
    .map((r, i) => {
      const row = obj(r)
      const label = text(row.label)
      if (!label) return null
      return {
        id: text(row.id) || `count-${i}`,
        icon: text(row.icon) || 'grid',
        value: text(row.value) || '0',
        label,
      }
    })
    .filter(Boolean)
}

/** SplitList feeds BulletList, which uses each item as a React key — strings only. */
function bulletItems(raw) {
  return list(raw).map(text).filter(Boolean)
}

/** MapPanel markers are 960x600 albersUsa coordinates; anything else is dropped
 *  rather than pinned somewhere wrong. The RPC returns none by design. */
function markerRows(raw) {
  return list(raw)
    .map((m, i) => {
      const row = obj(m)
      const x = Number(row.x)
      const y = Number(row.y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null
      return { id: text(row.id) || `pin-${i}`, x, y, label: text(row.label) }
    })
    .filter(Boolean)
}

/** Two-letter state codes for the map tint. */
function stateCodes(raw) {
  return list(raw)
    .map((s) => text(s).trim().toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s))
}

/* ------------------------------------------------------------------------ *
 * get_person_profile -> what ProfilePerson.jsx consumes.
 * ------------------------------------------------------------------------ */

function personFromRpc(raw, slug) {
  const p = obj(raw)
  const availability = obj(p.availability)
  const about = obj(p.about)
  const caps = obj(p.capabilities)
  const missions = obj(p.missions)
  const looking = obj(p.lookingFor)
  const left = obj(looking.left)
  const right = obj(looking.right)
  const affiliations = obj(p.affiliations)
  const locationCard = obj(p.locationCard)
  const activity = obj(p.activity)

  const bio = text(p.bio)
  const capShown = checkRows(caps.shown)
  const affilItems = iconRows(affiliations.items, 'building')

  return {
    slug: text(p.slug) || slug,
    kind: 'person',
    source: 'live',

    name: text(p.name) || slug,
    verified: Boolean(p.verified),
    verifiedLabel: text(p.verifiedLabel) || 'Verified',
    role: text(p.role),
    organization: text(p.organization),
    location: text(p.location),
    email: text(p.email),
    linkedin: text(p.linkedin),
    website: text(p.website),
    photoUrl: imageUrl(p.photoUrl),
    bio,
    tags: list(p.tags).map(text).filter(Boolean),

    tabs: tabsFrom(p.tabs, PERSON_TABS),

    availability: {
      heading: text(availability.heading) || 'AVAILABILITY',
      status: text(availability.status),
      body: text(availability.body),
      primaryCta: text(availability.primaryCta) || 'CONNECT',
      acceptsConnections: availability.acceptsConnections !== false,
    },

    about: {
      heading: text(about.heading) || 'ABOUT ME',
      body: text(about.body) || bio,
      link: text(about.link),
    },

    capabilities: {
      heading: text(caps.heading) || 'CAPABILITIES',
      action: text(caps.action),
      total: count(caps.total) || capShown.length,
      shown: capShown,
      footerLink: capShown.length ? text(caps.footerLink) : '',
    },

    missions: {
      heading: text(missions.heading) || 'SPACE MISSIONS',
      action: text(missions.action),
      rows: missionRows(missions.rows),
    },

    lookingFor: {
      heading: text(looking.heading) || "WHAT I'M LOOKING FOR",
      action: text(looking.action),
      left: { heading: text(left.heading) || "I'M SEEKING", items: bulletItems(left.items) },
      right: { heading: text(right.heading) || 'I CAN PROVIDE', items: bulletItems(right.items) },
    },

    affiliations: {
      heading: text(affiliations.heading) || 'AFFILIATIONS',
      action: text(affiliations.action),
      items: affilItems,
      footerLink: affilItems.length ? text(affiliations.footerLink) : '',
    },

    // No viewBox: the fixture's crop was hand-authored for one city, and
    // MapPanel already frames itself around `highlight` when none is given.
    locationCard: {
      heading: text(locationCard.heading) || 'LOCATION',
      city: text(locationCard.city),
      note: text(locationCard.note),
      highlight: stateCodes(locationCard.highlight),
      markers: markerRows(locationCard.markers),
    },

    activity: {
      heading: text(activity.heading) || 'ACTIVITY HIGHLIGHTS',
      stats: statRows(activity.stats),
      footerLink: text(activity.footerLink),
    },

    // Not drawn by the Experience tab yet — it renders its own empty state —
    // but it is real data on the payload, and dropping it at the seam is a loss
    // the screen could never recover from once the tab is built.
    experience: list(p.experience).map((e, i) => {
      const row = obj(e)
      return {
        id: text(row.id) || `exp-${i}`,
        title: text(row.title),
        organization: text(row.organization),
        description: text(row.description),
        location: text(row.location),
        startDate: row.startDate || null,
        endDate: row.endDate || null,
        isCurrent: Boolean(row.isCurrent),
      }
    }),
  }
}

/* ------------------------------------------------------------------------ *
 * get_company_profile -> what ProfileCompany.jsx consumes.
 *
 * ProfileCompany has no normalize() of its own, so every sub-object below is
 * mandatory. Nothing here may become conditional.
 * ------------------------------------------------------------------------ */

function companyFromRpc(raw, slug) {
  const c = obj(raw)
  const connect = obj(c.connect)
  const glance = obj(c.atAGlance)
  const caps = obj(c.capabilities)
  const missions = obj(c.missions)
  const whatWeDo = obj(c.whatWeDo)
  const whoWeWorkWith = obj(c.whoWeWorkWith)
  const looking = obj(c.lookingFor)
  const left = obj(looking.left)
  const right = obj(looking.right)
  const locations = obj(c.locations)
  const activity = obj(c.activity)

  const name = text(c.name) || slug
  const description = text(c.description)
  const glanceRows = keyValueRows(glance.rows)
  const capShown = checkRows(caps.shown)
  const missionsOut = missionRows(missions.rows)
  const counts = countRows(whoWeWorkWith.counts)
  const seeking = bulletItems(left.items)
  const providing = bulletItems(right.items)
  const locItems = iconRows(locations.items, 'location')
  const stats = statRows(activity.stats)

  return {
    slug: text(c.slug) || slug,
    kind: 'company',
    source: 'live',

    name,
    verified: Boolean(c.verified),
    verifiedLabel: text(c.verifiedLabel) || 'Verified Organization',
    categories: list(c.categories).map(text).filter(Boolean),
    location: text(c.location),
    website: text(c.website),
    email: text(c.email),
    phone: text(c.phone),
    linkedin: text(c.linkedin),
    logoUrl: imageUrl(c.logoUrl),
    description,
    tags: list(c.tags).map(text).filter(Boolean),

    tabs: tabsFrom(c.tabs, COMPANY_TABS),

    connect: {
      heading: text(connect.heading) || `CONNECT WITH ${name.toUpperCase()}`,
      status: text(connect.status),
      body: text(connect.body),
      primaryCta: text(connect.primaryCta) || 'CONNECT',
      secondaryCta: text(connect.secondaryCta) || 'FOLLOW',
    },

    atAGlance: {
      heading: text(glance.heading) || 'AT A GLANCE',
      rows: glanceRows,
      footerLink: glanceRows.length ? text(glance.footerLink) : '',
    },

    capabilities: {
      heading: text(caps.heading) || 'CAPABILITIES',
      total: count(caps.total) || capShown.length,
      shown: capShown,
      footerLink: capShown.length ? text(caps.footerLink) : '',
    },

    missions: {
      heading: text(missions.heading) || 'SPACE MISSIONS',
      rows: missionsOut,
      footerLink: missionsOut.length ? text(missions.footerLink) : '',
    },

    whatWeDo: {
      heading: text(whatWeDo.heading) || 'WHAT WE DO',
      body: text(whatWeDo.body) || description,
      link: text(whatWeDo.link),
    },

    whoWeWorkWith: {
      heading: text(whoWeWorkWith.heading) || 'WHO WE WORK WITH',
      counts,
      footerLink: counts.length ? text(whoWeWorkWith.footerLink) : '',
    },

    lookingFor: {
      heading: text(looking.heading) || 'LOOKING FOR',
      action: text(looking.action),
      left: { heading: text(left.heading), items: seeking },
      right: { heading: text(right.heading), items: providing },
      footerLink: seeking.length || providing.length ? text(looking.footerLink) : '',
    },

    locations: {
      heading: text(locations.heading) || 'LOCATIONS',
      items: locItems,
      highlight: stateCodes(locations.highlight),
      markers: markerRows(locations.markers),
      footerLink: locItems.length ? text(locations.footerLink) : '',
    },

    activity: {
      heading: text(activity.heading) || 'ACTIVITY HIGHLIGHTS',
      stats,
      footerLink: stats.length ? text(activity.footerLink) : '',
    },

    footer: text(c.footer) || COMPANY_FIXTURE.footer,
  }
}

/* ------------------------------------------------------------------------ *
 * LEGACY: the plain directory_companies read, pre-033. Same guaranteed shape,
 * different source stamp, and only the columns that existed before the profile
 * tables — the membership/stripe columns on that table are never selected.
 * ------------------------------------------------------------------------ */

function companyFromRow(row, slug) {
  const r = obj(row)
  const name = text(r.name) || slug
  const location = [r.city, r.state, r.country].map(text).filter(Boolean).join(', ')
  const description = text(r.description)

  const glanceRows = keyValueRows([
    r.year_founded && { id: 'founded', icon: 'check-circle', key: 'Founded', value: text(r.year_founded) },
    text(r.employee_count) && { id: 'employees', icon: 'users', key: 'Employees', value: text(r.employee_count) },
    location && { id: 'hq', icon: 'location', key: 'Headquarters', value: location },
  ].filter(Boolean))

  return {
    slug: text(r.slug) || slug,
    kind: 'company',
    source: 'live-legacy',

    name,
    verified: false,
    verifiedLabel: 'Verified Organization',
    categories: asArray(r.vertical),
    location,
    website: text(r.website),
    email: text(r.email),
    phone: text(r.phone),
    linkedin: '',
    logoUrl: imageUrl(r.logo_url),
    description,
    tags: [],

    tabs: COMPANY_TABS,

    connect: {
      heading: `CONNECT WITH ${name.toUpperCase()}`,
      status: '',
      body: '',
      primaryCta: 'CONNECT',
      secondaryCta: 'FOLLOW',
    },

    atAGlance: { heading: 'AT A GLANCE', rows: glanceRows, footerLink: '' },
    capabilities: { heading: 'CAPABILITIES', total: 0, shown: [], footerLink: '' },
    missions: { heading: 'SPACE MISSIONS', rows: [], footerLink: '' },
    whatWeDo: { heading: 'WHAT WE DO', body: description, link: '' },
    whoWeWorkWith: { heading: 'WHO WE WORK WITH', counts: [], footerLink: '' },
    lookingFor: {
      heading: 'LOOKING FOR',
      action: '',
      left: { heading: '', items: [] },
      right: { heading: '', items: [] },
      footerLink: '',
    },
    locations: {
      heading: 'LOCATIONS',
      items: [],
      highlight: stateCodes([r.state]),
      markers: [],
      footerLink: '',
    },
    activity: { heading: 'ACTIVITY HIGHLIGHTS', stats: [], footerLink: '' },
    footer: COMPANY_FIXTURE.footer,
  }
}

/* ------------------------------------------------------------------------ *
 * The two exported reads.
 * ------------------------------------------------------------------------ */

export async function fetchPersonProfile(slug) {
  if (!slug) return null
  // Ahead of the supabase guard on purpose: the preview must render with no
  // database configured at all.
  if (slug === PREVIEW_SLUG) return { ...PERSON_FIXTURE, source: 'fixture' }
  if (!supabase) return null

  try {
    const { data, error } = await supabase.rpc('get_person_profile', { p_slug: slug })
    if (error) {
      if (error.code === FN_NOT_FOUND) {
        console.warn(
          'fetchPersonProfile: get_person_profile is not in the schema cache — ' +
          'migration 033_profile_read_rpcs.sql has not been applied to this project.',
        )
      } else {
        console.warn('fetchPersonProfile failed:', error.message || error)
      }
      return null
    }
    // A slug with no active record answers SQL NULL. Not-found, not an error.
    if (!data) return null
    return personFromRpc(data, slug)
  } catch (err) {
    console.warn('fetchPersonProfile threw:', err)
    return null
  }
}

export async function fetchCompanyProfile(slug) {
  if (!slug) return null
  if (slug === PREVIEW_SLUG) return { ...COMPANY_FIXTURE, source: 'fixture' }
  if (!supabase) return null

  try {
    const { data, error } = await supabase.rpc('get_company_profile', { p_slug: slug })
    if (!error) return data ? companyFromRpc(data, slug) : null

    if (error.code !== FN_NOT_FOUND) {
      console.warn('fetchCompanyProfile failed:', error.message || error)
      return null
    }

    console.warn(
      'fetchCompanyProfile: get_company_profile is not in the schema cache — ' +
      'migration 033_profile_read_rpcs.sql has not been applied to this project.' +
      (COMPANY_LEGACY_ON_MISSING_RPC ? ' Falling back to the plain directory_companies read.' : ''),
    )
    if (!COMPANY_LEGACY_ON_MISSING_RPC) return null

    const { data: row, error: rowError } = await supabase
      .from('directory_companies')
      .select('id,name,slug,description,logo_url,website,phone,email,vertical,city,state,country,employee_count,year_founded')
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle()
    if (rowError || !row) return null
    return companyFromRow(row, slug)
  } catch (err) {
    console.warn('fetchCompanyProfile threw:', err)
    return null
  }
}

export { PREVIEW_SLUG }
