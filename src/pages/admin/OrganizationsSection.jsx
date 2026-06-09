import React, { useState } from 'react';
import { AdminSection } from './AdminUI.jsx';

const VERTICALS = [
  { value: 'semiconductor', label: 'Semiconductor' },
  { value: 'space', label: 'Space / Aerospace' },
  { value: 'other', label: 'Other' },
];

export default function OrganizationsSection({ orgs, companies, V, adminSupabase, selectedTenantId, fetchData }) {
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [addOrgForm, setAddOrgForm] = useState({ name: '', website: '', vertical: 'semiconductor', description: '' });
  const [addOrgStatus, setAddOrgStatus] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', website: '', vertical: 'semiconductor', description: '' });
  const [rowBusy, setRowBusy] = useState(null);

  const handleAddOrg = async (e) => {
    e.preventDefault();
    if (!adminSupabase) return;
    setAddOrgStatus('Saving...');
    const slug = addOrgForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { error } = await adminSupabase.from('directory_organizations').insert({
      name: addOrgForm.name, slug,
      website: addOrgForm.website || null, vertical: addOrgForm.vertical,
      description: addOrgForm.description || null, membership_tiers: [],
      ...(selectedTenantId ? { tenant_id: selectedTenantId } : {}),
    });
    if (error) { setAddOrgStatus('Error: ' + error.message); }
    else {
      setAddOrgStatus('Created!');
      setAddOrgForm({ name: '', website: '', vertical: 'semiconductor', description: '' });
      setTimeout(() => { setAddOrgStatus(''); setShowAddOrg(false); }, 1500);
      await fetchData();
    }
  };

  const startEdit = (org) => {
    setEditingId(org.id);
    setEditForm({ name: org.name || '', website: org.website || '', vertical: org.vertical || 'semiconductor', description: org.description || '' });
  };
  const handleUpdateOrg = async (id) => {
    if (!adminSupabase) return;
    setRowBusy(id);
    try {
      const { error } = await adminSupabase.from('directory_organizations').update({
        name: editForm.name.trim(), website: editForm.website || null,
        vertical: editForm.vertical, description: editForm.description || null,
      }).eq('id', id);
      if (error) throw error;
      setEditingId(null);
      await fetchData();
    } catch (e) { alert('Update failed: ' + e.message); }
    finally { setRowBusy(null); }
  };
  const handleDeleteOrg = async (org) => {
    if (!adminSupabase) return;
    const memberCount = companies.filter(c => c.organization_id === org.id).length;
    const warn = memberCount > 0 ? ` ${memberCount} compan${memberCount === 1 ? 'y' : 'ies'} will be unlinked (not deleted).` : '';
    if (!window.confirm(`Delete "${org.name}"?${warn} This cannot be undone.`)) return;
    setRowBusy(org.id);
    try {
      const { error } = await adminSupabase.from('directory_organizations').delete().eq('id', org.id);
      if (error) throw error;
      await fetchData();
    } catch (e) { alert('Delete failed: ' + e.message); }
    finally { setRowBusy(null); }
  };

  const inp = { width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 6, padding: '8px 11px', fontSize: 13, fontFamily: V.space };
  const lab = { display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 4 };

  return (
    <AdminSection
      title="Organizations"
      V={V}
      action={
        <button onClick={() => setShowAddOrg(s => !s)} style={{
          background: showAddOrg ? V.accentDim : 'transparent',
          border: `1px solid ${showAddOrg ? V.accentBrd : V.border}`,
          color: showAddOrg ? V.accent : V.muted,
          borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
        }}>{showAddOrg ? 'Cancel' : '+ New Organization'}</button>
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
                <label style={lab}>{label}</label>
                <input type="text" placeholder={placeholder} value={addOrgForm[key]}
                  onChange={e => setAddOrgForm(f => ({ ...f, [key]: e.target.value }))}
                  required={key === 'name'} style={inp} />
              </div>
            ))}
            <div>
              <label style={lab}>Vertical</label>
              <select value={addOrgForm.vertical} onChange={e => setAddOrgForm(f => ({ ...f, vertical: e.target.value }))} style={inp}>
                {VERTICALS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button type="submit" style={{ background: V.accent, border: 'none', color: '#06060A', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 700, fontFamily: V.space, cursor: 'pointer' }}>Create Organization</button>
              {addOrgStatus && <span style={{ fontSize: 13, fontFamily: V.space, color: addOrgStatus.startsWith('Error') ? '#FCA5A5' : V.accent }}>{addOrgStatus}</span>}
            </div>
          </form>
        </div>
      )}
      <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 70px 150px', gap: 12, padding: '8px 16px', background: V.card2 }}>
          {['Organization', 'Vertical', 'Members', 'Actions'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>
        {orgs.map(org => {
          const memberCount = companies.filter(c => c.organization_id === org.id).length;
          if (editingId === org.id) {
            return (
              <div key={org.id} style={{ padding: '16px', borderBottom: `1px solid ${V.border}`, background: V.card2 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
                  <div><label style={lab}>Name</label><input style={inp} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div><label style={lab}>Website</label><input style={inp} value={editForm.website} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} placeholder="https://…" /></div>
                  <div><label style={lab}>Vertical</label><select style={inp} value={editForm.vertical} onChange={e => setEditForm(f => ({ ...f, vertical: e.target.value }))}>{VERTICALS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
                </div>
                <div style={{ marginBottom: 10 }}><label style={lab}>Description</label><textarea style={{ ...inp, minHeight: 48, resize: 'vertical' }} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleUpdateOrg(org.id)} disabled={rowBusy === org.id} style={{ background: V.accent, border: 'none', color: '#06060A', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: 'pointer' }}>{rowBusy === org.id ? 'Saving…' : 'Save'}</button>
                  <button onClick={() => setEditingId(null)} style={{ background: 'transparent', border: `1px solid ${V.border}`, color: V.muted, borderRadius: 6, padding: '6px 14px', fontSize: 12, fontFamily: V.space, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            );
          }
          return (
            <div key={org.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 70px 150px', gap: 12, padding: '12px 16px', alignItems: 'center', borderBottom: `1px solid ${V.border}`, opacity: rowBusy === org.id ? 0.5 : 1 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: V.space, color: V.text }}>{org.name}</div>
                <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                  {org.website && <> · <a href={org.website} target="_blank" rel="noreferrer" style={{ color: V.accent, textDecoration: 'none' }}>site</a></>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: V.muted, fontFamily: V.mono, textTransform: 'capitalize' }}>{org.vertical}</div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.mono, color: V.accent }}>{memberCount}</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => startEdit(org)} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${V.border}`, color: V.text, borderRadius: 5, padding: '4px 10px', fontSize: 11, fontWeight: 700, fontFamily: V.space, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => handleDeleteOrg(org)} style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.5)', color: '#FCA5A5', borderRadius: 5, padding: '4px 10px', fontSize: 11, fontWeight: 700, fontFamily: V.space, cursor: 'pointer' }}>Delete</button>
              </div>
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
