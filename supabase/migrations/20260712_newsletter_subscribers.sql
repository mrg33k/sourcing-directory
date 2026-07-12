-- Create newsletter_subscribers table for Directory page signups
create table if not exists public.newsletter_subscribers (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  source text default 'directory' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up RLS
alter table public.newsletter_subscribers enable row level security;

-- Allow anyone to insert (public signup)
create policy "Anyone can insert newsletter subscriptions"
  on public.newsletter_subscribers
  for insert
  with check (true);

-- Allow service role to read all
create policy "Service role can read newsletter subscriptions"
  on public.newsletter_subscribers
  for select
  using (auth.role() = 'service_role');
