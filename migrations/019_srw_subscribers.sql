-- Migration 019: srw_subscribers
-- Stores subscriber and contact form submissions from the Space Rising website.
-- form_type: 'subscribe' = /sign-up form, 'contact' = home page contact form

create table if not exists srw_subscribers (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null    default now(),
  form_type        text        not null    default 'subscribe', -- 'subscribe' | 'contact'
  first_name       text,
  last_name        text,
  email            text        not null,
  organization     text,
  areas_of_interest text[],    -- selected interest buckets
  newsletter_opt_in boolean    not null    default false,
  message          text,
  source           text        not null    default 'website'
);

-- Public writes allowed (form submissions), no public reads.
alter table srw_subscribers enable row level security;

create policy "public_insert" on srw_subscribers
  for insert with check (true);

create policy "service_role_read" on srw_subscribers
  for select using (false); -- only service role can read via service key
