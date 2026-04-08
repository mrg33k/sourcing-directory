// POST /api/sourcing/admin-setup
// Creates or promotes a user to admin role.
// Protected by SETUP_SECRET header — only run this once to bootstrap the admin account.
//
// Body: { email, password, full_name? }
// Headers: x-setup-secret: <SETUP_SECRET env var>
//
// What it does:
//   1. Verifies the setup secret
//   2. Creates auth user if they don't exist (or finds existing by email)
//   3. Sets app_metadata.role = 'admin' via service role (required for /admin portal access)
//   4. Creates a directory_members record with role='admin', status='approved'

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kzzvjtthknsozktmpvak.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SETUP_SECRET = process.env.SETUP_SECRET;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-setup-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Verify setup secret
  const providedSecret = req.headers['x-setup-secret'];
  if (!SETUP_SECRET || providedSecret !== SETUP_SECRET) {
    return res.status(403).json({ error: 'Invalid or missing setup secret' });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  const { email, password, full_name } = req.body || {};

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
