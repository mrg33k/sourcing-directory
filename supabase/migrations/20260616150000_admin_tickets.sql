-- Migration 025: Admin ticket / bug tracker
--
-- A living task tracker inside the admin panel: every requested fix or bug as a
-- ticket with a status (needs_fix / in_review / done), so the team has one source
-- of truth for what is requested, in progress, and done.
--
-- Admin-only: RLS is enabled with NO public/anon policies, so only the service-role
-- admin client (VITE_SOURCING_ADMIN_KEY) can read or write. tenant_id is nullable so
-- tickets can be scoped per-directory in the multi-tenant admin (matching MembersSection).

CREATE TABLE IF NOT EXISTS admin_tickets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        REFERENCES directory_tenants(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  description text,
  status      text        NOT NULL DEFAULT 'needs_fix'
                          CHECK (status IN ('needs_fix','in_review','done')),
  priority    text        NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low','medium','high')),
  assigned_to text,
  created_by  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_tickets_tenant ON admin_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_tickets_status ON admin_tickets(status);

ALTER TABLE admin_tickets ENABLE ROW LEVEL SECURITY;

-- No public policies: anon + authenticated are denied by default. The admin panel
-- talks to this table through the service-role client, which bypasses RLS entirely.
