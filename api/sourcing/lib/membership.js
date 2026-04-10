// Internal utility: premium membership check
// Not a Vercel handler — import and call from other API routes.
//
// Usage:
//   import { isUserPremiumMember } from '../lib/membership.js';
//   const isPremium = await isUserPremiumMember(userId, { tenantId, sb });
//
// Lookup path:
//   directory_members.auth_user_id = userId
//     → directory_members.company_id
//     → directory_companies.membership_tier
//
// Returns true  when membership_tier is any paid tier (basic | pro | enterprise)
// Returns false when membership_tier is 'free', when the user has no member record,
//               or when the company record is missing.

/**
 * Check whether a Supabase auth user holds a paid membership.
 *
 * @param {string} userId   - Supabase auth user ID (auth.users.id)
 * @param {object} options
 * @param {import('@supabase/supabase-js').SupabaseClient} options.sb
 *   A pre-created Supabase client (service role recommended so RLS does not
 *   filter out the member/company rows).
 * @param {string} [options.tenantId]
 *   When provided, the lookup is scoped to this tenant.  When omitted the
 *   check passes if the user has a paid membership in *any* tenant — useful
 *   for global guards.
 * @returns {Promise<boolean>}
 */
export async function isUserPremiumMember(userId, { sb, tenantId } = {}) {
  if (!userId || !sb) return false;

  // 1. Find the member record that links this auth user to a company.
  let memberQuery = sb
    .from('directory_members')
    .select('company_id')
    .eq('auth_user_id', userId);

  if (tenantId) {
    memberQuery = memberQuery.eq('tenant_id', tenantId);
  }

  const { data: member, error: memberError } = await memberQuery.maybeSingle();

  if (memberError || !member || !member.company_id) return false;

  // 2. Check the company's membership tier.
  const { data: company, error: companyError } = await sb
    .from('directory_companies')
    .select('membership_tier')
    .eq('id', member.company_id)
    .maybeSingle();

  if (companyError || !company) return false;

  // Paid tiers: basic | pro | enterprise  (anything that is not 'free')
  return Boolean(company.membership_tier && company.membership_tier !== 'free');
}
