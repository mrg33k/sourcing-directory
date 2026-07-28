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

import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './lib/adminAuth.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kzzvjtthknsozktmpvak.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SETUP_SECRET = process.env.SETUP_SECRET;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-setup-secret');
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

    // A tenant admin may only attach members to tenants they administer.
    if (!auth.isGlobal) {
      if (!tenant_id) {
        if (auth.tenantIds.length !== 1) {
          return res.status(400).json({ error: 'tenant_id is required (you administer more than one tenant)' });
        }
      } else if (!auth.tenantIds.includes(tenant_id)) {
        return res.status(403).json({ error: 'tenant_id is outside your admin scope' });
      }
    }
    const scopedTenantId = tenant_id || (!auth.isGlobal && auth.tenantIds.length === 1 ? auth.tenantIds[0] : null);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

    // Upsert directory_members row linked to the company
    const memberRecord = {
      email,
      full_name: full_name || '',
      role: 'member',
      status: 'approved',
      auth_user_id: memberId,
      ...(company_id ? { company_id } : {}),
      ...(scopedTenantId ? { tenant_id: scopedTenantId } : {}),
    };

    const { data: existingMember } = await admin
      .from('directory_members')
      .select('id')
      .eq('auth_user_id', memberId)
      .maybeSingle();

    if (existingMember) {
      await admin.from('directory_members').update(memberRecord).eq('id', existingMember.id);
    } else {
      await admin.from('directory_members').insert(memberRecord);
    }

    return res.status(200).json({
      ok: true,
      user_id: memberId,
      email,
      role: 'member',
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
