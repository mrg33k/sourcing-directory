-- Directory Site Content — admin-editable page copy overrides
-- Additive / non-destructive / IF NOT EXISTS
-- Applied 2026-07-23 via Supabase management API (database/query endpoint)

CREATE TABLE IF NOT EXISTS directory_site_content (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL,
  page_key    text        NOT NULL,
  field_key   text        NOT NULL,
  value       text        NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT  directory_site_content_unique UNIQUE (tenant_id, page_key, field_key)
);

ALTER TABLE directory_site_content ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'directory_site_content'
      AND policyname = 'site_content_public_read'
  ) THEN
    CREATE POLICY site_content_public_read
      ON directory_site_content
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;
