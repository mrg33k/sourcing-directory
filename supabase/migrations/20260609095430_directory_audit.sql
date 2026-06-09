-- Audit log for the directory admin: traceable record of destructive / role actions.
CREATE TABLE IF NOT EXISTS directory_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES directory_tenants(id) ON DELETE SET NULL,
  actor_email text,
  action      text NOT NULL,
  entity_type text,
  entity_id   uuid,
  detail      jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dir_audit_tenant  ON directory_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dir_audit_created ON directory_audit(created_at DESC);
ALTER TABLE directory_audit ENABLE ROW LEVEL SECURITY;
