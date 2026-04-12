import React, { useState } from 'react';
import { AdminSection } from './AdminUI.jsx';

export default function OrganizationsSection({ orgs, companies, V, adminSupabase, selectedTenantId, fetchData }) {
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [addOrgForm, setAddOrgForm] = useState({
    name: '', website: '', vertical: 'semiconductor', description: '',
  });
  const [addOrgStatus, setAddOrgStatus] = useState('');

  const handleAddOrg = async (e) => {
    e.preventDefault();
    if (!adminSupabase) return;
    setAddOrgStatus('Saving...');
    const slug = addOrgForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { error } = await adminSupabase.from('directory_organizations').insert({
      name: addOrgForm.name,
      slug,
      website: addOrgForm.website || null,
      vertical: addOrgForm.vertical,
      description: addOrgForm.description || null,
      membership_tiers: [],
      ...(selectedTenantId ? { tenant_id: selectedTenantId } : {}),
    });
    if (error) {
      setAddOrgStatus('Error: ' + error.message);
    } else {
      setAddOrgStatus('Created!');
      setAddOrgForm({ name: '', website: '', vertical: 'semiconductor', description: '' });
      setTimeout(() => { setAddOrgStatus(''); setShowAddOrg(false); }, 1500);
      await fetchData();
    }
  };

  return (
    <AdminSection
      title="Organizations"
      V={V}
      action={
        <button onClick={() => setShowAddOrg(s => !s)} style={{
          background: showAddOrg ? V.accentDim : 'transparent',
          border: `1px solid ${showAddOrg ? V.accentBrd : V.border}`,
          color: showAddOrg ? V.accent : V.muted,
          borderRadius: 6, padding: '6px 14px', fontSize: 12,
          fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
        }}>
          {showAddOrg ? 'Cancel' : '+ New Organization'}
        </button>
      }
    >
      {showAddOrg && (
        <div style={{ background: V.card, border: `1px solid ${V.accentBrd}`, borderRadius: 10, padding: '20px 20px', marginBottom: 20, maxWidth: 500 }}>
          <style>{`input,textarea,select { box-sizing: border-box; }`}</style>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 14 }}>New Organization</div>
          <form onSubmit={handleAddOrg} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Name *', key: 'name', placeholder: 'e.g. Industry Alliance' },
              { label: 'Website', key: 'website', placeholder: 'https://example.org' },
              { label: 'Description', key: 'description', placeholder: 'What this org does...' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 4 }}>{label}</label>
                <input
                  type="text" placeholder={placeholder} value={addOrgForm[key]}
                  onChange={e => setAddOrgForm(f => ({ ...f, [key]: e.target.value }))}
                  required={key === 'name'}
                  style={{ width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 6, padding: '8px 11px', fontSize: 13, fontFamily: V.space }}
                />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 4 }}>Vertical</label>
              <select value={addOrgForm.vertical} onChange={e => setAddOrgForm(f => ({ ...f, vertical: e.target.value }))}
                style={{ width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 6, padding: '8px 11px', fontSize: 13, fontFamily: V.space }}>
                <option value="semiconductor">Semiconductor</option>
                <option value="space">Space / Aerospace</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button type="submit" style={{ background: V.accent, border: 'none', color: '#fff', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 700, fontFamily: V.space, cursor: 'pointer' }}>
                Create Organization
              </button>
              {addOrgStatus && <span style={{ fontSize: 13, fontFamily: V.space, color: addOrgStatus.startsWith('Error') ? '#EF4444' : V.accent }}>{addOrgStatus}</span>}
            </div>
          </form>
        </div>
      )}
      <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 12, padding: '8px 16px', background: V.card2 }}>
          {['Organization', 'Vertical', 'Members'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</div>
          ))}
        </div>
        {orgs.map(org => {
          const tiers = Array.isArray(org.membership_tiers) ? org.membership_tiers : [];
          const memberCount = companies.filter(c => c.organization_id === org.id).length;
          return (
            <div key={org.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 100px 100px',
              gap: 12, padding: '12px 16px', alignItems: 'center',
              borderBottom: `1px solid ${V.border}`,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: V.space, color: V.text }}>{org.name}</div>
                <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                  {org.website && <> · <a href={org.website} target="_blank" rel="noreferrer" style={{ color: '#3B82F6', textDecoration: 'none' }}>site</a></>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: V.muted, fontFamily: V.mono, textTransform: 'capitalize' }}>{org.vertical}</div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.mono, color: V.accent }}>{memberCount}</div>
            </div>
          );
        })}
        {orgs.length === 0 && (
          <div style={{ padding: '24px 16px', color: V.dim, fontSize: 13, fontFamily: V.space }}>No organizations yet.</div>
        )}
      </div>
    </AdminSection>
  );
}
