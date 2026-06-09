// api/sourcing/deal-bank-submit-investor.js
// Deal Bank Round A — public "List your firm" submission.
// Writes a pending row to deal_bank_investors using the service role so the
// public site never needs an anon INSERT policy. status is FORCED to 'pending'
// here — the client cannot self-approve. Admin approves via DealBankSection.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

function toNum(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  const body = await readBody(req);
  const firmName = (body.firm_name || '').trim();
  if (!firmName) return res.status(400).json({ error: 'Firm name is required.' });

  const dealTypes = Array.isArray(body.deal_types)
    ? body.deal_types.filter(Boolean).map((s) => String(s).trim()).slice(0, 12)
    : null;

  const row = {
    firm_name:              firmName,
    website:                (body.website || '').trim() || null,
    criteria:               (body.criteria || '').trim() || null,
    check_size_min:         toNum(body.check_size_min),
    check_size_max:         toNum(body.check_size_max),
    deal_types:             dealTypes && dealTypes.length ? dealTypes : null,
    deals_last_18mo:        body.deals_last_18mo === '' || body.deals_last_18mo == null
                              ? null : Math.round(toNum(body.deals_last_18mo) || 0),
    linkedin_url:           (body.linkedin_url || '').trim() || null,
    contact_email_internal: (body.contact_email_internal || '').trim() || null,
    status:                 'pending', // forced — never trust client
  };

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await sb
    .from('deal_bank_investors')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('deal-bank-submit-investor insert error:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit firm.' });
  }

  return res.status(200).json({ ok: true, id: data.id });
}
