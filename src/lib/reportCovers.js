/**
 * Static report cover URL map.
 *
 * Interim until the directory_reports.cover_image_url column is added via
 * supabase/migrations/20260723_directory_reports_cover_image_url.sql.
 * When the DB column exists, getReportCoverUrl() prefers it automatically.
 *
 * Blueprint cover is handled separately via /blueprint/ title regex so it
 * keeps its local asset regardless of this map.
 */

const BASE =
  'https://kzzvjtthknsozktmpvak.supabase.co/storage/v1/object/public/sourcing-reports/report-covers';

export const REPORT_COVERS = {
  '3b721819-800b-5ed2-a9d0-f42d5aa73a14': `${BASE}/az-defense-strategy-memo-cover.png`,
  'dde7ae47-194b-5788-a5f7-72408bf669e3': `${BASE}/faa-site-reentry-licensing-cover.png`,
  'd8af835a-d28c-50fb-bf21-9791b20373a7': `${BASE}/s2888-spaceport-act-cover.png`,
  'ce18fabc-ff28-5271-b9f1-a5e4d75378c7': `${BASE}/the-legislative-triad-cover.png`,
  '25c95021-3acd-5222-ac2c-5f82d653a411': `${BASE}/az-space-sector-action-plan-cover.png`,
  'f961bbad-c99d-5806-a2c0-8a0f8506d4c1': `${BASE}/federal-opportunity-capture-cover.png`,
  '4aa10384-d54a-5f72-b01a-83f1022658d1': `${BASE}/market-intelligence-report-cover.png`,
};

/**
 * Resolve the best available cover URL for a report row.
 * Priority: DB column > static map > Blueprint local asset > null.
 */
export function getReportCoverUrl(item) {
  if (!item) return null;
  if (item.cover_image_url) return item.cover_image_url;
  if (/blueprint/i.test(item.title || '')) return '/v2-assets/blueprint-cover.png';
  return REPORT_COVERS[item.id] || null;
}
