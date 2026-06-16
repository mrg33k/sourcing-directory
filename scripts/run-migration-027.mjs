/**
 * Apply migration 027_directory_tags.sql to PRODUCTION via direct pg connection.
 * Usage: node --env-file=.env.prod.local scripts/run-migration-027.mjs
 *
 * Mirrors run-migration-025.mjs. Never prints the service key.
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const url = process.env.SUPABASE_URL?.trim();
if (!key || !url) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL not found. Run with --env-file=.env.prod.local');
  process.exit(1);
}

const ref = new URL(url).hostname.split('.')[0];
const host = `db.${ref}.supabase.co`;

const sql = readFileSync(join(__dirname, '..', 'migrations', '027_directory_tags.sql'), 'utf8');

const client = new Client({ host, port: 5432, database: 'postgres', user: 'postgres', password: key, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL.');
  try {
    await client.query(sql);
    console.log('✅ Migration 027_directory_tags applied successfully.');
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log('ℹ️  Some objects already exist — migration likely already applied.');
    } else {
      console.error('Migration error:', err.message);
      process.exit(1);
    }
  }
  const { rows } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'directory_tags'
    ORDER BY ordinal_position;
  `);
  console.log('directory_tags columns:', rows.map(r => r.column_name).join(', '));
  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
