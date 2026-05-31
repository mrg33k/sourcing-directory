-- 021_stripe_payment_columns.sql
-- R5k (nat-geo-uplift) — Stripe Checkout integration (swap from Square scaffold
-- in migration 020 — never deployed). Adds Stripe-specific tracking columns
-- alongside the generic pending_* / paid_* shape from 020.
--
-- Safe to run after 020 (additive only, IF NOT EXISTS). The Square-specific
-- column paid_square_payment_id from 020 is left in place (unused) to avoid
-- a destructive change in case 020 was already applied.
--
-- Run this BEFORE pushing R5j to production.

ALTER TABLE directory_companies
  ADD COLUMN IF NOT EXISTS paid_stripe_session_id        text,
  ADD COLUMN IF NOT EXISTS paid_stripe_payment_intent_id text;

-- Idempotency lookup for webhook deliveries.
CREATE INDEX IF NOT EXISTS idx_directory_companies_paid_stripe_session_id
  ON directory_companies (paid_stripe_session_id);

COMMENT ON COLUMN directory_companies.paid_stripe_session_id IS
  'Stripe Checkout Session ID for the most recent successful membership payment; used for webhook idempotency.';
COMMENT ON COLUMN directory_companies.paid_stripe_payment_intent_id IS
  'Stripe PaymentIntent ID for the most recent successful membership payment; reference for refunds + receipt lookups.';
