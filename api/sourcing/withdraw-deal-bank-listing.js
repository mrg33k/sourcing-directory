// POST /api/sourcing/withdraw-deal-bank-listing
// Lets an authenticated member withdraw their company's Deal Bank listing.
//
// Why this exists: members can withdraw their listings on the dashboard. This
// endpoint verifies ownership and sets status='withdrawn' without deletion.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const { listing_id } = req.body || {};
  if (!listing_id) return res.status(400).json({ error: 'listing_id is required.' });

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

    // 2. Get the listing and verify the user owns the associated company
    const { data: listing, error: listingErr } = await sb
      .from('deal_bank_listings')
      .select('id, company_id')
      .eq('id', listing_id)
      .single();
    if (listingErr || !listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    // 3. Verify the user owns this company (approved member)
    const { data: member, error: memberErr } = await sb
      .from('directory_members')
      .select('id')
      .eq('auth_user_id', userId)
      .eq('company_id', listing.company_id)
      .maybeSingle();
    if (memberErr) throw memberErr;
    if (!member) {
      return res.status(403).json({ error: 'You do not have permission to withdraw this listing.' });
    }

    // 4. Set status to 'withdrawn'
    const { data: updated, error: updErr } = await sb
      .from('deal_bank_listings')
      .update({
        status: 'withdrawn',
        updated_at: new Date().toISOString(),
      })
      .eq('id', listing_id)
      .select()
      .single();
    if (updErr) throw updErr;

    return res.status(200).json({ ok: true, listing: updated });
  } catch (err) {
    console.error('withdraw-deal-bank-listing error:', err);
    return res.status(500).json({ error: err.message || 'Withdrawal failed. Please try again.' });
  }
}
