-- Add cover_image_url to directory_reports
-- Used to store per-report branded cover PNG URLs (uploaded to sourcing-reports storage bucket).
-- The JS static map in src/lib/reportCovers.js acts as interim until this column is populated.
ALTER TABLE directory_reports
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
