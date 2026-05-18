/**
 * Apply migration 018_deal_bank.sql via Supabase Management API.
 * Usage: node scripts/apply-migration-018.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF env vars before running.
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || 'kzzvjtthknsozktmpvak';
if (!ACCESS_TOKEN) { console.error('Set SUPABASE_ACCESS_TOKEN env var'); process.exit(1); }
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function runSQL(sql, label) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (!res.ok || (Array.isArray(body) && body[0]?.error)) {
    const msg = body[0]?.message || body.message || JSON.stringify(body);
    if (msg.includes('already exists') || msg.includes('does not exist')) {
      console.log(`  ℹ️  ${label}: already applied (${msg.split('\n')[0].slice(0, 80)})`);
      return;
    }
    throw new Error(`${label}: ${msg}`);
  }
  console.log(`  ✅ ${label}: ok`);
}

// Execute each statement block individually for better error handling
const statements = [
  {
    label: 'Create deal_bank_listings table',
    sql: `
      CREATE TABLE IF NOT EXISTS deal_bank_listings (
        id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id       uuid        NOT NULL REFERENCES directory_companies(id) ON DELETE CASCADE,
        deck_url         text,
        exec_summary     text,
        leadership       jsonb       DEFAULT '[]'::jsonb,
        capital_sought   text,
        round_stage      text,
        revenue_y1       numeric,
        revenue_y2       numeric,
        revenue_y3       numeric,
        status           text        NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending','approved','rejected','withdrawn')),
        submitted_at     timestamptz DEFAULT now(),
        reviewed_at      timestamptz,
        reviewed_by      text,
        created_at       timestamptz DEFAULT now(),
        updated_at       timestamptz DEFAULT now()
      );
    `,
  },
  {
    label: 'Index: deal_bank_listings company',
    sql: `CREATE INDEX IF NOT EXISTS idx_db_listings_company ON deal_bank_listings(company_id);`,
  },
  {
    label: 'Index: deal_bank_listings status',
    sql: `CREATE INDEX IF NOT EXISTS idx_db_listings_status ON deal_bank_listings(status);`,
  },
  {
    label: 'Enable RLS: deal_bank_listings',
    sql: `ALTER TABLE deal_bank_listings ENABLE ROW LEVEL SECURITY;`,
  },
  {
    label: 'RLS policy: public read approved listings',
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies
                       WHERE tablename = 'deal_bank_listings'
                         AND policyname = 'public read approved listings') THEN
          CREATE POLICY "public read approved listings"
            ON deal_bank_listings FOR SELECT
            USING (status = 'approved');
        END IF;
      END $$;
    `,
  },
  {
    label: 'Create deal_bank_investors table',
    sql: `
      CREATE TABLE IF NOT EXISTS deal_bank_investors (
        id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        firm_name              text        NOT NULL,
        website                text,
        criteria               text,
        check_size_min         numeric,
        check_size_max         numeric,
        deal_types             text[],
        deals_last_18mo        integer,
        linkedin_url           text,
        contact_email_internal text,
        status                 text        NOT NULL DEFAULT 'pending'
                                           CHECK (status IN ('pending','approved','rejected','withdrawn')),
        submitted_at           timestamptz DEFAULT now(),
        reviewed_at            timestamptz,
        reviewed_by            text,
        created_at             timestamptz DEFAULT now(),
        updated_at             timestamptz DEFAULT now()
      );
    `,
  },
  {
    label: 'Index: deal_bank_investors status',
    sql: `CREATE INDEX IF NOT EXISTS idx_db_investors_status ON deal_bank_investors(status);`,
  },
  {
    label: 'Enable RLS: deal_bank_investors',
    sql: `ALTER TABLE deal_bank_investors ENABLE ROW LEVEL SECURITY;`,
  },
  {
    label: 'RLS policy: public read approved investors',
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies
                       WHERE tablename = 'deal_bank_investors'
                         AND policyname = 'public read approved investors') THEN
          CREATE POLICY "public read approved investors"
            ON deal_bank_investors FOR SELECT
            USING (status = 'approved');
        END IF;
      END $$;
    `,
  },
  {
    label: 'Create deal_bank_completed_rounds table',
    sql: `
      CREATE TABLE IF NOT EXISTS deal_bank_completed_rounds (
        id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        company          text        NOT NULL,
        amount_raised    text,
        round            text,
        date             date,
        source_url       text,
        notes            text,
        created_at       timestamptz DEFAULT now(),
        updated_at       timestamptz DEFAULT now()
      );
    `,
  },
  {
    label: 'Index: deal_bank_completed_rounds date',
    sql: `CREATE INDEX IF NOT EXISTS idx_db_completed_rounds_date ON deal_bank_completed_rounds(date);`,
  },
  {
    label: 'Index: deal_bank_completed_rounds company',
    sql: `CREATE INDEX IF NOT EXISTS idx_db_completed_rounds_company ON deal_bank_completed_rounds(company);`,
  },
  {
    label: 'Enable RLS: deal_bank_completed_rounds',
    sql: `ALTER TABLE deal_bank_completed_rounds ENABLE ROW LEVEL SECURITY;`,
  },
  {
    label: 'RLS policy: public read completed rounds',
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies
                       WHERE tablename = 'deal_bank_completed_rounds'
                         AND policyname = 'public read completed rounds') THEN
          CREATE POLICY "public read completed rounds"
            ON deal_bank_completed_rounds FOR SELECT
            USING (true);
        END IF;
      END $$;
    `,
  },
];

async function main() {
  console.log('Applying migration 018_deal_bank via Supabase Management API...\n');
  for (const { label, sql } of statements) {
    await runSQL(sql, label);
  }

  // Verify
  console.log('\nVerifying tables...');
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `SELECT table_name FROM information_schema.tables
              WHERE table_schema = 'public'
                AND table_name IN ('deal_bank_listings','deal_bank_investors','deal_bank_completed_rounds')
              ORDER BY table_name;`,
    }),
  });
  const tables = await res.json();
  console.log('Tables confirmed:', tables.map(r => r.table_name).join(', '));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
