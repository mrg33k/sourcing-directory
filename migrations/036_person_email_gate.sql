-- ============================================================================
-- 036 — Stop get_person_profile handing member emails to anonymous callers.
--
-- Companion to 035. That migration revoked the `email` column from anon on the
-- table, which closes the  GET /rest/v1/directory_people?select=email  path.
-- It does NOT close this one: get_person_profile is SECURITY DEFINER, so it
-- runs as its owner and sails straight past both RLS and column grants. The
-- gate has to live inside the function.
--
-- This is a verbatim re-declaration of the function as shipped in 033, with a
-- single field changed: 'email' now passes through person_may_see_email(),
-- which returns true only for the profile's own owner, a global admin, or an
-- approved admin of the same tenant. Everyone else gets ''.
--
-- Requires 035 (it creates person_may_see_email). Re-runnable.
--
-- The company function is deliberately untouched: its 'email' is the business
-- contact address off directory_companies, which is public information and was
-- already rendered on the old public company page.
-- ============================================================================

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
    -- 035: an address is only emitted to someone entitled to it. RLS is
    -- row-level and cannot mask a column, and this function is SECURITY
    -- DEFINER so it bypasses the column REVOKE too — the decision has to
    -- be made right here or not at all.
    'email',         CASE WHEN public.person_may_see_email(v.id)
                          THEN COALESCE(v.email, '') ELSE '' END,
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

