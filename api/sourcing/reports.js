// GET /api/sourcing/reports -- list reports for a tenant
// GET /api/sourcing/reports?tenant_id=xxx -- scoped to tenant
// GET /api/sourcing/reports?tenant_id=xxx&id=yyy -- single report
//
// Report data model:
//   id           uuid
//   tenant_id    uuid
//   title        text
//   category     text          -- government | acquisition | economic | quarterly
//   access       text          -- public | members | paid
//   is_premium   boolean       -- true = paid membership required (mirrors access='paid')
//   description  text
//   file_url     text
//   published_at timestamptz
//   created_at   timestamptz

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kzzvjtthknsozktmpvak.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // Use service key when available so all rows are readable server-side;
  // fall back to anon key for public-only access.
  const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const sb = createClient(SUPABASE_URL, key);
  const { tenant_id, id } = req.query || {};

  try {
    if (id) {
      // Single report lookup
      const { data: report, error } = await sb
        .from('directory_reports')
        .select('id, tenant_id, title, category, access, is_premium, description, file_url, published_at, created_at')
        .eq('id', id)
        .single();
      if (error || !report) return res.status(404).json({ error: 'Report not found' });
      return res.json(normalizeReport(report));
    }

    // List reports, optionally scoped to a tenant
    let q = sb
      .from('directory_reports')
      .select('id, tenant_id, title, category, access, is_premium, description, file_url, published_at, created_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (tenant_id) q = q.eq('tenant_id', tenant_id);

    const { data, error } = await q;
    if (error) throw error;

    return res.json((data || []).map(normalizeReport));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Normalize a raw directory_reports row into a consistent API shape.
 * Ensures is_premium is always a boolean and derives it from the access
 * field when the column value is null (pre-migration rows).
 *
 * @param {object} row - Raw row from directory_reports
 * @returns {object} Normalized report object
 */
function normalizeReport(row) {
  const isPremium = row.is_premium != null
    ? Boolean(row.is_premium)
    : row.access === 'paid' || row.access === 'members';

  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    category: row.category || null,
    access: row.access || 'public',
    isPremium,
    description: row.description || null,
    fileUrl: row.file_url || null,
    publishedAt: row.published_at || null,
    createdAt: row.created_at || null,
  };
}
