-- ===========================================================================
-- 033_profile_read_rpcs.sql — one call, one payload, per profile screen
-- ===========================================================================
--
-- WHAT THIS IS
--   get_person_profile(p_slug)  -> the entire /people/:slug payload as jsonb
--   get_company_profile(p_slug) -> the entire /company/:slug payload as jsonb
--
--   Key names match src/lib/profileFixtures.js EXACTLY, so the screens need no
--   edits: the RPC result drops into the same normalizer the fixtures go
--   through. src/lib/profileApi.js swaps its .from(...).select(...) for
--   .rpc('get_person_profile', { p_slug: slug }) and nothing else changes.
--
--   One round trip instead of eight. The person screen alone needs the person,
--   capabilities, needs, affiliations, experience, mission scores and an
--   analytics count; as separate PostgREST calls that is eight requests and
--   eight chances for a partially-rendered profile.
--
-- RULES THESE FUNCTIONS FOLLOW
--   * SECURITY DEFINER, so RLS is BYPASSED. Every function therefore filters
--     status ITSELF. A definer function that forgets this is a data leak with
--     a friendly name.
--   * SET search_path = public, pg_temp on every one of them.
--   * EXPLICIT COLUMN ALLOWLIST against directory_companies. Never SELECT *.
--     That table carries membership_tier, membership_seats, membership_paid_at,
--     membership_expires_at, membership_billing, paid_stripe_session_id,
--     paid_stripe_payment_intent_id, paid_stripe_subscription_id,
--     pending_checkout_session_id, pending_checkout_seats, pending_checkout_at,
--     paid_seats, paid_at and paid_receipt_url. None of that may ever reach a
--     public payload, and `select *` is how it would.
--   * NOT FOUND returns SQL NULL, not an exception. PostgREST answers 200 with
--     a `null` body and the screen shows its not-found state.
--
-- WHAT IS COMPUTED VS. STORED
--   Computed here (real data exists):
--     profile views      <- directory_analytics
--     opportunities      <- directory_listings
--     people count       <- directory_people
--     capability totals  <- the child tables
--   NOT invented (no data exists): connections, organizations, projects,
--   events attended. Those stats are OMITTED from the payload rather than
--   zero-filled, so the card asks for the data in place instead of printing a
--   confident 0. Patrik's call, 2026-07-28.
--
-- IDEMPOTENT: CREATE OR REPLACE only. Safe to run twice.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- get_person_profile
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_person_profile(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  -- The design lists ten capabilities and states a total of twelve.
  k_shown_limit constant integer := 10;

  v            directory_people%ROWTYPE;
  v_caps_total integer;
  v_caps       jsonb;
  v_missions   jsonb;
  v_seeking    jsonb;
  v_providing  jsonb;
  v_affil      jsonb;
  v_experience jsonb;
  v_views      integer;
  v_stats      jsonb := '[]'::jsonb;
  v_location   text;
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RETURN NULL;
  END IF;

  -- RLS is bypassed here. This is the status filter.
  SELECT * INTO v
  FROM directory_people
  WHERE slug = p_slug AND status = 'active';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_location := NULLIF(
    concat_ws(', ', NULLIF(v.city,''), NULLIF(v.state,''), NULLIF(v.country,'')), '');

  SELECT count(*) INTO v_caps_total
  FROM directory_person_capabilities WHERE person_id = v.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.name)
                            ORDER BY c.sort_order, c.name), '[]'::jsonb)
    INTO v_caps
  FROM (
    SELECT id, name, sort_order
    FROM directory_person_capabilities
    WHERE person_id = v.id
    ORDER BY sort_order, name
    LIMIT k_shown_limit
  ) c;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'label', t.name, 'pct', s.score)
                            ORDER BY s.score DESC, t.name), '[]'::jsonb)
    INTO v_missions
  FROM directory_mission_scores s
  JOIN directory_tags t ON t.id = s.tag_id
  WHERE s.entity_type = 'person' AND s.entity_id = v.id AND t.status = 'active';

  SELECT COALESCE(jsonb_agg(n.label ORDER BY n.sort_order, n.label), '[]'::jsonb)
    INTO v_seeking
  FROM directory_person_needs n
  WHERE n.person_id = v.id AND n.kind = 'seeking';

  SELECT COALESCE(jsonb_agg(n.label ORDER BY n.sort_order, n.label), '[]'::jsonb)
    INTO v_providing
  FROM directory_person_needs n
  WHERE n.person_id = v.id AND n.kind = 'providing';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id',      a.id,
           'title',   a.org_name,
           'sub',     a.role,
           'logo',    a.org_logo_url IS NOT NULL,
           'logoUrl', a.org_logo_url
         ) ORDER BY a.sort_order, a.org_name), '[]'::jsonb)
    INTO v_affil
  FROM directory_person_affiliations a
  WHERE a.person_id = v.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id',          e.id,
           'title',       e.title,
           'organization',e.org_name,
           'description', e.description,
           'location',    e.location,
           'startDate',   e.start_date,
           'endDate',     e.end_date,
           'isCurrent',   e.is_current
         ) ORDER BY e.sort_order, e.start_date DESC NULLS LAST), '[]'::jsonb)
    INTO v_experience
  FROM directory_person_experience e
  WHERE e.person_id = v.id;

  -- directory_analytics has company_id but no person_id, so a person's views
  -- are matched on the logged path. Today that is 0 for everyone, which is the
  -- true number until the profile route starts emitting the event.
  SELECT count(*) INTO v_views
  FROM directory_analytics
  WHERE event_type = 'profile_view'
    AND metadata ->> 'path' = '/people/' || v.slug;

  IF v_views > 0 THEN
    v_stats := v_stats || jsonb_build_array(jsonb_build_object(
      'id','views','icon','eye','label','Profile Views','value', v_views::text));
  END IF;

  RETURN jsonb_build_object(
    'slug',          v.slug,
    'kind',          'person',
    'source',        'live',
    'name',          v.full_name,
    'verified',      v.verification = 'verified',
    'verifiedLabel', 'Verified',
    'role',          COALESCE(v.job_title, ''),
    'organization',  COALESCE(v.org_name, ''),
    'location',      COALESCE(v_location, ''),
    'email',         COALESCE(v.email, ''),
    'linkedin',      COALESCE(v.linkedin_url, ''),
    'website',       COALESCE(v.website, ''),
    'photoUrl',      v.avatar_url,
    'bio',           COALESCE(v.bio_short, ''),
    'tags',          to_jsonb(v.focus_areas),

    'tabs', jsonb_build_array(
      jsonb_build_object('id','overview',    'label','Overview'),
      jsonb_build_object('id','capabilities','label','Capabilities'),
      jsonb_build_object('id','needs',       'label','Needs'),
      jsonb_build_object('id','experience',  'label','Experience'),
      jsonb_build_object('id','affiliations','label','Affiliations')
    ),

    'availability', jsonb_build_object(
      'heading',    'AVAILABILITY',
      'status',     COALESCE(v.availability_status, ''),
      'body',       COALESCE(v.availability_note, ''),
      'primaryCta', 'CONNECT',
      'acceptsConnections', v.accepts_connections
    ),

    'about', jsonb_build_object(
      'heading', 'ABOUT ME',
      'body',    COALESCE(NULLIF(v.bio_long,''), COALESCE(v.bio_short,'')),
      'link',    CASE WHEN NULLIF(v.bio_long,'') IS NOT NULL THEN 'View full bio' ELSE '' END
    ),

    'capabilities', jsonb_build_object(
      'heading',    'CAPABILITIES',
      'action',     'Edit',
      'total',      v_caps_total,
      'shown',      v_caps,
      'footerLink', CASE WHEN v_caps_total > 0
                         THEN 'View all capabilities (' || v_caps_total || ')'
                         ELSE '' END
    ),

    'missions', jsonb_build_object(
      'heading', 'SPACE MISSIONS',
      'action',  'Edit',
      'rows',    v_missions
    ),

    'lookingFor', jsonb_build_object(
      'heading', 'WHAT I''M LOOKING FOR',
      'action',  'Edit',
      'left',    jsonb_build_object('heading','I''M SEEKING',  'items', v_seeking),
      'right',   jsonb_build_object('heading','I CAN PROVIDE', 'items', v_providing)
    ),

    'affiliations', jsonb_build_object(
      'heading',    'AFFILIATIONS',
      'action',     '+ Add',
      'items',      v_affil,
      'footerLink', CASE WHEN jsonb_array_length(v_affil) > 0 THEN 'View all affiliations' ELSE '' END
    ),

    'experience', v_experience,

    -- markers are deliberately absent: they are pixel coordinates in the
    -- 960x600 albersUsa space of src/lib/usStatesPaths.js, which is a rendering
    -- concern the database has no business holding. state_code drives the
    -- highlight; the pin is the frontend's to place.
    'locationCard', jsonb_build_object(
      'heading',   'LOCATION',
      'city',      COALESCE(NULLIF(concat_ws(', ', NULLIF(v.city,''), NULLIF(v.state,'')), ''), ''),
      'note',      '',
      'highlight', CASE WHEN v.state_code IS NOT NULL
                        THEN jsonb_build_array(upper(v.state_code)) ELSE '[]'::jsonb END,
      'markers',   '[]'::jsonb
    ),

    'activity', jsonb_build_object(
      'heading', 'ACTIVITY HIGHLIGHTS',
      'stats',   v_stats
    )
  );
END;
$fn$;

COMMENT ON FUNCTION get_person_profile(text) IS
  'Whole /people/:slug payload as one jsonb. SECURITY DEFINER, so it filters status=active itself. Keys match src/lib/profileFixtures.js.';


-- ---------------------------------------------------------------------------
-- get_company_profile
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_company_profile(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  -- The design lists eight capabilities and states a total of eighteen.
  k_shown_limit constant integer := 8;

  -- EXPLICIT ALLOWLIST. Every column read from directory_companies is named
  -- here. No stripe / membership / billing column appears, and none may be added.
  v_id             uuid;
  v_name           text;
  v_slug           text;
  v_description    text;
  v_logo_url       text;
  v_website        text;
  v_phone          text;
  v_email          text;
  v_vertical       text;
  v_city           text;
  v_state          text;
  v_country        text;
  -- employee_count is TEXT in production, not a number. Live values include
  -- '10', '1-10' and '6000+'. Declaring it integer here would raise
  -- "invalid input syntax for type integer" on most of the 166 companies and
  -- 500 the whole profile. It is also the right type: the design prints
  -- "Employees  1,100+", which is a string, not a count.
  v_employee_count text;
  v_year_founded   integer;

  v_prof           directory_company_profile%ROWTYPE;
  v_has_profile    boolean := false;

  v_caps_total     integer;
  v_caps           jsonb;
  v_missions       jsonb;
  v_seeking        jsonb;
  v_providing      jsonb;
  v_locations      jsonb;
  v_highlight      jsonb;
  v_people_count   integer;
  v_views          integer;
  v_opps           integer;
  v_glance         jsonb := '[]'::jsonb;
  v_stats          jsonb := '[]'::jsonb;
  v_counts         jsonb := '[]'::jsonb;
  v_location       text;
  v_hq             text;
  v_categories     jsonb;
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RETURN NULL;
  END IF;

  -- RLS is bypassed here. This is the status filter.
  SELECT c.id, c.name, c.slug, c.description, c.logo_url, c.website, c.phone,
         c.email, c.vertical, c.city, c.state, c.country,
         c.employee_count, c.year_founded
    INTO v_id, v_name, v_slug, v_description, v_logo_url, v_website, v_phone,
         v_email, v_vertical, v_city, v_state, v_country,
         v_employee_count, v_year_founded
  FROM directory_companies c
  WHERE c.slug = p_slug AND c.status = 'active';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_prof FROM directory_company_profile WHERE company_id = v_id;
  v_has_profile := FOUND;

  v_location := NULLIF(
    concat_ws(', ', NULLIF(v_city,''), NULLIF(v_state,''), NULLIF(v_country,'')), '');

  -- Categories: the enrichment row wins; otherwise the one classification the
  -- live table actually has.
  IF v_has_profile AND array_length(v_prof.categories, 1) > 0 THEN
    v_categories := to_jsonb(v_prof.categories);
  ELSIF NULLIF(v_vertical,'') IS NOT NULL THEN
    v_categories := jsonb_build_array(v_vertical);
  ELSE
    v_categories := '[]'::jsonb;
  END IF;

  SELECT count(*) INTO v_caps_total
  FROM directory_company_capabilities WHERE company_id = v_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', c.id, 'icon', c.icon, 'title', c.name, 'sub', c.subtitle
         ) ORDER BY c.sort_order, c.name), '[]'::jsonb)
    INTO v_caps
  FROM (
    SELECT id, name, subtitle, icon, sort_order
    FROM directory_company_capabilities
    WHERE company_id = v_id
    ORDER BY sort_order, name
    LIMIT k_shown_limit
  ) c;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'label', t.name, 'pct', s.score)
                            ORDER BY s.score DESC, t.name), '[]'::jsonb)
    INTO v_missions
  FROM directory_mission_scores s
  JOIN directory_tags t ON t.id = s.tag_id
  WHERE s.entity_type = 'company' AND s.entity_id = v_id AND t.status = 'active';

  SELECT COALESCE(jsonb_agg(n.label ORDER BY n.sort_order, n.label), '[]'::jsonb)
    INTO v_seeking
  FROM directory_company_needs n
  WHERE n.company_id = v_id AND n.kind = 'seeking';

  SELECT COALESCE(jsonb_agg(n.label ORDER BY n.sort_order, n.label), '[]'::jsonb)
    INTO v_providing
  FROM directory_company_needs n
  WHERE n.company_id = v_id AND n.kind = 'providing';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', l.id, 'icon', 'location', 'title', l.label, 'sub', l.place
         ) ORDER BY l.is_headquarters DESC, l.sort_order, l.label), '[]'::jsonb)
    INTO v_locations
  FROM directory_company_locations l
  WHERE l.company_id = v_id;

  SELECT COALESCE(jsonb_agg(DISTINCT upper(l.state_code)), '[]'::jsonb)
    INTO v_highlight
  FROM directory_company_locations l
  WHERE l.company_id = v_id AND l.state_code IS NOT NULL;

  SELECT COALESCE(NULLIF(v_prof.headquarters_label,''), NULL) INTO v_hq;
  IF v_hq IS NULL THEN
    SELECT l.place INTO v_hq
    FROM directory_company_locations l
    WHERE l.company_id = v_id AND l.is_headquarters
    ORDER BY l.sort_order LIMIT 1;
  END IF;
  v_hq := COALESCE(v_hq, v_location);

  SELECT count(*) INTO v_people_count
  FROM directory_people WHERE company_id = v_id AND status = 'active';

  SELECT count(*) INTO v_views
  FROM directory_analytics
  WHERE event_type = 'profile_view'
    AND company_id = v_id
    AND created_at >= now() - interval '30 days';

  -- "Opportunities Posted" = the listing categories that are an ask, not
  -- editorial content. Articles, podcasts, videos, news and person entries are
  -- excluded on purpose.
  SELECT count(*) INTO v_opps
  FROM directory_listings
  WHERE company_id = v_id
    AND status = 'active'
    AND category IN ('job','rfp','grant','equipment')
    AND created_at >= now() - interval '30 days';

  -- AT A GLANCE: only rows that have a value. No blanks, no "N/A".
  IF v_year_founded IS NOT NULL THEN
    v_glance := v_glance || jsonb_build_array(jsonb_build_object(
      'id','founded','icon','check-circle','key','Founded','value', v_year_founded::text));
  END IF;
  IF NULLIF(v_employee_count, '') IS NOT NULL THEN
    v_glance := v_glance || jsonb_build_array(jsonb_build_object(
      'id','employees','icon','users','key','Employees','value', v_employee_count));
  END IF;
  IF v_has_profile AND NULLIF(v_prof.org_type,'') IS NOT NULL THEN
    v_glance := v_glance || jsonb_build_array(jsonb_build_object(
      'id','org-type','icon','building','key','Organization Type','value', v_prof.org_type));
  END IF;
  IF v_has_profile AND NULLIF(v_prof.naics_code,'') IS NOT NULL THEN
    v_glance := v_glance || jsonb_build_array(jsonb_build_object(
      'id','naics','icon','file','key','NAICS Code','value', v_prof.naics_code));
  END IF;
  IF v_hq IS NOT NULL THEN
    v_glance := v_glance || jsonb_build_array(jsonb_build_object(
      'id','hq','icon','location','key','Headquarters','value', v_hq));
  END IF;

  -- WHO WE WORK WITH: all six when the owner has an enrichment row, none at all
  -- when they do not. A card of six zeros is not data, it is a shrug.
  IF v_has_profile THEN
    v_counts := jsonb_build_array(
      jsonb_build_object('id','suppliers',   'icon','truck',      'value', v_prof.suppliers_count::text,    'label','Suppliers'),
      jsonb_build_object('id','partners',    'icon','handshake',  'value', v_prof.partners_count::text,     'label','Partners'),
      jsonb_build_object('id','customers',   'icon','users',      'value', v_prof.customers_count::text,    'label','Customers'),
      jsonb_build_object('id','universities','icon','graduation', 'value', v_prof.universities_count::text, 'label','Universities'),
      jsonb_build_object('id','gov-programs','icon','bank',       'value', v_prof.gov_programs_count::text, 'label','Gov. Programs'),
      jsonb_build_object('id','investors',   'icon','investor',   'value', v_prof.investors_count::text,    'label','Investors')
    );
  END IF;

  IF v_views > 0 THEN
    v_stats := v_stats || jsonb_build_array(jsonb_build_object(
      'id','views','icon','eye','label','Profile Views','value', v_views::text,'note','Last 30 days'));
  END IF;
  IF v_opps > 0 THEN
    v_stats := v_stats || jsonb_build_array(jsonb_build_object(
      'id','opportunities','icon','briefcase','label','Opportunities Posted','value', v_opps::text,'note','Last 30 days'));
  END IF;

  RETURN jsonb_build_object(
    'slug',          v_slug,
    'kind',          'company',
    'source',        'live',
    'name',          v_name,
    'verified',      COALESCE(v_prof.verification, 'unverified') = 'verified',
    'verifiedLabel', 'Verified Organization',
    'categories',    v_categories,
    'location',      COALESCE(v_location, ''),
    'website',       COALESCE(v_website, ''),
    'email',         COALESCE(v_email, ''),
    'phone',         COALESCE(v_phone, ''),
    'linkedin',      COALESCE(v_prof.linkedin_url, ''),
    'logoUrl',       v_logo_url,
    'description',   COALESCE(v_description, ''),
    'tags',          CASE WHEN v_has_profile THEN to_jsonb(v_prof.focus_areas) ELSE '[]'::jsonb END,

    'tabs', jsonb_build_array(
      jsonb_build_object('id','overview',    'label','Overview'),
      jsonb_build_object('id','capabilities','label','Capabilities'),
      jsonb_build_object('id','people',      'label','People', 'count', v_people_count),
      jsonb_build_object('id','location',    'label','Location'),
      jsonb_build_object('id','affiliations','label','Affiliations')
    ),

    'connect', jsonb_build_object(
      'heading',      'CONNECT WITH ' || upper(v_name),
      'status',       '',
      'body',         '',
      'primaryCta',   'CONNECT',
      'secondaryCta', 'FOLLOW'
    ),

    'atAGlance', jsonb_build_object(
      'heading',    'AT A GLANCE',
      'rows',       v_glance,
      'footerLink', CASE WHEN jsonb_array_length(v_glance) > 0 THEN 'View full company details' ELSE '' END
    ),

    'capabilities', jsonb_build_object(
      'heading',    'CAPABILITIES',
      'total',      v_caps_total,
      'shown',      v_caps,
      'footerLink', CASE WHEN v_caps_total > k_shown_limit THEN 'View all' ELSE '' END
    ),

    'missions', jsonb_build_object(
      'heading',    'SPACE MISSIONS',
      'rows',       v_missions,
      'footerLink', CASE WHEN jsonb_array_length(v_missions) > 0
                         THEN 'View mission alignment details' ELSE '' END
    ),

    'whatWeDo', jsonb_build_object(
      'heading', 'WHAT WE DO',
      'body',    COALESCE(v_description, ''),
      'link',    CASE WHEN NULLIF(v_description,'') IS NOT NULL THEN 'View full description' ELSE '' END
    ),

    'whoWeWorkWith', jsonb_build_object(
      'heading',    'WHO WE WORK WITH',
      'counts',     v_counts,
      'footerLink', CASE WHEN jsonb_array_length(v_counts) > 0 THEN 'View all' ELSE '' END
    ),

    'lookingFor', jsonb_build_object(
      'heading',    'LOOKING FOR',
      'action',     'Edit',
      'left',       jsonb_build_object('heading','', 'items', v_seeking),
      'right',      jsonb_build_object('heading','', 'items', v_providing),
      'footerLink', CASE WHEN jsonb_array_length(v_seeking) + jsonb_array_length(v_providing) > 0
                         THEN 'View all needs' ELSE '' END
    ),

    -- markers: same reason as the person payload. albersUsa pixel coordinates
    -- are a rendering concern; state_code is the data.
    'locations', jsonb_build_object(
      'heading',    'LOCATIONS',
      'items',      v_locations,
      'highlight',  v_highlight,
      'markers',    '[]'::jsonb,
      'footerLink', CASE WHEN jsonb_array_length(v_locations) > 0 THEN 'View all locations' ELSE '' END
    ),

    'activity', jsonb_build_object(
      'heading',    'ACTIVITY HIGHLIGHTS',
      'stats',      v_stats,
      'footerLink', CASE WHEN jsonb_array_length(v_stats) > 0 THEN 'View all activity' ELSE '' END
    ),

    'footer', 'SpaceOS is a platform of Space Rising. Building connections that advance the space economy.'
  );
END;
$fn$;

COMMENT ON FUNCTION get_company_profile(text) IS
  'Whole /company/:slug payload as one jsonb. SECURITY DEFINER, filters status=active itself, and reads directory_companies through an explicit column allowlist so no stripe/membership column can reach a public payload.';


-- ---------------------------------------------------------------------------
-- GRANTS
--
-- PostgreSQL grants EXECUTE to PUBLIC by default. For a SECURITY DEFINER
-- function that is a wider door than intended, so it is revoked and then handed
-- to exactly the two roles the app calls with.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION get_person_profile(text)  FROM PUBLIC;
REVOKE ALL ON FUNCTION get_company_profile(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_person_profile(text)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_company_profile(text) TO anon, authenticated;

COMMIT;
