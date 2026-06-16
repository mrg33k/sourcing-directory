/**
 * Seed the six Space Market Goals as the top-level directory_tags for space-rising.
 * Idempotent (upsert on tenant_id + name). Sub-tags are seeded later.
 * Usage: node --env-file=.env.prod.local scripts/seed-directory-tags.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.prod.local');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Same six goals + one-word market as the homepage, Defense last.
const TOP_TAGS = [
  { name: 'Build Space',      description: 'Infrastructure' },
  { name: 'Move in Space',    description: 'Mobility' },
  { name: 'Live in Space',    description: 'Life' },
  { name: 'Prosper in Space', description: 'Industry' },
  { name: 'Operate in Space', description: 'Intelligence' },
  { name: 'Secure Space',     description: 'Defense' },
];

async function run() {
  const { data: tenant, error: tErr } = await admin
    .from('directory_tenants').select('id, name, slug').eq('slug', 'space-rising').single();
  if (tErr || !tenant) { console.error('Could not find space-rising tenant:', tErr?.message); process.exit(1); }
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  const rows = TOP_TAGS.map(t => ({
    tenant_id: tenant.id, name: t.name, category: 'market_goal',
    parent_tag_id: null, description: t.description, status: 'active',
  }));

  const { data, error } = await admin
    .from('directory_tags')
    .upsert(rows, { onConflict: 'tenant_id,name' })
    .select('name, category');
  if (error) { console.error('Seed error:', error.message); process.exit(1); }

  console.log(`Seeded ${data.length} top tags:`, data.map(r => r.name).join(', '));
}

run().catch(err => { console.error(err); process.exit(1); });
