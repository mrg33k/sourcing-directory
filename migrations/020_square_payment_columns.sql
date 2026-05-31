-- 020_square_payment_columns.sql
-- R5i (nat-geo-uplift) — Square Checkout integration.
-- Add payment-tracking columns to directory_companies so the checkout-session
-- endpoint can stamp a pending session, and the webhook can flip the row to
-- membership_tier='paid' idempotently.
--
-- Run this BEFORE pushing R5i to production. Safe to run on a row that already
-- has a paid tier from a manual upgrade — only adds columns, never overwrites.

ALTER TABLE directory_companies
  ADD COLUMN IF NOT EXISTS pending_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS pending_checkout_seats     integer,
  ADD COLUMN IF NOT EXISTS pending_checkout_at        timestamptz,
  ADD COLUMN IF NOT EXISTS paid_square_payment_id     text,
  ADD COLUMN IF NOT EXISTS paid_seats                 integer,
  ADD COLUMN IF NOT EXISTS paid_at                    timestamptz,
  ADD COLUMN IF NOT EXISTS paid_receipt_url           text;

-- Index for idempotency lookups by payment_id (webhook handler)
CREATE INDEX IF NOT EXISTS idx_directory_companies_paid_square_payment_id
  ON directory_companies (paid_square_payment_id);

-- Index for the pending-checkout lookup (less critical but cheap)
CREATE INDEX IF NOT EXISTS idx_directory_companies_pending_checkout_session_id
  ON directory_companies (pending_checkout_session_id);

COMMENT ON COLUMN directory_companies.pending_checkout_session_id IS
  'Square payment-link ID issued when user enters checkout; cleared on webhook completion.';
COMMENT ON COLUMN directory_companies.paid_square_payment_id IS
  'Square payment ID for the most recent successful membership payment; used for webhook idempotency.';
COMMENT ON COLUMN directory_companies.paid_receipt_url IS
  'Square receipt URL captured at webhook time; surfaced in welcome email.';
