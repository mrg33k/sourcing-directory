-- Add is_premium boolean column to directory_reports
-- Premium reports require a paid membership tier to access (distinct from the existing
-- access='member' text field). Defaults to false so existing rows are unaffected.
ALTER TABLE directory_reports
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_dir_reports_is_premium ON directory_reports(is_premium);
