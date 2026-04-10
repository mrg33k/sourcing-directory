// POST /api/sourcing/delete-blank-reports
// Deletes records from directory_reports where title or description is NULL,
// an empty string, or contains only whitespace.
// Protected by x-setup-secret header (same SETUP_SECRET env var as admin-setup).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kzzvjtthknsozktmpvak.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SETUP_SECRET = process.env.SETUP_SECRET;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-setup-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Verify setup secret
  const providedSecret = req.headers['x-setup-secret'];
  if (!SETUP_SECRET || providedSecret !== SETUP_SECRET) {
    return res.status(403).json({ error: 'Invalid or missing setup secret' });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Fetch IDs of blank records: title or description is NULL, empty, or whitespace-only.
    // Supabase JS v2 doesn't support server-side trim(), so we fetch candidates and
    // filter whitespace-only values in JS before deleting.
    const { data: candidates, error: fetchErr } = await admin
      .from('directory_reports')
      .select('id, title, description');

    if (fetchErr) throw fetchErr;

    const blankIds = (candidates || [])
      .filter(r => isBlank(r.title) || isBlank(r.description))
      .map(r => r.id);

    if (blankIds.length === 0) {
      return res.status(200).json({ success: true, deleted: 0, message: 'No blank reports found.' });
    }

    const { error: deleteErr } = await admin
      .from('directory_reports')
      .delete()
      .in('id', blankIds);

    if (deleteErr) throw deleteErr;

    return res.status(200).json({
      success: true,
      deleted: blankIds.length,
      message: `Deleted ${blankIds.length} blank report record(s).`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function isBlank(value) {
  return value === null || value === undefined || value.trim() === '';
}
