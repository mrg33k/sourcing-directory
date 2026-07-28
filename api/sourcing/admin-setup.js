// POST /api/sourcing/admin-setup
//
// Two modes:
//   mode: 'member'  — called from the admin dashboard's Add Company flow.
//                     Auth: the caller's Supabase JWT (Authorization: Bearer <token>),
//                     verified server-side by requireAdmin().
//   default         — one-time bootstrap of the very first admin account.
//                     Auth: x-setup-secret header (SETUP_SECRET env var).
//
// Body: { email, password, full_name? } / { mode:'member', email, company_id, tenant_id }
//
// What it does:
//   1. Verifies the caller
//   2. Creates auth user if they don't exist (or finds existing by email)
//   3. Sets app_metadata.role = 'admin' via service role (bootstrap mode only)
//   4. Creates a directory_members record
//
// SECURITY (2026-07-28): member mode previously authenticated with
// `providedAdminKey === SUPABASE_SERVICE_KEY`, and the browser sent that key in an
// 'x-admin-key' header — so the service_role key was in the client bundle. Both the
// header and the comparison are gone.
//
// SECURITY (2026-07-28, round 3): member mode was authenticated but not AUTHORIZED.
// The existing-member lookup was keyed on auth_user_id alone with no tenant filter, and
// the row it found was then updated with the CALLER's tenant_id. See the block comment
// above the upsert below for the full before/after.

import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './lib/adminAuth.js';
import { applyCors } from './admin.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kzzvjtthknsozktmpvak.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SETUP_SECRET = process.env.SETUP_SECRET;

export default async function handler(req, res) {
  // CORS: this endpoint carries a Bearer token in member mode and a setup secret in
  // bootstrap mode, and its only browser caller (src/pages/admin/AddCompanySection.jsx:47)
  // hits the RELATIVE url '/api/sourcing/admin-setup', i.e. always same-origin — which
  // needs no Access-Control-Allow-Origin at all. The old `'*'` therefore bought nothing
  // and let any origin on the internet read this endpoint's responses with a borrowed
  // token. Same posture as api/sourcing/admin.js now, because it is literally the same
  // function: applyCors() echoes the origin only when it is on the known-origin
  // allowlist, and sends no ACAO otherwise.
  applyCors(req, res, { allowHeaders: 'Content-Type, Authorization, x-setup-secret' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  const { mode, email, password, full_name, company_id, tenant_id } = req.body || {};

  // ─── Member creation mode (called from admin dashboard Add Company flow) ───
  if (mode === 'member') {
    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!email) return res.status(400).json({ error: 'email is required' });

    // ── Resolve THE ONE TENANT this call may act in ──────────────────────────
    // Every branch below either produces a concrete scopedTenantId that the caller is
    // provably an admin of, or returns 4xx. Nothing downstream is allowed to touch a
    // row outside it, and scopedTenantId is never null: the previous version could
    // fall through with null (global admin, no tenant_id), which then produced a member
    // row with no tenant_id at all — a NOT NULL violation that was silently swallowed
    // and still reported `ok: true`.
    let scopedTenantId;
    if (auth.isGlobal) {
      // A global admin administers every tenant, so there is nothing to infer from.
      // They must name the one they mean. (The admin panel's tenant picker sends
      // `selectedTenantId`, which is null in "global mode" — SourcingAdmin.jsx:94.
      // That combination already failed on the NOT NULL constraint; it now fails
      // with a message that says why.)
      if (!tenant_id) return res.status(400).json({ error: 'tenant_id is required' });
      scopedTenantId = tenant_id;
    } else if (tenant_id) {
      if (!auth.tenantIds.includes(tenant_id)) {
        return res.status(403).json({ error: 'tenant_id is outside your admin scope' });
      }
      scopedTenantId = tenant_id;
    } else if (auth.tenantIds.length === 1) {
      scopedTenantId = auth.tenantIds[0];
    } else {
      return res.status(400).json({ error: 'tenant_id is required (you administer more than one tenant)' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // A tenant admin's scopedTenantId came out of their own directory_members rows, so
    // it is known to exist. A global admin's came out of the request body and has been
    // checked against nothing at all — verify it before it reaches a FK.
    if (auth.isGlobal) {
      const { data: tenantRow, error: tenantErr } = await admin
        .from('directory_tenants')
        .select('id')
        .eq('id', scopedTenantId)
        .maybeSingle();
      if (tenantErr) return res.status(500).json({ error: 'Failed to verify tenant: ' + tenantErr.message });
      if (!tenantRow) return res.status(404).json({ error: 'tenant_id not found' });
    }

    // company_id was previously written onto the member row with no check whatsoever —
    // any uuid the caller sent was attached. A member row's company_id is an entitlement:
    // api/sourcing/update-company.js and api/sourcing/update-deal-bank-listing.js both
    // treat it as "this member may edit that company". So it must be a company that
    // lives in the tenant this call is scoped to.
    if (company_id) {
      const { data: companyRow, error: companyErr } = await admin
        .from('directory_companies')
        .select('id')
        .eq('id', company_id)
        .eq('tenant_id', scopedTenantId)
        .maybeSingle();
      if (companyErr) return res.status(500).json({ error: 'Failed to verify company: ' + companyErr.message });
      if (!companyRow) return res.status(403).json({ error: 'company_id does not belong to this tenant' });
    }

    // Create or find the auth user
    let memberId;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: full_name || '' },
    });

    if (createErr) {
      if (createErr.message?.includes('already been registered') || createErr.code === 'email_exists') {
        const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
        if (listErr) return res.status(500).json({ error: 'Failed to list users: ' + listErr.message });
        const existing = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (!existing) return res.status(404).json({ error: 'User not found after creation failed' });
        memberId = existing.id;
      } else {
        return res.status(500).json({ error: 'Failed to create user: ' + createErr.message });
      }
    } else {
      memberId = created.user.id;
    }

    // ── Upsert the directory_members row, INSIDE scopedTenantId ──────────────
    //
    // BEFORE (the hole):
    //   lookup:  .select('id').eq('auth_user_id', memberId)          <- no tenant filter
    //   update:  .update({ role:'member', status:'approved',
    //                      tenant_id: <caller's tenant>,
    //                      company_id: <caller-supplied> })
    //   The :50-58 scoping added in the previous round validated the CLAIMED tenant_id
    //   and nothing else, so the row the lookup actually FOUND was never checked. An
    //   admin of tenant A who knew the email of an admin of tenant B could POST
    //   {mode:'member', email:<B's admin>, tenant_id:A, company_id:<anything>} and:
    //     1. find B's row (only auth_user_id was matched),
    //     2. demote it to role 'member'  — B loses its administrator,
    //     3. rewrite its tenant_id to A  — the row is dragged into A's roster,
    //     4. attach any company_id at all — write access to that company's profile.
    //
    // AFTER: three independent things stop it, and any one of them alone is sufficient.
    //   1. the lookup is filtered by tenant_id, so it can only ever return a row that is
    //      ALREADY in a tenant the caller administers;
    //   2. the update payload contains no tenant_id at all, so no UPDATE this endpoint
    //      issues can move a row between tenants, whatever the lookup returned;
    //   3. the UPDATE statement itself carries .eq('tenant_id', scopedTenantId), so even
    //      a stale or wrong id from step 1 cannot escape the scope.
    //
    // NOT A RESIDUAL, STATED SO IT IS NOT MISREAD AS ONE: a tenant admin CAN still name
    // any email address, including one that already has a member row in another tenant,
    // and get a NEW row for that person in their OWN tenant. That is the endpoint's
    // purpose — "Add Company, owner email" invites by address. It confers nothing
    // anywhere else: the other tenant's row is not read, not written and not consulted,
    // and the new row is role 'member' inside a tenant the caller already administers.
    //
    // role is likewise no longer written on the update path. This endpoint's job is
    // "give this person a login for this company"; silently rewriting an existing tenant
    // admin's role to 'member' is a privilege change wearing a create's clothes. On
    // INSERT the new row is 'member', as before.

    // Two lookups, both tenant-scoped. The second exists because directory_members
    // carries UNIQUE (tenant_id, email) (migrations/006:21): a legacy or invited row with
    // the same email but a null/absent auth_user_id would otherwise make the INSERT fail
    // on that index. Ordering makes the pick deterministic if legacy data holds more than
    // one row for the same user in one tenant.
    const { data: byAuthRows, error: byAuthErr } = await admin
      .from('directory_members')
      .select('id, role, auth_user_id')
      .eq('auth_user_id', memberId)
      .eq('tenant_id', scopedTenantId)
      .order('created_at', { ascending: true })
      .limit(1);
    if (byAuthErr) return res.status(500).json({ error: 'Failed to look up member: ' + byAuthErr.message });

    let existingMember = byAuthRows?.[0] || null;

    if (!existingMember) {
      const { data: byEmailRows, error: byEmailErr } = await admin
        .from('directory_members')
        .select('id, role, auth_user_id')
        .eq('tenant_id', scopedTenantId)
        // eq, not ilike: this fallback exists to avoid colliding with UNIQUE
        // (tenant_id, email), and that index is on the raw text — so the match that
        // matters is the exact one. ilike would also treat `_` and `%` in an address
        // as wildcards and could adopt a DIFFERENT member's row.
        .eq('email', email)
        .order('created_at', { ascending: true })
        .limit(1);
      if (byEmailErr) return res.status(500).json({ error: 'Failed to look up member: ' + byEmailErr.message });
      const candidate = byEmailRows?.[0] || null;
      if (candidate) {
        // Someone else's auth user already owns this tenant+email row. Do not steal it.
        if (candidate.auth_user_id && candidate.auth_user_id !== memberId) {
          return res.status(409).json({ error: 'A different account already holds this email in this tenant' });
        }
        existingMember = candidate;
      }
    }

    let resolvedRole = 'member';

    if (existingMember) {
      const patch = {
        status: 'approved',
        auth_user_id: memberId,
        ...(full_name ? { full_name } : {}),
        ...(company_id ? { company_id } : {}),
      };
      const { error: updErr } = await admin
        .from('directory_members')
        .update(patch)
        .eq('id', existingMember.id)
        .eq('tenant_id', scopedTenantId);
      if (updErr) return res.status(500).json({ error: 'Failed to update member: ' + updErr.message });
      resolvedRole = existingMember.role || 'member';
    } else {
      const { error: insErr } = await admin.from('directory_members').insert({
        tenant_id: scopedTenantId,
        email,
        full_name: full_name || '',
        role: 'member',
        status: 'approved',
        auth_user_id: memberId,
        ...(company_id ? { company_id } : {}),
      });
      if (insErr) return res.status(500).json({ error: 'Failed to create member: ' + insErr.message });
    }

    return res.status(200).json({
      ok: true,
      user_id: memberId,
      email,
      tenant_id: scopedTenantId,
      role: resolvedRole,
      message: `Member account created for ${email}. They can use password reset to set a password.`,
    });
  }

  // ─── Admin setup mode (original flow) ────────────────────────────────────
  const providedSecret = req.headers['x-setup-secret'];
  if (!SETUP_SECRET || providedSecret !== SETUP_SECRET) {
    return res.status(403).json({ error: 'Invalid or missing setup secret' });
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId;

  // Try to create the user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { full_name: full_name || '' },
  });

  if (createErr) {
    if (createErr.message?.includes('already been registered') || createErr.code === 'email_exists') {
      // User exists — find them by listing users (service role can do this)
      const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) return res.status(500).json({ error: 'Failed to list users: ' + listErr.message });

      const existing = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing) return res.status(404).json({ error: 'User not found after creation failed' });
      userId = existing.id;

      // Promote existing user to admin
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: { role: 'admin' },
      });
      if (updateErr) return res.status(500).json({ error: 'Failed to set admin role: ' + updateErr.message });
    } else {
      return res.status(500).json({ error: 'Failed to create user: ' + createErr.message });
    }
  } else {
    userId = created.user.id;
  }

  // Upsert a directory_members record so admin can also appear in member lists
  // Use the first available tenant, or no tenant (null) if none exist
  const { data: tenants } = await admin
    .from('directory_tenants')
    .select('id')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1);

  const tenantId = tenants?.[0]?.id || null;

  if (tenantId) {
    // Check if member record already exists
    const { data: existingMember } = await admin
      .from('directory_members')
      .select('id')
      .eq('auth_user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!existingMember) {
      await admin.from('directory_members').insert({
        tenant_id: tenantId,
        email,
        full_name: full_name || '',
        role: 'admin',
        status: 'approved',
        auth_user_id: userId,
      });
    } else {
      await admin.from('directory_members').update({
        role: 'admin',
        status: 'approved',
      }).eq('id', existingMember.id);
    }
  }

  return res.status(200).json({
    ok: true,
    user_id: userId,
    email,
    role: 'admin',
    message: `Admin account set up for ${email}. Use /admin to log in.`,
  });
}
