-- 022_payment_columns_backfill.sql
-- R5k follow-up (2026-05-31) — Smoke test of the Stripe checkout-webhook on
-- 2026-05-31 revealed that migration 020 (the original Square scaffold) was
-- never applied to prod. Migration 021 added only the two Stripe-specific
-- ID columns and assumed 020's generic pending_* / paid_* columns existed.
-- They didn't. The webhook handler ran past signature verification and event
-- routing successfully, then errored on PGRST204 "Could not find the
-- 'paid_at' column".
--
-- This migration backfills the columns the handlers actually reference,
-- without dragging the "Square" label into prod history. It's idempotent
-- (IF NOT EXISTS) and safe to re-run.

ALTER TABLE directory_companies
  ADD COLUMN IF NOT EXISTS pending_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS pending_checkout_seats      integer,
  ADD COLUMN IF NOT EXISTS pending_checkout_at         timestamptz,
  ADD COLUMN IF NOT EXISTS paid_seats                  integer,
  ADD COLUMN IF NOT EXISTS paid_at                     timestamptz,
  ADD COLUMN IF NOT EXISTS paid_receipt_url            text;

-- Index for the pending-checkout lookup (used by the create-session endpoint
-- when stamping a fresh session id; useful for ops queries too).
CREATE INDEX IF NOT EXISTS idx_directory_companies_pending_checkout_session_id
  ON directory_companies (pending_checkout_session_id);

COMMENT ON COLUMN directory_companies.pending_checkout_session_id IS
  'Stripe Checkout Session ID stamped when user enters checkout; cleared on webhook completion.';
COMMENT ON COLUMN directory_companies.paid_at IS
  'Timestamp of the most recent successful membership payment (from the Stripe session created_at).';
COMMENT ON COLUMN directory_companies.paid_receipt_url IS
  'Stripe receipt URL captured at webhook time; pulled from the payment intent latest_charge; surfaced on the welcome page.';
COMMENT ON COLUMN directory_companies.paid_seats IS
  'Number of seats the most recent payment covered.';
