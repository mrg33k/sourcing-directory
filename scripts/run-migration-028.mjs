/**
 * Apply migration 028_security_and_missing_tables.sql to PRODUCTION.
 *
 * THREE MODES — exactly one per invocation:
 *
 *   --emit-sql[=<path>]   Print a copy-pasteable SQL file for the Supabase SQL editor.
 *                         Needs NO credentials and touches NOTHING. This is the primary
 *                         path when the database password is not on this machine.
 *                           node scripts/run-migration-028.mjs --emit-sql | pbcopy
 *                           node scripts/run-migration-028.mjs --emit-sql=/tmp/028.sql
 *
 *   --check               Read-only pre-flight against production. Changes nothing.
 *                           node --env-file=.env.prod.local scripts/run-migration-028.mjs --check
 *
 *   --apply               Applies the migration inside one transaction.
 *                           node --env-file=.env.prod.local scripts/run-migration-028.mjs --apply
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
 * PART 1 / PART 2
 *
 *   The file contains a Part 2 that is guarded off by a single literal
 *   (`run_part_2 boolean := false;`). This script PARSES that literal and asserts only
 *   the post-conditions that correspond to what actually ran. A correct Part-1-only
 *   apply now exits 0. (It used to assert Part 2's effects unconditionally and exit 1
 *   on a perfectly good apply — the "known false alarm". That is fixed here.)
 *
 * IT DOES NOT SWALLOW ERRORS. 025/027 catch anything containing "already exists" and
 * report success anyway. That is how 014 and 016 came to be believed-applied while
 * directory_reports never got the columns. Here, ANY failure prints and exits nonzero.
 * The migration is wrapped in BEGIN/COMMIT, so a failure rolls the whole thing back and
 * prod is left exactly as it was.
 *
 * READ docs/security/APPLY-RUNBOOK.md first. The pass condition is an HTTP probe with
 * the public anon key, not this script's policy listing.
 */
import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const MIGRATION = '028_security_and_missing_tables.sql';
const sqlPath = join(repoRoot, 'migrations', MIGRATION);
const sql = readFileSync(sqlPath, 'utf8');

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
  console.error('Read docs/security/APPLY-RUNBOOK.md first.');
  process.exit(1);
}

// ───────────────────────────────────────────────────────────────────────────────
// The Part 2 switch, read out of the SQL file itself.
// Every post-condition below keys off this. If the file's shape ever changes so this
// cannot be parsed, stop — asserting the wrong half is exactly the bug being fixed.
// ───────────────────────────────────────────────────────────────────────────────
const switchMatch = sql.match(/run_part_2\s+boolean\s*:=\s*(true|false)\s*;/i);
if (!switchMatch) {
  console.error(`ERROR: could not find the "run_part_2 boolean := <true|false>;" switch in`);
  console.error(`  ${sqlPath}`);
  console.error('Without it this script cannot tell which post-conditions apply. Fix the file or the regex.');
  process.exit(1);
}
const PART2_ENABLED = switchMatch[1].toLowerCase() === 'true';

// ───────────────────────────────────────────────────────────────────────────────
// Post-condition targets (Part 1)
// ───────────────────────────────────────────────────────────────────────────────
const TABLES = ['directory_members', 'directory_analytics', 'directory_reports', 'directory_companies'];

const REQUIRED_REPORT_COLUMNS = [
  'is_premium', 'updated_at', 'updated_by', 'created_by', 'created_at', 'cover_image_url',
];

const REQUIRED_HELPERS = [
  'public.dir_is_global_admin()',
  'public.dir_is_tenant_admin(uuid)',
  'public.dir_is_tenant_member(uuid)',
  'public.dir_may_claim_company(uuid, uuid)',
];

// Part 1 §2 §3 §4: what must be gone, and what must exist with which command.
const PART1_DROPPED = {
  directory_members:   ['service role all', 'signup insert members', 'members read own'],
  directory_analytics: ['service read analytics', 'public insert analytics'],
  directory_companies: ['admins update companies'],
};
const PART1_EXPECTED = {
  directory_members: {
    members_select_own:          'SELECT',
    members_select_tenant_admin: 'SELECT',
    members_insert_self:         'INSERT',
    members_update_tenant_admin: 'UPDATE',
    members_delete_tenant_admin: 'DELETE',
  },
  directory_analytics: {
    analytics_public_insert:       'INSERT',
    analytics_select_tenant_admin: 'SELECT',
  },
  directory_companies: {
    companies_update_admin: 'UPDATE',
  },
};

// Part 2 §5 — asserted ONLY when Part 2 actually ran.
const PART2_DROPPED = {
  directory_reports: ['service full access reports', 'public read free reports', 'public read public reports'],
};
const PART2_EXPECTED = {
  directory_reports: {
    reports_public_read: 'SELECT',
    reports_member_read: 'SELECT',
  },
};

// Policies that are deliberately open to anon and must NOT be flagged: anonymous
// event/contact writes. Only READ reach (SELECT / ALL) open to anon is a failure.
const READ_CMDS = new Set(['SELECT', 'ALL']);
const isAnonRole = roles => /(^|[,{])\s*(public|anon)\s*($|[,}])/.test(roles);

// ───────────────────────────────────────────────────────────────────────────────
// MODE 1 — emit SQL for the Supabase dashboard editor. No credentials, no network.
// ───────────────────────────────────────────────────────────────────────────────
const VERIFY_SQL = `
-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFY — runs after COMMIT, changes nothing. The SQL editor shows this table.
-- Every row must read "expect N" and show N. Anything else: STOP and read
-- docs/security/APPLY-RUNBOOK.md, section "If a step fails".
-- NOTE: this is a policy inventory, not the pass condition. The pass condition is the
-- anon-key HTTP probe in the runbook — a fourth permissive policy under a name nobody
-- wrote down would satisfy every row below and still leak.
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT ord, check_name, result FROM (
  SELECT 1 AS ord, '§0 helper functions (expect 4)' AS check_name,
    (SELECT count(*)::text FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('dir_is_global_admin','dir_is_tenant_admin','dir_is_tenant_member','dir_may_claim_company')) AS result
  UNION ALL SELECT 2, '§1 directory_reports new columns (expect 6)',
    (SELECT count(*)::text FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'directory_reports'
        AND column_name IN ('is_premium','updated_at','updated_by','created_by','created_at','cover_image_url'))
  UNION ALL SELECT 3, '§2 directory_members legacy open policies (expect 0)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_members'
        AND policyname IN ('service role all','signup insert members','members read own'))
  UNION ALL SELECT 4, '§2 directory_members scoped policies (expect 5)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_members'
        AND policyname IN ('members_select_own','members_select_tenant_admin','members_insert_self','members_update_tenant_admin','members_delete_tenant_admin'))
  UNION ALL SELECT 5, '§2 directory_members policies reachable by anon (expect 0)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_members'
        AND roles::text[] && ARRAY['public','anon'])
  UNION ALL SELECT 6, '§3 directory_analytics "service read analytics" (expect 0)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_analytics'
        AND policyname IN ('service read analytics','public insert analytics'))
  UNION ALL SELECT 7, '§3 directory_analytics scoped policies (expect 2)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_analytics'
        AND policyname IN ('analytics_public_insert','analytics_select_tenant_admin'))
  UNION ALL SELECT 8, '§3 directory_analytics anon READ policies (expect 0)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_analytics'
        AND cmd IN ('SELECT','ALL') AND roles::text[] && ARRAY['public','anon'])
  UNION ALL SELECT 9, '§4 directory_companies "admins update companies" (expect 0)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_companies'
        AND policyname = 'admins update companies')
  UNION ALL SELECT 10, '§4 directory_companies companies_update_admin (expect 1)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_companies'
        AND policyname = 'companies_update_admin' AND cmd = 'UPDATE')
  UNION ALL SELECT 11, 'RLS enabled on members/analytics/companies/reports (expect 4)',
    (SELECT count(*)::text FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relrowsecurity
        AND relname IN ('directory_members','directory_analytics','directory_companies','directory_reports'))
  UNION ALL SELECT 12, 'PART 2 marker — "service full access reports" (0 = Part 2 ran, 1 = Part 2 still deferred)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND tablename='directory_reports'
        AND policyname = 'service full access reports')
) t ORDER BY ord;
`;

function emitSql() {
  const header = `-- ═══════════════════════════════════════════════════════════════════════════════
--  MIGRATION 028 — PASTE THIS WHOLE FILE INTO THE SUPABASE SQL EDITOR
--
--  Generated from migrations/${MIGRATION} by scripts/run-migration-028.mjs --emit-sql
--  The SQL between BEGIN and COMMIT below is byte-identical to that file. Nothing was
--  rewritten, reordered or summarised. Only this header and the VERIFY query at the
--  bottom were added, and the VERIFY query runs after COMMIT and changes nothing.
--
--  WHERE:  Supabase dashboard -> your project -> SQL Editor -> New query -> paste -> Run
--  WHO:    the editor runs as the 'postgres' role, which is what this needs.
--  NEEDS:  no local credentials, no database password, no CLI.
--
--  WHAT IT DOES: PART ${PART2_ENABLED ? '1 AND PART 2' : '1 ONLY'}.
${PART2_ENABLED
  ? `--    The run_part_2 switch in the source file is set to TRUE, so §5 WILL run and
--    directory_reports visibility WILL change for logged-out visitors on
--    os.spacerising.org. Do not run this unless the seven report pages have already
--    been repointed at GET /api/sourcing/reports.`
  : `--    The run_part_2 switch in the source file is FALSE, so §5 is skipped. Part 1 is
--    security-only: no visible change for any visitor, member or admin.
--    directory_reports read policies are NOT touched — that leak stays open on
--    purpose until the frontend hand-off lands.`}
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
    console.error(`Part 2 switch in the source file: ${PART2_ENABLED ? 'TRUE (Part 2 WILL run)' : 'false (Part 1 only)'}`);
    console.error('Open it, select all, paste into the Supabase SQL editor, Run.');
  } else {
    // SQL to stdout so `--emit-sql | pbcopy` gives a clean clipboard. Notes to stderr.
    process.stdout.write(out);
    console.error(`\n[${relative(repoRoot, sqlPath)} -> stdout, ${Buffer.byteLength(out, 'utf8')} bytes]`);
    console.error(`[Part 2 switch: ${PART2_ENABLED ? 'TRUE — Part 2 WILL run' : 'false — Part 1 only'}]`);
    console.error('[Tip: node scripts/run-migration-028.mjs --emit-sql | pbcopy]');
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
  console.error('  Example (do not paste a password into shell history — use an env file):');
  console.error('    SUPABASE_DB_URL=... node scripts/run-migration-028.mjs --check');
  console.error('');
  console.error('  NO PASSWORD AVAILABLE? Use the dashboard instead — it needs no credentials here:');
  console.error('    node scripts/run-migration-028.mjs --emit-sql | pbcopy');
  console.error('    then paste into the Supabase SQL editor and Run.');
  console.error('    Full instructions: docs/security/APPLY-RUNBOOK.md');
  process.exit(1);
}

const conn = resolveConnection();
const restUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || '<SUPABASE_URL>';
const client = new Client(conn.config);

// Surface the migration's RAISE NOTICE output — that is where the file announces
// whether Part 2 ran or was skipped, and it was being thrown away.
const notices = [];
client.on('notice', n => {
  const msg = (n?.message || '').trim();
  if (!msg) return;
  notices.push(msg);
  console.log(`  [db notice] ${msg}`);
});

// ───────────────────────────────────────────────────────────────────────────────
// Reporting
// ───────────────────────────────────────────────────────────────────────────────
async function policyRows() {
  const res = await client.query(
    `SELECT tablename, policyname, cmd, roles::text AS roles, qual, with_check
       FROM pg_policies
      WHERE schemaname = 'public' AND tablename = ANY($1)
      ORDER BY tablename, cmd, policyname`,
    [TABLES]
  );
  return res.rows;
}

async function helperPresence() {
  const res = await client.query(
    `SELECT h AS sig, to_regprocedure(h) IS NOT NULL AS present FROM unnest($1::text[]) AS h`,
    [REQUIRED_HELPERS]
  );
  return res.rows;
}

async function report(label) {
  console.log(`\n──────── ${label} ────────`);

  const helpers = await helperPresence();
  console.log('§0 helper functions:');
  for (const h of helpers) console.log(`  ${h.present ? 'present' : 'MISSING'}  ${h.sig}`);

  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'directory_reports'
      ORDER BY ordinal_position`
  );
  const have = cols.rows.map(r => r.column_name);
  const missing = REQUIRED_REPORT_COLUMNS.filter(c => !have.includes(c));
  console.log('\n§1 directory_reports columns:', have.join(', '));
  console.log(
    missing.length
      ? `  MISSING (api/sourcing/admin-reports.js will 500): ${missing.join(', ')}`
      : '  all columns required by api/sourcing/admin-reports.js are present'
  );

  const rows = await policyRows();
  console.log('\npolicies:');
  if (!rows.length) {
    console.log('  (none)');
  } else {
    for (const r of rows) {
      console.log(`  ${r.tablename.padEnd(22)} ${r.cmd.padEnd(6)} ${r.roles.padEnd(24)} ${r.policyname}`);
      if (r.qual) console.log(`      USING      ${r.qual.replace(/\s+/g, ' ')}`);
      if (r.with_check) console.log(`      WITH CHECK ${r.with_check.replace(/\s+/g, ' ')}`);
    }
  }

  // The shape that actually leaks: READ reach open to every role.
  const openReads = rows.filter(r => READ_CMDS.has(r.cmd) && r.qual === 'true' && isAnonRole(r.roles));
  console.log(
    openReads.length
      ? `\n  ANON CAN READ — ${openReads.length} open policy/policies: ${openReads.map(r => `${r.tablename}."${r.policyname}"`).join(', ')}`
      : '\n  no USING(true) read policy is granted to anon on these tables'
  );

  const rls = await client.query(
    `SELECT relname, relrowsecurity FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1)
      ORDER BY relname`,
    [TABLES]
  );
  console.log('rls enabled:', rls.rows.map(r => `${r.relname}=${r.relrowsecurity}`).join('  '));

  return rows;
}

function probeInstructions() {
  console.log('\nTHE PASS CONDITION IS AN HTTP PROBE, NOT THIS LISTING.');
  console.log('028 drops policies BY NAME. A fourth permissive policy under a name nobody wrote');
  console.log('down would satisfy every check above and still leak. Prove it from outside:');
  console.log('');
  console.log(`  curl -si "${restUrl}/rest/v1/directory_members?select=id" \\`);
  console.log('    -H "apikey: $SUPABASE_ANON_KEY" -H "Prefer: count=exact" -H "Range: 0-0"');
  console.log('  PASS: HTTP 200 with [] (or 401). FAIL: 206 with content-range 0-0/70 and a row.');
  console.log('');
  console.log(`  curl -s "${restUrl}/rest/v1/directory_analytics?select=event_type&limit=3" \\`);
  console.log('    -H "apikey: $SUPABASE_ANON_KEY"');
  console.log('  PASS: []. FAIL: real event rows.');
  console.log('');
  console.log('  ($SUPABASE_ANON_KEY = the PUBLIC anon key. Never the service key.)');
  console.log('  Full procedure: docs/security/APPLY-RUNBOOK.md');
}

// ───────────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────────
async function main() {
  await client.connect();
  console.log(`Connected: ${conn.label}  (credentials from ${conn.source})`);
  console.log(`Migration: migrations/${MIGRATION}`);
  console.log(`Part 2 switch in that file: ${PART2_ENABLED ? 'TRUE — PART 2 WILL RUN (visible product change)' : 'false — Part 1 only, no visible product change'}`);

  const before = await report('BEFORE');

  if (CHECK) {
    console.log('\n--check: read-only pre-flight complete. Nothing was changed.');
    console.log('To apply:  node --env-file=<env> scripts/run-migration-028.mjs --apply');
    console.log('No password? node scripts/run-migration-028.mjs --emit-sql | pbcopy  (dashboard path)');
    return;
  }

  console.log(`\nApplying ${sqlPath} ...`);
  // No try/catch: a failure must propagate, print, and exit nonzero. The file is
  // wrapped in BEGIN/COMMIT, so a failure leaves production untouched.
  await client.query(sql);
  console.log('Applied — transaction committed.');

  const after = await report('AFTER');

  // ── Post-conditions. These assert what ACTUALLY RAN, and nothing else. ────────
  const failures = [];
  const byTable = t => after.filter(r => r.tablename === t);
  const named = (t, n) => byTable(t).find(r => r.policyname === n);

  // Did Part 2 run? The file's own notices are the ground truth; the parsed switch is
  // the expectation. If they disagree, something is wrong with this script's model of
  // the file and no post-condition set can be trusted.
  const sawApplied = notices.some(m => /PART 2 APPLIED/i.test(m));
  const sawSkipped = notices.some(m => /PART 2 SKIPPED/i.test(m));
  if (sawApplied && !PART2_ENABLED) {
    failures.push('the database says PART 2 APPLIED but the parsed run_part_2 switch is false — post-conditions cannot be trusted');
  }
  if (sawSkipped && PART2_ENABLED) {
    failures.push('the database says PART 2 SKIPPED but the parsed run_part_2 switch is true — post-conditions cannot be trusted');
  }
  const part2Ran = sawApplied || (PART2_ENABLED && !sawSkipped);

  // ── PART 1, always ──
  for (const h of await helperPresence()) {
    if (!h.present) failures.push(`§0 helper ${h.sig} was not created`);
  }

  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'directory_reports'`
  );
  const have = cols.rows.map(r => r.column_name);
  for (const c of REQUIRED_REPORT_COLUMNS) {
    if (!have.includes(c)) failures.push(`§1 directory_reports.${c} still missing`);
  }

  for (const [table, names] of Object.entries(PART1_DROPPED)) {
    for (const n of names) {
      if (named(table, n)) failures.push(`policy ${table}."${n}" should have been dropped and is still present`);
    }
  }
  for (const [table, expected] of Object.entries(PART1_EXPECTED)) {
    for (const [n, cmd] of Object.entries(expected)) {
      const p = named(table, n);
      if (!p) failures.push(`policy ${table}."${n}" was not created`);
      else if (p.cmd !== cmd) failures.push(`policy ${table}."${n}" has cmd=${p.cmd}, expected ${cmd}`);
    }
  }

  // §2: after Part 1 nothing on directory_members is reachable by anon at all.
  for (const r of byTable('directory_members')) {
    if (isAnonRole(r.roles)) {
      failures.push(`directory_members."${r.policyname}" is still granted to ${r.roles} — Part 1 leaves this table authenticated-only`);
    }
  }
  // §3: anon INSERT on analytics is deliberate; anon READ is the hole.
  for (const r of byTable('directory_analytics')) {
    if (READ_CMDS.has(r.cmd) && isAnonRole(r.roles)) {
      failures.push(`directory_analytics."${r.policyname}" still grants ${r.cmd} to ${r.roles}`);
    }
  }
  // §4: the point of superseding 017 is that the predicate is no longer a no-op.
  const companiesUpdate = named('directory_companies', 'companies_update_admin');
  if (companiesUpdate && companiesUpdate.qual === 'true') {
    failures.push('directory_companies."companies_update_admin" resolved to USING (true)');
  }

  const rlsRows = await client.query(
    `SELECT c.relname FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relname = ANY($1)
        AND c.relrowsecurity
        AND NOT EXISTS (
          SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname
        )`,
    [TABLES]
  );
  for (const r of rlsRows.rows) failures.push(`${r.relname} has RLS enabled and ZERO policies`);

  // ── PART 2, only if it ran ──
  if (part2Ran) {
    for (const [table, names] of Object.entries(PART2_DROPPED)) {
      for (const n of names) {
        if (named(table, n)) failures.push(`PART 2: policy ${table}."${n}" should have been dropped and is still present`);
      }
    }
    for (const [table, expected] of Object.entries(PART2_EXPECTED)) {
      for (const [n, cmd] of Object.entries(expected)) {
        const p = named(table, n);
        if (!p) failures.push(`PART 2: policy ${table}."${n}" was not created`);
        else if (p.cmd !== cmd) failures.push(`PART 2: policy ${table}."${n}" has cmd=${p.cmd}, expected ${cmd}`);
      }
    }
    for (const r of byTable('directory_reports')) {
      if (READ_CMDS.has(r.cmd) && r.qual === 'true' && isAnonRole(r.roles)) {
        failures.push(`PART 2: directory_reports."${r.policyname}" still grants unrestricted read to ${r.roles}`);
      }
    }
  } else {
    // Part 2 did not run. The correct assertion is the INVERSE: directory_reports must
    // be exactly as we found it. Asserting Part 2's effects here is the false alarm this
    // script used to raise on a perfectly good Part-1-only apply.
    const sig = rs => rs.filter(r => r.tablename === 'directory_reports')
      .map(r => `${r.cmd}|${r.roles}|${r.policyname}|${r.qual}|${r.with_check}`).sort().join('\n');
    if (sig(before) !== sig(after)) {
      failures.push('Part 2 did not run, yet directory_reports policies changed. Something outside this file touched them.');
    }
  }

  if (failures.length) {
    console.error('\nPOST-CONDITION FAILURES:');
    for (const f of failures) console.error(`  - ${f}`);
    console.error('\nThe transaction COMMITTED before these ran — the database is in the state shown');
    console.error('under AFTER above. Read docs/security/APPLY-RUNBOOK.md, "If a step fails".');
    process.exitCode = 1;
    return;
  }

  console.log(`\nMigration 028 applied and verified — PART ${part2Ran ? '1 + PART 2' : '1 ONLY'}.`);
  if (!part2Ran) {
    console.log('');
    console.log('PART 2 was deliberately skipped, and this is NOT a failure:');
    console.log('  directory_reports read policies are UNCHANGED. "service full access reports" is');
    console.log('  still in place, so anonymous callers can still read every report row including');
    console.log('  paid ones. That leak stays open until the seven report pages are repointed at');
    console.log('  GET /api/sourcing/reports. See docs/security/APPLY-RUNBOOK.md, "What remains open".');
  }
  probeInstructions();
  console.log('\nThen: smoke-test the admin Reports tab and confirm a logged-out visit to');
  console.log('os.spacerising.org still renders the directory and the reports listings.');
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
    console.error('  node scripts/run-migration-028.mjs --emit-sql | pbcopy   -> paste into the Supabase SQL editor');
  }
  exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
process.exit(exitCode);
