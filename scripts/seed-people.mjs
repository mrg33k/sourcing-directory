#!/usr/bin/env node
/**
 * seed-people.mjs — give every real member a person profile, and move the five
 * public figures out of directory_listings into the table built for them.
 *
 * ===========================================================================
 * WHAT THIS WRITES, AND WHAT IT REFUSES TO
 * ===========================================================================
 * WRITES (new tables only, created by migrations/032):
 *   directory_people            — one row per distinct human
 *   directory_company_profile   — only with --company-profiles, see §COMPANY
 *
 * NEVER TOUCHES: directory_members, directory_companies, directory_listings,
 * directory_tenants, directory_tags. They are read-only here. The five listings
 * rows this script migrates FROM are left exactly as they are — they become
 * duplicates for a human to retire, not rows for a script to delete.
 *
 * INVENTS NOTHING. Every value written is copied from a column that already
 * holds it. There are no generated bios, no guessed job titles, no avatar URLs,
 * no mission scores, no capabilities. A profile that is 90% empty is the honest
 * state of a profile nobody has filled in yet, and the completeness treatment on
 * the screen is designed for exactly that. A plausible-sounding fake published
 * under a real person's name is not a smaller problem than a blank field.
 *
 * The one derivation, and why it is a copy rather than an invention:
 *   org_name  <- directory_companies.name, via the member's own company_id.
 * The person screen prints `organization` from directory_people.org_name and the
 * read RPC does not join the company table. Without this the profile of someone
 * who demonstrably works at a known company renders with no organization at all.
 * It is the same fact, moved. Nothing is asserted that the database did not
 * already assert.
 *
 * ===========================================================================
 * §MERGE — 70 members, 68 people
 * ===========================================================================
 * Two pairs of directory_members rows share an auth_user_id AND an email: one
 * human with two memberships (different tenants, and in one case different
 * companies). Writing a row per member row would publish two profiles under one
 * person's real name, with slugs differing only by a "-2". That is a visible
 * defect, not a seeded profile.
 *
 * So the unit is the HUMAN (auth_user_id), not the membership row. Each merged
 * person carries the EARLIEST member row's member_id / company_id / tenant_id
 * (earliest by created_at, then id — stable across reruns). The other membership
 * is untouched in directory_members and still reachable there; directory_people
 * has one company_id column and cannot represent two without inventing a shape.
 * Every one of the 70 members still resolves to a profile via auth_user_id.
 *
 * Members whose names collide but who are genuinely different people (different
 * email, different auth_user_id — three such pairs) each get their own profile
 * and a deterministic slug suffix. See §SLUGS.
 *
 * ===========================================================================
 * §SLUGS
 * ===========================================================================
 * kebab-case of the full name, ASCII-folded. The migration's slug guard trigger
 * enforces ^[a-z0-9]+(-[a-z0-9]+)*$ and rejects any slug already used by a
 * company, so both are checked here rather than discovered as a 500.
 *
 * Collisions resolve by appending -2, -3, ... The order is fixed by sorting
 * candidates on (created_at, id), so the same input always produces the same
 * assignment. Reruns never reshuffle anyway: an existing person keeps the slug
 * it already has, because a slug that changes is a URL that breaks.
 *
 * A name that folds to nothing falls back to person-<first 8 of the member id>.
 * Deliberately NOT the email local-part: that would publish part of a real
 * person's address in a public URL.
 *
 * ===========================================================================
 * §STATUS — these profiles are published
 * ===========================================================================
 * Rows are written status='active' (override with --status=draft).
 *
 * That is a deliberate choice, not a default that slipped through. The read RPC
 * filters status='active', so a draft profile resolves to null: not a quiet
 * placeholder, a 404. "Everyone gets a person profile, auto-provisioned, with a
 * prompt to come back and finish it" (Patrik, 2026-07-28) is only true if the
 * profile renders, and the completeness prompt only does its work on a page that
 * exists.
 *
 * WHAT THAT PUBLISHES, STATED PLAINLY: name, email and organization become
 * readable at /people/<slug> and through get_person_profile to anon.
 *
 * It is not a new exposure class. directory_members today carries a
 * `USING (true)` policy from migration 006 and is granted to anon, so all 70
 * emails are ALREADY readable by anyone holding the anon key that ships in the
 * browser bundle (verified against production, 2026-07-28). What does change is
 * that the address becomes human-readable and crawlable on a page instead of
 * sitting behind a REST call. If that is not wanted, the fix belongs in the RPC
 * — omit `email` for non-owners — not in whether the profile exists.
 *   Hold everything back instead:  node scripts/seed-people.mjs --status=draft
 *   Unpublish later:               UPDATE directory_people SET status='draft';
 *
 * ===========================================================================
 * §COMPANY — why --company-profiles writes nothing by default
 * ===========================================================================
 * directory_company_profile exists to hold what directory_companies does not:
 * linkedin_url, org_type, naics_code, focus_areas, the six relationship counts.
 * directory_companies has a source column for NONE of them (checked against all
 * 166 live rows; the only populated columns are name/slug/description/vertical/
 * city/state/country/website/employee_count/year_founded/phone/email/logo_url).
 *
 * The two fields that could be carried across are already handled upstream:
 * get_company_profile falls back to `vertical` for categories and to
 * "city, state, country" for the headquarters row, with or without a profile row.
 *
 * So a profile row would add nothing to the payload — and it would take something
 * away. `IF v_has_profile THEN v_counts := [six counts]` means the moment the row
 * exists, WHO WE WORK WITH renders 0 / 0 / 0 / 0 / 0 / 0 for that company.
 * 033's own comment: "A card of six zeros is not data, it is a shrug." Patrik's
 * call on stats with nothing behind them was "ask for the data, in place".
 *
 * Creating 166 empty rows would therefore break a card that is currently correct.
 * The mapping is implemented and runs the moment a source column exists; it is
 * off until then. --company-profiles forces it.
 *
 * ===========================================================================
 * USAGE
 * ===========================================================================
 *   node scripts/seed-people.mjs --dry-run        # plan only, writes nothing
 *   node scripts/seed-people.mjs                  # apply
 *   node scripts/seed-people.mjs --status=draft   # apply, unpublished
 *   node scripts/seed-people.mjs --company-profiles
 *
 * Idempotent. Running it twice does not create a second set: existing people are
 * matched on member_id, then auth_user_id, then a unique email, and an existing
 * row is only ever BACKFILLED — a field that already has a value is never
 * overwritten, because by then it may be something the person typed themselves.
 *
 * Reports counts. The only per-person string it ever prints is a single example
 * slug.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..')

/* ------------------------------------------------------------------ *
 * Environment
 * ------------------------------------------------------------------ */

/**
 * .env.prod.local stores values with a trailing literal backslash-n. Reading it
 * naively yields a service key with two junk characters on the end and a flat
 * 401 "Invalid API key" that looks like a rotated credential. Strip it.
 */
function loadEnv() {
  const candidates = ['.env.prod.local', '.env.production', '.env.local']
  const out = {}
  for (const name of candidates) {
    const file = path.join(REPO, name)
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (!m) continue
      const value = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '').trim()
      if (value && out[m[1]] === undefined) out[m[1]] = value
    }
  }
  return out
}

const ENV = loadEnv()
const SUPABASE_URL = ENV.SUPABASE_URL || ENV.VITE_SUPABASE_URL
const SERVICE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n' +
    'Expected in .env.prod.local at the repo root. Nothing was written.',
  )
  process.exit(1)
}

/* ------------------------------------------------------------------ *
 * Arguments
 * ------------------------------------------------------------------ */

const ARGV = process.argv.slice(2)
const DRY_RUN = ARGV.includes('--dry-run')
const WITH_COMPANY_PROFILES = ARGV.includes('--company-profiles')
const STATUS = (() => {
  const flag = ARGV.find((a) => a.startsWith('--status='))
  const value = flag ? flag.split('=')[1] : 'active'
  if (!['draft', 'active', 'inactive'].includes(value)) {
    console.error(`--status must be draft | active | inactive (got "${value}")`)
    process.exit(1)
  }
  return value
})()

/* ------------------------------------------------------------------ *
 * PostgREST
 * ------------------------------------------------------------------ */

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function rest(pathAndQuery, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers || {}) },
  })
  const raw = await res.text()
  let body = null
  if (raw) { try { body = JSON.parse(raw) } catch { body = raw } }
  return { ok: res.ok, status: res.status, body, range: res.headers.get('content-range') }
}

/**
 * Page through a table so a >1000-row default limit can never silently truncate.
 * `order` is a parameter because directory_company_profile is keyed on
 * company_id and has no `id` column at all — ordering by id there is a 400.
 */
async function selectAll(table, columns, order = 'id.asc') {
  const rows = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const res = await rest(`${table}?select=${columns}&order=${order}&offset=${from}&limit=${page}`)
    if (!res.ok) throw new Error(`select ${table} failed (${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`)
    rows.push(...res.body)
    if (res.body.length < page) return rows
  }
}

async function countOf(table, key = 'id') {
  const res = await rest(`${table}?select=${key}&limit=1`, { headers: { Prefer: 'count=exact' } })
  if (!res.ok) return null
  const m = /\/(\d+|\*)$/.exec(res.range || '')
  return m ? (m[1] === '*' ? 0 : Number(m[1])) : null
}

/**
 * Which of these columns actually exist on the table. One cheap probe each.
 *
 * This is what keeps §COMPANY honest rather than hardcoded: the carry-across
 * mapping asks the live schema instead of asserting "there is no linkedin_url",
 * so the day that column is added the script starts using it with no edit.
 */
async function detectColumns(table, candidates) {
  const present = []
  for (const col of candidates) {
    const res = await rest(`${table}?select=${col}&limit=1`)
    if (res.ok) present.push(col)
  }
  return present
}

/* ------------------------------------------------------------------ *
 * Slugs
 * ------------------------------------------------------------------ */

/** Matches the migration's guard: ^[a-z0-9]+(-[a-z0-9]+)*$ */
function slugify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics: "Jokūbas" -> "Jokubas"
    .replace(/['’]/g, '')         // O'Brien -> obrien, not o-brien
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * A slug that is free in BOTH namespaces. The trigger rejects any company slug,
 * and person slugs are UNIQUE among themselves.
 * `taken` is mutated so callers cannot hand out the same slug twice.
 */
function claimSlug(preferred, fallbackSeed, taken) {
  const base = slugify(preferred) || `person-${String(fallbackSeed).replace(/-/g, '').slice(0, 8)}`
  if (!taken.has(base)) { taken.add(base); return base }
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) { taken.add(candidate); return candidate }
  }
  throw new Error('could not allocate a slug after 1000 attempts')
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const clean = (v) => {
  const s = typeof v === 'string' ? v.trim() : v
  return s === '' || s === undefined ? null : s
}
const lower = (v) => String(v ?? '').trim().toLowerCase()

/** Oldest first, id as the tiebreak, so every run agrees on "the first one". */
const byAge = (a, b) => {
  const at = Date.parse(a.created_at || '') || 0
  const bt = Date.parse(b.created_at || '') || 0
  return at - bt || String(a.id).localeCompare(String(b.id))
}

/** Values present on an existing row that must never be clobbered by a rerun. */
function backfillOnly(existing, desired) {
  const patch = {}
  for (const [key, value] of Object.entries(desired)) {
    if (value === null || value === undefined) continue
    const current = existing[key]
    const isEmpty = current === null || current === undefined || (typeof current === 'string' && current.trim() === '')
    if (isEmpty) patch[key] = value
  }
  return patch
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

/**
 * Insert as one batch; on failure retry row by row so a single bad row is
 * reported by slug instead of taking the other 67 down with it.
 */
async function insertRows(table, rows, label) {
  if (!rows.length) return { inserted: 0, failed: [] }
  if (DRY_RUN) return { inserted: rows.length, failed: [] }

  const batch = await rest(table, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  })
  if (batch.ok) return { inserted: rows.length, failed: [] }

  console.warn(`  batch insert into ${table} failed (${batch.status}); retrying ${label} one at a time`)
  let inserted = 0
  const failed = []
  for (const row of rows) {
    const one = await rest(table, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    })
    if (one.ok) inserted++
    else failed.push({ slug: row.slug ?? row.company_id ?? '(row)', status: one.status, message: (one.body?.message || String(one.body)).slice(0, 160) })
  }
  return { inserted, failed }
}

async function patchRow(table, filter, patch) {
  if (!Object.keys(patch).length) return true
  if (DRY_RUN) return true
  const res = await rest(`${table}?${filter}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) console.warn(`  patch ${table} failed (${res.status}): ${JSON.stringify(res.body).slice(0, 200)}`)
  return res.ok
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

async function main() {
  console.log('seed-people.mjs')
  console.log(`  project   ${SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0]}`)
  console.log(`  mode      ${DRY_RUN ? 'DRY RUN (nothing is written)' : 'APPLY'}`)
  console.log(`  status    ${STATUS}${STATUS === 'active' ? ' (profiles are publicly readable)' : ' (profiles resolve to not-found until published)'}`)
  console.log(`  companies ${WITH_COMPANY_PROFILES ? 'FORCED ON (--company-profiles)' : 'skipped unless a source column exists'}`)

  /* ---- BEFORE ---------------------------------------------------- */
  const before = {
    people: await countOf('directory_people'),
    companyProfiles: await countOf('directory_company_profile', 'company_id'),
    capabilities: await countOf('directory_person_capabilities'),
    needs: await countOf('directory_person_needs'),
    affiliations: await countOf('directory_person_affiliations'),
    experience: await countOf('directory_person_experience'),
    missionScores: await countOf('directory_mission_scores'),
  }
  console.log('\nBEFORE', before)

  /* ---- READ (never written to) ----------------------------------- */
  const members = await selectAll('directory_members', 'id,tenant_id,company_id,email,full_name,auth_user_id,created_at')

  // Ask the live schema which enrichment columns exist rather than assuming.
  // Named explicitly, never `select=*`: directory_companies carries the stripe
  // and membership columns that migration 033 goes out of its way to keep out of
  // any payload, and they have no business being pulled into this process either.
  const COMPANY_BASE = 'id,name,slug,city,state,country,vertical'
  const COMPANY_ENRICHMENT = await detectColumns('directory_companies', ['linkedin_url', 'org_type', 'naics_code'])
  const companies = await selectAll(
    'directory_companies',
    [COMPANY_BASE, ...COMPANY_ENRICHMENT].join(','),
  )
  const listings = await selectAll('directory_listings', 'id,title,description,vertical,author_name,virtual_url,image_url,company_id,tenant_id,category,created_at')
  const people = await selectAll('directory_people', 'id,slug,full_name,email,auth_user_id,member_id,company_id,tenant_id,org_name,job_title,website,bio_short,bio_long,status')

  const companyById = new Map(companies.map((c) => [c.id, c]))
  const personListings = listings.filter((l) => l.category === 'person').sort(byAge)

  console.log(`\nSOURCE  members=${members.length}  companies=${companies.length}  person-listings=${personListings.length}  existing-people=${people.length}`)

  /* ---- Existing-people indexes for idempotency -------------------- */
  const byMemberId = new Map()
  const byAuthId = new Map()
  const byEmail = new Map()
  const bySlug = new Map()
  for (const p of people) {
    if (p.member_id) byMemberId.set(p.member_id, p)
    if (p.auth_user_id) byAuthId.set(p.auth_user_id, p)
    if (p.email) {
      const key = lower(p.email)
      byEmail.set(key, byEmail.has(key) ? null : p)   // null = ambiguous, never match on it
    }
    if (p.slug) bySlug.set(p.slug, p)
  }

  /* ---- §MERGE: group the 70 memberships into humans --------------- */
  const humans = new Map()   // auth_user_id (or member id) -> member rows, oldest first
  for (const m of [...members].sort(byAge)) {
    const key = m.auth_user_id || `member:${m.id}`
    humans.set(key, [...(humans.get(key) || []), m])
  }
  const merged = [...humans.values()].filter((g) => g.length > 1)

  /* ---- Slug namespace -------------------------------------------- */
  const taken = new Set([
    ...companies.map((c) => c.slug).filter(Boolean),   // the trigger rejects these
    ...people.map((p) => p.slug).filter(Boolean),      // and these are already UNIQUE
  ])

  /* ================================================================ *
   * 1. MEMBERS
   * ================================================================ */
  const memberInserts = []
  const memberPatches = []
  let memberMatched = 0

  for (const [, group] of humans) {
    const primary = group[0]                      // earliest membership wins the profile
    const company = primary.company_id ? companyById.get(primary.company_id) : null

    // Every value below is copied from a column that already holds it.
    const desired = {
      tenant_id: clean(primary.tenant_id),
      auth_user_id: clean(primary.auth_user_id),
      member_id: clean(primary.id),
      company_id: clean(primary.company_id),
      full_name: clean(primary.full_name),
      email: clean(primary.email),
      org_name: clean(company?.name) || null,
    }

    const emailKey = lower(primary.email)
    const existing =
      byMemberId.get(primary.id) ||
      (primary.auth_user_id ? byAuthId.get(primary.auth_user_id) : null) ||
      (emailKey ? byEmail.get(emailKey) || null : null)

    if (existing) {
      memberMatched++
      const patch = backfillOnly(existing, desired)
      if (Object.keys(patch).length) memberPatches.push({ id: existing.id, patch })
      continue
    }

    const slug = claimSlug(primary.full_name, primary.id, taken)
    memberInserts.push({
      ...desired,
      slug,
      status: STATUS,
      published_at: STATUS === 'active' ? new Date().toISOString() : null,
      // avatar_url, job_title, city/state/country, bios, focus_areas, availability:
      // no source column exists. Left empty on purpose — see the header.
    })
  }

  /* ================================================================ *
   * 2. THE FIVE PUBLIC FIGURES
   *
   * title -> full_name, description -> bio_short, vertical -> org_name,
   * author_name -> job_title, virtual_url -> website (or linkedin_url when the
   * link is LinkedIn). The listings rows stay exactly as they are.
   *
   * bio goes to bio_short, whole and verbatim. Splitting it into a short lede
   * plus a long body would mean choosing a cut point the author never wrote.
   * ================================================================ */
  const figureInserts = []
  const figurePatches = []
  let figureMatched = 0

  for (const l of personListings) {
    const name = clean(l.title)
    if (!name) continue

    const link = clean(l.virtual_url)
    const isLinkedIn = link ? /(^|\.)linkedin\.com/i.test(link.replace(/^https?:\/\//, '')) : false

    const desired = {
      tenant_id: clean(l.tenant_id),
      company_id: clean(l.company_id),
      full_name: name,
      org_name: clean(l.vertical),
      job_title: clean(l.author_name),
      bio_short: clean(l.description),
      website: isLinkedIn ? null : link,
      linkedin_url: isLinkedIn ? link : null,
      avatar_url: clean(l.image_url),
      // auth_user_id / member_id stay NULL: these five are not users. That is the
      // case migration 032 documents — an admin-created profile, maintained by
      // approved members of the linked company.
    }

    const wanted = slugify(name)
    const existing =
      (wanted ? bySlug.get(wanted) : null) ||
      people.find((p) => !p.member_id && lower(p.full_name) === lower(name)) ||
      null

    if (existing) {
      figureMatched++
      const patch = backfillOnly(existing, desired)
      if (Object.keys(patch).length) figurePatches.push({ id: existing.id, patch })
      continue
    }

    const slug = claimSlug(name, l.id, taken)
    figureInserts.push({
      ...desired,
      slug,
      status: STATUS,
      published_at: STATUS === 'active' ? new Date().toISOString() : null,
    })
  }

  /* ================================================================ *
   * 3. COMPANY PROFILES — see §COMPANY. The mapping is real; the source is not.
   * ================================================================ */
  const existingProfileIds = new Set(
    (await selectAll('directory_company_profile', 'company_id', 'company_id.asc')).map((r) => r.company_id),
  )
  const companyProfileInserts = []
  let companyNoSource = 0

  for (const c of companies) {
    if (existingProfileIds.has(c.id)) continue

    // Only fields with NO other path into the payload count as a reason to
    // create the row. `vertical` and city/state/country already reach it through
    // get_company_profile's own fallbacks, so carrying them changes nothing.
    const carried = {}
    for (const col of COMPANY_ENRICHMENT) {
      const value = clean(c[col])
      if (value) carried[col] = value
    }

    const hasSource = Object.keys(carried).length > 0
    if (!hasSource) companyNoSource++
    if (!hasSource && !WITH_COMPANY_PROFILES) continue

    const hq = [clean(c.city), clean(c.state), clean(c.country)].filter(Boolean).join(', ')
    companyProfileInserts.push({
      company_id: c.id,
      ...carried,
      headquarters_label: hq || null,
      categories: clean(c.vertical) ? [clean(c.vertical)] : [],
      // org_type / naics_code / linkedin_url absent above = no source, left null.
      // The six counts are NOT NULL DEFAULT 0 in the schema and cannot be null;
      // that is precisely why this block does not run by default.
    })
  }

  /* ---- PLAN ------------------------------------------------------- */
  console.log('\nPLAN')
  console.log(`  members            ${members.length} membership rows -> ${humans.size} distinct people (${merged.length} merged pair${merged.length === 1 ? '' : 's'}: same auth_user_id + same email)`)
  console.log(`  people to insert   ${memberInserts.length}`)
  console.log(`  people to backfill ${memberPatches.length} (of ${memberMatched} already present)`)
  console.log(`  figures to insert  ${figureInserts.length}`)
  console.log(`  figures to backfill ${figurePatches.length} (of ${figureMatched} already present)`)
  console.log(`  company profiles   ${companyProfileInserts.length} to insert; ${companyNoSource} companies have no source column for any field this table adds`)

  /* ---- WRITE ------------------------------------------------------ */
  const memberResult = await insertRows('directory_people', memberInserts, 'people')
  const figureResult = await insertRows('directory_people', figureInserts, 'public figures')

  let patched = 0
  for (const { id, patch } of [...memberPatches, ...figurePatches]) {
    if (await patchRow('directory_people', `id=eq.${id}`, patch)) patched++
  }

  const companyResult = await insertRows('directory_company_profile', companyProfileInserts, 'company profiles')

  for (const f of [...memberResult.failed, ...figureResult.failed, ...companyResult.failed]) {
    console.warn(`  FAILED ${f.slug}: ${f.status} ${f.message}`)
  }

  /* ---- AFTER ------------------------------------------------------ */
  const after = {
    people: await countOf('directory_people'),
    companyProfiles: await countOf('directory_company_profile', 'company_id'),
    capabilities: await countOf('directory_person_capabilities'),
    needs: await countOf('directory_person_needs'),
    affiliations: await countOf('directory_person_affiliations'),
    experience: await countOf('directory_person_experience'),
    missionScores: await countOf('directory_mission_scores'),
  }

  console.log('\nRESULT')
  console.log(`  inserted   people=${memberResult.inserted}  figures=${figureResult.inserted}  companyProfiles=${companyResult.inserted}`)
  console.log(`  backfilled ${patched}`)
  console.log(`  failed     ${memberResult.failed.length + figureResult.failed.length + companyResult.failed.length}`)
  console.log('AFTER', after)

  // One example slug. The only per-person string this script prints, by design.
  const sample = [...figureInserts, ...memberInserts][0]
  if (sample) console.log(`\nexample  /people/${sample.slug}`)

  if (DRY_RUN) console.log('\nDRY RUN — nothing was written. Re-run without --dry-run to apply.')
}

main().catch((err) => {
  console.error('\nseed-people.mjs failed:', err.message)
  process.exit(1)
})
