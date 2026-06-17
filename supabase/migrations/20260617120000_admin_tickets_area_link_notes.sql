-- Migration 026: admin_tickets — area + link + updated_by, and a notes thread.
--
-- Bridges toward the cv6 Tracker tool (one tracker per project/mission, agent works
-- the list): area tells the agent WHERE the bug lives, link is the exact screen,
-- updated_by gives accountability on every move, and admin_ticket_comments is the
-- thread where humans discuss and an agent can leave its thought-process notes
-- (is_agent flag). Admin-only, mirrors admin_tickets RLS (service-role bypasses).

ALTER TABLE admin_tickets ADD COLUMN IF NOT EXISTS area       text;  -- screen/mission the bug is on
ALTER TABLE admin_tickets ADD COLUMN IF NOT EXISTS link       text;  -- URL / where to see it
ALTER TABLE admin_tickets ADD COLUMN IF NOT EXISTS updated_by text;  -- who last moved it

CREATE TABLE IF NOT EXISTS admin_ticket_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid        NOT NULL REFERENCES admin_tickets(id) ON DELETE CASCADE,
  author     text,                       -- email or agent name
  body       text        NOT NULL,
  is_agent   boolean     DEFAULT false,  -- true = note left by the work-the-list agent
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_ticket_comments_ticket ON admin_ticket_comments(ticket_id, created_at);

ALTER TABLE admin_ticket_comments ENABLE ROW LEVEL SECURITY;
-- No public policies: only the service-role admin client reads/writes, same as admin_tickets.
