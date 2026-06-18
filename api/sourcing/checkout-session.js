// POST /api/sourcing/checkout-session — create a Stripe hosted-checkout session
//
// R5i (nat-geo-uplift): scaffolded 2026-05-31 against Square.
// R5k (nat-geo-uplift): swapped to Stripe 2026-05-31 — Patrik handed over live
//                       Space Rising Stripe credentials.
// M2  (membership-page): added solo-annual + solo-monthly plan types 2026-06-02.
// M3  (membership-page): replaced solo/team model with employee-tier pricing 2026-06-02.
//
// Env vars required for live operation:
//   STRIPE_SECRET_KEY   (sk_live_... or sk_test_...)
//   STRIPE_PUBLISHABLE_KEY (pk_live_... or pk_test_...) — frontend only
//   STRIPE_WEBHOOK_SECRET  (whsec_... — used by the webhook handler)
//
// Without STRIPE_SECRET_KEY, returns 503 {configured: false} so the frontend
// falls back to "we'll email you a link" copy until keys land.
//
// Input  (POST JSON): { company_id, company_slug, email, plan_type, tier }
//   plan_type: 'small-annual'   → $500 one-time payment
//              'small-monthly'  → $50/mo recurring subscription
//              'mid-annual'     → $1,000 one-time payment
//              'mid-monthly'    → $100/mo recurring subscription
//              'large-annual'   → $2,700 one-time payment
//              'large-monthly'  → $250/mo recurring subscription
//   tier: legacy 'paid' alias — treated as plan_type='small-annual' when plan_type is absent
//
// Output (200 JSON):  { checkout_url, session_id }
// Output (503 JSON):  { configured: false, reason: "<missing var>" }

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const PLANS = {
  'small-annual':  { cents: 50000,  name: 'Space Rising Membership — Annual (<25 employees)',     mode: 'payment'      },
  'small-monthly': { cents: 5000,   name: 'Space Rising Membership — Monthly (<25 employees)',    mode: 'subscription' },
  'mid-annual':    { cents: 100000, name: 'Space Rising Membership — Annual (25–199 employees)',  mode: 'payment'      },
  'mid-monthly':   { cents: 10000,  name: 'Space Rising Membership — Monthly (25–199 employees)', mode: 'subscription' },
  'large-annual':  { cents: 270000, name: 'Space Rising Membership — Annual (200+ employees)',    mode: 'payment'      },
  'large-monthly': { cents: 25000,  name: 'Space Rising Membership — Monthly (200+ employees)',   mode: 'subscription' },
};

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

  const { company_id, company_slug, email, tier, plan_type: rawPlanType } = req.body || {};

  // Normalise plan_type — legacy callers pass tier='paid' with no plan_type.
  const planType = rawPlanType || (tier === 'paid' ? 'small-annual' : null);
  if (!Object.keys(PLANS).includes(planType)) {
    return res.status(400).json({ error: `plan_type must be one of: ${Object.keys(PLANS).join(', ')}` });
  }
  if (!company_id && !company_slug) {
    return res.status(400).json({ error: 'company_id or company_slug required' });
  }
  if (!email) {
    return res.status(400).json({ error: 'email required' });
  }

  const plan = PLANS[planType];

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

    if (plan.mode === 'payment') {
      // ── Annual — one-time payment ─────────────────────────────────────────
      sessionParams = {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: plan.cents,
              product_data: { name: plan.name },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/spaceos/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${origin}/spaceos/signup?tier=paid&plan=${planType}&canceled=1`,
        metadata: {
          kind: 'space-rising-membership',
          company_id: resolvedCompanyId,
          plan_type: planType,
        },
        payment_intent_data: {
          metadata: {
            kind: 'space-rising-membership',
            company_id: resolvedCompanyId,
            plan_type: planType,
          },
        },
      };
    } else {
      // ── Monthly — recurring subscription (inline price_data) ──────────────
      sessionParams = {
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: plan.cents,
              recurring: { interval: 'month' },
              product_data: { name: plan.name },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/spaceos/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${origin}/spaceos/signup?tier=paid&plan=${planType}&canceled=1`,
        metadata: {
          kind: 'space-rising-membership',
          company_id: resolvedCompanyId,
          plan_type: planType,
        },
        subscription_data: {
          metadata: {
            kind: 'space-rising-membership',
            company_id: resolvedCompanyId,
            plan_type: planType,
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
