-- =============================================================================
-- Arizona Space Action Blueprint — governance schema
-- =============================================================================
--
-- Backs /blueprint (src/pages/os/OSBlueprint.jsx).
--
-- WHY THESE TABLES EXIST
-- ----------------------
-- The approved comp for this page shows a governance hierarchy: strategic
-- priorities -> goals -> initiatives -> KPIs, plus a roadmap, an alignment
-- register and an activity feed. Before this migration NONE of that had a home
-- in the database. The only real artefact was six rows in `directory_tags`
-- (category='market_goal') and the Blueprint PDF itself in `directory_reports`.
--
-- So this migration builds the machine and seeds ONLY what is verifiably true:
--   * the six priorities, linked to the tag rows that already define them
--   * the six phases of the Mobilization Method, verbatim from the report
--   * the four positions and five gaps, verbatim from the report
-- Goals, initiatives, KPIs and alignments are created EMPTY on purpose. The
-- report contains no hierarchy of goals or KPIs (three total occurrences of
-- "goal/initiative/KPI/objective" across 40 pages), so any row here would be
-- fiction. The page counts them and prints the real zero.
--
-- WHY `blueprint_priorities` REFERENCES `directory_tags` RATHER THAN REPLACING IT
-- ------------------------------------------------------------------------------
-- `directory_tags` (category='market_goal') is already the record for the six
-- priorities and is already consumed by the Directory's category filter. If this
-- table carried its own copy of the six names, the platform would have two
-- spellings of "Move in Space" that could drift apart — which is exactly the
-- failure this page exists to avoid. So `tag_id` is a real FK and the display
-- name is COALESCE(blueprint_priorities.name, directory_tags.name): the tag wins
-- unless an admin has deliberately overridden it. A priority created from
-- scratch in Admin Tools has tag_id NULL and carries its own name.
--
-- RLS
-- ---
-- Every table gets RLS ON with a SELECT-only policy for anon/authenticated.
-- There is deliberately NO insert/update/delete policy: all writes go through
-- POST /api/sourcing/admin, which holds the service-role key server-side, checks
-- the caller's admin claim, and is scoped by api/sourcing/lib/tablePolicy.js.
-- Service role bypasses RLS, so the write path works and the browser cannot
-- write directly even with a stolen anon key.
--
-- Applied to project kzzvjtthknsozktmpvak via the Supabase Management API
-- on 2026-08-03.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PRIORITIES — the six pillars
-- -----------------------------------------------------------------------------
create table if not exists public.blueprint_priorities (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.directory_tenants(id) on delete cascade,
  -- The canonical name lives on the tag. NULL here means "inherit it".
  tag_id      uuid unique references public.directory_tags(id) on delete set null,
  name        text,                       -- display override; NULL = use the tag's name
  slug        text not null,
  theme       text,                       -- the one-word theme (Infrastructure, Mobility, ...)
  summary     text,                       -- prose, sourced from the Blueprint report
  source_note text,                       -- WHICH part of the report the summary came from
  icon        text not null default 'grid',
  sort_order  integer not null default 0,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint blueprint_priorities_slug_per_tenant unique (tenant_id, slug),
  constraint blueprint_priorities_status_check check (status in ('active', 'archived')),
  -- A priority with no tag to inherit from MUST carry its own name.
  constraint blueprint_priorities_needs_a_name check (tag_id is not null or nullif(btrim(name), '') is not null)
);

-- -----------------------------------------------------------------------------
-- 2. GOALS — seeded EMPTY. The report defines none.
-- -----------------------------------------------------------------------------
create table if not exists public.blueprint_goals (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.directory_tenants(id) on delete cascade,
  priority_id  uuid not null references public.blueprint_priorities(id) on delete cascade,
  code         text,                      -- "2.1" etc., admin-assigned
  title        text not null,
  description  text,
  owner        text,
  status       text not null default 'not_started',
  progress_pct integer not null default 0,
  target_date  date,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint blueprint_goals_status_check check (status in ('not_started', 'in_progress', 'complete', 'on_hold')),
  constraint blueprint_goals_progress_check check (progress_pct between 0 and 100)
);
create index if not exists blueprint_goals_priority_idx on public.blueprint_goals (priority_id);
create index if not exists blueprint_goals_tenant_idx on public.blueprint_goals (tenant_id);

-- -----------------------------------------------------------------------------
-- 3. INITIATIVES — seeded EMPTY.
-- `goal_id` is nullable: an initiative can hang straight off a priority before
-- anyone has written the goal it will eventually belong to. Requiring a goal
-- first would mean an admin has to invent one to record real work.
-- -----------------------------------------------------------------------------
create table if not exists public.blueprint_initiatives (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.directory_tenants(id) on delete cascade,
  priority_id uuid not null references public.blueprint_priorities(id) on delete cascade,
  goal_id     uuid references public.blueprint_goals(id) on delete set null,
  title       text not null,
  description text,
  lead_org    text,
  owner       text,
  status      text not null default 'proposed',
  start_date  date,
  target_date date,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint blueprint_initiatives_status_check check (status in ('proposed', 'active', 'complete', 'on_hold'))
);
create index if not exists blueprint_initiatives_priority_idx on public.blueprint_initiatives (priority_id);
create index if not exists blueprint_initiatives_goal_idx on public.blueprint_initiatives (goal_id);

-- -----------------------------------------------------------------------------
-- 4. KPIS — seeded EMPTY.
-- Values are numeric and nullable. A KPI with no current_value is a measure
-- somebody has named but not yet measured, which is a real and common state;
-- the page renders it as "not measured yet" rather than as a 0.
-- -----------------------------------------------------------------------------
create table if not exists public.blueprint_kpis (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.directory_tenants(id) on delete cascade,
  priority_id    uuid not null references public.blueprint_priorities(id) on delete cascade,
  goal_id        uuid references public.blueprint_goals(id) on delete set null,
  name           text not null,
  description    text,
  unit           text not null default 'count',
  baseline_value numeric,
  current_value  numeric,
  target_value   numeric,
  as_of          date,
  source         text,                    -- where the number comes from, in words
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint blueprint_kpis_unit_check check (unit in ('count', 'percent', 'currency', 'ratio', 'text'))
);
create index if not exists blueprint_kpis_priority_idx on public.blueprint_kpis (priority_id);
create index if not exists blueprint_kpis_goal_idx on public.blueprint_kpis (goal_id);

-- -----------------------------------------------------------------------------
-- 5. MILESTONES — the roadmap. Seeded with the six real Mobilization Method
--    phases (report p.14). These are the only roadmap items that exist.
-- -----------------------------------------------------------------------------
create table if not exists public.blueprint_milestones (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.directory_tenants(id) on delete cascade,
  priority_id uuid references public.blueprint_priorities(id) on delete set null,
  phase_code  text,                       -- '01'..'06' for the Method phases
  title       text not null,
  description text,
  horizon     text,                       -- "Covered by this Blueprint", "2026-2030", ...
  status      text not null default 'planned',
  target_date date,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint blueprint_milestones_status_check check (status in ('planned', 'in_progress', 'complete'))
);

-- -----------------------------------------------------------------------------
-- 6. FINDINGS — the four positions where Arizona leads and the five gaps
--    holding it back (report p.17-18). Real, verbatim, and editable.
-- -----------------------------------------------------------------------------
create table if not exists public.blueprint_findings (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.directory_tenants(id) on delete cascade,
  kind        text not null,              -- 'position' (a strength) | 'gap' (a weakness)
  code        text,                       -- '+01/04', '-03/05'
  title       text not null,
  body        text,
  source_note text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint blueprint_findings_kind_check check (kind in ('position', 'gap'))
);

-- -----------------------------------------------------------------------------
-- 7. ALIGNMENTS — organization -> priority. Seeded EMPTY.
--    `directory_mission_scores` holds 7 rows and every one is a PERSON; no
--    company is aligned to anything today, so this table starts at zero and the
--    page says so.
-- -----------------------------------------------------------------------------
create table if not exists public.blueprint_alignments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.directory_tenants(id) on delete cascade,
  company_id  uuid not null references public.directory_companies(id) on delete cascade,
  priority_id uuid not null references public.blueprint_priorities(id) on delete cascade,
  note        text,
  aligned_by  text,
  created_at  timestamptz not null default now(),
  constraint blueprint_alignments_unique unique (company_id, priority_id)
);
create index if not exists blueprint_alignments_priority_idx on public.blueprint_alignments (priority_id);

-- -----------------------------------------------------------------------------
-- 8. ACTIVITY — the Recent Blueprint Activity feed.
--    Starts empty because nothing has ever emitted a blueprint event. Admin
--    Tools writes one row here after each CONFIRMED create/edit/delete, so the
--    feed is a record of things that actually happened, never a preview.
-- -----------------------------------------------------------------------------
create table if not exists public.blueprint_activity (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.directory_tenants(id) on delete cascade,
  action      text not null,              -- 'created' | 'updated' | 'deleted' | 'aligned'
  entity_type text not null,              -- 'priority' | 'goal' | 'initiative' | 'kpi' | 'milestone'
  entity_id   uuid,
  summary     text not null,              -- one human sentence, shown verbatim in the feed
  actor_email text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists blueprint_activity_created_idx on public.blueprint_activity (created_at desc);

-- =============================================================================
-- RLS — read for everyone, writes only through the service-role admin endpoint
-- =============================================================================
alter table public.blueprint_priorities  enable row level security;
alter table public.blueprint_goals       enable row level security;
alter table public.blueprint_initiatives enable row level security;
alter table public.blueprint_kpis        enable row level security;
alter table public.blueprint_milestones  enable row level security;
alter table public.blueprint_findings    enable row level security;
alter table public.blueprint_alignments  enable row level security;
alter table public.blueprint_activity    enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'blueprint_priorities', 'blueprint_goals', 'blueprint_initiatives', 'blueprint_kpis',
    'blueprint_milestones', 'blueprint_findings', 'blueprint_alignments', 'blueprint_activity'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'public read ' || t, t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      'public read ' || t, t
    );
  end loop;
end $$;

-- =============================================================================
-- SEED — only what the report and the existing tag rows actually say
-- =============================================================================

-- 8.1 The six priorities, bound to the six market_goal tags.
--     Names are NOT copied: `name` stays NULL so the tag's spelling is the one
--     that renders. `theme` mirrors the tag's one-word description for display
--     convenience. `summary` is drawn from the named report section, not written
--     as marketing copy — `source_note` records which section, per priority, so
--     any sentence here can be checked against the PDF.
insert into public.blueprint_priorities (tenant_id, tag_id, slug, theme, icon, sort_order, summary, source_note)
select
  t.tenant_id,
  t.id,
  s.slug,
  t.description,
  s.icon,
  s.sort_order,
  s.summary,
  s.source_note
from (values
  ('Build Space', 'build-space', 'mission-build', 1,
   'Infrastructure across the full operational lifecycle, not launch alone: research and development, design and integration, manufacturing and testing, orbital access, data systems and commercial operations. The Blueprint''s finding is that Arizona already holds these assets and that integrating them, rather than creating new ones, is the work.',
   'Arizona Space Blueprint 2026, Phase II - Infrastructure (Findings 01-03)'),
  ('Move in Space', 'move-in-space', 'mission-move', 2,
   'Launch and orbital access as one layer of a statewide system. Two emerging Arizona spaceport initiatives are underway, Yuma holds launch potential and logistics, and Sierra Vista offers operational and reentry infrastructure. The Blueprint asks for these to be designed as complementary parts of one plan rather than separate projects competing for the same federal dollars.',
   'Arizona Space Blueprint 2026, Phase II - Infrastructure (Findings 01, 04)'),
  ('Operate in Space', 'operate-in-space', 'mission-operate', 3,
   'Operating missions from Arizona, not just building them. The Blueprint names this as the state''s first gap: Arizona builds missions but does not operate them locally, so the work moves to Colorado, Maryland and California, and the talent follows. Data systems and downstream services are the layer where that changes.',
   'Arizona Space Blueprint 2026, Gap -01/05 and Phase II - Infrastructure Finding 01'),
  ('Live in Space', 'live-in-space', 'mission-live', 4,
   'The human layer of the space economy, which the Blueprint calls the new bottleneck. Arizona already hosts established companies across life support, mission systems and avionics, and its universities run active NASA missions and space-biology research. The constraint is the on-ramp: the state produces high-skill graduates and then loses most of them within five years.',
   'Arizona Space Blueprint 2026, Phase II - Human Frontiers (Findings 01-03)'),
  ('Prosper in Space', 'prosper-in-space', 'mission-prosper', 5,
   'Commercialization as the primary growth engine. The orbital economy is projected to grow from roughly $630 billion in 2023 to $1.8 trillion by 2035, but leadership positions are set well before the market reaches full scale. The Blueprint''s named gap is capital formation: Arizona-founded companies routinely have to leave the state to raise.',
   'Arizona Space Blueprint 2026, Phase I - Information; Phase II - Technology Finding 04; Gap -05/05'),
  ('Secure Space', 'secure-space', 'mission-secure', 6,
   'National security space, where Arizona is already strongest. The state ranks first nationally in the concentration of guided missile and space vehicle manufacturing employment, $3.5B in SDA Tranche 3 Tracking Layer contracts were awarded in 2025, and Davis-Monthan and Yuma Proving Ground are named as candidate integrated nodes for cleared space-systems testing.',
   'Arizona Space Blueprint 2026, At a Glance; Phase III - Defense lane')
) as s(tag_name, slug, icon, sort_order, summary, source_note)
join public.directory_tags t
  on t.name = s.tag_name
 and t.category = 'market_goal'
 and t.status = 'active'
on conflict (tag_id) do nothing;

-- 8.2 The roadmap: the six phases of the Mobilization Method, verbatim (p.14).
--     Status follows the report's own statement of what this document covers:
--     "Phases I through IV of the Method. Phase V (Implementation) is the work
--     that follows from this document. Phase VI (Impact) is what we measure
--     ourselves against over the next decade."
insert into public.blueprint_milestones (tenant_id, phase_code, title, description, horizon, status, sort_order)
select ten.id, m.phase_code, m.title, m.description, m.horizon, m.status, m.sort_order
from public.directory_tenants ten
cross join (values
  ('01', 'Information',    'Context for global-to-local alignment.',              'Delivered in this Blueprint',      'complete',    1),
  ('02', 'Investigation',  'Focused study of priority sectors.',                  'Delivered in this Blueprint',      'complete',    2),
  ('03', 'Ideation',       'Rapid development of prioritized tactics.',           'Delivered in this Blueprint',      'complete',    3),
  ('04', 'Innovation',     'Identification and acceleration of emerging tech.',   'Delivered in this Blueprint',      'complete',    4),
  ('05', 'Implementation', 'Translation into a working ecosystem strategy.',      'The work that follows this document', 'in_progress', 5),
  ('06', 'Impact',         'Space-for-Earth outcomes that strengthen economies.', 'Measured over the next decade',     'planned',     6)
) as m(phase_code, title, description, horizon, status, sort_order)
where ten.slug = 'space-rising'
  and not exists (select 1 from public.blueprint_milestones existing where existing.phase_code = m.phase_code);

-- 8.3 The four positions where Arizona leads (p.17) and the five gaps holding
--     the ecosystem back (p.18). Titles and bodies are the report's own.
insert into public.blueprint_findings (tenant_id, kind, code, title, body, source_note, sort_order)
select ten.id, f.kind, f.code, f.title, f.body, f.source_note, f.sort_order
from public.directory_tenants ten
cross join (values
  ('position', '+01/04', 'Cross-Sector Convergence',
   'Arizona sits at the intersection of commercial space, national security, academia, and advanced manufacturing. No other state holds all four corners at once.',
   'Arizona Space Blueprint 2026, "Where Arizona has a real advantage"', 1),
  ('position', '+02/04', 'Industrial and Manufacturing Strength',
   'Affordable infrastructure, an experienced aerospace labor base, and physical room to scale. Three things California and Florida no longer offer at the same price point.',
   'Arizona Space Blueprint 2026, "Where Arizona has a real advantage"', 2),
  ('position', '+03/04', 'Talent Pipeline at Scale',
   'Arizona State University and the University of Arizona produce thousands of high-skill graduates per year across engineering, science, and mission systems. Most leave the state within five years of graduation.',
   'Arizona Space Blueprint 2026, "Where Arizona has a real advantage"', 3),
  ('position', '+04/04', 'Strategic Geography and Stability',
   'Minimal natural-disaster risk and strong logistics positioning make Arizona reliable for operations, testing, and mission continuity. Insurance costs and downtime risk are meaningfully lower than competing space states.',
   'Arizona Space Blueprint 2026, "Where Arizona has a real advantage"', 4),
  ('gap', '-01/05', 'Lack of Operational Infrastructure',
   'Arizona builds missions but does not operate them locally. The work moves to Colorado, Maryland, and California. The talent follows.',
   'Arizona Space Blueprint 2026, "Where Arizona is falling short"', 5),
  ('gap', '-02/05', 'Missing Identity and Narrative',
   'Arizona is still perceived nationally as a supporting player rather than a leader. The gap is positioning. The gap can close.',
   'Arizona Space Blueprint 2026, "Where Arizona is falling short"', 6),
  ('gap', '-03/05', 'Legal and Policy Friction',
   'Regulatory uncertainty around export controls and commercialization pathways adds drag on deal flow that competing states have already reduced.',
   'Arizona Space Blueprint 2026, "Where Arizona is falling short"', 7),
  ('gap', '-04/05', 'Fragmentation Across the Ecosystem',
   'Universities, companies, government, and the military all hold AZ-based assets that should be operating as one system. They are not yet connected.',
   'Arizona Space Blueprint 2026, "Where Arizona is falling short"', 8),
  ('gap', '-05/05', 'Capital Formation Gaps',
   'Venture and growth capital flowing into AZ space remains a fraction of what flows into California, Texas, or Florida. AZ-founded companies routinely have to leave the state to raise.',
   'Arizona Space Blueprint 2026, "Where Arizona is falling short"', 9)
) as f(kind, code, title, body, source_note, sort_order)
where ten.slug = 'space-rising'
  and not exists (select 1 from public.blueprint_findings existing where existing.code = f.code);

-- No seed for blueprint_goals, blueprint_initiatives, blueprint_kpis,
-- blueprint_alignments or blueprint_activity. Those are empty because the truth
-- is empty. The page counts them and prints zero.
-- The Overview grid needs a one-liner; the Priorities tab needs the paragraph.
-- One column cannot be both without either blowing the card height (which it
-- did) or losing the sourced detail. So: `blurb` is the card, `summary` is the
-- page. Both come from the same cited section of the report.
alter table public.blueprint_priorities add column if not exists blurb text;

update public.blueprint_priorities set blurb = v.blurb
from (values
  ('build-space',      'Infrastructure across the full operational lifecycle, not launch alone. Arizona already holds the assets; integration is the work.'),
  ('move-in-space',    'Launch and orbital access as one statewide system: two emerging spaceport initiatives, Yuma logistics, Sierra Vista reentry.'),
  ('operate-in-space', 'Operating missions from Arizona, not just building them. Today that work moves to other states, and the talent follows.'),
  ('live-in-space',    'The human layer, and the Blueprint''s named bottleneck. Arizona produces the graduates and then loses most of them.'),
  ('prosper-in-space', 'Commercialization as the growth engine, against a capital-formation gap that pushes AZ-founded companies out of state.'),
  ('secure-space',     'National security space, where Arizona is already strongest: first nationally in space manufacturing employment.')
) as v(slug, blurb)
where blueprint_priorities.slug = v.slug;
