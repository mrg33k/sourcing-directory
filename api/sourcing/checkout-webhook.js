// POST /api/sourcing/checkout-webhook — receive Square webhook events
//
// R5i (nat-geo-uplift): scaffolded 2026-05-31, awaiting env vars.
//
// Env vars required for live operation:
//   SQUARE_WEBHOOK_SIGNATURE_KEY — from Square Dashboard → Webhooks → your endpoint
//   PUBLIC_BASE_URL              — e.g. https://sourcing.directory (for signature notification_url)
//
// This handler:
//   1. Verifies Square's webhook signature header (refuses unsigned payloads).
//   2. Filters to payment.updated events with COMPLETED status.
//   3. Idempotently flips the company row to membership_tier='paid' and stamps
//      seats + receipt URL. Re-deliveries of the same payment_id do not double-update.
//
// Without SQUARE_WEBHOOK_SIGNATURE_KEY the endpoint returns 503 so the webhook
// won't be registered until the key is set.

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://sourcing.directory';

// Vercel passes the raw body when bodyParser is disabled — we need the raw bytes
// for signature verification.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function verifySquareSignature(rawBody, signatureHeader, signatureKey, notificationUrl) {
  if (!signatureHeader || !signatureKey) return false;
  const hmac = crypto.createHmac('sha256', signatureKey);
  hmac.update(notificationUrl + rawBody);
  const expected = hmac.digest('base64');
  // Constant-time compare
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!WEBHOOK_KEY) {
    return res.status(503).json({ configured: false, reason: 'SQUARE_WEBHOOK_SIGNATURE_KEY not set' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const rawBody = await readRawBody(req);
  const sigHeader = req.headers['x-square-hmacsha256-signature'] || req.headers['x-square-signature'];
  const notificationUrl = `${PUBLIC_BASE_URL}/api/sourcing/checkout-webhook`;

  if (!verifySquareSignature(rawBody, sigHeader, WEBHOOK_KEY, notificationUrl)) {
    console.warn('Square webhook signature mismatch — refusing');
    return res.status(401).json({ error: 'invalid signature' });
  }

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'invalid JSON' }); }

  const eventType = payload.type;
  const data = payload.data?.object || {};

  // We care about payment.updated → COMPLETED
  if (eventType !== 'payment.updated') {
    return res.status(200).json({ ignored: eventType });
  }
  const payment = data.payment;
  if (!payment || payment.status !== 'COMPLETED') {
    return res.status(200).json({ ignored: 'not-completed' });
  }

  // Pull the note we embedded in the payment link.
  let note = {};
  try { note = JSON.parse(payment.note || '{}'); } catch { /* old / non-srcd payment */ }

  if (note.kind !== 'space-rising-membership' || !note.company_id) {
    return res.status(200).json({ ignored: 'not-srcd-membership' });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Idempotency check — has this payment_id already been processed?
  const { data: existing } = await sb
    .from('directory_companies')
    .select('id, membership_tier, paid_square_payment_id')
    .eq('id', note.company_id)
    .single();

  if (existing?.paid_square_payment_id === payment.id) {
    return res.status(200).json({ idempotent: true, payment_id: payment.id });
  }

  const update = {
    membership_tier: 'paid',
    paid_square_payment_id: payment.id,
    paid_seats: note.seats || existing?.pending_checkout_seats || null,
    paid_at: payment.updated_at || new Date().toISOString(),
    paid_receipt_url: payment.receipt_url || null,
    pending_checkout_session_id: null,
    pending_checkout_at: null,
  };

  const { error: upErr } = await sb
    .from('directory_companies')
    .update(update)
    .eq('id', note.company_id);

  if (upErr) {
    console.error('checkout-webhook supabase update error', upErr);
    return res.status(500).json({ error: 'supabase update failed', details: upErr });
  }

  return res.status(200).json({ ok: true, company_id: note.company_id, payment_id: payment.id });
}
