-- 006: Member authentication for sourcing directory
-- Adds directory_members table linking Supabase auth users to directory companies
-- Supports self-service signup with approval flow

-- ─── Members table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS directory_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES directory_tenants(id) ON DELETE CASCADE,
  company_id    uuid REFERENCES directory_companies(id) ON DELETE SET NULL,
  email         text NOT NULL,
  full_name     text,
  role          text DEFAULT 'member',  -- 'member', 'admin'
  status        text DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  auth_user_id  uuid,                   -- links to Supabase auth.users
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dir_members_tenant ON directory_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dir_members_email ON directory_members(email);
CREATE INDEX IF NOT EXISTS idx_dir_members_status ON directory_members(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dir_members_tenant_email ON directory_members(tenant_id, email);

ALTER TABLE directory_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own" ON directory_members FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "service role all" ON directory_members FOR ALL USING (true);

-- ─── Self-service toggle on tenants ────────────────────────────────────────
ALTER TABLE directory_tenants ADD COLUMN IF NOT EXISTS self_service boolean DEFAULT true;
