// POST /api/sourcing/update-company
// Lets an authenticated member edit their OWN company's profile fields.
//
// Why this exists: directory_companies has RLS, and the only UPDATE policy is
// "admins update companies" (migration 017). A regular member updating their own
// company through the browser's anon+session client matches no policy, so the
// UPDATE silently affects 0 rows (no error) — the portal flashed "Saved" but
// nothing persisted. (space-rising directory fix 2026-06-05)
//
// Rather than open a broad member RLS UPDATE policy (which would let a member
// PATCH membership_tier / status / featured / tenant_id directly via the REST
// API and escalate their plan or visibility), this endpoint runs server-side
// with the service role, verifies the caller owns the company, and only writes
// a whitelist of safe profile fields. Matches the signup.js pattern: mutations
// happen server-side via the service role, not client-side.
//
// Auth: Bearer <user access token> in the Authorization header. The token's user
// must have an approved directory_members row linking them to company_id.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only these company columns are member-editable. Sensitive columns
// (membership_tier, status, tenant_id, featured, slug, ...) are intentionally
// excluded so a member cannot escalate their plan or visibility here.
const EDITABLE_FIELDS = ['name', 'description', 'website', 'phone', 'email', 'logo_url', 'city', 'state'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });

  const { company_id, fields } = req.body || {};
  if (!company_id) return res.status(400).json({ error: 'company_id is required.' });
  if (!fields || typeof fields !== 'object') return res.status(400).json({ error: 'fields object is required.' });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Verify the token -> user
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
    }
    const userId = userData.user.id;

    // 2. Verify the user owns this company (approved member linking them to it)
    const { data: member, error: memberErr } = await sb
      .from('directory_members')
      .select('id, company_id, status')
      .eq('auth_user_id', userId)
      .eq('company_id', company_id)
      .maybeSingle();
    if (memberErr) throw memberErr;
    if (!member) {
      return res.status(403).json({ error: 'You do not have permission to edit this company.' });
    }

    // 3. Build a whitelisted update payload
    const update = {};
    for (const key of EDITABLE_FIELDS) {
      if (key in fields) {
        const raw = fields[key];
        const val = typeof raw === 'string' ? raw.trim() : raw;
        update[key] = (val === '' || val === undefined) ? null : val;
      }
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No editable fields provided.' });
    }
    update.updated_at = new Date().toISOString();

    // 4. Update via service role (RLS bypassed; ownership verified in step 2)
    const { data: updated, error: updErr } = await sb
      .from('directory_companies')
      .update(update)
      .eq('id', company_id)
      .select()
      .single();
    if (updErr) throw updErr;

    return res.status(200).json({ ok: true, company: updated });
  } catch (err) {
    console.error('update-company error:', err);
    return res.status(500).json({ error: err.message || 'Update failed. Please try again.' });
  }
}
