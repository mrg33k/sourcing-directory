-- Reports / resources accessible to directory members
CREATE TABLE IF NOT EXISTS directory_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES directory_tenants(id) ON DELETE CASCADE,
  title         text NOT NULL,
  category      text,
  access        text NOT NULL, -- 'free', 'member'
  description   text,
  file_url      text,
  published_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dir_reports_tenant ON directory_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dir_reports_access ON directory_reports(access);

ALTER TABLE directory_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read free reports" ON directory_reports FOR SELECT USING (access = 'free');
CREATE POLICY "service full access reports" ON directory_reports FOR ALL USING (true);
