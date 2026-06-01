// POST /api/spaceos/checkout-webhook — receive Stripe webhook events
//
// R5k follow-up (2026-05-31): Space Rising membership signups are moving off
// the sourcing.directory framing onto spacerising.org / spaceos. The webhook
// URL Stripe pings is the conceptual home of the payment surface — Space
// Rising owns the money flow, not the sourcing platform. Same Vercel project,
// same env vars, same code shape — different URL.
//
// Stripe webhook endpoint URL (set in Stripe Dashboard → Developers → Webhooks):
//   https://spacerising.org/api/spaceos/checkout-webhook
//
// Env vars required for live operation:
//   STRIPE_SECRET_KEY      (sk_live_... / sk_test_...) — used to retrieve session details if needed
//   STRIPE_WEBHOOK_SECRET  (whsec_...) — from Stripe Dashboard → Developers → Webhooks → endpoint
//
// This handler:
//   1. Verifies Stripe's webhook signature header (refuses unsigned payloads).
//   2. Handles checkout.session.completed events with payment_status='paid'.
//   3. Idempotently flips the company row to membership_tier='paid' and stamps
//      seats + receipt URL. Re-deliveries of the same session_id do not double-update.
//
// Without STRIPE_WEBHOOK_SECRET the endpoint returns 503 so the webhook
// won't be registered until the key is set.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Vercel passes the raw body when bodyParser is disabled — we need the raw bytes
// for Stripe signature verification.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!WEBHOOK_SECRET) {
    return res.status(503).json({ configured: false, reason: 'STRIPE_WEBHOOK_SECRET not set' });
  }
  if (!STRIPE_SECRET_KEY) {
    return res.status(503).json({ configured: false, reason: 'STRIPE_SECRET_KEY not set' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

  const rawBody = await readRawBody(req);
  const sigHeader = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sigHeader, WEBHOOK_SECRET);
  } catch (err) {
    console.warn('Stripe webhook signature mismatch — refusing', err?.message);
    return res.status(401).json({ error: 'invalid signature', message: err?.message || 'unknown' });
  }

  // We care about checkout.session.completed → payment_status='paid'
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ ignored: event.type });
  }

  const session = event.data?.object || {};
  if (session.payment_status !== 'paid') {
    return res.status(200).json({ ignored: 'not-paid', payment_status: session.payment_status });
  }

  // Pull the metadata we embedded on the session.
  const metadata = session.metadata || {};
  if (metadata.kind !== 'space-rising-membership' || !metadata.company_id) {
    return res.status(200).json({ ignored: 'not-srcd-membership' });
  }

  const companyId = metadata.company_id;
  const seats = parseInt(metadata.seats, 10) || null;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Idempotency check — has this session_id already been processed?
  const { data: existing } = await sb
    .from('directory_companies')
    .select('id, membership_tier, paid_stripe_session_id, pending_checkout_seats')
    .eq('id', companyId)
    .single();

  if (existing?.paid_stripe_session_id === session.id) {
    return res.status(200).json({ idempotent: true, session_id: session.id });
  }

  // Receipt URL: Stripe Checkout doesn't surface a receipt_url on the session
  // directly — it lives on the payment_intent's charge. Fetch it if we can.
  let receiptUrl = null;
  if (session.payment_intent) {
    try {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
        expand: ['latest_charge'],
      });
      receiptUrl = pi?.latest_charge?.receipt_url || null;
    } catch (err) {
      console.warn('Could not retrieve payment intent for receipt URL', err?.message);
    }
  }

  const update = {
    membership_tier: 'paid',
    paid_stripe_session_id: session.id,
    paid_stripe_payment_intent_id: session.payment_intent || null,
    paid_seats: seats || existing?.pending_checkout_seats || null,
    paid_at: new Date(((session.created || 0) * 1000) || Date.now()).toISOString(),
    paid_receipt_url: receiptUrl,
    pending_checkout_session_id: null,
    pending_checkout_at: null,
  };

  const { error: upErr } = await sb
    .from('directory_companies')
    .update(update)
    .eq('id', companyId);

  if (upErr) {
    console.error('checkout-webhook supabase update error', upErr);
    return res.status(500).json({ error: 'supabase update failed', details: upErr });
  }

  return res.status(200).json({ ok: true, company_id: companyId, session_id: session.id });
}
