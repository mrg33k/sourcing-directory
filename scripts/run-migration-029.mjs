/**
 * Apply migration 029_contacts_rls.sql to PRODUCTION via direct pg connection.
 *
 * Usage:
 *   node --env-file=.env.prod.local scripts/run-migration-029.mjs --check    # read-only pre-flight, changes nothing
 *   node --env-file=.env.prod.local scripts/run-migration-029.mjs --apply    # applies the migration
 *
 * Mirrors run-migration-028.mjs, including its two deliberate departures from
 * 025/027:
 *
 *   1. IT DOES NOT SWALLOW ERRORS. 025/027 catch anything containing "already exists"
 *      and report success anyway. That is how 014 and 016 came to be believed-applied
 *      while directory_reports never got the columns. Here, ANY failure prints and
 *      exits nonzero. The migration is wrapped in BEGIN/COMMIT, so a failure rolls the
 *      whole thing back and prod is left exactly as it was.
 *
 *   2. It requires an explicit --apply flag.
 *
 * ORDERING: 029 requires migration 028 PART 1 to be applied first — it uses the
 * dir_is_tenant_admin() / dir_is_global_admin() helpers created in 028 section 0. The
 * --check pre-flight reports whether those helpers exist, and the migration itself
 * raises and rolls back if they do not.
 *
 * UNLIKE 028: this migration has no deferred half. Everything in 029 runs, and none of
 * it changes anything a user sees. The only anon-key toucher of directory_contacts is
 * an INSERT (the public contact form), which is preserved.
 *
 * Never prints the service key, and never prints contact rows — submission PII is
 * exactly what this migration exists to stop leaking, so this script reports counts only.
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

const sqlPath = join(__dirname, '..', 'migrations', '029_contacts_rls.sql');
const sql = readFileSync(sqlPath, 'utf8');

const client = new Client({
  host,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: key,
  ssl: { rejectUnauthorized: false },
});

const TABLE = 'directory_contacts';

const REQUIRED_HELPERS = [
  'public.dir_is_tenant_admin(uuid)',
  'public.dir_is_global_admin()',
];

async function helpersPresent() {
  const res = await client.query(
    `SELECT h AS sig, to_regprocedure(h) IS NOT NULL AS present
       FROM unnest($1::text[]) AS h`,
    [REQUIRED_HELPERS]
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

  const pol = await client.query(
    `SELECT policyname, cmd, roles::text AS roles, qual, with_check
       FROM pg_policies
      WHERE schemaname = 'public' AND tablename = $1
      ORDER BY cmd, policyname`,
    [TABLE]
  );
  console.log(`\n${TABLE} policies:`);
  if (!pol.rows.length) {
    console.log('  (none)');
  } else {
    for (const r of pol.rows) {
      console.log(`  ${r.cmd.padEnd(6)} ${r.roles.padEnd(24)} ${r.policyname}`);
      if (r.qual) console.log(`      USING      ${r.qual.replace(/\s+/g, ' ')}`);
      if (r.with_check) console.log(`      WITH CHECK ${r.with_check.replace(/\s+/g, ' ')}`);
    }
  }

  // The specific hole this migration exists to close: a SELECT open to every role.
  const openReads = pol.rows.filter(
    r => (r.cmd === 'SELECT' || r.cmd === 'ALL') && r.qual === 'true' && r.roles.includes('public')
  );
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
}

async function main() {
  await client.connect();
  console.log(`Connected to ${host} (project ${ref}).`);

  await report('BEFORE');

  if (CHECK) {
    console.log('\n--check: read-only pre-flight complete. Nothing was changed.');
    console.log('To apply: node --env-file=.env.prod.local scripts/run-migration-029.mjs --apply');
    return;
  }

  const helpers = await helpersPresent();
  if (helpers.some(h => !h.present)) {
    console.error('\nREFUSING TO APPLY: migration 028 PART 1 must be applied first (it creates the');
    console.error('dir_* helper functions this migration references). Nothing was changed.');
    console.error('  node --env-file=.env.prod.local scripts/run-migration-028.mjs --apply');
    process.exitCode = 1;
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

  const pol = await client.query(
    `SELECT policyname, cmd, roles::text AS roles, qual
       FROM pg_policies
      WHERE schemaname = 'public' AND tablename = $1`,
    [TABLE]
  );
  const byName = new Map(pol.rows.map(r => [r.policyname, r]));

  if (byName.has('service read contacts')) {
    failures.push('policy directory_contacts."service read contacts" still present');
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

  for (const r of pol.rows) {
    if ((r.cmd === 'SELECT' || r.cmd === 'ALL') && r.qual === 'true' && r.roles.includes('public')) {
      failures.push(`directory_contacts."${r.policyname}" still grants unrestricted SELECT to every role`);
    }
  }

  const rls = await client.query(
    `SELECT relrowsecurity FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname = $1`,
    [TABLE]
  );
  if (!rls.rows[0]?.relrowsecurity) {
    failures.push('directory_contacts has RLS disabled');
  } else if (!pol.rows.length) {
    failures.push('directory_contacts has RLS enabled and ZERO policies');
  }

  if (failures.length) {
    console.error('\nPOST-CONDITION FAILURES:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nMigration 029 applied and verified.');
  console.log('Next, confirm the two things that matter:');
  console.log('  1. Anon read is closed. Expect [] :');
  console.log(`     curl -s "${url}/rest/v1/directory_contacts?select=sender_email&limit=1" -H "apikey: $VITE_SUPABASE_ANON_KEY"`);
  console.log('  2. The public contact form still submits. Open any company profile on');
  console.log('     os.spacerising.org logged out, send a test contact, then re-run this');
  console.log('     script with --check and confirm the submission count went up by one.');
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
