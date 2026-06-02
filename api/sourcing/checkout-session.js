// POST /api/sourcing/checkout-session — create a Stripe hosted-checkout session
//
// R5i (nat-geo-uplift): scaffolded 2026-05-31 against Square.
// R5k (nat-geo-uplift): swapped to Stripe 2026-05-31 — Patrik handed over live
//                       Space Rising Stripe credentials.
// M2  (membership-page): added solo-annual + solo-monthly plan types 2026-06-02.
//
// Env vars required for live operation:
//   STRIPE_SECRET_KEY          (sk_live_... or sk_test_...)
//   STRIPE_PUBLISHABLE_KEY     (pk_live_... or pk_test_...) — frontend only
//   STRIPE_WEBHOOK_SECRET      (whsec_... — used by the webhook handler)
//   STRIPE_PRICE_SOLO_MONTHLY  (price_xxx — the existing recurring Price ID for $83/mo solo)
//
// Without STRIPE_SECRET_KEY, returns 503 {configured: false} so the frontend
// falls back to "we'll email you a link" copy until keys land.
//
// Input  (POST JSON): { company_id, company_slug, email, plan_type, seats?, tier }
//   plan_type: 'solo-annual'   → $800 one-time payment (no seats param needed)
//              'solo-monthly'  → $83/mo recurring subscription (uses STRIPE_PRICE_SOLO_MONTHLY)
//              'team'          → per-seat annual pricing ($1000/$850/$700, requires seats)
//   tier: legacy 'paid' alias — treated as plan_type='team' when plan_type is absent
//
// Output (200 JSON):  { checkout_url, session_id }
// Output (503 JSON):  { configured: false, reason: "<missing var>" }

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY         = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_SOLO_MONTHLY = process.env.STRIPE_PRICE_SOLO_MONTHLY;

function pricePerSeat(seats) {
  if (seats <= 4)  return 1000;
  if (seats <= 14) return 850;
  if (seats <= 49) return 700;
  return null; // 50+ requires custom quote
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

  const { company_id, company_slug, email, seats, tier, plan_type: rawPlanType } = req.body || {};

  // Normalise plan_type — legacy callers pass tier='paid' with no plan_type.
  const planType = rawPlanType || (tier === 'paid' ? 'team' : null);
  if (!['solo-annual', 'solo-monthly', 'team'].includes(planType)) {
    return res.status(400).json({ error: 'plan_type must be solo-annual, solo-monthly, or team' });
  }
  if (!company_id && !company_slug) {
    return res.status(400).json({ error: 'company_id or company_slug required' });
  }
  if (!email) {
    return res.status(400).json({ error: 'email required' });
  }

  // Solo-monthly requires the recurring Price ID to be configured.
  if (planType === 'solo-monthly' && !STRIPE_PRICE_SOLO_MONTHLY) {
    return res.status(503).json({ configured: false, reason: 'STRIPE_PRICE_SOLO_MONTHLY not set' });
  }

  // Team plan requires a valid seat count.
  let seatCount = null;
  let ppm = null;
  if (planType === 'team') {
    seatCount = parseInt(seats, 10);
    if (!Number.isFinite(seatCount) || seatCount < 1) {
      return res.status(400).json({ error: 'seats must be a positive integer for team plan' });
    }
    ppm = pricePerSeat(seatCount);
    if (ppm === null) {
      return res.status(400).json({
        error: 'custom-pricing-required',
        message: 'Teams of 50+ seats need a custom quote — contact us instead of self-checkout.',
      });
    }
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve company_id from slug if needed.
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
    || (process.env.PUBLIC_BASE_URL || 'https://spacerising.org');

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

  try {
    let sessionParams;

    // ── SOLO ANNUAL — $800 one-time payment ───────────────────────────────
    if (planType === 'solo-annual') {
      sessionParams = {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: 80000, // $800.00
              product_data: {
                name: 'Space Rising Solo Membership — Annual',
                description: 'Full member access for 1 seat, billed once per year.',
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/space-rising-v2/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${origin}/space-rising-v2/signup?tier=paid&plan=solo-annual&canceled=1`,
        metadata: {
          kind: 'space-rising-membership',
          company_id: resolvedCompanyId,
          plan_type: 'solo-annual',
          seats: '1',
        },
        payment_intent_data: {
          metadata: {
            kind: 'space-rising-membership',
            company_id: resolvedCompanyId,
            plan_type: 'solo-annual',
          },
        },
      };

    // ── SOLO MONTHLY — $83/mo recurring subscription ──────────────────────
    } else if (planType === 'solo-monthly') {
      sessionParams = {
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [
          {
            price: STRIPE_PRICE_SOLO_MONTHLY,
            quantity: 1,
          },
        ],
        success_url: `${origin}/space-rising-v2/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${origin}/space-rising-v2/signup?tier=paid&plan=solo-monthly&canceled=1`,
        metadata: {
          kind: 'space-rising-membership',
          company_id: resolvedCompanyId,
          plan_type: 'solo-monthly',
          seats: '1',
        },
        subscription_data: {
          metadata: {
            kind: 'space-rising-membership',
            company_id: resolvedCompanyId,
            plan_type: 'solo-monthly',
          },
        },
      };

    // ── TEAM — per-seat annual one-time payment ───────────────────────────
    } else {
      const totalCents = ppm * seatCount * 100;
      sessionParams = {
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
        cancel_url:  `${origin}/space-rising-v2/signup?tier=paid&plan=team&canceled=1`,
        metadata: {
          kind: 'space-rising-membership',
          company_id: resolvedCompanyId,
          plan_type: 'team',
          seats: String(seatCount),
        },
        payment_intent_data: {
          metadata: {
            kind: 'space-rising-membership',
            company_id: resolvedCompanyId,
            plan_type: 'team',
            seats: String(seatCount),
          },
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session?.url || !session?.id) {
      console.error('Stripe checkout.sessions.create returned unexpected shape', session);
      return res.status(502).json({ error: 'stripe-bad-response' });
    }

    // Stamp the pending checkout so the webhook can find the company.
    await sb
      .from('directory_companies')
      .update({
        pending_checkout_session_id: session.id,
        pending_checkout_seats: seatCount || 1,
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
