// GET /api/sourcing/download-report?type=companies|jobs|reports&tenant_slug=xxx
// Returns a CSV export of directory data for the given tenant.
// Called by the Download Reports UI on SourcingReports.jsx.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kzzvjtthknsozktmpvak.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VALID_TYPES = ['companies', 'jobs', 'reports'];

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { type, tenant_slug } = req.query || {};

  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({
      error: `type is required. Valid values: ${VALID_TYPES.join(', ')}`,
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Resolve tenant if slug provided
    let tenantId = null;
    let tenantSlugSafe = tenant_slug ? String(tenant_slug).trim() : '';

    if (tenantSlugSafe) {
      const { data: tenant, error: tenantErr } = await sb
        .from('directory_tenants')
        .select('id, slug')
        .eq('slug', tenantSlugSafe)
        .eq('status', 'active')
        .single();

      if (tenantErr || !tenant) {
        return res.status(404).json({ error: `Tenant "${tenantSlugSafe}" not found` });
      }
      tenantId = tenant.id;
    }

    let csv = '';
    let filename = '';
    const datePart = new Date().toISOString().slice(0, 10);
    const slugPart = tenantSlugSafe ? `-${tenantSlugSafe}` : '';

    if (type === 'companies') {
      let query = sb
        .from('directory_companies')
        .select('id, name, slug, city, state, vertical, membership_tier, website, phone, email, employee_count, year_founded, status')
        .order('name');

      if (tenantId) query = query.eq('tenant_id', tenantId);

      const { data, error } = await query;
      if (error) throw error;

      const columns = [
        { key: 'id',              label: 'ID' },
        { key: 'name',            label: 'Company Name' },
        { key: 'slug',            label: 'Slug' },
        { key: 'city',            label: 'City' },
        { key: 'state',           label: 'State' },
        { key: 'vertical',        label: 'Vertical' },
        { key: 'membership_tier', label: 'Membership Tier' },
        { key: 'employee_count',  label: 'Employees' },
        { key: 'year_founded',    label: 'Year Founded' },
        { key: 'website',         label: 'Website' },
        { key: 'phone',           label: 'Phone' },
        { key: 'email',           label: 'Email' },
        { key: 'status',          label: 'Status' },
      ];
      csv = toCSV(data || [], columns);
      filename = `companies${slugPart}-${datePart}.csv`;

    } else if (type === 'jobs') {
      let query = sb
        .from('directory_listings')
        .select('id, title, description, city, state, category, status, created_at')
        .eq('category', 'jobs')
        .order('created_at', { ascending: false });

      if (tenantId) query = query.eq('tenant_id', tenantId);

      const { data, error } = await query;
      if (error) throw error;

      const columns = [
        { key: 'id',          label: 'ID' },
        { key: 'title',       label: 'Title' },
        { key: 'city',        label: 'City' },
        { key: 'state',       label: 'State' },
        { key: 'status',      label: 'Status' },
        { key: 'created_at',  label: 'Posted At' },
        { key: 'description', label: 'Description' },
      ];
      csv = toCSV(data || [], columns);
      filename = `jobs${slugPart}-${datePart}.csv`;

    } else if (type === 'reports') {
      let query = sb
        .from('directory_reports')
        .select('id, title, description, category, access, published_at')
        .order('published_at', { ascending: false });

      if (tenantId) query = query.eq('tenant_id', tenantId);

      const { data, error } = await query;
      if (error) throw error;

      const columns = [
        { key: 'id',           label: 'ID' },
        { key: 'title',        label: 'Title' },
        { key: 'category',     label: 'Category' },
        { key: 'access',       label: 'Access' },
        { key: 'published_at', label: 'Published At' },
        { key: 'description',  label: 'Description' },
      ];
      csv = toCSV(data || [], columns);
      filename = `reports${slugPart}-${datePart}.csv`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
