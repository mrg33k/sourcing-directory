-- Seed: the one Congress that is genuinely real, and the nine media items that
-- genuinely cover it. Nothing else.
--
-- WHAT IS AND IS NOT IN HERE
-- --------------------------
-- IN:  one congress_events row, and nine congress_media rows pointing at
--      directory_listings rows that already existed.
-- OUT: participants, sessions, speakers, sponsors, organizations. All zero.
--      They are zero because they are zero. The design comp shows 842 registered
--      participants, 412 organizations, 1,326 connections and 48 sessions; every
--      one of those figures was invented and none is seeded here, not even as
--      "sample data" — sample data in a production table becomes real data the
--      moment somebody screenshots it.
--
-- THE DATE, AND WHY IT IS APRIL 29 AND NOT APRIL 28-29
-- ----------------------------------------------------
-- The build brief said to prefer the comp's "April 28 - 29, 2026" on the grounds
-- that the comp is newer than the hardcoded page. Checking the sources changed the
-- answer. FOUR independent sources say a single day, April 29:
--   1. www.spacerising.org/spacecongress — the CLIENT'S OWN LIVE PUBLIC SITE:
--      "INAUGURAL SPACE CONGRESS I APRIL 29, 2026 I PHOENIX, ARIZONA, USA"
--   2. src/pages/srw/SRWSpaceCongressV2.jsx:28 — the live marketing page in THIS app
--   3. src/pages/srw/SRWSpaceCongress.jsx:175 — the older marketing page
--   4. directory_listings 3fa76998 — AZFamily's news report, dated 2026-04-29
-- Exactly one source says April 28-29: Tim's comp, which is the same artefact that
-- invented 842 participants and 1,326 connections.
--
-- Publishing a date that contradicts the client's own homepage is the specific
-- failure this whole page exists to avoid, so the DB carries the client's published
-- date. It is ONE value in ONE row: if the client confirms two days, an admin edits
-- the event in Admin Tools -> Congress and every surface follows. Flagged for
-- confirmation.
--
-- THE EVENT IS IN THE PAST. Today is 2026-08-03; this event ran 2026-04-29. The
-- client's own site describes it in the past tense ("Arizona's first Space Congress
-- transformed collaboration into action"). The page therefore derives its card
-- heading from the date rather than hardcoding "Upcoming Congress", and will read
-- "Most Recent Congress" until an admin adds the next edition.
--
-- VENUE: "Hyatt Regency Phoenix" appears in the repo's two marketing pages but NOT
-- on the client's live site, which names only "Phoenix, Arizona, USA". Kept, and
-- flagged as the one fact here with a single unconfirmed source.
--
-- COPY: the description is the client's own published sentence, lifted verbatim from
-- www.spacerising.org/spacecongress. It is not comp copy and not written by us.

-- The Upcoming/Most-Recent card needs a short line under the venue, and the hero
-- needs the longer definition. Two fields rather than one reused string, both
-- editable by an admin.
alter table public.congress_events add column if not exists summary text;

insert into public.congress_events (
  id, tenant_id, name, slug, edition_year,
  starts_on, ends_on, venue, city, state,
  summary, description, website_url, hero_image_url, status
)
values (
  'a1c0f9e2-6d3b-4c85-9f21-7b0e4d5a8c10',
  '91dac63a-9ae2-49ea-b15d-4209c55f225f',
  'Arizona Space Congress',
  'arizona-space-congress-2026',
  2026,
  '2026-04-29',
  '2026-04-29',
  'Hyatt Regency Phoenix',
  'Phoenix',
  'AZ',
  'Leaders from industry, government, academia and investment convene to rank Arizona''s space-economy priorities and vote them into the Arizona Space Blueprint.',
  'The annual working convening, where representatives of the space economy meet to debate and rank the sector''s priorities. Discussion is captured and synthesized by AI in real time, validated by the participants so a human stays in the loop, and then voted into a shared roadmap, the Space Blueprint.',
  'https://www.spacerising.org/spacecongress',
  '/images/space-rising/hero-banner.jpg',
  'published'
)
on conflict (id) do update set
  starts_on      = excluded.starts_on,
  ends_on        = excluded.ends_on,
  venue          = excluded.venue,
  city           = excluded.city,
  state          = excluded.state,
  summary        = excluded.summary,
  description    = excluded.description,
  website_url    = excluded.website_url,
  hero_image_url = excluded.hero_image_url,
  updated_at     = now();

-- ---------------------------------------------------------------------------
-- The nine real media items
-- ---------------------------------------------------------------------------
-- Genuine coverage OF the Arizona Space Congress: FOX 10 Phoenix, PBS Arizona /
-- AZPBS, KTAR, AZFamily and YouTube. Four videos, three podcasts, two news items.
-- Every one already exists in directory_listings with a working embed URL; this
-- relates them to the event rather than copying them, so the Media pages and this
-- page read one set of rows that cannot drift apart.
--
-- DELIBERATELY EXCLUDED — the two impostors that also match "congress":
--   975726cb  "SpaceCom / Space Congress 2026"  -> Orlando, FLORIDA. Different event.
--   54563b5b  "International Astronautical Congress - IAC 2026" -> Antalya, Türkiye.
-- Neither is the Arizona event and neither is wired in.
insert into public.congress_media (tenant_id, event_id, listing_id, sort_order)
select
  '91dac63a-9ae2-49ea-b15d-4209c55f225f',
  'a1c0f9e2-6d3b-4c85-9f21-7b0e4d5a8c10',
  v.listing_id::uuid,
  v.ord
from (values
  -- Video first: the YouTube item is the only one carrying a real cover image.
  ('987a0e6b-aa8e-441d-83ec-b020cdec558d', 1),  -- YouTube  · full session footage
  ('a795d0bb-daa8-4e95-af14-cde8a071c637', 2),  -- FOX 10   · Space Congress talks
  ('d44ddaa9-3711-48dd-9db0-a0e84f7422b2', 3),  -- FOX 10   · "gold boom"
  ('86bc0330-ead6-4b00-a6c6-b8f60af16b68', 4),  -- PBS AZ   · Arizona Horizon
  -- News
  ('3fa76998-5446-469a-a6b2-2a32a8422aca', 5),  -- AZFamily · first Space Congress
  ('b131bad4-18e7-4e7e-b6d5-7c21c08e3fb0', 6),  -- AZPBS    · a full day of innovation
  -- Podcasts
  ('4f0e0f05-95b8-4e47-b6c4-7f9936024dc6', 7),  -- Open Space with David Ariosto
  ('9e6e22e4-dffc-4cde-a250-2411dc2aeb38', 8),  -- FOX 10 Talks
  ('b53bb819-5665-4a00-87a5-48f95c47f42f', 9)   -- KTAR Business
) as v(listing_id, ord)
where exists (select 1 from public.directory_listings l where l.id = v.listing_id::uuid)
on conflict (event_id, listing_id) do update set sort_order = excluded.sort_order;
