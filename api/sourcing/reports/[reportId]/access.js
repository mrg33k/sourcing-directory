// GET /api/sourcing/reports/:reportId/access
// Returns { canAccess: boolean } for the authenticated user on the given report.
//
// 401 -- no/invalid Authorization header
// 404 -- report not found
// 200 -- { canAccess: true|false }
//
// Access rules:
//   report.access = 'public' | 'free'  → canAccess: true  (no membership required)
//   report.access = 'members' | 'paid' → canAccess: true  only when company.membership_tier != 'free'
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
      .select('id, tenant_id, access, is_premium')
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

    if (!isPremiumReport) {
      return res.json({ canAccess: true });
    }

    // Premium report: check if the user has a paid membership in this tenant
    const isPaidMember = await isUserPremiumMember(user.id, { sb, tenantId: report.tenant_id });
    return res.json({ canAccess: isPaidMember });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
