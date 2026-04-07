// POST /api/sourcing/run-migration -- one-time migration runner
// Creates user_notification_preferences table if not exists
// Protected by MIGRATION_SECRET env var

import pg from 'pg';
const { Client } = pg;

const MIGRATION_SECRET = process.env.MIGRATION_SECRET || 'aom-migration-2026';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { secret } = req.body || {};
  if (secret !== MIGRATION_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' });
  }

  const client = new Client({
    host: 'db.mcngatprgluexjjcqpkp.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
  });

  const sql = `
    CREATE TABLE IF NOT EXISTS user_notification_preferences (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        uuid NOT NULL,
      tenant_id      uuid NOT NULL REFERENCES directory_tenants(id) ON DELETE CASCADE,
      preference_key text NOT NULL,
      enabled        boolean DEFAULT true,
      frequency      text DEFAULT 'real-time',
      updated_at     timestamptz DEFAULT now(),
      UNIQUE(user_id, tenant_id, preference_key)
    );

    CREATE INDEX IF NOT EXISTS idx_notif_prefs_user   ON user_notification_preferences(user_id);
    CREATE INDEX IF NOT EXISTS idx_notif_prefs_tenant ON user_notification_preferences(tenant_id);

    ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_notification_preferences' AND policyname = 'users read own prefs') THEN
        CREATE POLICY "users read own prefs"
          ON user_notification_preferences FOR SELECT
          USING (auth.uid() = user_id);
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_notification_preferences' AND policyname = 'users insert own prefs') THEN
        CREATE POLICY "users insert own prefs"
          ON user_notification_preferences FOR INSERT
          WITH CHECK (auth.uid() = user_id);
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_notification_preferences' AND policyname = 'users update own prefs') THEN
        CREATE POLICY "users update own prefs"
          ON user_notification_preferences FOR UPDATE
          USING (auth.uid() = user_id);
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_notification_preferences' AND policyname = 'users delete own prefs') THEN
        CREATE POLICY "users delete own prefs"
          ON user_notification_preferences FOR DELETE
          USING (auth.uid() = user_id);
      END IF;
    END $$;

    -- Signup RLS policies (migration 011)
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'signup insert companies' AND tablename = 'directory_companies') THEN
        CREATE POLICY "signup insert companies" ON directory_companies FOR INSERT WITH CHECK (status = 'pending');
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'signup insert certs' AND tablename = 'directory_certifications') THEN
        CREATE POLICY "signup insert certs" ON directory_certifications FOR INSERT WITH CHECK (true);
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'signup insert members' AND tablename = 'directory_members') THEN
        CREATE POLICY "signup insert members" ON directory_members FOR INSERT WITH CHECK (true);
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read own pending company' AND tablename = 'directory_companies') THEN
        CREATE POLICY "read own pending company" ON directory_companies FOR SELECT USING (status IN ('active', 'pending'));
      END IF;
    END $$;

    -- Grant columns (migration 009)
    ALTER TABLE directory_listings
      ADD COLUMN IF NOT EXISTS grant_type           text,
      ADD COLUMN IF NOT EXISTS grant_amount_min      numeric,
      ADD COLUMN IF NOT EXISTS grant_amount_max      numeric,
      ADD COLUMN IF NOT EXISTS eligibility_criteria  text,
      ADD COLUMN IF NOT EXISTS application_url       text;
  `;

  try {
    await client.connect();
    await client.query(sql);
    await client.end();
    return res.status(200).json({ ok: true, message: 'Migration applied successfully' });
  } catch (err) {
    try { await client.end(); } catch {}
    if (err.message?.includes('already exists')) {
      return res.status(200).json({ ok: true, message: 'Table already exists' });
    }
    console.error('Migration error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
