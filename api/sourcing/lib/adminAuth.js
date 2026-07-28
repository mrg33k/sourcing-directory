// Server-side admin authentication for the sourcing directory.
//
// The ONLY place the Supabase service_role key is allowed to live is inside a
// serverless function. Nothing here may ever be imported from src/ — that would
// re-open the hole this module exists to close.
//
// Pattern lifted from api/sourcing/admin-reports.js (verify the caller's Supabase
// JWT server-side, then act with the service key), with one bug fixed:
//
//   admin-reports.js hard-requires `user_metadata.tenant_id || app_metadata.tenant_id`
//   and 403s without one. A GLOBAL admin (app_metadata.role === 'admin', no tenant
//   pinned) has no such field, so it locks them out of their own directory.
//
// requireAdmin() therefore resolves a tenant LIST, not a single id:
//   isGlobal: true,  tenantIds: []      -> all tenants, no scoping applied
//   isGlobal: false, tenantIds: [a, b]  -> scoped to exactly those tenants
//
// Admin is defined two ways in this codebase and both are honoured:
//   (a) user.app_metadata.role === 'admin'                        -> global admin
//       (matches src/pages/SourcingAdmin.jsx, which treats this flag as
//        `isGlobalAdmin` and shows every tenant)
//   (b) a directory_members row, role='admin' AND status='approved' -> tenant admin
//       (matches the tenant scoping in SourcingAdmin.jsx loadTenants())
//
// Note: metadata tenant_id is deliberately NOT used to widen scope. A tenant admin's
// reach is exactly the set of tenants they hold an approved admin membership in.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://kzzvjtthknsozktmpvak.supabase.co';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _client = null;

/** Service-role Supabase client. Server-side only. Returns null if unconfigured. */
export function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _client;
}

/** Pull the bearer token off the request. */
export function bearerToken(req) {
  const raw = req?.headers?.authorization || req?.headers?.Authorization || '';
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('Bearer ')) return null;
  const token = raw.slice(7).trim();
  return token || null;
}

/**
 * Verify the caller is an admin and resolve their tenant reach.
 *
 * @returns {Promise<
 *   { ok: true, sb: object, user: object, isGlobal: boolean, tenantIds: string[] } |
 *   { ok: false, status: number, error: string }
 * >}
 */
export async function requireAdmin(req) {
  const sb = serviceClient();
  if (!sb) return { ok: false, status: 500, error: 'Supabase not configured' };

  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: 'Missing authorization token' };

  const { data, error } = await sb.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return { ok: false, status: 401, error: 'Invalid or expired token' };

  // (a) Global admin — full reach across every tenant.
  if (user.app_metadata?.role === 'admin') {
    return { ok: true, sb, user, isGlobal: true, tenantIds: [] };
  }

  // (b) Tenant admin — reach is exactly their approved admin memberships.
  const { data: rows, error: memberErr } = await sb
    .from('directory_members')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .eq('role', 'admin')
    .eq('status', 'approved');

  if (memberErr) {
    return { ok: false, status: 500, error: `Could not resolve admin membership: ${memberErr.message}` };
  }

  const tenantIds = [...new Set((rows || []).map(r => r.tenant_id).filter(Boolean))];
  if (tenantIds.length === 0) {
    return { ok: false, status: 403, error: 'Admin access required' };
  }

  return { ok: true, sb, user, isGlobal: false, tenantIds };
}

/** Best-effort display name for audit rows. */
export function actorEmail(user) {
  return user?.email || user?.user_metadata?.email || null;
}
