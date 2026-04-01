import { supabase } from '../lib/supabase.js';

/**
 * Track a sourcing directory event.
 * Fire-and-forget -- errors are silently swallowed so tracking never breaks the UI.
 *
 * @param {string} tenantId  - UUID of the tenant (required)
 * @param {string} eventType - 'page_view' | 'profile_view' | 'search' | 'contact_click'
 * @param {object} metadata  - Optional extra data (company_id, query, etc.)
 * @param {string} companyId - Optional UUID of the company
 */
export async function trackEvent(tenantId, eventType, metadata = {}, companyId = null) {
  if (!supabase || !tenantId) return;
  try {
    await supabase.from('directory_analytics').insert({
      tenant_id: tenantId,
      event_type: eventType,
      metadata,
      ...(companyId ? { company_id: companyId } : {}),
    });
  } catch {
    // Intentionally silent
  }
}
