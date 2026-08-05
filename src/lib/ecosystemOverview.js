/**
 * ecosystemOverview.js — the live read behind /ecosystem/overview.
 *
 * Same contract as src/lib/adminStats.js, which this is modelled on and
 * borrows from: every figure is counted in the database at load, every metric
 * fails alone, and a metric with no mechanism behind it comes back `null` so
 * the screen can say so in words instead of drawing a plausible number.
 *
 * READS ONLY. Every request is a SELECT.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS COUNTED, AND WHAT IS DERIVED IN THE BROWSER
 * ---------------------------------------------------------------------------
 * PostgREST aggregate functions are OFF on this project (adminStats.js:44-47
 * has the receipt: `select=city,count()` answers PGRST123 for anon AND for
 * service_role). So there is no GROUP BY over the wire and four of this
 * screen's sections — the type donut, the capability bars, the city counts, the
 * capability leaderboard — are grouped here from short projections:
 *
 *   directory_companies        id,name,slug,city,state,created_at   165 rows
 *   directory_company_profile  company_id,org_type                  164 rows
 *   directory_certifications   company_id,cert_name                 345 rows
 *
 * Three named columns each, ~30KB total, no PII, no whole rows. Everything that
 * CAN be a head-count (the six KPI totals and their 30-day windows) is one,
 * because those cost zero rows.
 *
 * THE 164 IS NOT A BUG. directory_company_profile is published by RLS only for
 * companies whose own status is 'active' (directory_company_is_public), and one
 * of the 165 is still pending. So the donut is honestly a picture of the 164
 * public organizations, and the screen prints the difference rather than
 * papering over it with a total that does not add up.
 *
 * ---------------------------------------------------------------------------
 * THREE SECTIONS THE DESIGN ASKED FOR THAT DO NOT EXIST, AND WHAT REPLACED THEM
 * ---------------------------------------------------------------------------
 * Named here because the substitutions are the interesting part of this file:
 *
 *   "Connections Made"      There is no connections table, column or concept in
 *                           this product. Not renamed, not approximated — the
 *                           tile is Ecosystem Reports, a different real number.
 *   "Capabilities by
 *    Category"              directory_certifications has cert_name, cert_value
 *                           and vertical. No category column, no taxonomy, 30
 *                           flat names. Seven categories cannot be drawn
 *                           without inventing the mapping, so the bars rank the
 *                           30 real names by how many organizations hold each.
 *   "Top Capabilities in
 *    Demand"               directory_company_needs has 0 rows, so nothing on
 *                           this platform records demand. The list ranks the
 *                           other real thing: which organizations hold the most
 *                           capabilities.
 */

import { supabase } from './supabase.js'
import { windowDelta as windowDeltaFn } from './adminStats.js'
import { normalizeCity, cityLabel, isArizona, markerFor } from './cityGeography.js'

export const WINDOW_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
const TENANT_DB_LOOKUP_SLUG = 'space-rising'

/** Guard against a bulk import turning one grouped read into a megabyte. Not an
 *  expected condition: the largest table read here is 345 rows. */
const ROW_CAP = 2000

/* The six types the backfill writes (scripts/backfill-org-type.mjs), in the
   order the donut draws them. Order is by expected size, largest first, so the
   slivers group together on one side of the ring instead of being scattered
   between the big arcs where each one reads as a rendering artefact.

   `tone` is a class suffix, never a colour: DonutChart applies
   `osv3p-status--<tone>` and the page stylesheet is the only place a hex lives
   (osv3-ecosystem-overview.css). The four tones the shared sheet already
   defines are verification states and mean something else, so these carry their
   own prefix and are scoped to this page. */
export const ORG_TYPE_ORDER = [
  { id: 'Private Company', label: 'Private Company', tone: 'orgtype-private' },
  { id: 'Nonprofit', label: 'Nonprofit', tone: 'orgtype-nonprofit' },
  { id: 'Government', label: 'Government', tone: 'orgtype-government' },
  { id: 'Academic', label: 'Academic', tone: 'orgtype-academic' },
  { id: 'Investor', label: 'Investor', tone: 'orgtype-investor' },
  { id: 'Other', label: 'Other', tone: 'orgtype-other' },
]

/* ------------------------------------------------------------------------- *
 * Formatters — data-adjacent, not editorial
 * ------------------------------------------------------------------------- */

const numberFormat = new Intl.NumberFormat('en-US')

export function formatCount(n) {
  return Number.isFinite(n) ? numberFormat.format(n) : null
}

/* `formatRelative` ("2 hours ago") and `windowDelta` (the 30-day comparison
   that refuses to divide by zero) are adminStats.js's, re-exported rather than
   re-written. Two implementations of "how long ago" in one codebase is two
   implementations that drift, and windowDelta's 'first' / 'quiet' answers are
   exactly the two cases this screen has to handle. */
export { formatRelative, windowDelta } from './adminStats.js'

/* ------------------------------------------------------------------------- *
 * Query plumbing (adminStats.js pattern)
 * ------------------------------------------------------------------------- */

async function settle(label, run) {
  try {
    return { ok: true, label, value: await run() }
  } catch (err) {
    const message = err?.message || String(err)
    if (typeof console !== 'undefined') console.warn(`[ecosystemOverview] ${label}: ${message}`)
    return { ok: false, label, error: message }
  }
}

/** COUNT(*) with a predicate, computed in Postgres. `head: true` means the
 *  answer arrives in the Content-Range header with zero rows over the wire. */
async function countRows(table, { column = 'id', filters = [] } = {}) {
  let query = supabase.from(table).select(column, { count: 'exact', head: true })
  for (const [method, ...args] of filters) query = query[method](...args)
  const { count, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

async function countWithWindows(table, { column = 'id', dateColumn = 'created_at', windows, filters = [] }) {
  const [total, added, prior] = await Promise.all([
    countRows(table, { column, filters }),
    countRows(table, { column, filters: [...filters, ['gte', dateColumn, windows.currentFrom]] }),
    countRows(table, {
      column,
      filters: [...filters, ['gte', dateColumn, windows.priorFrom], ['lt', dateColumn, windows.currentFrom]],
    }),
  ])
  return { total, added, prior }
}

async function selectRows(table, columns, tune = (qb) => qb) {
  const { data, error } = await tune(supabase.from(table).select(columns)).limit(ROW_CAP)
  if (error) throw new Error(`${table}(${columns}): ${error.message}`)
  return data || []
}

/* ------------------------------------------------------------------------- *
 * Grouping
 * ------------------------------------------------------------------------- */

/** Organizations by type. Segments in ORG_TYPE_ORDER, zero-valued ones kept in
 *  the legend (a type with no members is a fact) and dropped by DonutChart from
 *  the ring itself (a zero-length arc is not drawable). */
function groupOrgTypes(profiles, organizationTotal) {
  const counts = new Map(ORG_TYPE_ORDER.map((t) => [t.id, 0]))
  let unknown = 0
  for (const row of profiles) {
    const t = row.org_type
    if (t && counts.has(t)) counts.set(t, counts.get(t) + 1)
    else unknown += 1
  }
  const segments = ORG_TYPE_ORDER.map((t) => ({ ...t, value: counts.get(t.id) }))
  const typed = segments.reduce((a, s) => a + s.value, 0)
  return {
    ok: typed > 0,
    segments,
    typed,
    /* Live organizations the donut does NOT cover: any row the backfill has not
       reached yet. Printed under the chart rather than folded into 'Other',
       because "we have not typed it" and "we typed it and could not tell" are
       different sentences and only the second one is what 'Other' means. */
    notCovered: Math.max(0, (organizationTotal ?? typed) - typed - unknown),
    unknown,
  }
}

/** Capabilities by how many organizations hold each. `pct` is relative to the
 *  most-held capability, which is what makes the bars comparable to each other;
 *  the printed number beside each bar is always the real count. */
function groupCapabilities(certRows, take = 7) {
  const byName = new Map()
  for (const row of certRows) {
    const name = String(row.cert_name || '').trim()
    if (!name) continue
    if (!byName.has(name)) byName.set(name, new Set())
    byName.get(name).add(row.company_id)
  }
  const all = [...byName.entries()]
    .map(([label, ids]) => ({ id: label, label, count: ids.size }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  const peak = all[0]?.count || 1
  return {
    ok: all.length > 0,
    distinct: all.length,
    rows: all.slice(0, take).map((r) => ({ ...r, pct: Math.round((r.count / peak) * 100) })),
  }
}

/** Organizations by the number of capabilities on record. The replacement for
 *  "Top Capabilities in Demand" — see the header. */
function groupCapabilityLeaders(certRows, companyById, take = 5) {
  const byCompany = new Map()
  for (const row of certRows) {
    if (!row.company_id) continue
    byCompany.set(row.company_id, (byCompany.get(row.company_id) || 0) + 1)
  }
  const rows = [...byCompany.entries()]
    .map(([id, count]) => ({ id, count, ...(companyById.get(id) || {}) }))
    .filter((r) => r.name)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, take)
  return { ok: rows.length > 0, rows }
}

/**
 * Arizona organizations by city.
 *
 * TWO MERGES AND ONE REFUSAL, all of them load-bearing:
 *   - "Phoenix" and "Phoenix, AZ" are separate values in this column and are
 *     merged (normalizeCity). Left apart, the map draws Phoenix at 33 when the
 *     real figure is 34, and Scottsdale at 22 when it is 23.
 *   - a city with no entry in the coordinate table gets NO marker. It still
 *     appears in the list with its real count; it simply is not placed. An
 *     invented coordinate is the one thing worse than a missing pin.
 *   - one row's city column holds the literal string "Arizona", which is a
 *     state. It is not a place, it is not merged into Phoenix, and it is
 *     counted in `unplaceable` so the screen can say the map covers 133 of 135.
 */
function groupPlaces(companies, windows) {
  const az = companies.filter((c) => isArizona(c.state))
  const counts = new Map()
  const firstSeen = new Map()
  let unplaceable = 0
  for (const c of az) {
    const key = normalizeCity(c.city)
    if (!key) { unplaceable += 1; continue }
    counts.set(key, (counts.get(key) || 0) + 1)
    const at = new Date(c.created_at).getTime()
    if (Number.isFinite(at) && (!firstSeen.has(key) || at < firstSeen.get(key))) firstSeen.set(key, at)
  }
  const rows = [...counts.entries()]
    .map(([key, count]) => ({ key, label: cityLabel(key), count, marker: markerFor(key) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  /* A CITY is new on the date its FIRST organization registered — the same rule
     adminStats.distinctLocations() applies, and the only reading under which
     Phoenix cannot be counted as a new place twice. */
  const currentFrom = new Date(windows.currentFrom).getTime()
  const priorFrom = new Date(windows.priorFrom).getTime()
  let added = 0
  let prior = 0
  for (const at of firstSeen.values()) {
    if (at >= currentFrom) added += 1
    else if (at >= priorFrom) prior += 1
  }

  const markers = rows.filter((r) => r.marker).map((r) => ({ ...r.marker, label: `${r.label} — ${r.count}` }))
  const unmapped = rows.filter((r) => !r.marker)
  return {
    ok: rows.length > 0,
    rows,
    markers,
    arizonaTotal: az.length,
    cities: rows.length,
    added,
    prior,
    placed: rows.filter((r) => r.marker).reduce((a, r) => a + r.count, 0),
    unmapped,
    unplaceable,
  }
}

/** "Phoenix, AZ" typed into the city field plus "AZ" in the state field reads
 *  as "Phoenix, AZ, AZ" if the two are simply joined. The trailing state comes
 *  off the city; nothing else about the string is touched. */
function locationOf(company) {
  const city = String(company.city || '').replace(/[\s,]+(AZ|Arizona)$/i, '').trim()
  return [city, company.state].filter(Boolean).join(', ')
}

/* Plain-word readings of the three audit actions get_ecosystem_activity
   returns. The feed says what happened in the member's terms; it never prints
   the raw action string, and it never says "connected" or "joined the
   ecosystem" for something that was an admin approving a listing. */
const ACTIVITY_COPY = {
  'company.approve': { icon: 'org-check', verb: 'was approved into the directory' },
  'company.feature': { icon: 'bookmark', verb: 'was featured in the directory' },
  'company.unfeature': { icon: 'bookmark', verb: 'was un-featured in the directory' },
}

/* ------------------------------------------------------------------------- *
 * The public read
 * ------------------------------------------------------------------------- */

export async function loadEcosystemOverview({
  now = Date.now(),
  windowDays = WINDOW_DAYS,
  tenantSlug = TENANT_DB_LOOKUP_SLUG,
} = {}) {
  if (!supabase) {
    return { ok: false, reason: 'no-connection', readAt: new Date(now), windowDays, failures: [] }
  }

  /* The window is a PARAMETER because the screen's one control changes it. Both
     ends move together: a 90-day window is always compared against the 90 days
     before it, never against a fixed month, so the comparison stays like for
     like at every setting. */
  const span = Math.max(1, Math.round(windowDays)) * DAY_MS
  const windows = {
    currentFrom: new Date(now - span).toISOString(),
    priorFrom: new Date(now - 2 * span).toISOString(),
  }

  // Step 1: resolve the tenant, the house pattern for any scoped table
  // (OSOrganizationsPage.jsx:134-162). A miss is not fatal — every row in this
  // database belongs to space-rising today, so an unfiltered count is the same
  // number. It is applied when it resolves so the screen stays correct the day
  // a second tenant exists.
  let tenantId = null
  try {
    const { data } = await supabase.from('directory_tenants').select('id').eq('slug', tenantSlug).single()
    tenantId = data?.id || null
  } catch { /* fall through unfiltered */ }
  const scoped = (filters = []) => (tenantId ? [...filters, ['eq', 'tenant_id', tenantId]] : filters)

  /* ORGANIZATIONS MEANS THE LIVE DIRECTORY, NOT THE TABLE.
     directory_companies holds 165 rows; 164 have status 'active' and one is
     still awaiting approval. A member reading "Ecosystem Overview" is asking
     how many organizations are IN the ecosystem, and an application that has
     not been approved is not in it yet — it is not on /directory either, and
     RLS does not publish its profile row, so counting it here would put a 165
     above a donut that can only ever reach 164.
     This is deliberately NOT the same number /admin-tools prints. That screen
     counts records, because an admin's job includes the queue. This one counts
     the ecosystem. The footnote says which. */
  const live = (filters = []) => scoped([...filters, ['eq', 'status', 'active']])

  const [
    organizations,
    people,
    capabilities,
    reports,
    arizonaCompanies,
    companyRows,
    profileRows,
    certRows,
    activityRows,
  ] = await Promise.all([
    settle('organizations', () => countWithWindows('directory_companies', { windows, filters: live() })),
    settle('people', () => countWithWindows('directory_people', { windows, filters: scoped() })),
    settle('capabilities', () => countWithWindows('directory_certifications', { windows, filters: scoped() })),
    settle('reports', () => countWithWindows('directory_reports', { windows, filters: scoped() })),
    settle('Arizona organizations', () =>
      countWithWindows('directory_companies', { windows, filters: live([['in', 'state', ['AZ', 'Arizona']]]) })),

    settle('organization list', () =>
      selectRows('directory_companies', 'id,name,slug,city,state,created_at', (qb) =>
        qb.eq('status', 'active').order('created_at', { ascending: false }))),
    settle('organization types', () => selectRows('directory_company_profile', 'company_id,org_type,verification')),
    settle('capability list', () => selectRows('directory_certifications', 'company_id,cert_name')),

    settle('ecosystem activity', async () => {
      const { data, error } = await supabase.rpc('get_ecosystem_activity', { p_limit: 5 })
      if (error) throw new Error(`get_ecosystem_activity: ${error.message}`)
      return data || []
    }),
  ])

  const failures = [organizations, people, capabilities, reports, arizonaCompanies,
    companyRows, profileRows, certRows, activityRows]
    .filter((r) => !r.ok).map((r) => r.label)

  const companies = companyRows.ok ? companyRows.value : []
  const companyById = new Map(companies.map((c) => [c.id, { name: c.name, slug: c.slug }]))
  const profiles = profileRows.ok ? profileRows.value : []
  const certs = certRows.ok ? certRows.value : []

  const places = companyRows.ok ? groupPlaces(companies, windows) : { ok: false, rows: [], markers: [] }
  const orgTypes = profileRows.ok
    ? groupOrgTypes(profiles, organizations.ok ? organizations.value.total : null)
    : { ok: false, segments: [], typed: 0, notCovered: 0, unknown: 0 }

  /* Verification, read off the same profile rows the donut already cost us. It
     is 0 of 164 today and that is a real zero, not a failure: no organization
     has been through review. The Recent Organizations rows carry it so the
     badge appears by itself the day one is verified. */
  const verifiedById = new Map(profiles.map((p) => [p.company_id, p.verification === 'verified']))
  const typeById = new Map(profiles.map((p) => [p.company_id, p.org_type]))

  return {
    ok: true,
    readAt: new Date(now),
    windowDays,

    metrics: {
      organizations: organizations.ok ? organizations.value : null,
      people: people.ok ? people.value : null,
      capabilities: capabilities.ok ? capabilities.value : null,
      reports: reports.ok ? reports.value : null,
      /* Both of these carry a real window too, and each one measures a
         different event. Arizona Organizations counts the Arizona rows that
         registered inside it. Arizona Cities counts CITIES that were not on
         the map before — a place is new on the date its first organization
         registered, so the same city can never be counted as new twice. */
      arizonaCompanies: arizonaCompanies.ok ? arizonaCompanies.value : null,
      arizonaLocations: places.ok ? { total: places.cities, added: places.added, prior: places.prior } : null,
    },

    orgTypes,
    capabilities: certRows.ok ? groupCapabilities(certs) : { ok: false, rows: [], distinct: 0 },
    leaders: certRows.ok ? groupCapabilityLeaders(certs, companyById) : { ok: false, rows: [] },
    places,

    recentOrganizations: {
      ok: companyRows.ok,
      rows: companies.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        type: typeById.get(c.id) || null,
        location: locationOf(c),
        createdAt: c.created_at,
        verified: verifiedById.get(c.id) === true,
      })),
      /** How many of the five have been verified. 0 is the honest number today
       *  and the screen says why rather than showing five grey badges. */
      verifiedCount: companies.slice(0, 5).filter((c) => verifiedById.get(c.id) === true).length,
    },

    activity: {
      ok: activityRows.ok,
      items: (activityRows.ok ? activityRows.value : [])
        .map((r) => {
          const copy = ACTIVITY_COPY[r.action]
          if (!copy) return null // an action with no plain-word reading is not printed
          return { id: r.id, icon: copy.icon, subject: r.company_name, slug: r.company_slug, verb: copy.verb, at: r.occurred_at }
        })
        .filter(Boolean),
    },

    failures,
  }
}

export default { loadEcosystemOverview, windowDelta: windowDeltaFn, formatCount, WINDOW_DAYS, ORG_TYPE_ORDER }
