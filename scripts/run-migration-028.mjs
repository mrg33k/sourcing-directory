/**
 * Apply migration 028_security_and_missing_tables.sql to PRODUCTION via direct pg connection.
 *
 * Usage:
 *   node --env-file=.env.prod.local scripts/run-migration-028.mjs --check    # read-only pre-flight, changes nothing
 *   node --env-file=.env.prod.local scripts/run-migration-028.mjs --apply    # applies the migration
 *
 * Mirrors run-migration-027.mjs, with two deliberate differences:
 *
 *   1. IT DOES NOT SWALLOW ERRORS. 025/027 catch anything containing "already exists"
 *      and report success anyway. That is how 014 and 016 came to be believed-applied
 *      while directory_reports never got the columns. Here, ANY failure prints and
 *      exits nonzero. The migration is wrapped in BEGIN/COMMIT, so a failure rolls the
 *      whole thing back and prod is left exactly as it was.
 *
 *   2. It requires an explicit --apply flag. Read
 *      docs/security/028-impact-analysis.md first — section 4B of the migration is a
 *      visible product change on os.spacerising.org.
 *
 * Never prints the service key.
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const CHECK = args.includes('--check') || !APPLY;

if (!APPLY && !args.includes('--check')) {
  console.error('Refusing to guess. Pass --check for a read-only pre-flight, or --apply to run the migration.');
  console.error('Read docs/security/028-impact-analysis.md before --apply.');
  process.exit(1);
}

const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const url = process.env.SUPABASE_URL?.trim();
if (!key || !url) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL not found. Run with --env-file=.env.prod.local');
  process.exit(1);
}

const ref = new URL(url).hostname.split('.')[0];
const host = `db.${ref}.supabase.co`;

const sqlPath = join(__dirname, '..', 'migrations', '028_security_and_missing_tables.sql');
const sql = readFileSync(sqlPath, 'utf8');

const client = new Client({
  host,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: key,
  ssl: { rejectUnauthorized: false },
});

const TABLES = ['directory_members', 'directory_analytics', 'directory_reports'];

const REQUIRED_REPORT_COLUMNS = [
  'is_premium',
  'updated_at',
  'updated_by',
  'created_by',
  'created_at',
  'cover_image_url',
];

async function report(label) {
  console.log(`\n──────── ${label} ────────`);

  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'directory_reports'
      ORDER BY ordinal_position`
  );
  const have = cols.rows.map(r => r.column_name);
  const missing = REQUIRED_REPORT_COLUMNS.filter(c => !have.includes(c));
  console.log('directory_reports columns:', have.join(', '));
  console.log(
    missing.length
      ? `  MISSING (api/sourcing/admin-reports.js will 500): ${missing.join(', ')}`
      : '  all columns required by api/sourcing/admin-reports.js are present'
  );

  const pol = await client.query(
    `SELECT tablename, policyname, cmd, roles::text AS roles, qual, with_check
       FROM pg_policies
      WHERE schemaname = 'public' AND tablename = ANY($1)
      ORDER BY tablename, cmd, policyname`,
    [TABLES]
  );
  console.log('\npolicies:');
  if (!pol.rows.length) {
    console.log('  (none)');
  } else {
    for (const r of pol.rows) {
      console.log(`  ${r.tablename.padEnd(22)} ${r.cmd.padEnd(6)} ${r.roles.padEnd(24)} ${r.policyname}`);
      if (r.qual) console.log(`      USING      ${r.qual.replace(/\s+/g, ' ')}`);
      if (r.with_check) console.log(`      WITH CHECK ${r.with_check.replace(/\s+/g, ' ')}`);
    }
  }

  // The specific holes this migration exists to close.
  const open = pol.rows.filter(
    r => (r.qual === 'true' || r.with_check === 'true') && r.roles.includes('public')
  );
  console.log(
    open.length
      ? `\n  ${open.length} policy/policies still open to every role: ${open.map(r => `${r.tablename}."${r.policyname}"`).join(', ')}`
      : '\n  no USING(true)/WITH CHECK(true) policies granted to every role'
  );

  const rls = await client.query(
    `SELECT relname, relrowsecurity FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1)
      ORDER BY relname`,
    [TABLES]
  );
  console.log('\nrls enabled:', rls.rows.map(r => `${r.relname}=${r.relrowsecurity}`).join('  '));
}

async function main() {
  await client.connect();
  console.log(`Connected to ${host} (project ${ref}).`);

  await report('BEFORE');

  if (CHECK) {
    console.log('\n--check: read-only pre-flight complete. Nothing was changed.');
    console.log('To apply: node --env-file=.env.prod.local scripts/run-migration-028.mjs --apply');
    return;
  }

  console.log(`\nApplying ${sqlPath} ...`);
  // No try/catch: a failure must propagate, print, and exit nonzero. The file is
  // wrapped in BEGIN/COMMIT, so a failure leaves production untouched.
  const res = await client.query(sql);
  const notices = Array.isArray(res) ? res.length : 1;
  console.log(`Applied. ${notices} statement group(s) executed, transaction committed.`);

  await report('AFTER');

  // Hard post-conditions. If any of these fail the migration did not do its job,
  // and this script must not report success.
  const failures = [];

  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'directory_reports'`
  );
  const have = cols.rows.map(r => r.column_name);
  for (const c of REQUIRED_REPORT_COLUMNS) {
    if (!have.includes(c)) failures.push(`directory_reports.${c} still missing`);
  }

  const stillOpen = await client.query(
    `SELECT tablename, policyname FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY($1)
        AND policyname IN (
          'service role all', 'signup insert members',
          'service read analytics', 'service full access reports',
          'public read free reports'
        )`,
    [TABLES]
  );
  for (const r of stillOpen.rows) {
    failures.push(`policy ${r.tablename}."${r.policyname}" still present`);
  }

  const noPolicy = await client.query(
    `SELECT c.relname FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relname = ANY($1)
        AND c.relrowsecurity
        AND NOT EXISTS (
          SELECT 1 FROM pg_policies p
           WHERE p.schemaname = 'public' AND p.tablename = c.relname
        )`,
    [TABLES]
  );
  for (const r of noPolicy.rows) {
    failures.push(`${r.relname} has RLS enabled and ZERO policies`);
  }

  if (failures.length) {
    console.error('\nPOST-CONDITION FAILURES:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nMigration 028 applied and verified.');
  console.log('Next: smoke-test GET /api/sourcing/admin-reports?id=<id> and confirm the');
  console.log('reports listings on os.spacerising.org still render as expected.');
}

let exitCode = 0;
try {
  await main();
  exitCode = process.exitCode ?? 0;
} catch (err) {
  console.error('\nMIGRATION FAILED — transaction rolled back, production unchanged.');
  console.error(err?.message || err);
  if (err?.detail) console.error('detail:', err.detail);
  if (err?.hint) console.error('hint:', err.hint);
  if (err?.position) console.error('position:', err.position);
  exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
process.exit(exitCode);
