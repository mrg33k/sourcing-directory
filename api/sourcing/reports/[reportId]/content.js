// GET /api/sourcing/reports/:reportId/content
// Returns report content for authorized users. Placeholder until file storage is implemented.
//
// 401 -- no/invalid Authorization header
// 403 -- user does not have access to this report
// 404 -- report not found
// 200 -- { reportId, title, description, fileUrl, placeholder } for authorized users
//
// Access rules mirror /access endpoint:
//   report.access = 'public' | 'free'  → accessible to all authenticated users
//   report.access = 'members' | 'paid' → requires company.membership_tier != 'free'
//   report.is_premium = true           → same as 'paid'

import { createClient } from '@supabase/supabase-js';
import { isUserPremiumMember } from '../../lib/membership.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kzzvjtthknsozktmpvak.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Authorization required' });
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Authorization required' });

  const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) return res.status(500).json({ error: 'Supabase not configured' });

  const sb = createClient(SUPABASE_URL, key);

  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  // ── Report lookup ─────────────────────────────────────────────────────────
  const { reportId } = req.query;
  if (!reportId) return res.status(400).json({ error: 'reportId is required' });

  try {
    const { data: report, error: reportError } = await sb
      .from('directory_reports')
      .select('id, tenant_id, title, description, category, access, is_premium, file_url, published_at')
      .eq('id', reportId)
      .single();

    if (reportError || !report) return res.status(404).json({ error: 'Report not found' });

    // ── Access check ──────────────────────────────────────────────────────
    const reportAccess = report.access || 'public';
    const isPremiumReport =
      report.is_premium === true ||
      reportAccess === 'paid' ||
      reportAccess === 'members' ||
      reportAccess === 'member';

    if (isPremiumReport) {
      const isPaidMember = await isUserPremiumMember(user.id, { sb, tenantId: report.tenant_id });
      if (!isPaidMember) return res.status(403).json({ error: 'Paid membership required to access this report' });
    }

    // ── Serve content ─────────────────────────────────────────────────────
    // If the report has a file_url, redirect to it.
    if (report.file_url) {
      return res.redirect(302, report.file_url);
    }

    // Placeholder until file storage is implemented
    return res.json({
      reportId: report.id,
      title: report.title,
      description: report.description || null,
      category: report.category || null,
      publishedAt: report.published_at || null,
      fileUrl: null,
      placeholder: true,
      message: 'Report content coming soon. Files will be available here once uploaded.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
