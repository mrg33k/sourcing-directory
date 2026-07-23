/**
 * useSiteContent — reads page copy overrides from directory_site_content
 *
 * Two variants:
 *
 * 1. useSiteContent(tenantId)
 *    Use when you already have the tenant UUID in state.
 *    Used by: SourcingAdmin > SiteContentSection, SpaceOSHomeV3, SourcingMembershipV2.
 *
 * 2. useSiteContentBySlug(slug)
 *    Resolves the tenant UUID from the slug and then fetches content.
 *    Use in section pages that already know TENANT_DB_LOOKUP_SLUG = 'space-rising'.
 *    Keeps each page change to three lines (import, hook, prop replacement).
 *
 * Both return { get(pageKey, fieldKey, fallback) } which returns the DB override
 * or `fallback` when no override exists (empty table = current hardcoded copy).
 *
 * Keys used across the site:
 *   page_key 'home'          : welcome_header, welcome_subheader
 *   page_key 'membership'    : headline, subcopy
 *   page_key per section     : page_title, page_subtitle
 *     sections: directory, reports, articles, events, jobs, marketplace,
 *               discovery, podcasts, videos, news, people, rfps, grants,
 *               organizations
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

/* ── shared fetch helper ── */
async function fetchContentMap(tenantId) {
  const { data } = await supabase
    .from('directory_site_content')
    .select('page_key, field_key, value')
    .eq('tenant_id', tenantId);
  const map = {};
  (data || []).forEach(row => {
    if (!map[row.page_key]) map[row.page_key] = {};
    map[row.page_key][row.field_key] = row.value;
  });
  return map;
}

/* ── getter factory ── */
function makeGetter(contentMap) {
  return function get(pageKey, fieldKey, fallback = '') {
    const v = contentMap[pageKey]?.[fieldKey];
    return (v && v.trim()) ? v : fallback;
  };
}

/* ── useSiteContent(tenantId) ── */
export function useSiteContent(tenantId) {
  const [contentMap, setContentMap] = useState({});

  useEffect(() => {
    if (!tenantId) return;
    fetchContentMap(tenantId).then(setContentMap);
  }, [tenantId]);

  return { get: makeGetter(contentMap) };
}

/* ── useSiteContentBySlug(slug) ── */
export function useSiteContentBySlug(slug) {
  const [contentMap, setContentMap] = useState({});

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      const { data: tenantData } = await supabase
        .from('directory_tenants')
        .select('id')
        .eq('slug', slug)
        .single();
      if (cancelled || !tenantData?.id) return;
      const map = await fetchContentMap(tenantData.id);
      if (!cancelled) setContentMap(map);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  return { get: makeGetter(contentMap) };
}
