#!/usr/bin/env node
/**
 * backfill-org-type.mjs — derive `directory_company_profile.org_type` for every
 * organization in the directory, and leave a trail a human can audit.
 *
 *   node scripts/backfill-org-type.mjs --dry-run     print the plan, write nothing
 *   node scripts/backfill-org-type.mjs               write it
 *   node scripts/backfill-org-type.mjs --report      print the current state of the column
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment, or from
 * .env.production at the repo root if they are not set.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * The column has been on directory_company_profile since the profile-screen
 * migration and the table has never held a row, so 0 of 165 organizations had a
 * type and every screen that wanted one rendered an empty state. This fills it.
 *
 * It is a SCRIPT and not a paste because of two properties a paste cannot have:
 *
 *   RE-RUNNABLE. Run it again after 40 new companies register and it types the
 *   40 and leaves the 165 alone. Run it after an admin corrects a row and it
 *   SKIPS that row — see org_type_reviewed_at below. A one-off INSERT would
 *   silently undo every correction the second time anybody ran it.
 *
 *   AUDITABLE. Every value it writes carries the rule that produced it, the
 *   confidence of that rule, and the exact text it matched on. An admin sorting
 *   Admin Tools by "derived from" can review one RULE at a time rather than one
 *   company at a time, which is the difference between a 10-minute audit and a
 *   165-row one.
 *
 * ---------------------------------------------------------------------------
 * THE RULES, AND WHAT MAKES ONE ALLOWED
 * ---------------------------------------------------------------------------
 * A rule is allowed only if the signal it reads is a FACT ABOUT THE
 * ORGANIZATION rather than a correlation. A .edu domain is issued only to an
 * accredited institution — that is a fact. "The name contains Space" is a
 * correlation and there is no rule like it here.
 *
 * The ladder is ordered most-specific first and the FIRST match wins. Order is
 * load-bearing in two places, both deliberate:
 *   - a .edu beats every name rule (a university that also says "Inc." is still
 *     a university)
 *   - the institutional NAME rules beat the .org TLD, because "Casa Grande
 *     Union High School" on cghs.cguhsd.org is a school before it is a
 *     nonprofit.
 *
 * THE LAST RULE IS THE ONE TO ARGUE WITH. `domain-tld:commercial` says: an
 * organization in a business directory, with a .com and no institutional signal
 * of any kind, is a private company. That is an inference, not a certainty, so
 * it is recorded at MEDIUM confidence with its own source string — an admin who
 * disagrees with the inference can filter for exactly it. What it is NOT is a
 * guess dressed as a fact.
 *
 * Anything the ladder does not reach is written as 'Other' with confidence
 * 'none' and source 'unclassified'. Not a seventh label, not a plausible-
 * looking one. The screen then reads 'Other' as what it is: we do not know.
 *
 * `vertical` is recorded in the evidence blob but is NOT a rule. It holds one
 * of space / semiconductor / defense / biotech, which is the industry an
 * organization works in and says nothing at all about whether it is a company,
 * a university or an agency — ASU's Biodesign Institute and Caris Life Sciences
 * are both 'biotech'. src/lib/adminStats.js:473-476 already refuses to
 * substitute it for a type; substituting it here would be the same error one
 * layer down. It is captured so an auditor can see everything the classifier
 * saw, not because it moved a decision.
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/* ------------------------------------------------------------------------- *
 * Credentials
 * ------------------------------------------------------------------------- */

function loadEnvFile(name) {
  try {
    const out = {}
    for (const line of readFileSync(join(ROOT, name), 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const i = t.indexOf('=')
      out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
    return out
  } catch { return {} }
}

const fileEnv = loadEnvFile('.env.production')
const SUPABASE_URL = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || fileEnv.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (env or .env.production).')
  process.exit(1)
}

const rest = (path, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...init,
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  },
})

/* ------------------------------------------------------------------------- *
 * The six types
 * ------------------------------------------------------------------------- */

export const ORG_TYPES = ['Private Company', 'Nonprofit', 'Government', 'Academic', 'Investor', 'Other']

/* ------------------------------------------------------------------------- *
 * The classifier
 * ------------------------------------------------------------------------- */

/** Host of a website field, as typed by a human into a signup form.
 *  This data contains, verbatim: `http:\\www.arsenalgpa.com` (backslashes),
 *  `https//www.newspacebrandbuilders.com` (no colon), `HTTPS://www.TxSpace...`
 *  (upper case), and a dozen bare `example.com` with no scheme at all. Each of
 *  those is a real organization, and a host parser that drops one of them costs
 *  a real type. Returns '' only when there is genuinely no hostname. */
export function hostOf(website) {
  if (!website) return ''
  let s = String(website).trim().toLowerCase().replace(/\\/g, '/')
  if (!s) return ''
  s = s.replace(/^https?:?\/+/, '').replace(/^\/+/, '')
  const host = s.split(/[/?#]/)[0].replace(/^www\./, '')
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : ''
}

/** The rule ladder. First match wins; see the header for why the order is what
 *  it is. Each entry: [source, type, confidence, test(name, host) -> matched
 *  string | false]. `matched` goes into the evidence blob. */
const RULES = [
  // 1-2. Restricted top-level domains. .edu is issued only to accredited US
  // institutions and .gov/.mil only to government bodies, so these are facts
  // about the registrant rather than inferences about the name.
  ['domain-tld:.edu', 'Academic', 'high', (n, h) => h.endsWith('.edu') && h],
  ['domain-tld:.gov', 'Government', 'high', (n, h) => (h.endsWith('.gov') || h.endsWith('.mil')) && h],

  // 3. Educational institutions by name. "College" inside "Big Sky Way
  //    Leadership College, Inc." is the operative word; the "Inc." only says
  //    how it is incorporated.
  ['name:academic', 'Academic', 'high', (n) => match(n, /\b(universit(?:y|ies)|college|high school|school district|community college|academy|polytechnic)\b/i)],

  // 4. Government bodies by name. Deliberately narrow: "Authority", "Department
  //    of", "County", "City of" name a public body. "Defense" and "Federal
  //    Contractor" do not — a defense contractor is a private company, which is
  //    why no vertical or industry word appears in this list.
  ['name:government', 'Government', 'high', (n) => match(n, /\b(department of|ministry of|county of|city of|state of|commerce authority|port authority|transportation authority|public authority|air force|space force|\bnasa\b|federal aviation)\b/i)],
  ['name:government-authority', 'Government', 'medium', (n) => match(n, /\bauthority\b/i)],

  // 5. Membership and charitable bodies by name.
  ['name:nonprofit', 'Nonprofit', 'high', (n) => match(n, /\b(foundation|coalition|association|society|nonprofit|non-profit|charitable|chamber of commerce|museum|\balliance\b|\bcouncil\b)\b/i)],

  // 6. Capital. "Ventures", "Capital" and "Private Wealth" are what a firm that
  //    deploys money calls itself; none of them appear in an operator's name by
  //    accident.
  ['name:investor', 'Investor', 'high', (n) => match(n, /\b(ventures?|venture capital|capital partners|\bcapital\b|private wealth|wealth management|asset management|private equity|\bequity\b|investments?|\bfund\b|accelerator|incubator)\b/i)],

  // 7. The .org TLD. Not restricted the way .edu is, so this is medium: an .org
  //    is overwhelmingly a nonprofit but nothing stops a company registering
  //    one. It sits BELOW the name rules so a school on an .org is still a
  //    school.
  ['domain-tld:.org', 'Nonprofit', 'medium', (n, h) => h.endsWith('.org') && h],

  // 8. A legal incorporation suffix. "LLC" is a statement about legal form, and
  //    the forms in this list are private ones.
  ['name:legal-suffix', 'Private Company', 'high', (n) => match(n, /(?:^|[\s,(])(inc\.?|l\.?l\.?c\.?|corp\.?|corporation|incorporated|ltd\.?|limited|plc|gmbh|s\.?a\.?r\.?l|company)(?:$|[\s,.)])/i)],

  // 9. THE INFERENCE. See the header. Everything above is a fact about the
  //    organization; this is a reading of the directory it sits in. Medium, and
  //    it wears its own source string so it can be filtered out in one click.
  ['domain-tld:commercial', 'Private Company', 'medium', (n, h) =>
    h && /\.(com|net|io|co|us|tech|biz|space|aero|ai|dev|app|solutions|systems)$/.test(h) && h],
]

function match(name, re) {
  const m = String(name || '').match(re)
  return m ? m[0].trim() : false
}

/**
 * Classify one company row.
 * Returns { org_type, source, confidence, evidence } — never null, never a
 * label outside ORG_TYPES.
 */
export function classify(company) {
  const name = company.name || ''
  const host = hostOf(company.website)
  for (const [source, type, confidence, test] of RULES) {
    const matched = test(name, host)
    if (matched) {
      return {
        org_type: type,
        source,
        confidence,
        evidence: { name, website: company.website || null, host: host || null, vertical: company.vertical || null, matched: String(matched) },
      }
    }
  }
  // Nothing fired. 'Other' with confidence 'none' is the honest answer: this is
  // the bucket for "we do not know", and the screen reads it as exactly that.
  return {
    org_type: 'Other',
    source: 'unclassified',
    confidence: 'none',
    evidence: { name, website: company.website || null, host: host || null, vertical: company.vertical || null, matched: null },
  }
}

/* ------------------------------------------------------------------------- *
 * Run
 * ------------------------------------------------------------------------- */

async function fetchAll(table, select, order = 'created_at.asc') {
  const out = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const res = await rest(`${table}?select=${select}&order=${order}&limit=${PAGE}&offset=${from}`)
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`)
    const rows = await res.json()
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

async function report() {
  const res = await rest('directory_company_profile?select=org_type,org_type_source,org_type_confidence,org_type_reviewed_at&limit=1000')
  const rows = await res.json()
  if (!rows.length) { console.log('directory_company_profile is empty — nothing has been derived yet.'); return }
  const by = (key) => rows.reduce((m, r) => (m[r[key] ?? 'null'] = (m[r[key] ?? 'null'] || 0) + 1, m), {})
  console.log(`${rows.length} profile rows\n`)
  console.log('BY TYPE');       for (const [k, v] of Object.entries(by('org_type')).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)
  console.log('\nBY RULE');     for (const [k, v] of Object.entries(by('org_type_source')).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)
  console.log('\nBY CONFIDENCE'); for (const [k, v] of Object.entries(by('org_type_confidence')).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)
  console.log(`\nHuman-reviewed (script will not touch these): ${rows.filter((r) => r.org_type_reviewed_at).length}`)
}

async function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has('--report')) return report()
  const dryRun = args.has('--dry-run')

  const companies = await fetchAll('directory_companies', 'id,name,website,vertical,status', 'name.asc')
  const existing = await fetchAll('directory_company_profile', 'company_id,org_type,org_type_source,org_type_reviewed_at', 'company_id.asc')
  const byId = new Map(existing.map((r) => [r.company_id, r]))

  console.log(`${companies.length} organizations, ${existing.length} profile rows on record.\n`)

  const now = new Date().toISOString()
  const writes = []
  const skipped = []
  const tally = {}
  const rules = {}

  for (const c of companies) {
    const prior = byId.get(c.id)
    // The correction guard. A human has spoken about this row; the classifier
    // does not get a second opinion.
    if (prior?.org_type_reviewed_at) { skipped.push(c.name); continue }
    const r = classify(c)
    tally[r.org_type] = (tally[r.org_type] || 0) + 1
    rules[r.source] = (rules[r.source] || 0) + 1
    writes.push({
      company_id: c.id,
      org_type: r.org_type,
      org_type_source: r.source,
      org_type_confidence: r.confidence,
      org_type_evidence: r.evidence,
      org_type_derived_at: now,
    })
  }

  console.log('BY TYPE');  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)
  console.log('\nBY RULE'); for (const [k, v] of Object.entries(rules).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)
  if (skipped.length) console.log(`\nSkipped ${skipped.length} human-reviewed row(s): ${skipped.join(', ')}`)

  // Every 'Other' printed by name. This list IS the review queue: it is what an
  // admin has to look at, and keeping it short is the measure of the ladder.
  const others = writes.filter((w) => w.org_type === 'Other')
  if (others.length) {
    console.log(`\nUNCLASSIFIED (${others.length}) — these need a human:`)
    for (const o of others) console.log(`  ${o.org_type_evidence.name}  [website: ${o.org_type_evidence.website || 'none'}]`)
  }

  if (dryRun) { console.log('\n--dry-run: nothing written.'); return }

  // upsert on the primary key. `merge-duplicates` updates the org_type columns
  // and leaves every other column on an existing row untouched, so re-running
  // this cannot clear a verification or a linkedin_url somebody filled in.
  const CHUNK = 100
  let written = 0
  for (let i = 0; i < writes.length; i += CHUNK) {
    const batch = writes.slice(i, i + CHUNK)
    const res = await rest('directory_company_profile?on_conflict=company_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(batch),
    })
    if (!res.ok) throw new Error(`write failed: ${res.status} ${await res.text()}`)
    // Never report a write we did not confirm: count the rows the database
    // handed back, not the rows we sent.
    written += (await res.json()).length
  }
  console.log(`\nWrote ${written} of ${writes.length} rows.`)
  if (written !== writes.length) {
    console.error('MISMATCH — the database confirmed fewer rows than were sent. Investigate before trusting the screen.')
    process.exit(1)
  }
}

// Only run when invoked directly, so `classify` and `hostOf` can be imported
// and checked against a list of names without touching the database.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1) })
}
