import React, { useState } from 'react';
import { AdminSection } from './AdminUI.jsx';

export default function AddCompanySection({ orgs, V, adminSupabase, selectedTenantId, fetchData }) {
  const [addCompanyForm, setAddCompanyForm] = useState({
    name: '', website: '', city: '', state: 'AZ', vertical: 'semiconductor',
    description: '', employee_count: '', year_founded: '', email: '', phone: '',
    membership_tier: 'free', featured: false, owner_email: '',
  });
  const [addCompanyStatus, setAddCompanyStatus] = useState('');

  const handleAddCompany = async (e) => {
    e.preventDefault();
    if (!adminSupabase) return;
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
      membership_tier: addCompanyForm.membership_tier,
      featured: addCompanyForm.featured,
      status: 'active',
      organization_id: orgId,
      ...(selectedTenantId ? { tenant_id: selectedTenantId } : {}),
    }).select().single();
    if (error) {
      setAddCompanyStatus('Error: ' + error.message);
    } else {
      // If owner email provided, create auth user + directory_members row
      if (addCompanyForm.owner_email.trim() && insertedCompany?.id) {
        const adminKey = (import.meta.env.VITE_SOURCING_ADMIN_KEY || '').trim();
        const resp = await fetch('/api/sourcing/admin-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
          body: JSON.stringify({
            mode: 'member',
            email: addCompanyForm.owner_email.trim(),
            company_id: insertedCompany.id,
            tenant_id: selectedTenantId || null,
          }),
        }).catch(() => null);
        if (!resp || !resp.ok) {
          setAddCompanyStatus('Company added, but owner account creation failed.');
          setTimeout(() => { setAddCompanyStatus(''); }, 3000);
          setAddCompanyForm({ name: '', website: '', city: '', state: 'AZ', vertical: 'semiconductor', description: '', employee_count: '', year_founded: '', email: '', phone: '', membership_tier: 'free', featured: false, owner_email: '' });
          await fetchData();
          return;
        }
      }
      setAddCompanyStatus('Added!');
      setAddCompanyForm({ name: '', website: '', city: '', state: 'AZ', vertical: 'semiconductor', description: '', employee_count: '', year_founded: '', email: '', phone: '', membership_tier: 'free', featured: false, owner_email: '' });
      setTimeout(() => { setAddCompanyStatus(''); }, 1500);
      await fetchData();
    }
  };

  return (
    <AdminSection title="Add Company" V={V}>
      <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '28px 24px', maxWidth: 600 }}>
        <style>{`input,textarea,select { box-sizing: border-box; } input::placeholder,textarea::placeholder { color: ${V.dim}; } input:focus,textarea:focus,select:focus { outline: none; border-color: ${V.accentBrd} !important; }`}</style>
        <form onSubmit={handleAddCompany} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              <select value={addCompanyForm.membership_tier} onChange={e => setAddCompanyForm(f => ({ ...f, membership_tier: e.target.value }))}
                style={{ width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: V.space }}>
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="featured-cb" checked={addCompanyForm.featured} onChange={e => setAddCompanyForm(f => ({ ...f, featured: e.target.checked }))} style={{ accentColor: V.accent, width: 16, height: 16 }} />
            <label htmlFor="featured-cb" style={{ fontSize: 13, fontFamily: V.space, color: V.muted, cursor: 'pointer' }}>Mark as featured (shows first in directory)</label>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
            <button type="submit" style={{ background: V.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, fontFamily: V.space, cursor: 'pointer' }}>
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
