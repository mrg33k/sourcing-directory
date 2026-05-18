/**
 * Apply migration 018_deal_bank.sql directly via pg client.
 * Usage: node scripts/run-migration-018.mjs
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env vars from .env.production if not already set
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  // Parse .env.production manually
  const envPath = join(__dirname, '..', '.env.production');
  let envContent = '';
  try { envContent = readFileSync(envPath, 'utf8'); } catch {}
  for (const line of envContent.split('\n')) {
    const m = line.match(/^SUPABASE_SERVICE_ROLE_KEY="?([^"]+)"?/);
    if (m) { process.env.SUPABASE_SERVICE_ROLE_KEY = m[1].trim(); break; }
  }
}

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not found.');
  process.exit(1);
}

const sql = readFileSync(join(__dirname, '..', 'migrations', '018_deal_bank.sql'), 'utf8');

const client = new Client({
  host: 'db.kzzvjtthknsozktmpvak.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: key,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL.');

  try {
    await client.query(sql);
    console.log('✅ Migration 018_deal_bank applied successfully.');
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log('ℹ️  Some objects already exist — migration likely already applied.');
    } else {
      console.error('Migration error:', err.message);
      process.exit(1);
    }
  }

  // Verify tables exist
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('deal_bank_listings', 'deal_bank_investors', 'deal_bank_completed_rounds')
    ORDER BY table_name;
  `);
  console.log('Tables found:', rows.map(r => r.table_name).join(', '));

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
