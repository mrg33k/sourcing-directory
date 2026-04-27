// Provision Taryn and Tim as tenant-scoped admins on Space Rising
// Task 5e445600-81b0-4d03-8b11-8e8e832f4dff
//
// Does NOT set app_metadata.role='admin' (that would be platform-wide global admin).
// Only adds directory_members records scoped to the Space Rising tenant.

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS_TO_PROVISION = [
  { email: 'taryn@azspacelab.com', full_name: 'Taryn' },
  { email: 'tim@azspacelab.com',   full_name: 'Tim' },
];

async function run() {
  // 1. Get Space Rising tenant
  const { data: tenant, error: tenantErr } = await admin
    .from('directory_tenants')
    .select('id, name, slug')
    .eq('slug', 'space-rising')
    .single();

  if (tenantErr || !tenant) {
    console.error('Could not find space-rising tenant:', tenantErr?.message);
    process.exit(1);
  }
  console.log(`Found tenant: ${tenant.name} (${tenant.id})`);

  const results = [];

  for (const u of USERS_TO_PROVISION) {
    console.log(`\nProcessing ${u.email}...`);

    let userId;
    let isNew = false;

    // Try to create the auth user (email_confirm=true skips email verification)
    const tempPw = randomBytes(16).toString('hex');
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: tempPw,
      email_confirm: true,
      // NO app_metadata.role — tenant-scoped admin only, not global
      user_metadata: { full_name: u.full_name },
    });

    if (createErr) {
      if (createErr.message?.includes('already been registered') || createErr.code === 'email_exists') {
        console.log(`  User already exists, finding...`);
        const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
        if (listErr) { console.error('  listUsers failed:', listErr.message); process.exit(1); }
        const existing = listData?.users?.find(uu => uu.email?.toLowerCase() === u.email.toLowerCase());
        if (!existing) { console.error('  Could not find existing user'); process.exit(1); }
        userId = existing.id;
        console.log(`  Found existing user: ${userId}`);
      } else {
        console.error('  createUser failed:', createErr.message);
        process.exit(1);
      }
    } else {
      userId = created.user.id;
      isNew = true;
      console.log(`  Created new user: ${userId}`);
    }

    // 2. Upsert directory_members record for Space Rising, role='admin'
    const { data: existingMember } = await admin
      .from('directory_members')
      .select('id, role, status')
      .eq('auth_user_id', userId)
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (existingMember) {
      const { error: updateErr } = await admin
        .from('directory_members')
        .update({ role: 'admin', status: 'approved' })
        .eq('id', existingMember.id);
      if (updateErr) { console.error('  member update failed:', updateErr.message); process.exit(1); }
      console.log(`  Updated existing member record to role=admin, status=approved`);
    } else {
      const { error: insertErr } = await admin
        .from('directory_members')
        .insert({
          tenant_id: tenant.id,
          auth_user_id: userId,
          email: u.email,
          full_name: u.full_name,
          role: 'admin',
          status: 'approved',
        });
      if (insertErr) { console.error('  member insert failed:', insertErr.message); process.exit(1); }
      console.log(`  Inserted directory_members record: role=admin, status=approved`);
    }

    // 3. Generate a password reset link so they can set their own password (no temp pw needed)
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: u.email,
    });
    const resetLink = linkErr ? null : linkData?.properties?.action_link;
    if (linkErr) console.warn(`  Warning: could not generate reset link: ${linkErr.message}`);
    else console.log(`  Password reset link generated (one-time use)`);

    results.push({
      email: u.email,
      full_name: u.full_name,
      user_id: userId,
      is_new_account: isNew,
      tenant: tenant.name,
      tenant_id: tenant.id,
      role: 'admin',
      reset_link: resetLink,
    });
  }

  console.log('\n=== PROVISIONING COMPLETE ===');
  results.forEach(r => {
    console.log(`\n${r.full_name} (${r.email})`);
    console.log(`  user_id:     ${r.user_id}`);
    console.log(`  tenant:      ${r.tenant}`);
    console.log(`  role:        ${r.role} (tenant-scoped only, NOT global admin)`);
    console.log(`  new_account: ${r.is_new_account}`);
    if (r.reset_link) {
      console.log(`  reset_link:  ${r.reset_link}`);
    }
  });

  return results;
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
