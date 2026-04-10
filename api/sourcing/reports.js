// POST /api/sourcing/reports
// Generate and download a report as CSV.
// Body: { tenantSlug, reportType, format }
//   tenantSlug  (required) — matches directory_tenants.slug
//   reportType  (optional) — one of: government | acquisition | economic | quarterly
//               omit or 'all' to return all categories for the tenant
//   format      (required) — 'csv' (PDF not supported)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kzzvjtthknsozktmpvak.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { tenantSlug, reportType, format } = req.body || {};

  // Validate required params
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

  // Validate reportType if provided
  const category = reportType && reportType !== 'all' ? reportType.toLowerCase().trim() : null;
  if (category && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({
      error: `Invalid reportType "${reportType}". Valid values: ${VALID_CATEGORIES.join(', ')}`,
      valid_types: VALID_CATEGORIES,
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Resolve tenant
    const { data: tenant, error: tenantErr } = await sb
      .from('directory_tenants')
      .select('id, name, slug')
      .eq('slug', tenantSlug.trim())
      .eq('status', 'active')
      .single();

    if (tenantErr || !tenant) {
      return res.status(404).json({ error: `Tenant "${tenantSlug}" not found` });
    }

    // Fetch reports scoped to tenant
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

    // Generate CSV
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
