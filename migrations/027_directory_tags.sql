-- Migration 027: Function tag taxonomy (six market tags + sub-tags)
--
-- Turns today's free-text tags (a jsonb array on directory_listings) into a
-- managed taxonomy: six top-level market tags (the same six Space Market Goals
-- as the homepage), each with a set of sub-tags via parent_tag_id (self-FK).
-- Admins manage the list; AI-suggest-on-upload + user-confirm is a later phase.
--
-- The existing substring tag search keeps working untouched — this table is the
-- managed source of truth that the upload flow and tag pages build on next.

CREATE TABLE IF NOT EXISTS directory_tags (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        REFERENCES directory_tenants(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  category      text,                          -- 'market_goal' for top tags, 'sub' under a parent
  parent_tag_id uuid        REFERENCES directory_tags(id) ON DELETE CASCADE,
  description   text,
  status        text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','retired')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_directory_tags_tenant ON directory_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_directory_tags_parent ON directory_tags(parent_tag_id);

ALTER TABLE directory_tags ENABLE ROW LEVEL SECURITY;

-- Public can read active tags (forward-compat for tag pages / FE filters). Writes
-- go through the service-role admin client, which bypasses RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename = 'directory_tags'
                   AND policyname = 'public read active tags') THEN
    CREATE POLICY "public read active tags"
      ON directory_tags FOR SELECT
      USING (status = 'active');
  END IF;
END $$;
