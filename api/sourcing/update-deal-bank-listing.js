// POST /api/sourcing/update-deal-bank-listing
// Lets an authenticated member edit their company's Deal Bank listing.
//
// Why this exists: deal_bank_listings has RLS constraints, and we need to verify
// ownership before allowing edits. This endpoint runs server-side with the service
// role, verifies the caller owns the company, and writes only safe listing fields.
//
// Auth: Bearer <user access token> in the Authorization header. The token's user
// must have an approved directory_members row linking them to company_id.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only these deal_bank_listings columns are member-editable
const EDITABLE_FIELDS = ['exec_summary', 'capital_sought', 'round_stage', 'revenue_y1', 'revenue_y2', 'revenue_y3', 'deck_url', 'leadership'];

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
      return res.status(403).json({ error: 'You do not have permission to edit this listing.' });
    }

    // 3. Check if listing exists, or create it if not
    const { data: existingListing, error: checkErr } = await sb
      .from('deal_bank_listings')
      .select('id')
      .eq('company_id', company_id)
      .maybeSingle();
    if (checkErr) throw checkErr;

    // 4. Build a whitelisted update payload
    const update = {};
    for (const key of EDITABLE_FIELDS) {
      if (key in fields) {
        const raw = fields[key];
        if (Array.isArray(raw)) {
          update[key] = raw;
        } else if (typeof raw === 'string') {
          const val = raw.trim();
          update[key] = (val === '' || val === undefined) ? null : val;
        } else {
          update[key] = (raw === null || raw === undefined) ? null : raw;
        }
      }
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No editable fields provided.' });
    }
    update.updated_at = new Date().toISOString();

    let result;
    if (existingListing) {
      // 5a. Update existing listing via service role (RLS bypassed; ownership verified in step 2)
      const { data: updated, error: updErr } = await sb
        .from('deal_bank_listings')
        .update(update)
        .eq('id', existingListing.id)
        .select()
        .single();
      if (updErr) throw updErr;
      result = updated;
    } else {
      // 5b. Create new listing if it doesn't exist
      const { data: created, error: creErr } = await sb
        .from('deal_bank_listings')
        .insert({
          company_id,
          status: 'pending',
          ...update,
        })
        .select()
        .single();
      if (creErr) throw creErr;
      result = created;
    }

    return res.status(200).json({ ok: true, listing: result });
  } catch (err) {
    console.error('update-deal-bank-listing error:', err);
    return res.status(500).json({ error: err.message || 'Update failed. Please try again.' });
  }
}
