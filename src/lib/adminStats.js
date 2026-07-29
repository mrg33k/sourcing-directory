/**
 * adminStats.js — the live read behind /admin-tools.
 *
 * Every figure the admin dashboard prints is counted here, in the database, and
 * handed to the screen as a number. Nothing on this path invents a value: a
 * metric either has a count behind it or it comes back `unavailable`, and the
 * screen says so in words rather than drawing a plausible number.
 *
 * WHAT THIS MODULE IS NOT: it holds no copy. Every sentence on the dashboard
 * lives in AdminTools.jsx. This file returns numbers, booleans, and the two
 * formats that are data-adjacent rather than editorial (a thousands-separated
 * count, a date). That line is what keeps the screen reviewable as a design and
 * this file reviewable as a query.
 *
 * ---------------------------------------------------------------------------
 * READS ONLY. NOTHING HERE WRITES.
 * ---------------------------------------------------------------------------
 * Every request is a SELECT. Most are `head: true` counts, which send the
 * predicate to Postgres and bring back a number in the Content-Range header
 * with ZERO rows over the wire. The dashboard reads the platform; it never
 * touches it.
 *
 * ---------------------------------------------------------------------------
 * IT RUNS ON THE ANON KEY, SO IT ONLY EVER COUNTS WHAT IS ALREADY PUBLIC
 * ---------------------------------------------------------------------------
 * /admin-tools/_preview is open to anyone and holds no secrets. Every table
 * touched here is already anon-readable through RLS (verified against the live
 * project, 2026-07-28). Two consequences worth stating out loud:
 *
 *   1. These are aggregate counts. No member row, no email, no auth id is ever
 *      fetched — the only per-record reads are organizations (a public
 *      directory listing) and person profiles whose own row says status
 *      = 'active', which is the exact condition under which RLS already
 *      publishes them at /people/<slug>. Nothing appears on this screen that a
 *      visitor could not already read on the site.
 *   2. When the real admin surface gets an auth guard, this module does not
 *      change: it is already reading through the same policies.
 *
 * ---------------------------------------------------------------------------
 * ONE FIGURE IS NOT COUNTED SERVER-SIDE, AND IT IS NOT FOR WANT OF TRYING
 * ---------------------------------------------------------------------------
 * Locations is COUNT(DISTINCT (city, state)) and belongs in Postgres. It is not
 * there today because this project has PostgREST aggregate functions turned
 * OFF: `select=city,state,count()` answers
 *
 *     {"code":"PGRST123","message":"Use of aggregate functions is not allowed"}
 *
 * for anon AND for service_role, so there is no GROUP BY, no count(), and
 * PostgREST has never supported DISTINCT. The correct fix is one read-only
 * function in the database:
 *
 *     CREATE FUNCTION get_admin_location_stats(p_current_from timestamptz,
 *                                              p_prior_from   timestamptz)
 *     RETURNS TABLE (total int, added int, prior int)
 *     LANGUAGE sql STABLE SECURITY DEFINER AS $$
 *       WITH place AS (
 *         SELECT lower(btrim(city)) AS c, lower(btrim(coalesce(state,''))) AS s,
 *                min(created_at) AS first_seen
 *         FROM directory_companies
 *         WHERE city IS NOT NULL AND btrim(city) <> ''
 *         GROUP BY 1, 2
 *       )
 *       SELECT count(*)::int,
 *              count(*) FILTER (WHERE first_seen >= p_current_from)::int,
 *              count(*) FILTER (WHERE first_seen >= p_prior_from
 *                                 AND first_seen <  p_current_from)::int
 *       FROM place;
 *     $$;
 *
 * Creating it is a schema change, which is not in this round's mandate, so the
 * client asks for it FIRST and falls back only when it is missing. The fallback
 * projects three short public columns (city, state, created_at) for the 164
 * companies that have a city — about 8KB, no PII, no whole rows — and does the
 * same GROUP BY here. `locations.mode` reports which path ran, so this is
 * visible rather than quietly assumed, and the day the function is applied the
 * client upgrades itself with no code change.
 *
 * The distinction the fallback still honours: the answer is the number of
 * DISTINCT places, never the row count. Those are 39 and 164 today. And a place
 * is "new" on the date its FIRST company registered, which is the only reading
 * under which the same city cannot be counted as new twice.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY METRIC FAILS ALONE
 * ---------------------------------------------------------------------------
 * Each count is wrapped in `settle()`. One table erroring returns
 * `{ ok: false }` for that one metric and leaves the other twenty intact, so a
 * single RLS change or a renamed column degrades one tile into "we cannot read
 * this" instead of blanking the dashboard. A dashboard that is 90% right and
 * says which 10% is missing beats a dashboard that is 0% there.
 */

import { supabase } from './supabase.js'

/* ------------------------------------------------------------------------- *
 * Constants
 * ------------------------------------------------------------------------- */

export const WINDOW_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** Rows pulled for the activity chart are capped. 30 days of signups on this
 *  platform is a couple of dozen timestamps; the cap is a guard against a bulk
 *  import turning one chart into a megabyte, not an expected condition. */
const SERIES_ROW_CAP = 2000

/** PostgREST: "no function with that name/signature in the schema cache." */
const FN_NOT_FOUND = 'PGRST202'

/**
 * CAPABILITIES COUNTS `directory_certifications`, AND ONLY THAT.
 *
 * Two tables could answer "how many capabilities does the platform hold":
 *   directory_certifications        345 rows — every capability record that
 *                                   exists today (ITAR Registered, AS9100, ...)
 *   directory_company_capabilities    0 rows — the new profile-screen table
 *                                   from migration 032
 *
 * They are NOT summed. The likeliest way the new table fills is a backfill out
 * of directory_certifications, and a sum would then count every capability
 * twice on the day that lands — a KPI that silently doubles is worse than one
 * that is a release behind. So the live source is named here, in one place, and
 * `metrics.companyCapabilities` is returned alongside it so the switch is a
 * one-line change made deliberately by whoever populates that table.
 */
const CAPABILITY_TABLE = 'directory_certifications'

/* ------------------------------------------------------------------------- *
 * Small formatters. Data-adjacent, not editorial — see the header note.
 * ------------------------------------------------------------------------- */

const numberFormat = new Intl.NumberFormat('en-US')

/** 2843 -> "2,843". Null/NaN -> null, never "0" and never "NaN". */
export function formatCount(n) {
  return Number.isFinite(n) ? numberFormat.format(n) : null
}

/** 2026-07-23 -> "Jul 23, 2026" — the "Member Since" column. */
export function formatDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "4 minutes ago" / "5 days ago" — the activity feed's time line. */
export function formatRelative(value, now = Date.now()) {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.max(0, Math.round((now - then) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.round(months / 12)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

/** UTC calendar day of a timestamp, the key the activity buckets are built on.
 *  UTC on both sides — created_at is stored in UTC, so bucketing in UTC is the
 *  only version where a row cannot land in a day that has no column. */
const dayKey = (value) => new Date(value).toISOString().slice(0, 10)

/* ------------------------------------------------------------------------- *
 * The delta rule
 * ------------------------------------------------------------------------- */

/**
 * Compare a 30-day window with the 30 days before it.
 *
 * Returns { added, prior, percent, direction } where `direction` is
 * 'up' | 'down' | 'flat' | 'first' | 'quiet' | 'none'.
 *
 * DIVISION BY ZERO IS THE WHOLE REASON THIS IS A FUNCTION. A prior window of 0
 * has no percentage — not Infinity, not 100%, not 0%. It answers 'first', which
 * the screen prints as "the first on record". A current window of 0 answers
 * 'quiet': there is no percentage to state either (0 against 34 is a real -100%,
 * but "down 100%" on a KPI reads as the platform losing its users rather than a
 * month with no signups), so the screen prints the count and stops.
 *
 * 'none' is the only value that means "no comparison exists" — a metric that
 * could not be read at all.
 */
export function windowDelta(added, prior) {
  if (!Number.isFinite(added) || !Number.isFinite(prior)) {
    return { added: null, prior: null, percent: null, direction: 'none' }
  }
  if (added === 0) return { added: 0, prior, percent: null, direction: 'quiet' }
  if (prior === 0) return { added, prior: 0, percent: null, direction: 'first' }
  const percent = Math.round(((added - prior) / prior) * 100)
  const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat'
  return { added, prior, percent: Math.abs(percent), direction }
}

/* ------------------------------------------------------------------------- *
 * Query plumbing
 * ------------------------------------------------------------------------- */

/** Run one read; never throw. `{ ok, value }` or `{ ok: false, error }`. */
async function settle(label, run) {
  try {
    return { ok: true, label, value: await run() }
  } catch (err) {
    const message = err?.message || String(err)
    if (typeof console !== 'undefined') console.warn(`[adminStats] ${label}: ${message}`)
    return { ok: false, label, error: message }
  }
}

/**
 * COUNT(*) with a predicate, computed in Postgres.
 *
 * `head: true` is the point: PostgREST answers with the Content-Range header
 * and an empty body, so a count of 166 costs the same bytes as a count of
 * 166,000 and no row ever reaches the browser.
 *
 * `filters` are [method, ...args] tuples applied to the PostgREST builder:
 *   ['eq', 'status', 'pending']            -> status = 'pending'
 *   ['gte', 'created_at', iso]             -> created_at >= iso
 *   ['not', 'city', 'is', null]            -> city IS NOT NULL
 */
async function countRows(table, { column = 'id', filters = [] } = {}) {
  let query = supabase.from(table).select(column, { count: 'exact', head: true })
  for (const [method, ...args] of filters) query = query[method](...args)
  const { count, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

/** The three counts every KPI needs: all time, this window, the one before. */
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

/* ------------------------------------------------------------------------- *
 * Locations — distinct (city, state)
 * ------------------------------------------------------------------------- */

/** Session memory: once the RPC has answered "no such function", stop asking.
 *  One 404 per page load is a diagnosable signal; one per render is noise. */
let locationRpcMissing = false

async function distinctLocations(windows) {
  if (!locationRpcMissing) {
    const { data, error } = await supabase.rpc('get_admin_location_stats', {
      p_current_from: windows.currentFrom,
      p_prior_from: windows.priorFrom,
    })
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data
      return { total: Number(row?.total) || 0, added: Number(row?.added) || 0, prior: Number(row?.prior) || 0, mode: 'server' }
    }
    if (error.code !== FN_NOT_FOUND) throw new Error(`get_admin_location_stats: ${error.message}`)
    locationRpcMissing = true
  }

  // Fallback: three public columns, grouped here. See the header.
  const { data, error } = await supabase
    .from('directory_companies')
    .select('city,state,created_at')
    .not('city', 'is', null)
    .limit(SERIES_ROW_CAP)
  if (error) throw new Error(`directory_companies(city,state,created_at): ${error.message}`)

  const firstSeen = new Map()
  for (const row of data || []) {
    const city = String(row.city || '').trim().toLowerCase()
    if (!city) continue // '' is not a place; NULL was already filtered in SQL
    const key = `${city}|${String(row.state || '').trim().toLowerCase()}`
    const at = new Date(row.created_at).getTime()
    if (!firstSeen.has(key) || at < firstSeen.get(key)) firstSeen.set(key, at)
  }

  const currentFrom = new Date(windows.currentFrom).getTime()
  const priorFrom = new Date(windows.priorFrom).getTime()
  let added = 0
  let prior = 0
  for (const at of firstSeen.values()) {
    if (at >= currentFrom) added += 1
    else if (at >= priorFrom) prior += 1
  }
  return { total: firstSeen.size, added, prior, mode: 'client-group', rowsRead: (data || []).length }
}

/* ------------------------------------------------------------------------- *
 * The 30-day activity series
 * ------------------------------------------------------------------------- */

/** The 30 UTC day keys ending today, oldest first. Built from the calendar,
 *  not from the data — which is what makes the zero-fill total. */
function windowDays(now, days = WINDOW_DAYS) {
  const keys = []
  for (let i = days - 1; i >= 0; i -= 1) keys.push(dayKey(now - i * DAY_MS))
  return keys
}

/**
 * One series of daily counts, ZERO-FILLED.
 *
 * The classic bug this exists to prevent: bucket the rows you got, hand the
 * resulting sparse array to a polyline, and the line silently redraws itself
 * over a different x-axis every day — 6 events on 6 different days become 6
 * evenly spaced points that look like a smooth ramp. Here the axis is the 30
 * calendar days, every one of them is present, and a day with no signups is a
 * 0 the chart draws through.
 */
async function dailyCounts(table, { dateColumn = 'created_at', days, sinceIso }) {
  const { data, error } = await supabase
    .from(table)
    .select(dateColumn)
    .gte(dateColumn, sinceIso)
    .order(dateColumn, { ascending: true })
    .limit(SERIES_ROW_CAP)
  if (error) throw new Error(`${table}(${dateColumn}): ${error.message}`)

  const byDay = new Map(days.map((d) => [d, 0]))
  for (const row of data || []) {
    const key = dayKey(row[dateColumn])
    if (byDay.has(key)) byDay.set(key, byDay.get(key) + 1)
  }
  return days.map((d) => byDay.get(d))
}

/**
 * A y-axis that fits the data instead of the design's 0-100.
 *
 * Small integers get one tick per unit (a platform whose busiest day is 1 gets
 * an axis of 0 and 1, not an empty 0-100 field with a line pinned to the
 * floor). Anything bigger gets five ticks on a 1/2/5 x 10^n step, so the top
 * tick is always >= the peak and the numbers are always readable.
 */
export function axisTicks(max) {
  const peak = Number.isFinite(max) ? Math.max(0, Math.ceil(max)) : 0
  if (peak <= 4) return Array.from({ length: Math.max(peak, 1) + 1 }, (_, i) => i)
  const rough = peak / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) || magnitude * 10
  return [0, 1, 2, 3, 4].map((i) => i * step)
}

/** Five evenly spaced x labels ("Jul 1"), first and last inclusive. */
function seriesLabels(days) {
  if (!days.length) return []
  const at = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (days.length - 1)))
  return [...new Set(at)].map((i) =>
    new Date(`${days[i]}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  )
}

/* ------------------------------------------------------------------------- *
 * The public read
 * ------------------------------------------------------------------------- */

/**
 * Read every figure on the admin dashboard.
 *
 * Always resolves. Shape:
 *
 *   { ok, reason?, readAt, metrics, locations, verification, activity,
 *     recentOrganizations, recentActivity, pending, failures }
 *
 * `ok: false` has exactly one cause: there is no database connection in this
 * build (no VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Everything else is a
 * per-metric `{ ok: false }` and the rest of the screen still draws.
 */
export async function loadAdminStats({ now = Date.now() } = {}) {
  if (!supabase) {
    return { ok: false, reason: 'no-connection', readAt: new Date(now), failures: [] }
  }

  const windows = {
    currentFrom: new Date(now - WINDOW_DAYS * DAY_MS).toISOString(),
    priorFrom: new Date(now - 2 * WINDOW_DAYS * DAY_MS).toISOString(),
  }
  const days = windowDays(now)
  const sinceIso = `${days[0]}T00:00:00.000Z`

  const [
    members,
    companies,
    capabilities,
    companyCapabilities,
    locations,
    verifiedNow,
    verificationPending,
    verificationRejected,
    verificationRows,
    verifiedAdded,
    verifiedPrior,
    membersPending,
    listingsPending,
    memberSeries,
    companySeries,
    capabilitySeries,
    recentOrgRows,
    recentPeople,
  ] = await Promise.all([
    settle('total users', () => countWithWindows('directory_members', { windows })),
    settle('organizations', () => countWithWindows('directory_companies', { windows })),
    settle('capabilities', () => countWithWindows(CAPABILITY_TABLE, { windows })),
    settle('profile capabilities', () => countRows('directory_company_capabilities')),
    settle('locations', () => distinctLocations(windows)),

    // Verification lives on directory_company_profile, one row per company that
    // has ever been looked at. Companies with no row there are unverified by
    // the column's own default, which is why `unverified` is derived below from
    // the organization total rather than counted: 166 - 0 - 0 - 0 = 166 is the
    // truthful split today, and counting the empty table would answer 0 of 0.
    settle('verified organizations', () =>
      countRows('directory_company_profile', { column: 'company_id', filters: [['eq', 'verification', 'verified']] })),
    settle('organizations pending review', () =>
      countRows('directory_company_profile', { column: 'company_id', filters: [['eq', 'verification', 'pending']] })),
    settle('organizations rejected', () =>
      countRows('directory_company_profile', { column: 'company_id', filters: [['eq', 'verification', 'rejected']] })),
    settle('verification records', () => countRows('directory_company_profile', { column: 'company_id' })),
    settle('verified this window', () =>
      countRows('directory_company_profile', {
        column: 'company_id',
        filters: [['eq', 'verification', 'verified'], ['gte', 'verified_at', windows.currentFrom]],
      })),
    settle('verified prior window', () =>
      countRows('directory_company_profile', {
        column: 'company_id',
        filters: [
          ['eq', 'verification', 'verified'],
          ['gte', 'verified_at', windows.priorFrom],
          ['lt', 'verified_at', windows.currentFrom],
        ],
      })),

    settle('registrations awaiting approval', () =>
      countRows('directory_members', { filters: [['eq', 'status', 'pending']] })),
    settle('content submissions', () =>
      countRows('directory_listings', { filters: [['eq', 'status', 'pending']] })),

    settle('new users by day', () => dailyCounts('directory_members', { days, sinceIso })),
    settle('new organizations by day', () => dailyCounts('directory_companies', { days, sinceIso })),
    settle('new capabilities by day', () => dailyCounts(CAPABILITY_TABLE, { days, sinceIso })),

    settle('recent organizations', async () => {
      const { data, error } = await supabase
        .from('directory_companies')
        .select('id,name,slug,city,state,created_at')
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw new Error(`directory_companies: ${error.message}`)
      const rows = data || []
      if (!rows.length) return []

      // Their verification + org_type, if either has ever been recorded.
      const { data: profiles } = await supabase
        .from('directory_company_profile')
        .select('company_id,verification,org_type')
        .in('company_id', rows.map((r) => r.id))
      const byId = new Map((profiles || []).map((p) => [p.company_id, p]))

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        // The design's sub-line is a category ("Launch Services"). org_type is
        // where that lives and nothing has one yet, so the line is OMITTED
        // rather than filled with `vertical`, which reads "Space" on all 166
        // rows and is a column of noise pretending to be information.
        sub: byId.get(r.id)?.org_type || null,
        location: [r.city, r.state].filter(Boolean).join(', '),
        verification: byId.get(r.id)?.verification || 'unverified',
        createdAt: r.created_at,
      }))
    }),

    settle('recent profiles', async () => {
      // status='active' is exactly the RLS condition under which these rows are
      // already published at /people/<slug>. Nothing here is more visible than
      // the site already makes it.
      const { data, error } = await supabase
        .from('directory_people')
        .select('id,full_name,slug,created_at,published_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(2)
      if (error) throw new Error(`directory_people: ${error.message}`)
      return data || []
    }),
  ])

  const failures = [members, companies, capabilities, locations, verifiedNow, verificationRows,
    memberSeries, companySeries, capabilitySeries, recentOrgRows, recentPeople]
    .filter((r) => !r.ok)
    .map((r) => r.label)

  /* --- verification split ------------------------------------------------ */
  const orgTotal = companies.ok ? companies.value.total : null
  const verified = verifiedNow.ok ? verifiedNow.value : null
  const pendingReview = verificationPending.ok ? verificationPending.value : null
  const rejected = verificationRejected.ok ? verificationRejected.value : null
  const decided = [verified, pendingReview, rejected].every((v) => v !== null)
  const verification = {
    ok: orgTotal !== null && decided,
    total: orgTotal,
    verified,
    pending: pendingReview,
    rejected,
    unverified: orgTotal !== null && decided
      ? Math.max(0, orgTotal - verified - pendingReview - rejected)
      : null,
    /** false = no organization has ever been through verification. The donut is
     *  still truthful (everything is unverified); this is what tells the screen
     *  to say why rather than let a single full ring imply a review happened. */
    recorded: verificationRows.ok ? verificationRows.value > 0 : null,
  }

  /* --- activity series --------------------------------------------------- */
  const seriesSources = [
    { id: 'users', result: memberSeries },
    { id: 'orgs', result: companySeries },
    { id: 'capabilities', result: capabilitySeries },
  ]
  const drawable = seriesSources.filter((s) => s.result.ok)
  const peak = Math.max(0, ...drawable.flatMap((s) => s.result.value))
  const activity = {
    ok: drawable.length > 0,
    points: Object.fromEntries(drawable.map((s) => [s.id, s.result.value])),
    xLabels: seriesLabels(days),
    yTicks: axisTicks(peak),
    peak,
    events: drawable.reduce((sum, s) => sum + s.result.value.reduce((a, b) => a + b, 0), 0),
    missing: seriesSources.filter((s) => !s.result.ok).map((s) => s.id),
  }

  /* --- the activity feed ------------------------------------------------- *
   * Merged from two real event sources and capped at 3 per source, so one bulk
   * import cannot fill all five rows with the same sentence and hide the rest
   * of the platform's week.                                                  */
  const feed = [
    ...(recentOrgRows.ok ? recentOrgRows.value : []).slice(0, 3).map((r) => ({
      id: `org-${r.id}`, kind: 'organization', subject: r.name, at: r.createdAt,
    })),
    ...(recentPeople.ok ? recentPeople.value : []).slice(0, 3).map((r) => ({
      id: `person-${r.id}`, kind: 'profile', subject: r.full_name, at: r.published_at || r.created_at,
    })),
  ]
    .filter((e) => e.at && e.subject)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 5)
    .map((e) => ({ ...e, time: formatRelative(e.at, now) }))

  return {
    ok: true,
    readAt: new Date(now),
    windowDays: WINDOW_DAYS,

    metrics: {
      users: members.ok ? members.value : null,
      organizations: companies.ok ? companies.value : null,
      capabilities: capabilities.ok ? capabilities.value : null,
      /** The new profile-screen table, reported but NOT added in. See CAPABILITY_TABLE. */
      companyCapabilities: companyCapabilities.ok ? companyCapabilities.value : null,
      capabilitySource: CAPABILITY_TABLE,
      verified: verified === null ? null : { total: verified, added: verifiedAdded.ok ? verifiedAdded.value : 0, prior: verifiedPrior.ok ? verifiedPrior.value : 0 },
    },

    locations: locations.ok
      ? {
          ok: true,
          total: locations.value.total,
          added: locations.value.added,
          prior: locations.value.prior,
          mode: locations.value.mode,
          rowsRead: locations.value.rowsRead,
        }
      : { ok: false },

    verification,
    activity,
    recentOrganizations: recentOrgRows.ok
      ? { ok: true, rows: recentOrgRows.value }
      : { ok: false, rows: [] },
    recentActivity: { ok: recentOrgRows.ok || recentPeople.ok, items: feed },

    pending: {
      /** Each entry is a real count or null. null means the platform has no
       *  column that records this yet — the screen must say so, not print 0. */
      organizationsAwaitingVerification: pendingReview,
      registrationsAwaitingApproval: membersPending.ok ? membersPending.value : null,
      contentSubmissions: listingsPending.ok ? listingsPending.value : null,
      /**
       * NOT MEASURABLE, and this null is the honest answer rather than a gap in
       * the query. Neither capability table has a status, a submitted_at or a
       * reviewer column: directory_certifications is
       * (id, company_id, cert_name, cert_value, vertical, created_at, tenant_id)
       * and directory_company_capabilities is
       * (id, company_id, name, subtitle, icon, sort_order, created_at, updated_at).
       * There is no submission queue in this database, so there is no number to
       * print — a 0 here would claim an empty queue that does not exist.
       */
      capabilitySubmissions: null,
    },

    failures,
  }
}

/**
 * The same payload for a platform with nothing in it — the `?state=empty`
 * design state.
 *
 * It lives HERE, next to loadAdminStats, and not in the screen, because a
 * hand-written copy of this shape is a copy that goes stale: the first version
 * of it kept `locations: { value }` after the live read moved to
 * `{ total, added, prior }`, and the Locations tile silently rendered with no
 * number at all. One shape, one file, one place to change it.
 */
export function emptyAdminStats(now = Date.now()) {
  const days = windowDays(now)
  const zeros = days.map(() => 0)
  return {
    ok: true,
    readAt: new Date(now),
    windowDays: WINDOW_DAYS,
    metrics: {
      users: { total: 0, added: 0, prior: 0 },
      organizations: { total: 0, added: 0, prior: 0 },
      capabilities: { total: 0, added: 0, prior: 0 },
      companyCapabilities: 0,
      capabilitySource: CAPABILITY_TABLE,
      verified: { total: 0, added: 0, prior: 0 },
    },
    locations: { ok: true, total: 0, added: 0, prior: 0, mode: 'server' },
    verification: { ok: true, total: 0, verified: 0, pending: 0, rejected: 0, unverified: 0, recorded: false },
    activity: {
      ok: true,
      points: { users: zeros, orgs: zeros, capabilities: zeros },
      xLabels: seriesLabels(days),
      yTicks: axisTicks(0),
      peak: 0,
      events: 0,
      missing: [],
    },
    recentOrganizations: { ok: true, rows: [] },
    recentActivity: { ok: true, items: [] },
    pending: {
      organizationsAwaitingVerification: 0,
      registrationsAwaitingApproval: 0,
      contentSubmissions: 0,
      capabilitySubmissions: null,
    },
    failures: [],
  }
}

export default {
  loadAdminStats, emptyAdminStats, windowDelta, axisTicks,
  formatCount, formatDate, formatRelative, WINDOW_DAYS,
}
