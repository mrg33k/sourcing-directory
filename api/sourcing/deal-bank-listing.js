// POST /api/sourcing/deal-bank-listing
// Lets an authenticated company member manage their OWN Deal Bank listing:
// fetch it, edit it, withdraw it (soft hide), or reactivate it.
//
// Why this exists: deal_bank_listings has RLS. Anon can INSERT (the public
// "Add my listing" form), and anon can SELECT approved rows (the public lane),
// but there is no member self-UPDATE policy — a member updating their own
// listing through the browser's anon+session client matches no policy, so the
// UPDATE silently affects 0 rows. Same failure the company-profile save hit.
// Mirrors api/sourcing/update-company.js: mutations run server-side via the
// service role, after verifying the caller owns the company. (deal-bank Round C)
//
// Auth: Bearer <user access token> in the Authorization header. The token's user
// must have a directory_members row linking them to the listing's company_id.
//
// Body: { action: 'get'|'update'|'withdraw'|'reactivate', company_id, listing_id, fields? }

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only these listing columns are member-editable. status is intentionally NOT
// here — a member cannot self-approve; edits route back through 'pending' below.
const EDITABLE_FIELDS = [
  'exec_summary', 'capital_sought', 'round_stage',
  'revenue_y1', 'revenue_y2', 'revenue_y3',
  'deck_url', 'leadership',
];
const NUMERIC_FIELDS = new Set(['revenue_y1', 'revenue_y2', 'revenue_y3']);

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

  const { action, company_id, listing_id, fields } = req.body || {};
  if (!action) return res.status(400).json({ error: 'action is required.' });
  if (!company_id) return res.status(400).json({ error: 'company_id is required.' });

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

    // 2. Verify the user owns this company (member row links them to it)
    const { data: member, error: memberErr } = await sb
      .from('directory_members')
      .select('id, company_id')
      .eq('auth_user_id', userId)
      .eq('company_id', company_id)
      .maybeSingle();
    if (memberErr) throw memberErr;
    if (!member) {
      return res.status(403).json({ error: 'You do not have permission to manage this listing.' });
    }

    // 3. For actions that touch a specific listing, load it and confirm it
    //    belongs to the verified company (no cross-company edits).
    let listing = null;
    if (listing_id) {
      const { data: row, error: rowErr } = await sb
        .from('deal_bank_listings')
        .select('*')
        .eq('id', listing_id)
        .maybeSingle();
      if (rowErr) throw rowErr;
      if (!row) return res.status(404).json({ error: 'Listing not found.' });
      if (row.company_id !== company_id) {
        return res.status(403).json({ error: 'That listing belongs to a different company.' });
      }
      listing = row;
    }

    // ── get: return the member's listing (for the edit form to prefill) ──
    if (action === 'get') {
      if (!listing) {
        // No listing_id passed — return the most recent listing for the company.
        const { data: rows, error: e } = await sb
          .from('deal_bank_listings')
          .select('*')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (e) throw e;
        return res.status(200).json({ ok: true, listing: rows?.[0] || null });
      }
      return res.status(200).json({ ok: true, listing });
    }

    // ── withdraw: soft-hide an approved/pending listing ──
    if (action === 'withdraw') {
      if (!listing) return res.status(400).json({ error: 'listing_id is required.' });
      const { data: updated, error: e } = await sb
        .from('deal_bank_listings')
        .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
        .eq('id', listing.id)
        .select()
        .single();
      if (e) throw e;
      return res.status(200).json({ ok: true, listing: updated });
    }

    // ── reactivate: send a withdrawn/rejected listing back for review ──
    if (action === 'reactivate') {
      if (!listing) return res.status(400).json({ error: 'listing_id is required.' });
      const { data: updated, error: e } = await sb
        .from('deal_bank_listings')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', listing.id)
        .select()
        .single();
      if (e) throw e;
      return res.status(200).json({ ok: true, listing: updated });
    }

    // ── update: edit fields. Edits re-enter the review queue (status=pending) ──
    if (action === 'update') {
      if (!listing) return res.status(400).json({ error: 'listing_id is required.' });
      if (!fields || typeof fields !== 'object') {
        return res.status(400).json({ error: 'fields object is required.' });
      }
      const update = {};
      for (const key of EDITABLE_FIELDS) {
        if (!(key in fields)) continue;
        const raw = fields[key];
        if (key === 'leadership') {
          update[key] = Array.isArray(raw) && raw.length > 0 ? raw : null;
        } else if (NUMERIC_FIELDS.has(key)) {
          const n = raw === '' || raw === null || raw === undefined ? null : parseFloat(raw);
          update[key] = Number.isNaN(n) ? null : n;
        } else {
          const val = typeof raw === 'string' ? raw.trim() : raw;
          update[key] = (val === '' || val === undefined) ? null : val;
        }
      }
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No editable fields provided.' });
      }
      // An edit changes the public-facing content, so it goes back to review.
      update.status = 'pending';
      update.updated_at = new Date().toISOString();

      const { data: updated, error: e } = await sb
        .from('deal_bank_listings')
        .update(update)
        .eq('id', listing.id)
        .select()
        .single();
      if (e) throw e;
      return res.status(200).json({ ok: true, listing: updated });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('deal-bank-listing error:', err);
    return res.status(500).json({ error: err.message || 'Request failed. Please try again.' });
  }
}
