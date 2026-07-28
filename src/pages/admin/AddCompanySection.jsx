import React, { useState } from 'react';
import { AdminSection } from './AdminUI.jsx';
import { supabase } from '../../lib/supabase.js';

// membership_tier is billing state. PROTECTED_COLUMNS in api/sourcing/lib/tablePolicy.js
// strips /^membership_/ from every payload the admin API accepts, so the tier picker
// that used to live in this form was discarded server-side while the admin was shown
// "Added!". The control is gone rather than disabled: a new company simply starts on
// the column's database default, and the tier moves through checkout.
// If tier ever needs to be admin-settable, that is a purpose-built server endpoint with
// its own audit trail — not a hole in PROTECTED_COLUMNS.
const BLANK_FORM = {
  name: '', website: '', city: '', state: 'AZ', vertical: 'semiconductor',
  description: '', employee_count: '', year_founded: '', email: '', phone: '',
  featured: false, owner_email: '',
};

export default function AddCompanySection({ orgs, V, adminSupabase, selectedTenantId, selectedTenant, fetchData }) {
  const [addCompanyForm, setAddCompanyForm] = useState({ ...BLANK_FORM });
  const [addCompanyStatus, setAddCompanyStatus] = useState('');

  // A company with no directory is invisible everywhere.
  //
  // Every directory-facing query filters on the directory the company belongs to, so a
  // row created without one is in the database and on no screen. It used to be created
  // that way by default: the payload carried the directory only `if (selectedTenantId)`,
  // and SourcingAdmin starts every admin in "All Directories" mode with that unset. The
  // server does not rescue it either — api/sourcing/admin.js preparePayload only fills
  // the directory in for a scoped admin who administers exactly one, and skips the whole
  // block for a platform admin (`if (key && !auth.isGlobal)`). All five live admin
  // accounts are platform admins, so every company added from this form landed
  // directoryless while the form said "Added!".
  //
  // So the choice is required, up front, instead of guessed at and lost.
  const needsDirectory = !selectedTenantId;

  const handleAddCompany = async (e) => {
    e.preventDefault();
    if (!adminSupabase) return;
    if (needsDirectory) {
      setAddCompanyStatus('Error: Choose a directory first. Use the directory picker in the top bar — a company has to belong to one, and nothing was saved.');
      return;
    }
    setAddCompanyStatus('Saving...');
    const slug = addCompanyForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const orgId = orgs.find(o => o.vertical === addCompanyForm.vertical)?.id || null;
    const { data: insertedCompany, error } = await adminSupabase.from('directory_companies').insert({
      name: addCompanyForm.name,
      slug,
      website: addCompanyForm.website || null,
      city: addCompanyForm.city || null,
      state: addCompanyForm.state || 'AZ',
      country: 'US',
      vertical: addCompanyForm.vertical,
      description: addCompanyForm.description || null,
      employee_count: addCompanyForm.employee_count || null,
      year_founded: addCompanyForm.year_founded ? parseInt(addCompanyForm.year_founded) : null,
      email: addCompanyForm.email || null,
      phone: addCompanyForm.phone || null,
      featured: addCompanyForm.featured,
      status: 'active',
      organization_id: orgId,
      // Unconditional. Guarded by `needsDirectory` above — if this is ever absent the
      // row is orphaned, so it is not an optional spread.
      tenant_id: selectedTenantId,
    }).select().single();
    if (error) {
      setAddCompanyStatus('Error: ' + error.message);
    } else {
      // If owner email provided, create auth user + directory_members row.
      // Authenticates with the signed-in admin's own Supabase JWT — this used to send
      // the service_role key from the browser as an 'x-admin-key' header.
      if (addCompanyForm.owner_email.trim() && insertedCompany?.id) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token || '';
        const resp = await fetch('/api/sourcing/admin-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            mode: 'member',
            email: addCompanyForm.owner_email.trim(),
            company_id: insertedCompany.id,
            tenant_id: selectedTenantId,
          }),
        }).catch(() => null);
        if (!resp || !resp.ok) {
          setAddCompanyStatus('Company added, but owner account creation failed.');
          setTimeout(() => { setAddCompanyStatus(''); }, 3000);
          setAddCompanyForm({ ...BLANK_FORM });
          await fetchData();
          return;
        }
      }
      setAddCompanyStatus('Added!');
      setAddCompanyForm({ ...BLANK_FORM });
      setTimeout(() => { setAddCompanyStatus(''); }, 1500);
      await fetchData();
    }
  };

  return (
    <AdminSection title="Add Company" V={V}>
      <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '28px 24px', maxWidth: 600 }}>
        <style>{`input,textarea,select { box-sizing: border-box; } input::placeholder,textarea::placeholder { color: ${V.dim}; } input:focus,textarea:focus,select:focus { outline: none; border-color: ${V.accentBrd} !important; }`}</style>

        {/* Which directory this company is being added to — stated before the form,
            because it is the one thing here that cannot be corrected by editing a field. */}
        {needsDirectory ? (
          <div style={{
            background: V.accentDim, border: `1px solid ${V.accentBrd}`, borderRadius: 8,
            padding: '14px 16px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: V.space, color: V.accent, marginBottom: 6 }}>
              Choose a directory first
            </div>
            <div style={{ fontSize: 12.5, fontFamily: V.space, color: V.muted, lineHeight: 1.55 }}>
              You are viewing all directories at once. A company has to belong to one, so pick the
              directory this company goes into using the picker in the top bar, then fill in the form.
            </div>
          </div>
        ) : (
          <div style={{
            fontSize: 12.5, fontFamily: V.space, color: V.muted, marginBottom: 20,
            paddingBottom: 14, borderBottom: `1px solid ${V.border}`,
          }}>
            Adding to <span style={{ color: V.text, fontWeight: 700 }}>{selectedTenant?.name || 'the selected directory'}</span>.
          </div>
        )}

        <form onSubmit={handleAddCompany} style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: needsDirectory ? 0.55 : 1 }}>
          {[
            { label: 'Company Name *', key: 'name', type: 'text', placeholder: 'e.g. Acme Semiconductors' },
            { label: 'Website', key: 'website', type: 'url', placeholder: 'https://example.com' },
            { label: 'City', key: 'city', type: 'text', placeholder: 'e.g. Chandler' },
            { label: 'State', key: 'state', type: 'text', placeholder: 'AZ' },
            { label: 'Email', key: 'email', type: 'email', placeholder: 'info@example.com' },
            { label: 'Phone', key: 'phone', type: 'text', placeholder: '(480) 555-0000' },
            { label: 'Employee Count', key: 'employee_count', type: 'text', placeholder: 'e.g. 50-200' },
            { label: 'Year Founded', key: 'year_founded', type: 'number', placeholder: '2015' },
            { label: 'Owner Email (optional — creates login account)', key: 'owner_email', type: 'email', placeholder: 'owner@example.com' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>{label}</label>
              <input
                type={type} placeholder={placeholder} value={addCompanyForm[key]}
                onChange={e => setAddCompanyForm(f => ({ ...f, [key]: e.target.value }))}
                required={key === 'name'}
                style={{ width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: V.space }}
              />
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>Description</label>
            <textarea
              placeholder="1-2 sentences describing what the company does..."
              value={addCompanyForm.description}
              onChange={e => setAddCompanyForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              style={{ width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: V.space, resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>Vertical</label>
              <select value={addCompanyForm.vertical} onChange={e => setAddCompanyForm(f => ({ ...f, vertical: e.target.value }))}
                style={{ width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: V.space }}>
                <option value="semiconductor">Semiconductor</option>
                <option value="space">Space / Aerospace</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>Membership Tier</label>
              <div style={{ width: '100%', background: V.card, border: `1px solid ${V.border}`, color: V.dim, borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: V.space }}>
                Set by checkout
              </div>
              <div style={{ fontSize: 11, fontFamily: V.space, color: V.dim, marginTop: 5, lineHeight: 1.4 }}>
                Membership tier is billing state and is not set here. New companies start on the free tier.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="featured-cb" checked={addCompanyForm.featured} onChange={e => setAddCompanyForm(f => ({ ...f, featured: e.target.checked }))} style={{ accentColor: V.accent, width: 16, height: 16 }} />
            <label htmlFor="featured-cb" style={{ fontSize: 13, fontFamily: V.space, color: V.muted, cursor: 'pointer' }}>Mark as featured (shows first in directory)</label>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
            <button
              type="submit"
              disabled={needsDirectory}
              title={needsDirectory ? 'Choose a directory in the top bar first' : undefined}
              style={{
                background: needsDirectory ? V.dim : V.accent,
                border: 'none', color: '#fff', borderRadius: 8, padding: '10px 24px',
                fontSize: 14, fontWeight: 700, fontFamily: V.space,
                cursor: needsDirectory ? 'not-allowed' : 'pointer',
              }}
            >
              Add Company
            </button>
            {addCompanyStatus && (
              <span style={{ fontSize: 13, fontFamily: V.space, color: addCompanyStatus.startsWith('Error') ? '#EF4444' : V.accent }}>
                {addCompanyStatus}
              </span>
            )}
          </div>
        </form>
      </div>
    </AdminSection>
  );
}
