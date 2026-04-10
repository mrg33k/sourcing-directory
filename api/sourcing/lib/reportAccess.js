// Internal utility: premium report access check
// Not a Vercel handler — import and call from other API routes.
//
// Usage:
//   import { canUserAccessReport } from '../lib/reportAccess.js';
//   const { canAccess, report } = await canUserAccessReport(userId, reportId, { sb });
//
// Access rules:
//   report.access = 'public' | 'free'  → true for any authenticated user
//   report.access = 'members' | 'paid' → true only when user has a paid membership tier
//   report.is_premium = true           → same as 'paid'
//
// Returns:
//   { canAccess: true, report }  — user may view/download this report
//   { canAccess: false, report } — report is premium and user is not a paid member
//   { canAccess: false, report: null, notFound: true } — reportId does not exist

import { isUserPremiumMember } from './membership.js';

/**
 * Determine whether a Supabase auth user can access a specific report.
 *
 * @param {string} userId    - Supabase auth user ID (auth.users.id)
 * @param {string} reportId  - UUID of the directory_reports row
 * @param {object} options
 * @param {import('@supabase/supabase-js').SupabaseClient} options.sb
 *   A pre-created Supabase client (service role recommended so RLS does not
 *   hide the report or member/company rows).
 * @returns {Promise<{ canAccess: boolean, report: object|null, notFound?: boolean }>}
 */
export async function canUserAccessReport(userId, reportId, { sb } = {}) {
  if (!userId || !reportId || !sb) {
    return { canAccess: false, report: null };
  }

  // 1. Fetch the report to read its access level and tenant.
  const { data: report, error: reportError } = await sb
    .from('directory_reports')
    .select('id, tenant_id, title, description, category, access, is_premium, file_url, published_at')
    .eq('id', reportId)
    .single();

  if (reportError || !report) {
    return { canAccess: false, report: null, notFound: true };
  }

  // 2. Determine whether this report requires a paid membership.
  const reportAccess = report.access || 'public';
  const isPremiumReport =
    report.is_premium === true ||
    reportAccess === 'paid' ||
    reportAccess === 'members' ||
    reportAccess === 'member';

  // 3. Free / public reports are always accessible to authenticated users.
  if (!isPremiumReport) {
    return { canAccess: true, report };
  }

  // 4. Premium report: check if the user holds a paid membership in this tenant.
  const isPaidMember = await isUserPremiumMember(userId, { sb, tenantId: report.tenant_id });
  return { canAccess: isPaidMember, report };
}
