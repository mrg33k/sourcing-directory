/**
 * Tracker updates (2026-06-19) — Space Rising admin Tickets board.
 *
 * 1. Applies migration 028 (admin_tickets.type: issue|feature) — idempotent.
 * 2. Resolves the Space Rising tenant (aborts if not exactly one match).
 * 3. Inserts, idempotently (skips if a ticket with the same tenant+title exists):
 *      - 2 ISSUES from Ben (desktop font size; Deal Bank admin CRUD)
 *      - 6 FEATURES from Taryn (regional Space Congress landing pages — HOLD)
 * 4. Prints the resulting board.
 *
 * Usage: node --env-file=.env.prod.local scripts/apply-tracker-updates-2026-06-19.mjs
 * Never prints the service key.
 */
import pg from 'pg';
const { Client } = pg;

const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const url = process.env.SUPABASE_URL?.trim();
if (!key || !url) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL not found. Run with --env-file=.env.prod.local');
  process.exit(1);
}
const ref = new URL(url).hostname.split('.')[0];
const host = `db.${ref}.supabase.co`;
const client = new Client({ host, port: 5432, database: 'postgres', user: 'postgres', password: key, ssl: { rejectUnauthorized: false } });

const DOC = 'https://docs.google.com/document/d/1VqBH96___Qjs3y6ZmXRQQ_val-om84adOWli8d0-SrM/edit';

const ISSUES = [
  {
    title: 'Desktop font size too large after recent rollout',
    type: 'issue', priority: 'high', area: 'Typography (desktop)',
    created_by: 'ben@spacerising.org', link: 'https://spacerising.org/',
    description: "Ben (CEO): a recent desktop font-size change made text oversized. \"I know how to zoom to read anything on my laptop.\" Right-size desktop typography back to the intended scale. Ref: email 2026-06-19, screenshot PastedGraphic-1.png.",
  },
  {
    title: "Deal Bank admin — can't edit/remove Investor groups; no add/edit/remove for Investment (deck/team) or Completed",
    type: 'issue', priority: 'high', area: 'Admin / Deal Bank',
    created_by: 'ben@spacerising.org', link: 'https://spacerising.org/admin',
    description: "Ben (CEO), Admin → Deal Bank: can add a new group under Investor but cannot edit or remove them. No way to add/edit/remove under Investment (deck or team), nor to update. No way to add/edit under Completed. Ref: email 2026-06-19.",
  },
];

const REGIONS = [
  { name: 'Southwest', tagline: 'Exploration, launch and observatories.', states: 'Arizona, New Mexico, Colorado, Utah, Nevada' },
  { name: 'Southeast', tagline: "America's Launch Coast.",               states: 'Florida, Alabama, Georgia, Carolinas' },
  { name: 'Northeast', tagline: 'Research, finance and policy.',          states: 'Pennsylvania, Ohio, West Virginia, New York, Virginia, Maryland' },
  { name: 'Northwest', tagline: 'Earth intelligence and satellite innovation.', states: 'Washington, Oregon, Idaho, Montana, Alaska, North Dakota' },
  { name: 'Midwest',   tagline: 'Manufacturing and workforce.',           states: 'Illinois, Michigan, Indiana, Ohio extensions' },
  { name: 'Gulf',      tagline: 'Human spaceflight and industrial scale.', states: 'Texas, Louisiana, Mississippi' },
];
const FEATURES = REGIONS.map(r => ({
  title: `Space Congress landing page — ${r.name}`,
  type: 'feature', priority: 'medium', area: `Space Congress / ${r.name}`,
  created_by: 'taryn@spacerising.org', link: DOC,
  description: `${r.name} → ${r.tagline} States: ${r.states}. Per Taryn's Space Congress framework (2026-06-19); target July 1 (align with Blueprint publish). HOLD — not this round.`,
}));

const ALL = [...ISSUES, ...FEATURES];

async function main() {
  await client.connect();
  console.log('Connected.');

  // 1. Migration 028 — type column (idempotent).
  await client.query(`ALTER TABLE admin_tickets ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'issue' CHECK (type IN ('issue','feature'));`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_tickets_type ON admin_tickets(type);`);
  console.log('✅ Migration 028 (admin_tickets.type) applied / already present.');

  // 2. Resolve the Space Rising tenant.
  const { rows: tenants } = await client.query(
    `SELECT id, slug, name FROM directory_tenants WHERE slug ILIKE '%space%rising%' OR name ILIKE '%space rising%' ORDER BY name;`
  );
  if (tenants.length !== 1) {
    console.error('ABORT: expected exactly one Space Rising tenant, found:', tenants);
    process.exit(1);
  }
  const tenant = tenants[0];
  console.log(`Tenant: ${tenant.name} (${tenant.slug}) ${tenant.id}`);

  // 3. Insert idempotently.
  let inserted = 0, skipped = 0;
  for (const t of ALL) {
    const { rows: exists } = await client.query(
      `SELECT id FROM admin_tickets WHERE tenant_id = $1 AND title = $2 LIMIT 1;`,
      [tenant.id, t.title]
    );
    if (exists.length) { skipped++; console.log(`  · skip (exists): ${t.title}`); continue; }
    await client.query(
      `INSERT INTO admin_tickets (tenant_id, title, description, type, priority, area, link, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'needs_fix');`,
      [tenant.id, t.title, t.description, t.type, t.priority, t.area, t.link, t.created_by]
    );
    inserted++; console.log(`  + insert [${t.type}]: ${t.title}`);
  }
  console.log(`\nInserted ${inserted}, skipped ${skipped}.`);

  // 4. Board readout.
  const { rows: board } = await client.query(
    `SELECT type, status, priority, title, created_by FROM admin_tickets WHERE tenant_id = $1 ORDER BY type, created_at;`,
    [tenant.id]
  );
  console.log('\n=== Space Rising tracker board ===');
  for (const b of board) console.log(`[${b.type}/${b.status}/${b.priority}] ${b.title}  (by ${b.created_by || '—'})`);

  await client.end();
}
main().catch(err => { console.error(err); process.exit(1); });
