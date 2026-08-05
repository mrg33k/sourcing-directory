-- Space Congress Integration — the schema behind /congress.
--
-- WHY THIS EXISTS
-- ---------------
-- Before this migration the Arizona Space Congress existed in exactly one place in
-- the entire product: a hardcoded JSX string at src/pages/srw/SRWSpaceCongress.jsx:175
-- reading "April 29, 2026 | Hyatt Regency | Phoenix, Arizona". There was no event row,
-- no sessions, no speakers, no registrations, no notion of an organization attending
-- anything. Every figure on the design comp for this page (842 participants, 412
-- organizations, 1,326 connections, 48 sessions) was invented.
--
-- So this is the machine, not the numbers. The tables below are empty on purpose
-- except for the one event that is genuinely true and the nine media items that
-- genuinely exist. Everything else is filled by an admin through Admin Tools →
-- Congress, and every count on the page reads the real row count, which on day one
-- is zero and is displayed as zero.
--
-- NAMING: `congress_*`. Three other agents are building against this database in
-- parallel; nothing here touches or renames an existing table.
--
-- TENANCY: every table carries `tenant_id` even where it could be inferred from a
-- parent. That is deliberate — api/sourcing/lib/tablePolicy.js scopes a non-global
-- admin on a table's own tenant column, and a table with no tenant column has to
-- declare `globalOnly` or `parentScope` instead. Carrying the column on every table
-- keeps all six policies identical and keeps the RLS predicates single-table.
--
-- DATES: `date` + `time`, not `timestamptz`. A conference agenda is stated in local
-- wall-clock time ("9:00 AM, Main Stage") and Arizona does not observe DST, so
-- storing an instant would add a timezone conversion that can only ever introduce
-- drift between what the admin typed and what the attendee reads.

-- ---------------------------------------------------------------------------
-- 1. congress_events — the event stops being a hardcoded string
-- ---------------------------------------------------------------------------
create table if not exists public.congress_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.directory_tenants(id) on delete cascade,
  name          text not null,
  slug          text,
  edition_year  integer,
  -- starts_on / ends_on are the SINGLE source of the event date. The marketing page
  -- and this page must never disagree again; SRWSpaceCongress.jsx should read this row.
  starts_on     date not null,
  ends_on       date,
  venue         text,
  city          text,
  state         text,
  description   text,
  website_url   text,
  hero_image_url text,
  status        text not null default 'published',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists congress_events_tenant_idx on public.congress_events (tenant_id, starts_on desc);

-- ---------------------------------------------------------------------------
-- 2. congress_speakers — a speaker may or may not be someone we already know
-- ---------------------------------------------------------------------------
-- person_id / company_id are nullable on purpose: a keynote speaker flown in for the
-- day is usually not in directory_people, and refusing to record them until they are
-- would make the admin screen unusable. full_name is therefore the required field and
-- the link to a real profile is the enrichment.
create table if not exists public.congress_speakers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.directory_tenants(id) on delete cascade,
  event_id    uuid not null references public.congress_events(id) on delete cascade,
  person_id   uuid references public.directory_people(id) on delete set null,
  company_id  uuid references public.directory_companies(id) on delete set null,
  full_name   text not null,
  title       text,
  org_name    text,
  headshot_url text,
  bio         text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists congress_speakers_event_idx on public.congress_speakers (event_id, sort_order);

-- ---------------------------------------------------------------------------
-- 3. congress_sessions — the agenda
-- ---------------------------------------------------------------------------
create table if not exists public.congress_sessions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.directory_tenants(id) on delete cascade,
  event_id     uuid not null references public.congress_events(id) on delete cascade,
  title        text not null,
  description  text,
  session_date date,
  starts_at    time,
  ends_at      time,
  room         text,
  track        text,
  is_featured  boolean not null default true,
  sort_order   integer not null default 0,
  status       text not null default 'published',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists congress_sessions_event_idx
  on public.congress_sessions (event_id, session_date, starts_at);

-- ---------------------------------------------------------------------------
-- 4. congress_session_speakers — a session can have a panel, not just one face
-- ---------------------------------------------------------------------------
-- Carries its own tenant_id (see the TENANCY note at the top) so the admin policy
-- for it is the same shape as the other five and needs no parentScope rule.
create table if not exists public.congress_session_speakers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.directory_tenants(id) on delete cascade,
  session_id    uuid not null references public.congress_sessions(id) on delete cascade,
  speaker_id    uuid not null references public.congress_speakers(id) on delete cascade,
  speaking_role text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (session_id, speaker_id)
);

create index if not exists congress_session_speakers_session_idx
  on public.congress_session_speakers (session_id, sort_order);

-- ---------------------------------------------------------------------------
-- 5. congress_organizations — which organizations are at the event, and as what
-- ---------------------------------------------------------------------------
-- `role` is the exhibitor / sponsor / academic / attendee / partner badge the design
-- draws on each organization card. It is CHECK-constrained rather than left as free
-- text because the page renders it as a badge and an unrecognised value would render
-- as an unstyled chip that nobody notices is wrong.
create table if not exists public.congress_organizations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.directory_tenants(id) on delete cascade,
  event_id     uuid not null references public.congress_events(id) on delete cascade,
  company_id   uuid not null references public.directory_companies(id) on delete cascade,
  role         text not null default 'attendee'
               check (role in ('exhibitor', 'sponsor', 'academic', 'attendee', 'partner')),
  sponsor_tier text,
  booth        text,
  sort_order   integer not null default 0,
  status       text not null default 'published',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (event_id, company_id, role)
);

create index if not exists congress_organizations_event_idx
  on public.congress_organizations (event_id, role, sort_order);

-- ---------------------------------------------------------------------------
-- 6. congress_registrations — who is going
-- ---------------------------------------------------------------------------
-- This table holds personal data (name + email of every registrant), so unlike the
-- five above it is NOT publicly readable. A signed-in user reads their own row and
-- nothing else; the page gets the headline participant COUNT from the security-definer
-- function below, so a real number can be shown without exposing the list.
create table if not exists public.congress_registrations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.directory_tenants(id) on delete cascade,
  event_id      uuid not null references public.congress_events(id) on delete cascade,
  person_id     uuid references public.directory_people(id) on delete set null,
  member_id     uuid references public.directory_members(id) on delete set null,
  auth_user_id  uuid,
  full_name     text,
  email         text,
  ticket_type   text not null default 'general',
  status        text not null default 'registered'
                check (status in ('registered', 'cancelled', 'attended')),
  sessions_attending integer not null default 0,
  meetings_scheduled integer not null default 0,
  registered_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists congress_registrations_event_idx
  on public.congress_registrations (event_id, status);
create index if not exists congress_registrations_user_idx
  on public.congress_registrations (auth_user_id);

-- ---------------------------------------------------------------------------
-- 7. congress_media — relate real coverage to the event
-- ---------------------------------------------------------------------------
-- The nine FOX 10 / PBS / KTAR / AZFamily / YouTube items are already real rows in
-- directory_listings, which is their correct home. Copying them here would create a
-- second copy that drifts. This is a join, so the media stays where the Media pages
-- already read it from and the Congress page relates to it.
create table if not exists public.congress_media (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.directory_tenants(id) on delete cascade,
  event_id   uuid not null references public.congress_events(id) on delete cascade,
  listing_id uuid not null references public.directory_listings(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, listing_id)
);

create index if not exists congress_media_event_idx on public.congress_media (event_id, sort_order);

-- ---------------------------------------------------------------------------
-- RLS — mirrors the directory_* house pattern: public read + service_role full
-- ---------------------------------------------------------------------------
alter table public.congress_events            enable row level security;
alter table public.congress_speakers          enable row level security;
alter table public.congress_sessions          enable row level security;
alter table public.congress_session_speakers  enable row level security;
alter table public.congress_organizations     enable row level security;
alter table public.congress_registrations     enable row level security;
alter table public.congress_media             enable row level security;

drop policy if exists "public read congress events" on public.congress_events;
create policy "public read congress events" on public.congress_events
  for select using (status = 'published');

drop policy if exists "service full access congress events" on public.congress_events;
create policy "service full access congress events" on public.congress_events
  for all using (auth.role() = 'service_role');

drop policy if exists "public read congress speakers" on public.congress_speakers;
create policy "public read congress speakers" on public.congress_speakers
  for select using (true);

drop policy if exists "service full access congress speakers" on public.congress_speakers;
create policy "service full access congress speakers" on public.congress_speakers
  for all using (auth.role() = 'service_role');

drop policy if exists "public read congress sessions" on public.congress_sessions;
create policy "public read congress sessions" on public.congress_sessions
  for select using (status = 'published');

drop policy if exists "service full access congress sessions" on public.congress_sessions;
create policy "service full access congress sessions" on public.congress_sessions
  for all using (auth.role() = 'service_role');

drop policy if exists "public read congress session speakers" on public.congress_session_speakers;
create policy "public read congress session speakers" on public.congress_session_speakers
  for select using (true);

drop policy if exists "service full access congress session speakers" on public.congress_session_speakers;
create policy "service full access congress session speakers" on public.congress_session_speakers
  for all using (auth.role() = 'service_role');

drop policy if exists "public read congress organizations" on public.congress_organizations;
create policy "public read congress organizations" on public.congress_organizations
  for select using (status = 'published');

drop policy if exists "service full access congress organizations" on public.congress_organizations;
create policy "service full access congress organizations" on public.congress_organizations
  for all using (auth.role() = 'service_role');

drop policy if exists "public read congress media" on public.congress_media;
create policy "public read congress media" on public.congress_media
  for select using (true);

drop policy if exists "service full access congress media" on public.congress_media;
create policy "service full access congress media" on public.congress_media
  for all using (auth.role() = 'service_role');

-- Registrations: a signed-in user sees their OWN row. There is no public read.
drop policy if exists "read own congress registration" on public.congress_registrations;
create policy "read own congress registration" on public.congress_registrations
  for select using (auth.uid() is not null and auth_user_id = auth.uid());

drop policy if exists "service full access congress registrations" on public.congress_registrations;
create policy "service full access congress registrations" on public.congress_registrations
  for all using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- congress_event_stats() — the four headline numbers, without leaking the roster
-- ---------------------------------------------------------------------------
-- The stat strip needs a participant count, but congress_registrations is not
-- publicly readable and must not become so. A security-definer function returns the
-- COUNT and nothing else: no name, no email, no row.
--
-- It returns real zeros. That is the point of the whole exercise — on the day this
-- ships every one of these is 0, the page prints 0, and it never prints 842.
create or replace function public.congress_event_stats(p_event_id uuid)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'participants', (
      select count(*) from congress_registrations
      where event_id = p_event_id and status in ('registered', 'attended')
    ),
    'organizations', (
      select count(distinct company_id) from congress_organizations
      where event_id = p_event_id and status = 'published'
    ),
    'speakers', (
      select count(*) from congress_speakers where event_id = p_event_id
    ),
    'sessions', (
      select count(*) from congress_sessions
      where event_id = p_event_id and status = 'published'
    )
  );
$$;

revoke all on function public.congress_event_stats(uuid) from public;
grant execute on function public.congress_event_stats(uuid) to anon, authenticated, service_role;
