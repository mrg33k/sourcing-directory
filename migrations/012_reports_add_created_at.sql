-- Add missing created_at column to directory_reports
-- The original migration omitted this column but fetchReports orders by it
ALTER TABLE directory_reports
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Also fix the access column default to match admin UI values (public/members/paid)
ALTER TABLE directory_reports
  ALTER COLUMN access SET DEFAULT 'public';
