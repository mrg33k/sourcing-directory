// GET  /api/sourcing/reports?tenant_id=xxx        -- list reports for a tenant
// GET  /api/sourcing/reports?tenant_id=xxx&id=yyy -- single report
// POST /api/sourcing/reports { tenantSlug, reportType, format } -- generate CSV download

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kzzvjtthknsozktmpvak.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const VALID_CATEGORIES = ['government', 'acquisition', 'economic', 'quarterly'];

function escapeCSV(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV(rows, columns) {
  const header = columns.map(c => escapeCSV(c.label)).join(',');
  const body = rows.map(row =>
    columns.map(c => escapeCSV(row[c.key])).join(',')
  ).join('\n');
  return header + '\n' + body;
}

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'GET or POST only' });
}

// GET: List/fetch reports with premium status
async function handleGet(req, res) {
  const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const sb = createClient(SUPABASE_URL, key);
  const { tenant_id, id } = req.query || {};

  try {
    if (id) {
      const { data: report, error } = await sb
        .from('directory_reports')
        .select('id, tenant_id, title, category, access, is_premium, description, file_url, published_at, created_at')
        .eq('id', id)
        .single();
      if (error || !report) return res.status(404).json({ error: 'Report not found' });
      return res.json(normalizeReport(report));
    }

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

// POST: Generate CSV report download
async function handlePost(req, res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { tenantSlug, reportType, format } = req.body || {};

  if (!tenantSlug || typeof tenantSlug !== 'string' || !tenantSlug.trim()) {
    return res.status(400).json({ error: 'tenantSlug is required' });
  }

  if (!format || typeof format !== 'string') {
    return res.status(400).json({ error: 'format is required (csv)' });
  }

  const fmt = format.toLowerCase().trim();
  if (fmt !== 'csv') {
    return res.status(400).json({
      error: 'PDF generation is not supported. Use format: "csv".',
      supported_formats: ['csv'],
    });
  }

  const category = reportType && reportType !== 'all' ? reportType.toLowerCase().trim() : null;
  if (category && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({
      error: `Invalid reportType "${reportType}". Valid values: ${VALID_CATEGORIES.join(', ')}`,
      valid_types: VALID_CATEGORIES,
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: tenant, error: tenantErr } = await sb
      .from('directory_tenants')
      .select('id, name, slug')
      .eq('slug', tenantSlug.trim())
      .eq('status', 'active')
      .single();

    if (tenantErr || !tenant) {
      return res.status(404).json({ error: `Tenant "${tenantSlug}" not found` });
    }

    let query = sb
      .from('directory_reports')
      .select('id, title, description, category, access, published_at, tenant_id')
      .eq('tenant_id', tenant.id)
      .order('published_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: reports, error: reportsErr } = await query;
    if (reportsErr) throw reportsErr;

    if (!reports || reports.length === 0) {
      return res.status(404).json({
        error: category
          ? `No reports found for category "${category}" in tenant "${tenantSlug}"`
          : `No reports found for tenant "${tenantSlug}"`,
      });
    }

    const columns = [
      { key: 'id',           label: 'ID' },
      { key: 'title',        label: 'Title' },
      { key: 'category',     label: 'Category' },
      { key: 'access',       label: 'Access' },
      { key: 'published_at', label: 'Published At' },
      { key: 'description',  label: 'Description' },
    ];

    const csv = toCSV(reports, columns);

    const categoryPart = category ? `-${category}` : '';
    const datePart = new Date().toISOString().slice(0, 10);
    const filename = `reports-${tenantSlug}${categoryPart}-${datePart}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
