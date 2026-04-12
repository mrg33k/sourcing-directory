-- Add updated_at and updated_by to directory_reports without affecting existing data
ALTER TABLE directory_reports
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- Backfill updated_at for existing rows using created_at
UPDATE directory_reports
SET updated_at = created_at
WHERE updated_at IS NULL;
