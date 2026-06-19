-- Migration 028: admin_tickets — item type (issue vs feature).
--
-- Patrik (2026-06-19): differentiate bug reports ("issue") from requested new
-- work ("feature") on the same tracker board. An issue is something broken to
-- fix; a feature is new scope to build (e.g. Taryn's Space Congress landing
-- pages). Default 'issue' so every existing ticket reads as a bug, matching how
-- the tracker has been used to date.
--
-- Admin-only, mirrors admin_tickets RLS (service-role bypasses).

ALTER TABLE admin_tickets ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'issue'
  CHECK (type IN ('issue','feature'));

CREATE INDEX IF NOT EXISTS idx_admin_tickets_type ON admin_tickets(type);
