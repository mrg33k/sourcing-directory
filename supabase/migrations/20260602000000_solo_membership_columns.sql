-- 20260602000000_solo_membership_columns.sql
-- Solo membership tiers — 2026-06-02
--
-- Adds two columns to support the solo pricing paths alongside team memberships:
--   1. paid_stripe_subscription_id — the Stripe Subscription object ID (sub_xxx)
--      stamped when a monthly subscription checkout completes. Null for annual
--      one-time payments (those use paid_stripe_payment_intent_id instead).
--   2. membership_billing — 'annual' | 'monthly'. Distinguishes solo-annual
--      ($800 one-time) from solo-monthly ($83/mo recurring subscription).
--      Also set for team annual purchases going forward.
--
-- Idempotent; safe to re-run.

ALTER TABLE directory_companies
  ADD COLUMN IF NOT EXISTS paid_stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS membership_billing           text;

CREATE INDEX IF NOT EXISTS idx_directory_companies_paid_stripe_subscription_id
  ON directory_companies (paid_stripe_subscription_id);

COMMENT ON COLUMN directory_companies.paid_stripe_subscription_id IS
  'Stripe Subscription ID (sub_xxx) for monthly memberships; null for annual one-time payments.';
COMMENT ON COLUMN directory_companies.membership_billing IS
  'Billing cadence: ''annual'' for one-time annual payments, ''monthly'' for recurring subscriptions.';
