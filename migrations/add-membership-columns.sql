-- Add paid membership columns to directory_companies
-- membership_seats: number of seats included in the membership
-- membership_paid_at: timestamp when payment was confirmed
-- membership_expires_at: timestamp when membership expires (null = no expiry set)

ALTER TABLE directory_companies ADD COLUMN IF NOT EXISTS membership_seats INT DEFAULT 1;
ALTER TABLE directory_companies ADD COLUMN IF NOT EXISTS membership_paid_at TIMESTAMPTZ NULL;
ALTER TABLE directory_companies ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ NULL;
