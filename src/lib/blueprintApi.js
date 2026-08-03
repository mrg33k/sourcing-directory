// Read layer for the Arizona Space Action Blueprint page.
//
// One function, one round of reads, one shape out. The page holds no query
// logic — same seam as src/lib/profileApi.js and src/lib/adminStats.js.
//
// THE ONE RULE THIS FILE ENFORCES
// -------------------------------
// Every count returned here is `count: 'exact', head: true` against the real
// table. Nothing is estimated, defaulted or carried over from a previous read.
// When a read FAILS the count comes back `null`, never 0 — the page renders
// null as "could not read" and 0 as the number zero, and those are different
// sentences. `settle()` below is the same idea as adminStats.js:204: one metric
// failing degrades one tile instead of blanking the screen.
//
// Priority display names are COALESCE(blueprint_priorities.name,
// directory_tags.name). The tag is the record; the local column is an override
// an admin can set. See the migration header for why.

import { supabase } from './supabase.js'

export const TENANT_DB_LOOKUP_SLUG = 'space-rising'

/** The report row the hero button and the Documents tab are both built on. */
export const BLUEPRINT_REPORT_ID = 'ccec28b1-2019-5418-91a0-7a09f1e63ab2'

/* `blurb` is the one-liner the Overview grid shows; `summary` is the paragraph
   the Priorities tab shows. Two columns rather than one because a single string
   either blows the card height or loses the sourced detail — both come from the
   same cited section of the report. */
const PRIORITY_COLUMNS =
  'id,tag_id,name,slug,theme,blurb,summary,source_note,icon,sort_order,status,updated_at'

/** Resolve one metric without letting it take the others down with it. */
async function settle(label, run) {
  try {
    return { ok: true, label, value: await run() }
  } catch (err) {
    console.warn(`[blueprintApi] ${label}: ${err?.message || err}`)
    return { ok: false, label, value: null }
  }
}

/** Exact row count, or a throw the caller's settle() turns into null. */
async function countRows(table, filters = []) {
  let q = supabase.from(table).select('id', { count: 'exact', head: true })
  for (const [method, ...args] of filters) q = q[method](...args)
  const { count, error } = await q
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

/**
 * Counts of goals / initiatives / KPIs / aligned organizations, grouped by
 * priority id.
 *
 * Deliberately NOT four `count(*) group by` calls — PostgREST has no group-by,
 * and four head-counts per priority would be 24 requests. Instead each table is
 * read once for its priority_id column only and tallied in the browser. That is
 * correct for the volumes this page will ever see (a governance hierarchy is
 * tens of rows, not thousands) and it is exact, not sampled.
 */
async function countsByPriority(tenantId) {
  const spec = [
    ['goals', 'blueprint_goals'],
    ['initiatives', 'blueprint_initiatives'],
    ['kpis', 'blueprint_kpis'],
    ['organizations', 'blueprint_alignments'],
  ]
  const out = {}
  await Promise.all(spec.map(async ([key, table]) => {
    let q = supabase.from(table).select('priority_id')
    if (tenantId) q = q.eq('tenant_id', tenantId)
    const { data, error } = await q.limit(5000)
    if (error) { out[key] = null; return }
    const tally = {}
    for (const row of data || []) {
      if (!row.priority_id) continue
      tally[row.priority_id] = (tally[row.priority_id] || 0) + 1
    }
    out[key] = tally
  }))
  return out
}

/**
 * Everything the Blueprint page renders, in one call.
 *
 * Returns `{ ok:false }` only when the build has no database connection at all.
 * A connected build with empty tables returns ok:true and zeros — "we cannot
 * read the platform" and "the platform has none of these yet" are different
 * screens.
 */
export async function loadBlueprint() {
  if (!supabase) {
    return { ok: false, reason: 'no-connection', readAt: new Date() }
  }

  let tenantId = null
  try {
    const { data } = await supabase
      .from('directory_tenants')
      .select('id')
      .eq('slug', TENANT_DB_LOOKUP_SLUG)
      .single()
    tenantId = data?.id || null
  } catch (_) {
    /* fall through: an unscoped read is still better than a blank screen, and
       every blueprint_* table currently holds one tenant's rows only. */
  }

  const scoped = (q) => (tenantId ? q.eq('tenant_id', tenantId) : q)

  const [
    prioritiesR, tagsR, milestonesR, findingsR, reportsR, activityR,
    goalsR, initiativesR, kpisR, orgTotalR, perPriority,
  ] = await Promise.all([
    settle('priorities', async () => {
      const { data, error } = await scoped(
        supabase.from('blueprint_priorities').select(PRIORITY_COLUMNS).eq('status', 'active'),
      ).order('sort_order', { ascending: true })
      if (error) throw new Error(error.message)
      return data || []
    }),
    settle('tags', async () => {
      const { data, error } = await supabase
        .from('directory_tags')
        .select('id,name,description')
        .eq('category', 'market_goal')
      if (error) throw new Error(error.message)
      return data || []
    }),
    settle('milestones', async () => {
      const { data, error } = await scoped(
        supabase.from('blueprint_milestones')
          .select('id,phase_code,title,description,horizon,status,target_date,priority_id,sort_order'),
      ).order('sort_order', { ascending: true })
      if (error) throw new Error(error.message)
      return data || []
    }),
    settle('findings', async () => {
      const { data, error } = await scoped(
        supabase.from('blueprint_findings').select('id,kind,code,title,body,source_note,sort_order'),
      ).order('sort_order', { ascending: true })
      if (error) throw new Error(error.message)
      return data || []
    }),
    settle('reports', async () => {
      const { data, error } = await scoped(
        supabase.from('directory_reports')
          .select('id,title,category,access,description,file_url,published_at'),
      ).order('published_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data || []
    }),
    settle('activity', async () => {
      const { data, error } = await scoped(
        supabase.from('blueprint_activity')
          .select('id,action,entity_type,summary,actor_email,created_at'),
      ).order('created_at', { ascending: false }).limit(12)
      if (error) throw new Error(error.message)
      return data || []
    }),
    settle('goals', async () => {
      const { data, error } = await scoped(
        supabase.from('blueprint_goals')
          .select('id,priority_id,code,title,description,owner,status,progress_pct,target_date,sort_order'),
      ).order('progress_pct', { ascending: false })
      if (error) throw new Error(error.message)
      return data || []
    }),
    settle('initiatives', async () => {
      const { data, error } = await scoped(
        supabase.from('blueprint_initiatives')
          .select('id,priority_id,goal_id,title,description,lead_org,owner,status,target_date,sort_order'),
      ).order('sort_order', { ascending: true })
      if (error) throw new Error(error.message)
      return data || []
    }),
    settle('kpis', async () => {
      const { data, error } = await scoped(
        supabase.from('blueprint_kpis')
          .select('id,priority_id,goal_id,name,description,unit,baseline_value,current_value,target_value,as_of,source,sort_order'),
      ).order('sort_order', { ascending: true })
      if (error) throw new Error(error.message)
      return data || []
    }),
    /* The ecosystem's real organization count — directory_companies, not the
       4-row directory_organizations table. Used only as the DENOMINATOR beside
       the aligned count; it is never presented as an alignment figure. */
    settle('organizationsTotal', async () => {
      const filters = [['eq', 'status', 'active']]
      if (tenantId) filters.push(['eq', 'tenant_id', tenantId])
      return countRows('directory_companies', filters)
    }),
    countsByPriority(tenantId),
  ])

  // A read that failed anywhere means the build cannot talk to the database.
  if (!prioritiesR.ok && !reportsR.ok && !milestonesR.ok) {
    return { ok: false, reason: 'unreadable', readAt: new Date() }
  }

  const tagName = {}
  for (const t of tagsR.value || []) tagName[t.id] = t.name

  const priorities = (prioritiesR.value || []).map((p, i) => ({
    ...p,
    // The tag is the record. The local column is an override, and it is only
    // used when an admin has actually typed one.
    displayName: (p.name && p.name.trim()) || tagName[p.tag_id] || p.slug,
    nameSource: (p.name && p.name.trim()) ? 'override' : (tagName[p.tag_id] ? 'tag' : 'slug'),
    number: i + 1,
    counts: {
      goals: perPriority.goals ? (perPriority.goals[p.id] || 0) : null,
      initiatives: perPriority.initiatives ? (perPriority.initiatives[p.id] || 0) : null,
      kpis: perPriority.kpis ? (perPriority.kpis[p.id] || 0) : null,
      organizations: perPriority.organizations ? (perPriority.organizations[p.id] || 0) : null,
    },
  }))

  const goals = goalsR.value || []
  const reports = reportsR.value || []
  const blueprintReport = reports.find((r) => r.id === BLUEPRINT_REPORT_ID) || null

  /* "Last updated" is a real timestamp or it is nothing. The report's
     published_at is the Blueprint's own date; the newest updated_at across the
     governance rows is when this page's content last changed. Both are read,
     neither is invented. */
  const contentTouchedAt = [...priorities]
    .map((p) => p.updated_at)
    .filter(Boolean)
    .sort()
    .pop() || null

  return {
    ok: true,
    readAt: new Date(),
    tenantId,
    priorities,
    milestones: milestonesR.value || [],
    findings: findingsR.value || [],
    positions: (findingsR.value || []).filter((f) => f.kind === 'position'),
    gaps: (findingsR.value || []).filter((f) => f.kind === 'gap'),
    reports,
    blueprintReport,
    activity: activityR.value || [],
    goals,
    topGoals: [...goals].sort((a, b) => (b.progress_pct || 0) - (a.progress_pct || 0)).slice(0, 5),
    initiatives: initiativesR.value || [],
    kpis: kpisR.value || [],
    totals: {
      priorities: priorities.length,
      goals: goalsR.ok ? goals.length : null,
      initiatives: initiativesR.ok ? (initiativesR.value || []).length : null,
      kpis: kpisR.ok ? (kpisR.value || []).length : null,
      alignedOrganizations: perPriority.organizations
        ? Object.values(perPriority.organizations).reduce((n, v) => n + v, 0)
        : null,
      ecosystemOrganizations: orgTotalR.ok ? orgTotalR.value : null,
    },
    contentTouchedAt,
    failures: [prioritiesR, milestonesR, findingsR, reportsR, activityR, goalsR, initiativesR, kpisR, orgTotalR]
      .filter((r) => !r.ok)
      .map((r) => r.label),
  }
}

export default loadBlueprint
