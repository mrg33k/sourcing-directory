// POST /api/sourcing/signup -- server-side signup handler
// Uses service role key to bypass RLS and insert company + member + certifications
// This is the correct architecture: signup inserts happen server-side, not client-side.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Airtable — Directory Signups table mirror. Best-effort write after the
// Supabase insert succeeds. Same PAT used by the srw-subscribe endpoint
// (data.records:write scope, Space Rising base only). 2026-05-31.
const AIRTABLE_PAT             = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID         = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_DIRECTORY_TABLE = process.env.AIRTABLE_DIRECTORY_TABLE_ID;

async function mirrorToAirtable({ company, full_name, auth_email, selectedCerts, tenant_slug, source_url }) {
  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID || !AIRTABLE_DIRECTORY_TABLE) {
    console.warn('Airtable directory env vars not set, skipping mirror.');
    return { skipped: true };
  }
  const fields = {
    'Company Name': company.name,
    'Slug': company.slug,
    'Description': company.description,
    'Website': company.website,
    'Company Email': company.email,
    'Phone': company.phone,
    'Logo URL': company.logo_url,
    'Vertical': company.vertical,
    'City': company.city,
    'State': company.state,
    'Country': company.country,
    'Employee Count': company.employee_count,
    'Year Founded': company.year_founded,
    'Membership Tier': company.membership_tier,
    'Membership Seats': company.membership_seats,
    'Status': company.status,
    'Featured': !!company.featured,
    'Tenant': tenant_slug,
    'Contact Name': full_name,
    'Contact Email': auth_email,
    'Certifications': Array.isArray(selectedCerts) ? selectedCerts : [],
    'Submitted At': company.created_at || new Date().toISOString(),
    'Updated At': company.updated_at,
    'Supabase ID': company.id,
    'Source URL': source_url || null,
  };
  Object.keys(fields).forEach((k) => (fields[k] === null || fields[k] === undefined || fields[k] === '') && delete fields[k]);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_DIRECTORY_TABLE}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  const data = await res.json();
  if (!res.ok) console.error('Airtable directory mirror error:', data);
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const {
    auth_email, auth_password, full_name,
    name, description, website, phone, email,
    vertical, city, state, employee_count, year_founded,
    org_id, tenant_id, selectedCerts,
    membership_tier, seats,
  } = req.body || {};

  // Validate required fields
  if (!auth_email || !auth_password) return res.status(400).json({ error: 'Email and password are required.' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Company name is required.' });
  if (!description || !description.trim()) return res.status(400).json({ error: 'Description is required.' });
  if (!full_name || !full_name.trim()) return res.status(400).json({ error: 'Your name is required.' });
  if (auth_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  try {
    // 1. Create auth user
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email: auth_email.trim(),
      password: auth_password,
      email_confirm: true, // auto-confirm so they can log in immediately
    });
    if (authErr) {
      if (authErr.message?.includes('already been registered') || authErr.message?.includes('duplicate')) {
        return res.status(409).json({ error: 'That email is already registered. Try signing in instead.' });
      }
      throw authErr;
    }

    const userId = authData.user?.id;

    // 2. Generate slug
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // 3. Insert company
    const companyPayload = {
      name: name.trim(),
      slug,
      description: description.trim(),
      website: website?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      vertical: vertical || 'semiconductor',
      city: city?.trim() || null,
      state: state || 'AZ',
      employee_count: employee_count || null,
      year_founded: year_founded ? parseInt(year_founded) : null,
      organization_id: org_id || null,
      // R5i (nat-geo-uplift): membership_tier always created as 'free' here — even
      // on the paid signup path. The checkout-session endpoint + webhook flip it
      // to 'paid' only after Square confirms payment. That way an abandoned paid
      // signup doesn't end up tier='paid' without payment having cleared.
      membership_tier: 'free',
      // Stamp pending seat count so checkout-session has the figure on hand.
      pending_checkout_seats: (membership_tier === 'paid' && seats) ? parseInt(seats, 10) : null,
      status: 'pending',
    };
    if (tenant_id) companyPayload.tenant_id = tenant_id;

    const { data: company, error: companyErr } = await sb
      .from('directory_companies')
      .insert(companyPayload)
      .select()
      .single();

    if (companyErr) {
      // Clean up auth user on failure
      if (userId) await sb.auth.admin.deleteUser(userId);
      if (companyErr.message?.includes('duplicate') || companyErr.message?.includes('unique')) {
        return res.status(409).json({ error: 'A company with this name already exists.' });
      }
      throw companyErr;
    }

    // 4. Insert member record (always -- login requires this)
    let effectiveTenantId = tenant_id;
    if (!effectiveTenantId) {
      // No tenant passed from frontend -- look up default for this vertical
      const { data: fallbackTenant } = await sb
        .from('directory_tenants')
        .select('id')
        .eq('vertical', vertical || 'semiconductor')
        .eq('status', 'active')
        .limit(1)
        .single();
      effectiveTenantId = fallbackTenant?.id;
    }

    if (effectiveTenantId) {
      const { error: memberErr } = await sb
        .from('directory_members')
        .insert({
          tenant_id: effectiveTenantId,
          company_id: company.id,
          email: auth_email.trim(),
          full_name: full_name.trim(),
          status: 'approved',
          auth_user_id: userId,
        });
      if (memberErr) console.error('Member insert error:', memberErr.message);
    } else {
      console.error('No tenant found for member insert -- vertical:', vertical);
    }

    // 5. Insert certifications
    if (selectedCerts && selectedCerts.length > 0) {
      const certRows = selectedCerts.map(cert => ({
        company_id: company.id,
        cert_name: cert,
        cert_value: 'true',
        vertical: vertical || 'semiconductor',
        ...(tenant_id ? { tenant_id } : {}),
      }));
      const { error: certErr } = await sb.from('directory_certifications').insert(certRows);
      if (certErr) console.error('Cert insert error:', certErr.message);
    }

    // 6. Mirror to Airtable (best-effort, doesn't block the response)
    try {
      // Look up tenant slug for the Airtable row so it shows "space-rising"
      // instead of an opaque UUID.
      let tenant_slug = null;
      if (effectiveTenantId) {
        const { data: tenantRow } = await sb
          .from('directory_tenants')
          .select('slug')
          .eq('id', effectiveTenantId)
          .single();
        tenant_slug = tenantRow?.slug || null;
      }
      const source_url = (req.headers['referer'] || req.headers['referrer'] || '').toString().split('?')[0] || null;
      await mirrorToAirtable({
        company,
        full_name,
        auth_email,
        selectedCerts,
        tenant_slug,
        source_url,
      });
    } catch (err) {
      console.error('Airtable mirror error:', err.message);
      // Supabase already has the record — don't fail the signup over Airtable.
    }

    return res.status(200).json({
      ok: true,
      company_id: company.id,
      company_slug: company.slug,
      user_id: userId,
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: err.message || 'Signup failed. Please try again.' });
  }
}
