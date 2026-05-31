// POST /api/sourcing/checkout-session — create a Stripe hosted-checkout session
//
// R5i (nat-geo-uplift): scaffolded 2026-05-31 against Square.
// R5k (nat-geo-uplift): swapped to Stripe 2026-05-31 — Patrik handed over live
//                       Space Rising Stripe credentials. Same input/output
//                       contract; same UX flow (redirect to hosted page).
//
// Env vars required for live operation:
//   STRIPE_SECRET_KEY        (sk_live_... or sk_test_...)
//   STRIPE_PUBLISHABLE_KEY   (pk_live_... or pk_test_...) — frontend only, not used here
//   STRIPE_WEBHOOK_SECRET    (whsec_... — used by the webhook handler, not this endpoint)
//
// Without STRIPE_SECRET_KEY, the endpoint returns 503 {configured: false} so the
// frontend can fall back gracefully to "we'll email you a link" copy until keys land.
//
// Input  (POST JSON): { company_id, company_slug, email, seats, tier }
// Output (200 JSON):  { checkout_url, session_id }
// Output (503 JSON):  { configured: false, reason: "<missing var>" }

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

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
  if (!STRIPE_SECRET_KEY) {
    return res.status(503).json({ configured: false, reason: 'STRIPE_SECRET_KEY not set' });
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

  const origin = (req.headers && req.headers.origin)
    || (process.env.PUBLIC_BASE_URL || 'https://sourcing.directory');

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: totalCents,
            product_data: {
              name: `Space Rising Membership — ${seatCount} ${seatCount === 1 ? 'seat' : 'seats'}`,
              description: `Annual membership, ${seatCount} ${seatCount === 1 ? 'seat' : 'seats'} at $${ppm.toLocaleString()} / seat / year.`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/space-rising-v2/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/space-rising-v2/signup?tier=paid&canceled=1`,
      metadata: {
        kind: 'space-rising-membership',
        company_id: resolvedCompanyId,
        seats: String(seatCount),
      },
      payment_intent_data: {
        metadata: {
          kind: 'space-rising-membership',
          company_id: resolvedCompanyId,
          seats: String(seatCount),
        },
      },
    });

    if (!session?.url || !session?.id) {
      console.error('Stripe checkout.sessions.create returned unexpected shape', session);
      return res.status(502).json({ error: 'stripe-bad-response' });
    }

    // Stamp the pending checkout on the company row so the webhook can find it.
    await sb
      .from('directory_companies')
      .update({
        pending_checkout_session_id: session.id,
        pending_checkout_seats: seatCount,
        pending_checkout_at: new Date().toISOString(),
      })
      .eq('id', resolvedCompanyId);

    return res.status(200).json({ checkout_url: session.url, session_id: session.id });
  } catch (err) {
    console.error('checkout-session Stripe error', err);
    return res.status(502).json({
      error: 'stripe-api-error',
      message: err?.message || 'unknown',
      type: err?.type || null,
    });
  }
}
