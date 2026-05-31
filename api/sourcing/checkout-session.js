// POST /api/sourcing/checkout-session — create a Square hosted-checkout payment link
//
// R5i (nat-geo-uplift): scaffolded 2026-05-31, awaiting env vars to activate.
//
// Env vars required for live operation:
//   SQUARE_ACCESS_TOKEN          (token starting EAAA... — production OR sandbox)
//   SQUARE_LOCATION_ID           (e.g. L4XXXXX — from Square Dashboard → Locations)
//   SQUARE_ENVIRONMENT           ("sandbox" or "production", defaults to "sandbox")
//   SQUARE_WEBHOOK_SIGNATURE_KEY (used by the webhook handler, not this endpoint)
//
// Without those, the endpoint returns 503 {configured: false} so the frontend
// can fall back gracefully to "we'll email you a link" copy until keys land.
//
// Input  (POST JSON): { company_id, company_slug, email, seats, tier }
// Output (200 JSON):  { checkout_url, session_id }
// Output (503 JSON):  { configured: false, reason: "<missing var>" }

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID;
const SQUARE_ENVIRONMENT = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase();

const SQUARE_HOST = SQUARE_ENVIRONMENT === 'production'
  ? 'https://connect.squareup.com'
  : 'https://connect.squareupsandbox.com';

function pricePerSeat(seats) {
  if (seats <= 4)  return 1000;
  if (seats <= 14) return 850;
  if (seats <= 49) return 700;
  return null; // 50+ requires custom quote — endpoint should NOT auto-checkout
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // ── Press-go gate ─────────────────────────────────────────────────────────
  if (!SQUARE_ACCESS_TOKEN) {
    return res.status(503).json({ configured: false, reason: 'SQUARE_ACCESS_TOKEN not set' });
  }
  if (!SQUARE_LOCATION_ID) {
    return res.status(503).json({ configured: false, reason: 'SQUARE_LOCATION_ID not set' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { company_id, company_slug, email, seats, tier } = req.body || {};

  if (tier !== 'paid') {
    return res.status(400).json({ error: 'checkout-session is only for paid tier' });
  }
  if (!company_id && !company_slug) {
    return res.status(400).json({ error: 'company_id or company_slug required' });
  }
  if (!email) {
    return res.status(400).json({ error: 'email required' });
  }
  const seatCount = parseInt(seats, 10);
  if (!Number.isFinite(seatCount) || seatCount < 1) {
    return res.status(400).json({ error: 'seats must be a positive integer' });
  }

  const ppm = pricePerSeat(seatCount);
  if (ppm === null) {
    return res.status(400).json({
      error: 'custom-pricing-required',
      message: 'Teams of 50+ seats need a custom quote — contact us instead of self-checkout.',
    });
  }

  const totalUsd = ppm * seatCount;
  const totalCents = totalUsd * 100;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve company_id if only slug given.
  let resolvedCompanyId = company_id;
  if (!resolvedCompanyId) {
    const { data: row, error } = await sb
      .from('directory_companies')
      .select('id')
      .eq('slug', company_slug)
      .single();
    if (error || !row) {
      return res.status(404).json({ error: 'company not found for slug ' + company_slug });
    }
    resolvedCompanyId = row.id;
  }

  // Build Square payment link request.
  // Docs: https://developer.squareup.com/reference/square/checkout-api/create-payment-link
  const origin = (req.headers && req.headers.origin)
    || (process.env.PUBLIC_BASE_URL || 'https://sourcing.directory');
  const idempotencyKey = `srcd-${resolvedCompanyId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const body = {
    idempotency_key: idempotencyKey,
    quick_pay: {
      name: `Space Rising Membership — ${seatCount} ${seatCount === 1 ? 'seat' : 'seats'}`,
      price_money: { amount: totalCents, currency: 'USD' },
      location_id: SQUARE_LOCATION_ID,
    },
    checkout_options: {
      redirect_url: `${origin}/space-rising-v2/signup/complete`,
      ask_for_shipping_address: false,
      accepted_payment_methods: { apple_pay: true, google_pay: true, cash_app_pay: false, afterpay_clearpay: false },
    },
    pre_populated_data: { buyer_email: email },
    payment_note: JSON.stringify({
      kind: 'space-rising-membership',
      company_id: resolvedCompanyId,
      seats: seatCount,
    }),
  };

  try {
    const squareRes = await fetch(`${SQUARE_HOST}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2025-01-23',
      },
      body: JSON.stringify(body),
    });
    const json = await squareRes.json();

    if (!squareRes.ok || !json.payment_link) {
      console.error('Square payment-link error', squareRes.status, json);
      return res.status(502).json({
        error: 'square-api-error',
        details: json.errors || json,
      });
    }

    const session_id = json.payment_link.id;
    const checkout_url = json.payment_link.url;

    // Stamp the pending checkout on the company row so the webhook can find it.
    await sb
      .from('directory_companies')
      .update({
        pending_checkout_session_id: session_id,
        pending_checkout_seats: seatCount,
        pending_checkout_at: new Date().toISOString(),
      })
      .eq('id', resolvedCompanyId);

    return res.status(200).json({ checkout_url, session_id });
  } catch (err) {
    console.error('checkout-session unexpected error', err);
    return res.status(500).json({ error: 'unexpected', message: err.message });
  }
}
