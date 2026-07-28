#!/usr/bin/env node
/**
 * check-no-vite-secrets — build-time tripwire.
 *
 * WHY THIS EXISTS
 * Anything named `VITE_*` is inlined by Vite into the JavaScript that every
 * visitor downloads. On 2026-07-28 `VITE_SOURCING_ADMIN_KEY` was found holding
 * the Supabase **service_role** key, which means a god-mode credential has been
 * shipping in the public bundle at os.spacerising.org. This script makes that
 * class of mistake fail the build instead of shipping silently.
 *
 * WHAT IT CHECKS
 * Every `VITE_`-prefixed variable Vite would see for a production build:
 *   - `process.env` (this is how Vercel supplies them)
 *   - the dotenv files Vite loads for `mode=production`:
 *     `.env`, `.env.local`, `.env.production`, `.env.production.local`
 * For each value that looks like a JWT, the payload is base64url-decoded and
 * inspected for `"role":"service_role"`.
 *
 * It NEVER prints a value — only the variable name and where it came from.
 *
 * THE LEGACY ALLOWLIST
 * `VITE_SOURCING_ADMIN_KEY` is already compromised and already deployed. Making
 * it a hard failure today would break the production deploy pipeline before the
 * server-side replacement is live, which helps nobody. So it WARNS loudly on
 * every build and everything else FAILS. Deleting it from `LEGACY_ALLOWLIST` is
 * the final step of `docs/security/key-rotation-runbook.md` — do that and the
 * warning becomes a permanent hard failure.
 *
 * Run `STRICT_VITE_SECRETS=1 npm run build` to treat the allowlist as empty.
 * That is how you prove the cleanup actually worked before deleting the entry.
 *
 * Exit codes: 0 = clean (or allowlisted-only), 1 = a service_role key would ship.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Known-compromised variables that are already live. Warn, do not fail.
 * REMOVE ENTRIES AS THEY ARE RETIRED — see the runbook. Empty is the goal.
 */
const LEGACY_ALLOWLIST = new Set(['VITE_SOURCING_ADMIN_KEY'])

// Dotenv files Vite loads for `vite build` (mode = production), lowest priority
// first. `.env.prod.local` and `.env.check` are NOT in this list because Vite
// never loads them — they are at-rest copies, and the runbook covers them.
const ENV_FILES = ['.env', '.env.local', '.env.production', '.env.production.local']

const STRICT = process.env.STRICT_VITE_SECRETS === '1'

/** Parse a dotenv file into [name, value] pairs. Tolerant, not exhaustive. */
function parseDotenv(text) {
  const out = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    // Strip one layer of matching quotes.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1)
    }
    out.push([m[1], value])
  }
  return out
}

/**
 * Decode a JWT payload. Returns the raw payload STRING (never logged) or null.
 * Deliberately string-based: we look for the role claim without needing the
 * payload to be well-formed JSON.
 */
function decodeJwtPayload(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const parts = trimmed.split('.')
  if (parts.length !== 3) return null
  if (!parts[0].startsWith('eyJ')) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    return Buffer.from(b64 + pad, 'base64').toString('utf8')
  } catch {
    return null
  }
}

/** True when the decoded payload claims the Supabase service_role. */
function isServiceRole(payload) {
  if (!payload) return false
  // Matches "role":"service_role" with any whitespace around the colon.
  return /"role"\s*:\s*"service_role"/.test(payload)
}

// ── Gather every VITE_ variable Vite would see, with its source ──────────────
/** @type {Map<string, {value: string, source: string}>} */
const candidates = new Map()

for (const file of ENV_FILES) {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full)) continue
  let text
  try {
    text = fs.readFileSync(full, 'utf8')
  } catch {
    continue
  }
  for (const [name, value] of parseDotenv(text)) {
    if (!name.startsWith('VITE_')) continue
    candidates.set(name, { value, source: file })
  }
}

// process.env wins — that is Vercel, and it is what actually builds production.
for (const [name, value] of Object.entries(process.env)) {
  if (!name.startsWith('VITE_')) continue
  if (typeof value !== 'string' || !value) continue
  candidates.set(name, { value, source: 'process.env' })
}

// ── Inspect ─────────────────────────────────────────────────────────────────
const failures = []
const warnings = []

for (const [name, { value, source }] of candidates) {
  if (!isServiceRole(decodeJwtPayload(value))) continue
  const allowlisted = !STRICT && LEGACY_ALLOWLIST.has(name)
  ;(allowlisted ? warnings : failures).push({ name, source })
}

const LABEL = 'check-no-vite-secrets'

for (const { name, source } of warnings) {
  console.warn(
    `\n[${LABEL}] WARNING: ${name} (from ${source}) holds a service_role key.\n` +
      `  It is inlined into the public JS bundle and is readable by every visitor.\n` +
      `  Allowlisted as known-compromised so deploys are not blocked before the\n` +
      `  server-side replacement ships. THIS IS NOT RESOLVED.\n` +
      `  Fix + remove the allowlist entry: docs/security/key-rotation-runbook.md\n`
  )
}

if (failures.length > 0) {
  console.error(`\n[${LABEL}] BUILD BLOCKED — a service_role key would ship to the browser.\n`)
  for (const { name, source } of failures) {
    console.error(`  ✗ ${name}  (source: ${source})  →  payload claims "role":"service_role"`)
  }
  console.error(
    `\n  Anything named VITE_* is inlined into public JavaScript. A service_role key\n` +
      `  bypasses every row-level-security policy in the database.\n\n` +
      `  Fix it:\n` +
      `    1. Remove the variable, or point it at the ANON key instead.\n` +
      `    2. Move the privileged call to a server function under api/ that reads\n` +
      `       SUPABASE_SERVICE_ROLE_KEY (no VITE_ prefix, never sent to the browser).\n` +
      `    3. If the key was ever built with this value, ROTATE IT:\n` +
      `       docs/security/key-rotation-runbook.md\n\n` +
      `  (Values are never printed by this check — only variable names.)\n`
  )
  process.exit(1)
}

const strictNote = STRICT ? ' (STRICT: allowlist ignored)' : ''
console.log(
  `[${LABEL}] OK — ${candidates.size} VITE_ variable(s) checked, ` +
    `no unapproved service_role key would ship${strictNote}.`
)
process.exit(0)
