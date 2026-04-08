// POST /api/sourcing/upgrade-membership
// Updates directory_companies with paid membership data
// Body: { company_id, tier_name, seat_count }

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mcngatprgluexjjcqpkp.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { company_id, tier_name, seat_count } = req.body || {};

  if (!company_id) {
    return res.status(400).json({ error: 'company_id is required' });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const { error } = await sb
      .from('directory_companies')
      .update({
        membership_seats: seat_count || 1,
        membership_paid_at: new Date().toISOString(),
      })
      .eq('id', company_id);

    if (error) throw error;

    return res.status(200).json({ success: true, company_id, tier_name, seat_count: seat_count || 1 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
