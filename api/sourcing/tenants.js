// GET /api/sourcing/tenants -- list all active tenants with company counts
// GET /api/sourcing/tenants?slug=xxx -- get single tenant by slug

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mcngatprgluexjjcqpkp.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { slug } = req.query || {};

  try {
    if (slug) {
      // Get single tenant by slug
      const { data: tenant, error } = await sb.from('directory_tenants')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .single();
      if (error || !tenant) return res.status(404).json({ error: 'Tenant not found' });

      // Get company count
      const { count } = await sb.from('directory_companies')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);

      return res.json({ ...tenant, company_count: count || 0 });
    }

    // List all active tenants with company counts
    const { data: tenants, error } = await sb.from('directory_tenants')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (error) throw error;

    // Get company counts
    const results = [];
    for (const t of (tenants || [])) {
      const { count } = await sb.from('directory_companies')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', t.id);
      results.push({ ...t, company_count: count || 0 });
    }

    return res.json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
