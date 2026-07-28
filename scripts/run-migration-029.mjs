/**
 * Apply migration 029_contacts_rls.sql to PRODUCTION.
 *
 * THREE MODES — exactly one per invocation:
 *
 *   --emit-sql[=<path>]   Print a copy-pasteable SQL file for the Supabase SQL editor.
 *                         Needs NO credentials and touches NOTHING. This is the primary
 *                         path when the database password is not on this machine.
 *                           node scripts/run-migration-029.mjs --emit-sql | pbcopy
 *                           node scripts/run-migration-029.mjs --emit-sql=/tmp/029.sql
 *
 *   --check               Read-only pre-flight against production. Changes nothing.
 *                           node --env-file=.env.prod.local scripts/run-migration-029.mjs --check
 *
 *   --apply               Applies the migration inside one transaction.
 *                           node --env-file=.env.prod.local scripts/run-migration-029.mjs --apply
 *
 * CREDENTIALS (--check / --apply only)
 *
 *   This connects to Postgres directly, so it needs the DATABASE password — NOT the
 *   service_role key. Passing the service key as the password is what the 027/028/029
 *   runners used to do, and it has never once authenticated ("password authentication
 *   failed for user postgres"). Set ONE of:
 *
 *     SUPABASE_DB_URL   full connection string, copied from the Supabase dashboard
 *                       (Project Settings -> Database -> Connection string -> URI)
 *     DATABASE_URL      same thing, if that is what your env already calls it
 *     SUPABASE_DB_PASSWORD  just the password; the host is composed from SUPABASE_URL
 *
 *   If none is set the script stops with instructions and points at --emit-sql.
 *   No secret is ever printed: connection strings are redacted before they are logged.
 *
 * ORDERING: 029 requires migration 028 PART 1 first — it uses the dir_is_tenant_admin() /
 * dir_is_global_admin() helpers created in 028 §0. --check reports whether those helpers
 * exist, --apply refuses to run without them, and the migration itself raises and rolls
 * back as a third line of defence.
 *
 * UNLIKE 028: this migration has no deferred half. Everything in 029 runs, and none of it
 * changes anything a user sees. The only anon-key toucher of directory_contacts is an
 * INSERT (the public contact form), which is preserved.
 *
 * IT DOES NOT SWALLOW ERRORS. Any failure prints and exits nonzero. The file is wrapped
 * in BEGIN/COMMIT, so a failure rolls back and prod is left exactly as it was.
 *
 * Never prints the database password, and never prints contact rows — submission PII is
 * exactly what this migration exists to stop leaking, so this script reports counts only.
 */
import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const MIGRATION = '029_contacts_rls.sql';
const sqlPath = join(repoRoot, 'migrations', MIGRATION);
const sql = readFileSync(sqlPath, 'utf8');

const TABLE = 'directory_contacts';

const REQUIRED_HELPERS = [
  'public.dir_is_tenant_admin(uuid)',
  'public.dir_is_global_admin()',
];

const READ_CMDS = new Set(['SELECT', 'ALL']);
const isAnonRole = roles => /(^|[,{])\s*(public|anon)\s*($|[,}])/.test(roles);

// ───────────────────────────────────────────────────────────────────────────────
// Mode
// ───────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const emitArg = args.find(a => a === '--emit-sql' || a.startsWith('--emit-sql='));
const EMIT = Boolean(emitArg);
const EMIT_PATH = emitArg && emitArg.includes('=') ? emitArg.slice(emitArg.indexOf('=') + 1) : null;
const APPLY = args.includes('--apply');
const CHECK = args.includes('--check');

if ([EMIT, APPLY, CHECK].filter(Boolean).length !== 1) {
  console.error('Refusing to guess. Pass exactly one mode:');
  console.error('  --emit-sql[=<path>]  SQL for the Supabase dashboard editor. No credentials needed.');
  console.error('  --check              read-only pre-flight against production');
  console.error('  --apply              run the migration');
  console.error('Read docs/security/APPLY-RUNBOOK.md first. 028 Part 1 must land before this.');
  process.exit(1);
}

// ───────────────────────────────────────────────────────────────────────────────
// MODE 1 — emit SQL for the Supabase dashboard editor. No credentials, no network.
// ───────────────────────────────────────────────────────────────────────────────
const VERIFY_SQL = `
-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFY — runs after COMMIT, changes nothing. The SQL editor shows this table.
-- Every row must read "expect N" and show N. Anything else: STOP and read
-- docs/security/APPLY-RUNBOOK.md, section "If a step fails".
-- NOTE: this is a policy inventory, not the pass condition. The pass condition is the
-- anon-key HTTP probe in the runbook — a permissive policy under a name nobody wrote
-- down would satisfy every row below and still leak.
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT ord, check_name, result FROM (
  SELECT 1 AS ord, 'legacy "service read contacts" / "public insert contacts" (expect 0)' AS check_name,
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_contacts'
        AND policyname IN ('service read contacts','public insert contacts')) AS result
  UNION ALL SELECT 2, 'contacts_public_insert, cmd INSERT (expect 1)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_contacts'
        AND policyname = 'contacts_public_insert' AND cmd = 'INSERT')
  UNION ALL SELECT 3, 'contacts_select_tenant_admin, cmd SELECT (expect 1)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_contacts'
        AND policyname = 'contacts_select_tenant_admin' AND cmd = 'SELECT')
  UNION ALL SELECT 4, 'directory_contacts READ policies reachable by anon (expect 0)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_contacts'
        AND cmd IN ('SELECT','ALL') AND roles::text[] && ARRAY['public','anon'])
  UNION ALL SELECT 5, 'RLS enabled on directory_contacts (expect true)',
    (SELECT relrowsecurity::text FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname = 'directory_contacts')
  UNION ALL SELECT 6, '028 §0 helpers this file depends on (expect 2)',
    ((to_regprocedure('public.dir_is_tenant_admin(uuid)') IS NOT NULL)::int
     + (to_regprocedure('public.dir_is_global_admin()') IS NOT NULL)::int)::text
) t ORDER BY ord;
`;

function emitSql() {
  const header = `-- ═══════════════════════════════════════════════════════════════════════════════
--  MIGRATION 029 — PASTE THIS WHOLE FILE INTO THE SUPABASE SQL EDITOR
--
--  Generated from migrations/${MIGRATION} by scripts/run-migration-029.mjs --emit-sql
--  The SQL between BEGIN and COMMIT below is byte-identical to that file. Nothing was
--  rewritten, reordered or summarised. Only this header and the VERIFY query at the
--  bottom were added, and the VERIFY query runs after COMMIT and changes nothing.
--
--  WHERE:  Supabase dashboard -> your project -> SQL Editor -> New query -> paste -> Run
--  WHO:    the editor runs as the 'postgres' role, which is what this needs.
--  NEEDS:  no local credentials, no database password, no CLI.
--
--  RUN MIGRATION 028 PART 1 FIRST. This file needs the dir_is_tenant_admin() and
--  dir_is_global_admin() helpers created in 028 §0. If they are missing, the guard at
--  the top raises an exception, the whole transaction rolls back, and NOTHING is applied
--  — you will see the error in the editor. That is the intended behaviour, not a bug.
--
--  WHAT IT DOES: closes the anonymous read of every contact / RFQ submission ever sent
--  through the site (name, email, phone, message). Keeps the anonymous INSERT the public
--  contact form depends on. No visible product change.
--
--  IT IS ONE TRANSACTION. Any error rolls the whole thing back and production is left
--  exactly as it was. It is idempotent: safe to run again if you are unsure whether it
--  landed. Running it twice changes nothing the second time.
--
--  AFTER RUNNING: the result grid shows the VERIFY table at the bottom of this file.
--  That is a policy inventory, NOT the pass condition. The pass condition is the
--  anon-key HTTP probe in docs/security/APPLY-RUNBOOK.md. Run it.
-- ═══════════════════════════════════════════════════════════════════════════════

`;

  const out = header + sql + VERIFY_SQL;

  if (EMIT_PATH) {
    writeFileSync(EMIT_PATH, out, 'utf8');
    console.error(`Wrote ${Buffer.byteLength(out, 'utf8')} bytes to ${EMIT_PATH}`);
    console.error('Apply migration 028 Part 1 BEFORE this one.');
    console.error('Open it, select all, paste into the Supabase SQL editor, Run.');
  } else {
    // SQL to stdout so `--emit-sql | pbcopy` gives a clean clipboard. Notes to stderr.
    process.stdout.write(out);
    console.error(`\n[${relative(repoRoot, sqlPath)} -> stdout, ${Buffer.byteLength(out, 'utf8')} bytes]`);
    console.error('[Apply migration 028 Part 1 BEFORE this one.]');
    console.error('[Tip: node scripts/run-migration-029.mjs --emit-sql | pbcopy]');
  }
}

if (EMIT) {
  emitSql();
  process.exit(0);
}

// ───────────────────────────────────────────────────────────────────────────────
// Credentials. The DATABASE password — never the service_role key.
// ───────────────────────────────────────────────────────────────────────────────
// Built from the PARSED PARTS, never by editing the raw string. The password is never a
// substring of what this returns, so there is no regex to get wrong and no way to leak a
// password containing '@', ':' or '/'.
function safeLabel(parsed) {
  return `${parsed.protocol}//${parsed.username || '(no user)'}${parsed.password ? ':***' : ''}@${parsed.host}${parsed.pathname}`;
}

function resolveConnection() {
  const explicit = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (explicit) {
    const varName = process.env.SUPABASE_DB_URL?.trim() ? 'SUPABASE_DB_URL' : 'DATABASE_URL';
    let parsed;
    try {
      parsed = new URL(explicit);
    } catch {
      console.error(`ERROR: ${varName} is not a valid URL. Expected postgresql://user:password@host:port/database`);
      process.exit(1);
    }
    if (parsed.port === '6543') {
      console.error('WARNING: port 6543 is the TRANSACTION-mode pooler. It cannot run a multi-statement');
      console.error('         migration reliably. Use the session pooler (port 5432) or the direct');
      console.error('         connection, or use --emit-sql and the dashboard editor.');
    }
    return {
      config: { connectionString: explicit, ssl: { rejectUnauthorized: false } },
      label: safeLabel(parsed),
      source: varName,
    };
  }

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (password) {
    const url = process.env.SUPABASE_URL?.trim();
    if (!url) {
      console.error('ERROR: SUPABASE_DB_PASSWORD is set but SUPABASE_URL is not, so the database host');
      console.error('       cannot be derived. Set SUPABASE_DB_URL with the full connection string instead.');
      process.exit(1);
    }
    const ref = new URL(url).hostname.split('.')[0];
    const host = `db.${ref}.supabase.co`;
    return {
      config: { host, port: 5432, database: 'postgres', user: 'postgres', password, ssl: { rejectUnauthorized: false } },
      label: `postgresql://postgres:***@${host}:5432/postgres`,
      source: 'SUPABASE_DB_PASSWORD',
    };
  }

  console.error('ERROR: no database credentials. This connects to Postgres directly, so it needs the');
  console.error('       DATABASE PASSWORD. The service_role key is NOT a database password — passing it');
  console.error('       as one is why this script used to fail with:');
  console.error('           password authentication failed for user "postgres"');
  console.error('');
  console.error('  Set ONE of these and re-run:');
  console.error('    SUPABASE_DB_URL       full connection string — Supabase dashboard ->');
  console.error('                          Project Settings -> Database -> Connection string -> URI');
  console.error('    DATABASE_URL          same thing under the name your env already uses');
  console.error('    SUPABASE_DB_PASSWORD  the password only (host derived from SUPABASE_URL)');
  console.error('');
  console.error('  NO PASSWORD AVAILABLE? Use the dashboard instead — it needs no credentials here:');
  console.error('    node scripts/run-migration-029.mjs --emit-sql | pbcopy');
  console.error('    then paste into the Supabase SQL editor and Run.');
  console.error('    Full instructions: docs/security/APPLY-RUNBOOK.md');
  process.exit(1);
}

const conn = resolveConnection();
const restUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || '<SUPABASE_URL>';
const client = new Client(conn.config);

client.on('notice', n => {
  const msg = (n?.message || '').trim();
  if (msg) console.log(`  [db notice] ${msg}`);
});

// ───────────────────────────────────────────────────────────────────────────────
// Reporting
// ───────────────────────────────────────────────────────────────────────────────
async function helpersPresent() {
  const res = await client.query(
    `SELECT h AS sig, to_regprocedure(h) IS NOT NULL AS present
       FROM unnest($1::text[]) AS h`,
    [REQUIRED_HELPERS]
  );
  return res.rows;
}

async function policyRows() {
  const res = await client.query(
    `SELECT policyname, cmd, roles::text AS roles, qual, with_check
       FROM pg_policies
      WHERE schemaname = 'public' AND tablename = $1
      ORDER BY cmd, policyname`,
    [TABLE]
  );
  return res.rows;
}

async function report(label) {
  console.log(`\n──────── ${label} ────────`);

  const helpers = await helpersPresent();
  console.log('028 part 1 helpers:');
  for (const h of helpers) {
    console.log(`  ${h.present ? 'present' : 'MISSING'}  ${h.sig}`);
  }
  if (helpers.some(h => !h.present)) {
    console.log('  -> migration 028 PART 1 has not been applied. 029 will refuse to run.');
  }

  const rows = await policyRows();
  console.log(`\n${TABLE} policies:`);
  if (!rows.length) {
    console.log('  (none)');
  } else {
    for (const r of rows) {
      console.log(`  ${r.cmd.padEnd(6)} ${r.roles.padEnd(24)} ${r.policyname}`);
      if (r.qual) console.log(`      USING      ${r.qual.replace(/\s+/g, ' ')}`);
      if (r.with_check) console.log(`      WITH CHECK ${r.with_check.replace(/\s+/g, ' ')}`);
    }
  }

  // The specific hole this migration exists to close: read reach open to every role.
  const openReads = rows.filter(r => READ_CMDS.has(r.cmd) && r.qual === 'true' && isAnonRole(r.roles));
  console.log(
    openReads.length
      ? `\n  ANON CAN READ CONTACT PII — ${openReads.length} open SELECT policy/policies: ${openReads.map(r => `"${r.policyname}"`).join(', ')}`
      : '\n  no SELECT policy on directory_contacts is open to every role'
  );

  const rls = await client.query(
    `SELECT relrowsecurity FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname = $1`,
    [TABLE]
  );
  console.log(`rls enabled: ${TABLE}=${rls.rows[0]?.relrowsecurity}`);

  // Counts only. Never the rows — sender_email / sender_phone / message are the PII
  // this migration is closing, and they do not belong in a terminal scrollback.
  const vol = await client.query(
    `SELECT count(*)::int AS submissions,
            count(DISTINCT tenant_id)::int AS tenants,
            min(created_at) AS first_at,
            max(created_at) AS last_at
       FROM ${TABLE}`
  );
  const v = vol.rows[0];
  console.log(
    `exposure: ${v.submissions} submission(s) across ${v.tenants} tenant(s)` +
    (v.submissions ? `, ${new Date(v.first_at).toISOString().slice(0, 10)} .. ${new Date(v.last_at).toISOString().slice(0, 10)}` : '')
  );

  return rows;
}

// ───────────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────────
async function main() {
  await client.connect();
  console.log(`Connected: ${conn.label}  (credentials from ${conn.source})`);
  console.log(`Migration: migrations/${MIGRATION}  (no deferred half — all of it runs)`);

  await report('BEFORE');

  if (CHECK) {
    console.log('\n--check: read-only pre-flight complete. Nothing was changed.');
    console.log('To apply:  node --env-file=<env> scripts/run-migration-029.mjs --apply');
    console.log('No password? node scripts/run-migration-029.mjs --emit-sql | pbcopy  (dashboard path)');
    return;
  }

  const helpers = await helpersPresent();
  if (helpers.some(h => !h.present)) {
    console.error('\nREFUSING TO APPLY: migration 028 PART 1 must be applied first (it creates the');
    console.error('dir_* helper functions this migration references). Nothing was changed.');
    console.error('  node --env-file=<env> scripts/run-migration-028.mjs --apply');
    console.error('  or the no-credentials path: node scripts/run-migration-028.mjs --emit-sql | pbcopy');
    process.exitCode = 1;
    return;
  }

  console.log(`\nApplying ${sqlPath} ...`);
  // No try/catch: a failure must propagate, print, and exit nonzero. The file is
  // wrapped in BEGIN/COMMIT, so a failure leaves production untouched.
  await client.query(sql);
  console.log('Applied — transaction committed.');

  const after = await report('AFTER');

  // ── Post-conditions. 029 has no deferred half, so every one of these applies. ──
  const failures = [];
  const byName = new Map(after.map(r => [r.policyname, r]));

  for (const gone of ['service read contacts', 'public insert contacts']) {
    if (byName.has(gone)) failures.push(`policy directory_contacts."${gone}" should have been dropped and is still present`);
  }

  const insert = byName.get('contacts_public_insert');
  if (!insert) {
    failures.push('contacts_public_insert missing — the public contact form would start failing');
  } else if (insert.cmd !== 'INSERT') {
    failures.push(`contacts_public_insert has cmd=${insert.cmd}, expected INSERT`);
  }

  const select = byName.get('contacts_select_tenant_admin');
  if (!select) {
    failures.push('contacts_select_tenant_admin missing');
  } else if (select.cmd !== 'SELECT') {
    failures.push(`contacts_select_tenant_admin has cmd=${select.cmd}, expected SELECT`);
  } else if (select.qual === 'true') {
    failures.push('contacts_select_tenant_admin resolved to USING (true) — the hole is still open');
  }

  for (const r of after) {
    if (READ_CMDS.has(r.cmd) && isAnonRole(r.roles)) {
      failures.push(`directory_contacts."${r.policyname}" still grants ${r.cmd} to ${r.roles}`);
    }
  }

  const rls = await client.query(
    `SELECT relrowsecurity FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname = $1`,
    [TABLE]
  );
  if (!rls.rows[0]?.relrowsecurity) {
    failures.push('directory_contacts has RLS disabled');
  } else if (!after.length) {
    failures.push('directory_contacts has RLS enabled and ZERO policies');
  }

  if (failures.length) {
    console.error('\nPOST-CONDITION FAILURES:');
    for (const f of failures) console.error(`  - ${f}`);
    console.error('\nThe transaction COMMITTED before these ran — the database is in the state shown');
    console.error('under AFTER above. Read docs/security/APPLY-RUNBOOK.md, "If a step fails".');
    process.exitCode = 1;
    return;
  }

  console.log('\nMigration 029 applied and verified.');
  console.log('\nTHE PASS CONDITION IS AN HTTP PROBE, NOT THIS LISTING.');
  console.log('029 drops a policy BY NAME. A second permissive policy under a name nobody wrote');
  console.log('down would satisfy every check above and still leak. Prove it from outside:');
  console.log('');
  console.log(`  curl -si "${restUrl}/rest/v1/directory_contacts?select=id" \\`);
  console.log('    -H "apikey: $SUPABASE_ANON_KEY" -H "Prefer: count=exact" -H "Range: 0-0"');
  console.log('  PASS: HTTP 200 with [] (or 401). FAIL: 206 with a nonzero content-range and a row.');
  console.log('  ($SUPABASE_ANON_KEY = the PUBLIC anon key. Never the service key.)');
  console.log('');
  console.log('Then the write path, which is what would actually hurt if it broke: open any');
  console.log('company profile on os.spacerising.org LOGGED OUT, send a test contact, confirm the');
  console.log('success state renders, then re-run this script with --check and confirm the');
  console.log('submission count went up by one.');
  console.log('Full procedure: docs/security/APPLY-RUNBOOK.md');
}

let exitCode = 0;
try {
  await main();
  exitCode = process.exitCode ?? 0;
} catch (err) {
  if (APPLY) {
    console.error('\nMIGRATION FAILED — transaction rolled back, production unchanged.');
  } else {
    console.error('\nPRE-FLIGHT FAILED — nothing was attempted, production untouched.');
  }
  console.error(err?.message || err);
  if (err?.detail) console.error('detail:', err.detail);
  if (err?.hint) console.error('hint:', err.hint);
  if (err?.position) console.error('position:', err.position);
  if (/password authentication failed|no pg_hba|SASL|SCRAM/i.test(String(err?.message))) {
    console.error('');
    console.error('That is a credentials problem, not a migration problem. Check SUPABASE_DB_URL /');
    console.error('SUPABASE_DB_PASSWORD, or take the no-credentials path:');
    console.error('  node scripts/run-migration-029.mjs --emit-sql | pbcopy   -> paste into the Supabase SQL editor');
  }
  exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
process.exit(exitCode);
