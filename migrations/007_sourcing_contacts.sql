-- Contact/RFQ submissions
CREATE TABLE IF NOT EXISTS directory_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES directory_tenants(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES directory_companies(id) ON DELETE CASCADE,
  sender_name   text NOT NULL,
  sender_email  text NOT NULL,
  sender_phone  text,
  message       text NOT NULL,
  type          text DEFAULT 'contact', -- 'contact', 'rfq', 'inquiry'
  status        text DEFAULT 'new',     -- 'new', 'read', 'replied'
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dir_contacts_tenant ON directory_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dir_contacts_company ON directory_contacts(company_id);

ALTER TABLE directory_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public insert contacts" ON directory_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "service read contacts" ON directory_contacts FOR SELECT USING (true);

-- Page view tracking
CREATE TABLE IF NOT EXISTS directory_analytics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES directory_tenants(id) ON DELETE CASCADE,
  company_id    uuid REFERENCES directory_companies(id) ON DELETE CASCADE,
  event_type    text NOT NULL, -- 'page_view', 'search', 'contact_click', 'profile_view'
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dir_analytics_tenant ON directory_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dir_analytics_created ON directory_analytics(created_at);

ALTER TABLE directory_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public insert analytics" ON directory_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "service read analytics" ON directory_analytics FOR SELECT USING (true);
