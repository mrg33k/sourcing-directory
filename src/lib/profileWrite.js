/**
 * profileWrite.js — the WRITE seam for the person and company profiles.
 *
 * profileApi.js reads. This file writes. They are deliberately separate: the
 * read path is display-shaped (get_person_profile collapses needs to bare
 * labels, caps the capability list at ten, and never returns a row id), and you
 * cannot edit a record through a payload that has thrown away its primary keys.
 * So every load in this file goes STRAIGHT AT THE TABLES and keeps the ids.
 *
 * ===========================================================================
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE
 * ===========================================================================
 * A save that silently does nothing is worse than a save that fails loudly.
 *
 * supabase-js hands you `{ data: [], error: null }` when a write is legal at
 * the grant level but matches NO ROW under RLS. That is indistinguishable from
 * success at a glance, and it is exactly how "I pressed Save and it forgot
 * everything" ships. So:
 *
 *   * every write ends in `.select(...)`
 *   * every write counts the rows that actually came back
 *   * zero rows where rows were required is returned as an ERROR, never as ok
 *
 * `NO_ROWS_WRITTEN` below is that check. Do not remove it to make a test pass.
 *
 * ===========================================================================
 * WHY BROWSER WRITES ARE SAFE HERE — AND WHY THE UI STILL CHECKS
 * ===========================================================================
 * migrations/032 puts the authorization in Postgres:
 *
 *   directory_people                 owner (auth_user_id = auth.uid()), or an
 *                                    approved member of the person's company
 *                                    when the row has no auth user, or admin
 *   person child tables              directory_can_edit_person(person_id)
 *   company child tables + profile   approved member of that company, or admin
 *   directory_mission_scores         the matching one of the two, by entity_type
 *
 * and the INSERT/UPDATE/DELETE grants on all ten tables go to `authenticated`
 * ONLY — `anon` was never given them. So a signed-out browser cannot write, and
 * a signed-in browser can only write its own rows. That is the enforcement.
 *
 * The predicates re-implemented below are NOT the enforcement. They exist so a
 * viewer is never shown an Edit control that is going to fail — a button that
 * throws a permission error when pressed is a worse lie than no button. Two
 * layers, and only one of them is load-bearing. If they ever disagree, Postgres
 * is right.
 *
 * ===========================================================================
 * ONE PLACE THE UI CHECK IS DELIBERATELY NARROWER THAN "APPROVED MEMBER"
 * ===========================================================================
 * The organization's NAME and DESCRIPTION live on directory_companies, which
 * migration 032 was forbidden to touch. That table's only UPDATE policy is
 * migrations/017 "admins update companies", which requires a directory_members
 * row with role='admin' AND status='approved' in the SAME TENANT. A plain
 * approved member cannot write it, and 017's global-admin branch reads the
 * top-level JWT `role` claim, which is the Postgres role and is never 'admin'
 * (032 §0 documents this) — so that branch has never matched anybody.
 *
 * `canEditCompanyCore` therefore checks for tenant-admin and nothing else. It
 * is not the same right as `canEditCompanyProfile`, and collapsing the two
 * would put a Save button in front of a member the database will refuse.
 *
 * The durable fix belongs in the human-gated 028, which already plans to
 * supersede 017: a policy letting an APPROVED member update the safe columns of
 * their own company (name, description, website, email, phone, logo_url, city,
 * state, country, employee_count, year_founded — never the membership or stripe
 * columns). When that lands, `canEditCompanyCore` collapses into
 * `canEditCompanyProfile` and the description card stops being conditional.
 *
 * ===========================================================================
 * WHAT AN UNAUTHENTICATED WRITE ACTUALLY DOES — MEASURED 2026-07-28
 * ===========================================================================
 * Against the live project, with the anon key:
 *
 *   INSERT into any of the nine write targets
 *     -> HTTP 401, code 42501,
 *        "new row violates row-level security policy for table ..."
 *
 *   UPDATE / DELETE on directory_people (and directory_companies)
 *     -> HTTP 200 with an EMPTY ARRAY. No error. No exception. Nothing changed
 *        on disk — verified by reading the column back with the service role,
 *        it still held its original value.
 *
 * The second one is the whole reason this file counts rows. supabase-js reports
 * it as `{ data: [], error: null }`, and a save path that checks only `error`
 * would have shown a green confirmation for a write the database threw away.
 * That is not a hypothetical: it is what the anon path does today.
 */

import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

/* ========================================================================== *
 * ERRORS
 *
 * Every exported function resolves `{ data, error }`. `error` is either null or
 * a plain object with a `code`, a `message` a person can read, and — when the
 * database blamed a specific column — a `field` the form can attach it to.
 * Nothing here throws, and nothing here returns success it did not observe.
 * ========================================================================== */

const NOT_CONFIGURED = {
  code: 'NOT_CONFIGURED',
  message: 'This build has no database connection, so nothing can be saved.',
}

const NOT_SIGNED_IN = {
  code: 'NOT_SIGNED_IN',
  message: 'You are signed out. Sign in again and your changes can be saved.',
}

/** Postgres/PostgREST codes worth naming in the user's own words. */
function normalizeError(raw, what, fieldHint) {
  if (!raw) return null
  const code = raw.code || raw.status || 'UNKNOWN'
  const detail = raw.message || raw.details || String(raw)

  // insufficient_privilege — the grant or the policy said no.
  if (code === '42501' || /row-level security/i.test(detail)) {
    return {
      code: 'DENIED',
      message: `Your account is not allowed to change ${what}.`,
      field: fieldHint || null,
      detail,
    }
  }
  // unique_violation — a duplicate the form should have caught, or a slug clash.
  if (code === '23505') {
    return {
      code: 'DUPLICATE',
      message: /slug/i.test(detail)
        ? 'That public address is already taken. Choose another.'
        : `That ${what} is already listed. Remove the duplicate and save again.`,
      field: fieldHint || (/slug/i.test(detail) ? 'slug' : null),
      detail,
    }
  }
  // check_violation
  if (code === '23514') {
    return {
      code: 'INVALID',
      message: `One of the values in ${what} is outside the range the record allows.`,
      field: fieldHint || null,
      detail,
    }
  }
  // RAISE EXCEPTION from directory_people_slug_guard()
  if (code === 'P0001') {
    return { code: 'INVALID', message: detail, field: fieldHint || 'slug', detail }
  }
  // No JWT / expired JWT.
  if (code === 'PGRST301' || code === '401' || code === 401) return NOT_SIGNED_IN
  // Missing table or column — a migration has not landed on this project.
  if (code === 'PGRST204' || code === 'PGRST205' || code === '42P01') {
    return {
      code: 'SCHEMA',
      message: `The record this screen saves to is not present in this database yet (${what}).`,
      field: null,
      detail,
    }
  }
  return { code: String(code), message: detail, field: fieldHint || null, detail }
}

/** The write ran, the database was happy, and it changed NOTHING. */
function noRowsWritten(what) {
  return {
    code: 'NO_ROWS_WRITTEN',
    message:
      `Nothing was saved for ${what}. The record either no longer exists or your ` +
      'account is not allowed to change it. Reload the page and try again.',
    field: null,
  }
}

const ok = (data) => ({ data, error: null })
const fail = (error) => ({ data: null, error })

/* ========================================================================== *
 * VIEWER CONTEXT — who is looking, and what may they touch
 * ========================================================================== */

const NO_IDS = []

/**
 * Resolve the signed-in user and the two membership facts every permission
 * question below is answered from.
 *
 * Returns `{ data: viewer, error }`. A signed-out viewer is NOT an error — it
 * is a viewer with `signedIn: false` and empty lists, which is what a stranger
 * looking at a public profile is.
 */
export async function getViewerContext() {
  if (!supabase) return ok({ signedIn: false, userId: null, isGlobalAdmin: false, approvedCompanyIds: NO_IDS, adminTenantIds: NO_IDS, personId: null, personSlug: null })

  let session = null
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) return fail(normalizeError(error, 'your session'))
    session = data?.session || null
  } catch (err) {
    return fail(normalizeError(err, 'your session'))
  }

  const user = session?.user || null
  if (!user) {
    return ok({
      signedIn: false,
      userId: null,
      isGlobalAdmin: false,
      approvedCompanyIds: NO_IDS,
      adminTenantIds: NO_IDS,
      personId: null,
      personSlug: null,
    })
  }

  // app_metadata is writable only with the service role, so it is trustworthy
  // at the source. It is still being read in a browser — see the file header.
  const isGlobalAdmin = user.app_metadata?.role === 'admin'

  const [membersRes, personRes] = await Promise.all([
    supabase
      .from('directory_members')
      .select('company_id,tenant_id,role,status')
      .eq('auth_user_id', user.id)
      .eq('status', 'approved'),
    supabase
      .from('directory_people')
      .select('id,slug')
      .eq('auth_user_id', user.id)
      .limit(1),
  ])

  if (membersRes.error) return fail(normalizeError(membersRes.error, 'your memberships'))

  const rows = Array.isArray(membersRes.data) ? membersRes.data : []
  const approvedCompanyIds = [...new Set(rows.map((r) => r.company_id).filter(Boolean))]
  const adminTenantIds = [
    ...new Set(rows.filter((r) => r.role === 'admin').map((r) => r.tenant_id).filter(Boolean)),
  ]

  // A missing person row is normal (not every member has been given one yet)
  // and must not fail the whole context.
  const person = !personRes.error && Array.isArray(personRes.data) ? personRes.data[0] : null

  return ok({
    signedIn: true,
    userId: user.id,
    isGlobalAdmin,
    approvedCompanyIds,
    adminTenantIds,
    personId: person?.id || null,
    personSlug: person?.slug || null,
  })
}

/* -------------------------------------------------------------------------- *
 * The predicates. Pure, synchronous, and each one mirrors a named SQL function
 * in migrations/032. The SQL is the authority; these only decide what to draw.
 * -------------------------------------------------------------------------- */

/** Mirrors directory_is_approved_company_member(uuid). */
export function isApprovedCompanyMember(viewer, companyId) {
  if (!viewer || !viewer.signedIn || !companyId) return false
  return viewer.approvedCompanyIds.includes(companyId)
}

/**
 * Mirrors directory_can_edit_person(uuid).
 *
 * `person` needs `auth_user_id` and `company_id` — both of which the read RPC
 * does NOT return, which is why the edit screens load the row directly.
 */
export function canEditPerson(viewer, person) {
  if (!viewer || !viewer.signedIn || !person) return false
  if (viewer.isGlobalAdmin) return true
  if (person.auth_user_id) return person.auth_user_id === viewer.userId
  return isApprovedCompanyMember(viewer, person.company_id)
}

/** The company PROFILE right: the side table and the three child tables. */
export function canEditCompanyProfile(viewer, company) {
  if (!viewer || !viewer.signedIn || !company) return false
  if (viewer.isGlobalAdmin) return true
  return isApprovedCompanyMember(viewer, company.id)
}

/**
 * The company CORE right: directory_companies itself (name, description).
 * Narrower on purpose — see the file header. Tenant admin, and nothing else.
 */
export function canEditCompanyCore(viewer, company) {
  if (!viewer || !viewer.signedIn || !company || !company.tenant_id) return false
  return viewer.adminTenantIds.includes(company.tenant_id)
}

/** Where the Edit / + Add affordances point. One place, so they never drift. */
export function editHref(kind, slug, section) {
  const key = kind === 'company' ? 'company' : 'person'
  const base = `/profile/edit?${key}=${encodeURIComponent(slug || '')}`
  return section ? `${base}&section=${encodeURIComponent(section)}` : base
}

/**
 * Answer "should this viewer see an Edit control on this profile?" in one call.
 *
 * This is what ProfilePerson.jsx / ProfileCompany.jsx need — they render the
 * design's "Edit" and "+ Add" actions unconditionally today, which means a
 * stranger is shown a control that does nothing for them.
 */
export async function resolveEditPermission(kind, slug) {
  if (!slug || slug === '_preview') return ok({ canEdit: false, canEditCore: false, href: null })
  if (!supabase) return ok({ canEdit: false, canEditCore: false, href: null })

  const { data: viewer, error: viewerError } = await getViewerContext()
  if (viewerError) return fail(viewerError)
  if (!viewer.signedIn) return ok({ canEdit: false, canEditCore: false, href: null })

  if (kind === 'company') {
    const { data, error } = await supabase
      .from('directory_companies')
      .select('id,tenant_id')
      .eq('slug', slug)
      .limit(1)
    if (error) return fail(normalizeError(error, 'this organization'))
    const company = Array.isArray(data) ? data[0] : null
    if (!company) return ok({ canEdit: false, canEditCore: false, href: null })
    const canEdit = canEditCompanyProfile(viewer, company)
    return ok({
      canEdit,
      canEditCore: canEditCompanyCore(viewer, company),
      href: canEdit ? editHref('company', slug) : null,
    })
  }

  const { data, error } = await supabase
    .from('directory_people')
    .select('id,auth_user_id,company_id')
    .eq('slug', slug)
    .limit(1)
  if (error) return fail(normalizeError(error, 'this profile'))
  const person = Array.isArray(data) ? data[0] : null
  if (!person) return ok({ canEdit: false, canEditCore: false, href: null })
  const canEdit = canEditPerson(viewer, person)
  return ok({ canEdit, canEditCore: canEdit, href: canEdit ? editHref('person', slug) : null })
}

/**
 * The same answer as a hook, for the two view screens.
 *
 * It lives in this file rather than in a hooks module because the write seam is
 * the one place that knows what "may edit" means, and a second copy of that
 * rule somewhere else is how the two get to disagree.
 *
 *   const { canEdit, href } = useEditPermission('person', slug)
 *   ...
 *   action={canEdit ? <CardAction href={href}>Edit</CardAction> : null}
 */
export function useEditPermission(kind, slug) {
  const [state, setState] = useState({ loading: true, canEdit: false, canEditCore: false, href: null })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, canEdit: false, canEditCore: false, href: null })
    resolveEditPermission(kind, slug).then(({ data, error }) => {
      if (cancelled) return
      // A failure to RESOLVE permission is not permission. Fail closed.
      if (error || !data) {
        setState({ loading: false, canEdit: false, canEditCore: false, href: null })
        return
      }
      setState({ loading: false, ...data })
    })
    return () => { cancelled = true }
  }, [kind, slug])

  return state
}

/* ========================================================================== *
 * VALIDATION — runs before anything is sent, so the common mistakes never
 * become a database round trip and never become a toast.
 * ========================================================================== */

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/           // matches the 032 trigger exactly
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STATE_RE = /^[A-Za-z]{2}$/

const str = (v) => (v === null || v === undefined ? '' : String(v).trim())

function urlProblem(value, label) {
  const v = str(value)
  if (!v) return null
  if (!/^https?:\/\//i.test(v)) return `${label} needs to start with http:// or https://`
  return null
}

/** `{ ok, fieldErrors }` — keys are form field names, values are one sentence. */
export function validatePersonForm(form) {
  const e = {}
  if (!str(form.full_name)) e.full_name = 'A name is required — it is the one thing every profile shows.'
  const slug = str(form.slug)
  if (!slug) e.slug = 'A public address is required.'
  else if (!SLUG_RE.test(slug)) e.slug = 'Use lowercase letters, numbers and single hyphens only (like jane-doe).'
  if (str(form.email) && !EMAIL_RE.test(str(form.email))) e.email = 'That does not look like an email address.'
  if (str(form.state_code) && !STATE_RE.test(str(form.state_code))) e.state_code = 'Use the two-letter state code, like AZ.'
  const linkedin = urlProblem(form.linkedin_url, 'The LinkedIn link')
  if (linkedin) e.linkedin_url = linkedin
  const website = urlProblem(form.website, 'The website')
  if (website) e.website = website
  const avatar = urlProblem(form.avatar_url, 'The photo link')
  if (avatar) e.avatar_url = avatar
  return { ok: Object.keys(e).length === 0, fieldErrors: e }
}

export function validateCompanyProfileForm(form) {
  const e = {}
  const linkedin = urlProblem(form.linkedin_url, 'The LinkedIn link')
  if (linkedin) e.linkedin_url = linkedin
  for (const key of COUNT_COLUMNS) {
    const raw = form[key]
    if (raw === '' || raw === null || raw === undefined) continue
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 0) e[key] = 'Use a whole number, zero or more.'
  }
  return { ok: Object.keys(e).length === 0, fieldErrors: e }
}

/**
 * Duplicate names break UNIQUE(person_id, name) / UNIQUE(company_id, name).
 *
 * Keys in the returned map are indexes into the array that was PASSED IN, so
 * callers must hand it the same array the screen is rendering — a filtered copy
 * would point the error at the wrong row. `keepIndex()` below is how the write
 * functions keep that true while still dropping blank rows.
 */
export function findDuplicateNames(rows, key = 'name') {
  const seen = new Map()
  const dupes = {}
  rows.forEach((row, i) => {
    const v = str(row[key]).toLowerCase()
    if (!v) return
    if (seen.has(v)) dupes[i] = 'This is already listed above.'
    else seen.set(v, i)
  })
  return dupes
}

/** Tag each row with the index the SCREEN knows it by, then drop the blanks.
 *  Every rowErrors key downstream is that original index. */
function keepIndex(rows, isFilled) {
  return (rows || [])
    .map((row, i) => ({ ...row, _i: i }))
    .filter((row) => isFilled(row))
}

export const COUNT_COLUMNS = [
  'suppliers_count',
  'partners_count',
  'customers_count',
  'universities_count',
  'gov_programs_count',
  'investors_count',
]

/* ========================================================================== *
 * LOADS FOR EDITING
 *
 * Straight at the tables, ids kept, nothing capped. A DRAFT person row is
 * invisible to the public SELECT policy but visible to its own editor, because
 * the "people owner or admin write" policy is FOR ALL and permissive policies
 * are OR'd — so the owner of an unpublished profile can still open it here.
 * ========================================================================== */

const PERSON_COLUMNS =
  'id,tenant_id,auth_user_id,member_id,company_id,slug,full_name,avatar_url,job_title,org_name,' +
  'city,state,state_code,country,email,linkedin_url,website,bio_short,bio_long,focus_areas,' +
  'availability_status,availability_note,accepts_connections,verification,status,published_at'

export async function loadPersonForEdit(slug) {
  if (!supabase) return fail(NOT_CONFIGURED)
  if (!str(slug)) return fail({ code: 'NOT_FOUND', message: 'No profile address was given.' })

  const { data, error } = await supabase
    .from('directory_people')
    .select(PERSON_COLUMNS)
    .eq('slug', slug)
    .limit(1)
  if (error) return fail(normalizeError(error, 'this profile'))

  const person = Array.isArray(data) ? data[0] : null
  if (!person) {
    return fail({
      code: 'NOT_FOUND',
      message: 'There is no profile at this address, or it is not one you can open.',
    })
  }

  const [caps, needs, affiliations, experience, scores] = await Promise.all([
    supabase.from('directory_person_capabilities')
      .select('id,name,sort_order').eq('person_id', person.id)
      .order('sort_order').order('name'),
    supabase.from('directory_person_needs')
      .select('id,kind,label,detail,sort_order').eq('person_id', person.id)
      .order('sort_order').order('label'),
    supabase.from('directory_person_affiliations')
      .select('id,company_id,org_name,org_logo_url,role,is_current,sort_order')
      .eq('person_id', person.id).order('sort_order').order('org_name'),
    supabase.from('directory_person_experience')
      .select('id,company_id,org_name,title,description,location,start_date,end_date,is_current,sort_order')
      .eq('person_id', person.id).order('sort_order'),
    supabase.from('directory_mission_scores')
      .select('id,tag_id,score,note').eq('entity_type', 'person').eq('entity_id', person.id),
  ])

  const firstError = [caps, needs, affiliations, experience, scores].find((r) => r.error)
  if (firstError) return fail(normalizeError(firstError.error, 'this profile'))

  return ok({
    person,
    capabilities: caps.data || [],
    needs: needs.data || [],
    affiliations: affiliations.data || [],
    experience: experience.data || [],
    missionScores: scores.data || [],
  })
}

const COMPANY_COLUMNS = 'id,tenant_id,name,slug,description,logo_url,website,phone,email,vertical,city,state,country,employee_count,year_founded,status'

export async function loadCompanyForEdit(slug) {
  if (!supabase) return fail(NOT_CONFIGURED)
  if (!str(slug)) return fail({ code: 'NOT_FOUND', message: 'No organization address was given.' })

  const { data, error } = await supabase
    .from('directory_companies')
    .select(COMPANY_COLUMNS)
    .eq('slug', slug)
    .limit(1)
  if (error) return fail(normalizeError(error, 'this organization'))

  const company = Array.isArray(data) ? data[0] : null
  if (!company) {
    return fail({
      code: 'NOT_FOUND',
      message: 'There is no organization at this address, or it is not one you can open.',
    })
  }

  const [profile, caps, needs, locations, scores] = await Promise.all([
    supabase.from('directory_company_profile').select('*').eq('company_id', company.id).limit(1),
    supabase.from('directory_company_capabilities')
      .select('id,name,subtitle,icon,sort_order').eq('company_id', company.id)
      .order('sort_order').order('name'),
    supabase.from('directory_company_needs')
      .select('id,kind,label,detail,sort_order').eq('company_id', company.id)
      .order('sort_order').order('label'),
    supabase.from('directory_company_locations')
      .select('id,label,place,city,state_code,country_code,is_headquarters,sort_order')
      .eq('company_id', company.id).order('sort_order'),
    supabase.from('directory_mission_scores')
      .select('id,tag_id,score,note').eq('entity_type', 'company').eq('entity_id', company.id),
  ])

  const firstError = [profile, caps, needs, locations, scores].find((r) => r.error)
  if (firstError) return fail(normalizeError(firstError.error, 'this organization'))

  return ok({
    company,
    // No enrichment row yet is the normal case for 165 of the 166 organizations.
    profile: (Array.isArray(profile.data) ? profile.data[0] : null) || null,
    capabilities: caps.data || [],
    needs: needs.data || [],
    locations: locations.data || [],
    missionScores: scores.data || [],
  })
}

/** The six space missions, for the alignment editor. */
export async function loadMissionTags() {
  if (!supabase) return fail(NOT_CONFIGURED)
  const { data, error } = await supabase
    .from('directory_tags')
    .select('id,name')
    .eq('category', 'market_goal')
    .order('name')
  if (error) return fail(normalizeError(error, 'the space missions'))
  return ok(data || [])
}

/* ========================================================================== *
 * WRITES
 * ========================================================================== */

/** Guard every write behind a live session, so "denied" is never mistaken for
 *  "signed out" in the message the person reads. */
async function requireSession() {
  if (!supabase) return NOT_CONFIGURED
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) return normalizeError(error, 'your session')
    if (!data?.session?.user) return NOT_SIGNED_IN
    return null
  } catch (err) {
    return normalizeError(err, 'your session')
  }
}

/** null for an empty string, so an emptied field clears the column rather than
 *  storing '' — the read RPC's NULLIF/COALESCE logic keys off NULL. */
const nullable = (v) => {
  const s = str(v)
  return s === '' ? null : s
}

const boolOf = (v) => v === true || v === 'true' || v === 'on'

const intOrZero = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0
}

/* -------------------------------------------------------------------------- *
 * The person record itself.
 * -------------------------------------------------------------------------- */

export async function savePersonProfile(personId, form) {
  const sessionError = await requireSession()
  if (sessionError) return fail(sessionError)
  if (!personId) return fail({ code: 'NOT_FOUND', message: 'There is no profile record to save to.' })

  const { ok: valid, fieldErrors } = validatePersonForm(form)
  if (!valid) {
    return fail({
      code: 'VALIDATION',
      message: 'Some fields need fixing before this can be saved.',
      fieldErrors,
    })
  }

  const patch = {
    full_name: str(form.full_name),
    slug: str(form.slug),
    avatar_url: nullable(form.avatar_url),
    job_title: nullable(form.job_title),
    org_name: nullable(form.org_name),
    city: nullable(form.city),
    state: nullable(form.state),
    state_code: form.state_code ? str(form.state_code).toUpperCase() : null,
    country: nullable(form.country),
    email: nullable(form.email),
    linkedin_url: nullable(form.linkedin_url),
    website: nullable(form.website),
    bio_short: nullable(form.bio_short),
    bio_long: nullable(form.bio_long),
    focus_areas: Array.isArray(form.focus_areas)
      ? form.focus_areas.map(str).filter(Boolean)
      : [],
    availability_status: nullable(form.availability_status),
    availability_note: nullable(form.availability_note),
    accepts_connections: boolOf(form.accepts_connections),
  }

  // Publishing is what makes the profile visible at all, so it is set here and
  // stamped once. `verification` is NOT in this patch: a member cannot mark
  // themselves verified.
  if (form.status === 'active' || form.status === 'draft' || form.status === 'inactive') {
    patch.status = form.status
    if (form.status === 'active' && !form.published_at) patch.published_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('directory_people')
    .update(patch)
    .eq('id', personId)
    .select('id,slug,status,updated_at')

  if (error) return fail(normalizeError(error, 'your profile details', 'slug'))
  if (!Array.isArray(data) || data.length === 0) return fail(noRowsWritten('your profile details'))
  return ok(data[0])
}

/* -------------------------------------------------------------------------- *
 * THE LIST SYNC — one function, six callers.
 *
 * The editors hand back the whole list. Rows that arrived with an id are
 * updated, rows without one are inserted, and ids that were loaded but are no
 * longer in the list are deleted. Every step verifies its own row count, so a
 * delete that RLS quietly refused is reported instead of leaving a row the
 * screen has already stopped showing.
 * -------------------------------------------------------------------------- */

async function syncList({ table, parentColumn, parentId, existingIds, rows, toColumns, what }) {
  const kept = rows.filter((r) => r && r.id).map((r) => r.id)
  const removed = (existingIds || []).filter((id) => !kept.includes(id))
  const result = { inserted: 0, updated: 0, deleted: 0 }

  if (removed.length) {
    const { data, error } = await supabase.from(table).delete().in('id', removed).select('id')
    if (error) return fail(normalizeError(error, what))
    if (!Array.isArray(data) || data.length !== removed.length) {
      return fail({
        code: 'NO_ROWS_WRITTEN',
        message:
          `${removed.length === 1 ? 'An item' : 'Some items'} could not be removed from ${what}. ` +
          'Reload the page and try again.',
        field: null,
      })
    }
    result.deleted = data.length
  }

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row || !row.id) continue
    const columns = toColumns(row, i)
    const at = row._i === undefined ? i : row._i
    const { data, error } = await supabase
      .from(table).update(columns).eq('id', row.id).select('id')
    if (error) return fail({ ...normalizeError(error, what), rowIndex: at })
    if (!Array.isArray(data) || data.length === 0) {
      return fail({ ...noRowsWritten(what), rowIndex: at })
    }
    result.updated += 1
  }

  const fresh = rows
    .map((row, i) => (row && !row.id ? { ...toColumns(row, i), [parentColumn]: parentId } : null))
    .filter(Boolean)

  if (fresh.length) {
    const { data, error } = await supabase.from(table).insert(fresh).select('id')
    if (error) return fail(normalizeError(error, what))
    if (!Array.isArray(data) || data.length !== fresh.length) {
      return fail(noRowsWritten(what))
    }
    result.inserted = data.length
  }

  return ok(result)
}

/* -------------------------------------------------------------------------- *
 * Person child lists.
 * -------------------------------------------------------------------------- */

export async function savePersonCapabilities(personId, rows, existingIds) {
  const sessionError = await requireSession()
  if (sessionError) return fail(sessionError)

  const dupes = findDuplicateNames(rows, 'name')
  if (Object.keys(dupes).length) {
    return fail({ code: 'VALIDATION', message: 'Remove the duplicate capability before saving.', rowErrors: dupes })
  }
  const clean = keepIndex(rows, (r) => str(r.name))

  return syncList({
    table: 'directory_person_capabilities',
    parentColumn: 'person_id',
    parentId: personId,
    existingIds,
    rows: clean,
    toColumns: (row, i) => ({ name: str(row.name), sort_order: i }),
    what: 'your capabilities',
  })
}

/**
 * Both columns of "WHAT I'M LOOKING FOR" in one call, because they are one
 * table and one card — saving half of it is not a thing the screen offers.
 */
export async function savePersonNeeds(personId, seeking, providing, existingIds) {
  const sessionError = await requireSession()
  if (sessionError) return fail(sessionError)

  const rows = [
    ...seeking.filter((r) => str(r.label)).map((r) => ({ ...r, kind: 'seeking' })),
    ...providing.filter((r) => str(r.label)).map((r) => ({ ...r, kind: 'providing' })),
  ]

  return syncList({
    table: 'directory_person_needs',
    parentColumn: 'person_id',
    parentId: personId,
    existingIds,
    rows,
    toColumns: (row, i) => ({
      kind: row.kind,
      label: str(row.label),
      detail: nullable(row.detail),
      sort_order: i,
    }),
    what: 'what you are looking for',
  })
}

export async function savePersonAffiliations(personId, rows, existingIds) {
  const sessionError = await requireSession()
  if (sessionError) return fail(sessionError)

  return syncList({
    table: 'directory_person_affiliations',
    parentColumn: 'person_id',
    parentId: personId,
    existingIds,
    rows: keepIndex(rows, (r) => str(r.org_name)),
    toColumns: (row, i) => ({
      org_name: str(row.org_name),
      role: nullable(row.role),
      org_logo_url: nullable(row.org_logo_url),
      is_current: boolOf(row.is_current),
      sort_order: i,
    }),
    what: 'your affiliations',
  })
}

export async function savePersonExperience(personId, rows, existingIds) {
  const sessionError = await requireSession()
  if (sessionError) return fail(sessionError)

  // The table CHECKs end_date >= start_date. Catching it here names the row.
  const rowErrors = {}
  rows.forEach((row, i) => {
    if (row.start_date && row.end_date && row.end_date < row.start_date) {
      rowErrors[i] = 'The end date is before the start date.'
    }
  })
  if (Object.keys(rowErrors).length) {
    return fail({ code: 'VALIDATION', message: 'Check the dates below.', rowErrors })
  }

  return syncList({
    table: 'directory_person_experience',
    parentColumn: 'person_id',
    parentId: personId,
    existingIds,
    rows: keepIndex(rows, (r) => str(r.org_name)),
    toColumns: (row, i) => ({
      org_name: str(row.org_name),
      title: nullable(row.title),
      description: nullable(row.description),
      location: nullable(row.location),
      start_date: nullable(row.start_date),
      end_date: nullable(row.end_date),
      is_current: boolOf(row.is_current),
      sort_order: i,
    }),
    what: 'your experience',
  })
}

/* -------------------------------------------------------------------------- *
 * Mission alignment. One table, both entity types, keyed
 * UNIQUE (entity_type, entity_id, tag_id) — so a cleared score is a DELETE and
 * a set score is an upsert on that key.
 * -------------------------------------------------------------------------- */

export async function saveMissionScores(entityType, entityId, scoresByTagId, existingRows) {
  const sessionError = await requireSession()
  if (sessionError) return fail(sessionError)
  if (entityType !== 'person' && entityType !== 'company') {
    return fail({ code: 'INVALID', message: 'Unknown record type.' })
  }

  const existing = existingRows || []
  const upserts = []
  const removeIds = []

  for (const row of existing) {
    const raw = scoresByTagId[row.tag_id]
    if (raw === '' || raw === null || raw === undefined) removeIds.push(row.id)
  }

  for (const [tagId, raw] of Object.entries(scoresByTagId)) {
    if (raw === '' || raw === null || raw === undefined) continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return fail({
        code: 'VALIDATION',
        message: 'Mission alignment is a number from 0 to 100.',
        fieldErrors: { [tagId]: 'Use a number from 0 to 100.' },
      })
    }
    upserts.push({ entity_type: entityType, entity_id: entityId, tag_id: tagId, score: Math.round(n) })
  }

  const result = { removed: 0, saved: 0 }

  if (removeIds.length) {
    const { data, error } = await supabase
      .from('directory_mission_scores').delete().in('id', removeIds).select('id')
    if (error) return fail(normalizeError(error, 'mission alignment'))
    if (!Array.isArray(data) || data.length !== removeIds.length) {
      return fail(noRowsWritten('mission alignment'))
    }
    result.removed = data.length
  }

  if (upserts.length) {
    const { data, error } = await supabase
      .from('directory_mission_scores')
      .upsert(upserts, { onConflict: 'entity_type,entity_id,tag_id' })
      .select('id')
    if (error) return fail(normalizeError(error, 'mission alignment'))
    if (!Array.isArray(data) || data.length !== upserts.length) {
      return fail(noRowsWritten('mission alignment'))
    }
    result.saved = data.length
  }

  return ok(result)
}

/* -------------------------------------------------------------------------- *
 * The company enrichment row. UPSERT, because 165 of the 166 organizations do
 * not have one yet and the first save is what creates it.
 *
 * Each card sends only its OWN columns. That is safe with upsert: the conflict
 * branch is `DO UPDATE SET` over the supplied columns only, so the counts card
 * cannot blank the at-a-glance card.
 * -------------------------------------------------------------------------- */

export async function saveCompanyProfile(companyId, patch) {
  const sessionError = await requireSession()
  if (sessionError) return fail(sessionError)
  if (!companyId) return fail({ code: 'NOT_FOUND', message: 'There is no organization record to save to.' })

  const { data, error } = await supabase
    .from('directory_company_profile')
    .upsert({ company_id: companyId, ...patch }, { onConflict: 'company_id' })
    .select('company_id,updated_at')

  if (error) return fail(normalizeError(error, "this organization's profile"))
  if (!Array.isArray(data) || data.length === 0) return fail(noRowsWritten("this organization's profile"))
  return ok(data[0])
}

/** AT A GLANCE + the links row. */
export async function saveCompanyGlance(companyId, form) {
  const { ok: valid, fieldErrors } = validateCompanyProfileForm(form)
  if (!valid) {
    return fail({ code: 'VALIDATION', message: 'Some fields need fixing before this can be saved.', fieldErrors })
  }
  return saveCompanyProfile(companyId, {
    linkedin_url: nullable(form.linkedin_url),
    org_type: nullable(form.org_type),
    naics_code: nullable(form.naics_code),
    headquarters_label: nullable(form.headquarters_label),
    categories: Array.isArray(form.categories) ? form.categories.map(str).filter(Boolean) : [],
    focus_areas: Array.isArray(form.focus_areas) ? form.focus_areas.map(str).filter(Boolean) : [],
  })
}

/** WHO WE WORK WITH — the six counts, stored because no relationship graph exists. */
export async function saveCompanyCounts(companyId, form) {
  const { ok: valid, fieldErrors } = validateCompanyProfileForm(form)
  if (!valid) {
    return fail({ code: 'VALIDATION', message: 'Those need to be whole numbers.', fieldErrors })
  }
  const patch = {}
  for (const key of COUNT_COLUMNS) patch[key] = intOrZero(form[key])
  return saveCompanyProfile(companyId, patch)
}

/**
 * The organization's own description, on directory_companies.
 *
 * TENANT ADMIN ONLY at the database level (migrations/017). The screen hides
 * this control from everyone else rather than letting them press a button that
 * returns 42501 — but the check here is the client's, and Postgres has the vote.
 */
export async function saveCompanyDescription(companyId, description) {
  const sessionError = await requireSession()
  if (sessionError) return fail(sessionError)
  if (!companyId) return fail({ code: 'NOT_FOUND', message: 'There is no organization record to save to.' })

  const { data, error } = await supabase
    .from('directory_companies')
    .update({ description: nullable(description) })
    .eq('id', companyId)
    .select('id')

  if (error) return fail(normalizeError(error, "this organization's description", 'description'))
  if (!Array.isArray(data) || data.length === 0) {
    return fail({
      code: 'DENIED',
      message:
        'The description was not saved. Only an organization admin can change it — ' +
        'ask one of your admins, or contact Space Rising.',
      field: 'description',
    })
  }
  return ok(data[0])
}

/* -------------------------------------------------------------------------- *
 * Company child lists.
 * -------------------------------------------------------------------------- */

export async function saveCompanyCapabilities(companyId, rows, existingIds) {
  const sessionError = await requireSession()
  if (sessionError) return fail(sessionError)

  const dupes = findDuplicateNames(rows, 'name')
  if (Object.keys(dupes).length) {
    return fail({ code: 'VALIDATION', message: 'Remove the duplicate capability before saving.', rowErrors: dupes })
  }
  const clean = keepIndex(rows, (r) => str(r.name))

  return syncList({
    table: 'directory_company_capabilities',
    parentColumn: 'company_id',
    parentId: companyId,
    existingIds,
    rows: clean,
    toColumns: (row, i) => ({
      name: str(row.name),
      subtitle: nullable(row.subtitle),
      icon: nullable(row.icon),
      sort_order: i,
    }),
    what: "this organization's capabilities",
  })
}

export async function saveCompanyNeeds(companyId, seeking, providing, existingIds) {
  const sessionError = await requireSession()
  if (sessionError) return fail(sessionError)

  const rows = [
    ...seeking.filter((r) => str(r.label)).map((r) => ({ ...r, kind: 'seeking' })),
    ...providing.filter((r) => str(r.label)).map((r) => ({ ...r, kind: 'providing' })),
  ]

  return syncList({
    table: 'directory_company_needs',
    parentColumn: 'company_id',
    parentId: companyId,
    existingIds,
    rows,
    toColumns: (row, i) => ({
      kind: row.kind,
      label: str(row.label),
      detail: nullable(row.detail),
      sort_order: i,
    }),
    what: 'what this organization is looking for',
  })
}

export async function saveCompanyLocations(companyId, rows, existingIds) {
  const sessionError = await requireSession()
  if (sessionError) return fail(sessionError)

  const rowErrors = {}
  rows.forEach((row, i) => {
    if (str(row.state_code) && !STATE_RE.test(str(row.state_code))) {
      rowErrors[i] = 'Use the two-letter state code, like CA. Leave it blank outside the US.'
    }
  })
  if (Object.keys(rowErrors).length) {
    return fail({ code: 'VALIDATION', message: 'Check the state codes below.', rowErrors })
  }

  return syncList({
    table: 'directory_company_locations',
    parentColumn: 'company_id',
    parentId: companyId,
    existingIds,
    rows: keepIndex(rows, (r) => str(r.label)),
    toColumns: (row, i) => ({
      label: str(row.label),
      place: nullable(row.place),
      city: nullable(row.city),
      state_code: row.state_code ? str(row.state_code).toUpperCase() : null,
      country_code: row.country_code ? str(row.country_code).toUpperCase() : null,
      is_headquarters: boolOf(row.is_headquarters),
      sort_order: i,
    }),
    what: "this organization's locations",
  })
}
