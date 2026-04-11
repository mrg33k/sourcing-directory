-- Ensure file_url column exists on directory_reports
-- (Column was added in migration 008 but this guards against any fresh-schema path)
ALTER TABLE directory_reports
  ADD COLUMN IF NOT EXISTS file_url text;

-- Insert the S3C Quarterly Market Intelligence Report if it doesn't exist,
-- then update its file_url. Two-step is idempotent on re-runs.
INSERT INTO directory_reports (tenant_id, title, category, access, description, file_url, published_at)
SELECT
  t.id,
  'S3C Quarterly Market Intelligence Report',
  'quarterly',
  'member',
  'S3C Q1 2026 Market Intelligence Report covering Arizona semiconductor supply chain trends, fab capacity, workforce data, and investment pipeline.',
  'https://rag.aheadofmarket.com/files/shared:sourcing/eedc3008-S3C%20Quarterly%20Market%20Intelligence%20Report.docx',
  '2026-04-01 00:00:00+00'
FROM directory_tenants t
WHERE t.slug = 's3c-semiconductor'
  AND NOT EXISTS (
    SELECT 1 FROM directory_reports r WHERE r.title = 'S3C Quarterly Market Intelligence Report'
  );

-- Ensure the file_url is set (handles the case where the row already existed)
UPDATE directory_reports
  SET file_url = 'https://rag.aheadofmarket.com/files/shared:sourcing/eedc3008-S3C%20Quarterly%20Market%20Intelligence%20Report.docx'
  WHERE title = 'S3C Quarterly Market Intelligence Report';
