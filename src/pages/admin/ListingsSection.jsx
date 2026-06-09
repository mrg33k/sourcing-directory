import React, { useState } from 'react';
import { AdminSection, ListingRow } from './AdminUI.jsx';

const CATEGORIES = ['equipment', 'job', 'event', 'article'];

const EMPTY = {
  category: 'event', company_id: '', title: '', description: '', status: 'active',
  image_url: '', contact_email: '', vertical: '',
  // equipment
  price: '', condition: '',
  // job
  job_type: '', location: '', remote: false, salary_min: '', salary_max: '', apply_url: '',
  // event
  event_date: '', event_end_date: '', event_location: '', event_type: '', organizer: '', virtual_url: '',
};

function toLocalInput(ts) {
  if (!ts) return '';
  try { const d = new Date(ts); const off = d.getTimezoneOffset(); return new Date(d - off * 60000).toISOString().slice(0, 16); }
  catch { return ''; }
}

function ListingForm({ initial, companies, tenantId, adminSupabase, onClose, fetchData, V }) {
  const [f, setF] = useState(() => ({ ...EMPTY, ...(initial || {}),
    event_date: toLocalInput(initial?.event_date), event_end_date: toLocalInput(initial?.event_end_date),
    price: initial?.price ?? '', salary_min: initial?.salary_min ?? '', salary_max: initial?.salary_max ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const isEdit = !!initial?.id;
  const up = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async () => {
    setErr('');
    if (!f.title.trim()) return setErr('Title is required.');
    if (!f.company_id) return setErr('Pick a company.');
    setSaving(true);
    try {
      const num = (v) => (v === '' || v == null ? null : Number(v));
      const row = {
        category: f.category, company_id: f.company_id, title: f.title.trim(),
        description: f.description || null, status: f.status,
        image_url: f.image_url || null, contact_email: f.contact_email || null,
        vertical: f.vertical || null,
        price: f.category === 'equipment' ? num(f.price) : null,
        condition: f.category === 'equipment' ? (f.condition || null) : null,
        job_type: f.category === 'job' ? (f.job_type || null) : null,
        location: f.category === 'job' ? (f.location || null) : null,
        remote: f.category === 'job' ? !!f.remote : null,
        salary_min: f.category === 'job' ? num(f.salary_min) : null,
        salary_max: f.category === 'job' ? num(f.salary_max) : null,
        apply_url: f.category === 'job' ? (f.apply_url || null) : null,
        event_date: f.category === 'event' && f.event_date ? new Date(f.event_date).toISOString() : null,
        event_end_date: f.category === 'event' && f.event_end_date ? new Date(f.event_end_date).toISOString() : null,
        event_location: f.category === 'event' ? (f.event_location || null) : null,
        event_type: f.category === 'event' ? (f.event_type || null) : null,
        organizer: f.category === 'event' ? (f.organizer || null) : null,
        virtual_url: f.category === 'event' ? (f.virtual_url || null) : null,
      };
      let resp;
      if (isEdit) {
        resp = await adminSupabase.from('directory_listings').update(row).eq('id', initial.id);
      } else {
        resp = await adminSupabase.from('directory_listings').insert({ ...row, tenant_id: tenantId });
      }
      if (resp.error) throw resp.error;
      await fetchData();
      onClose();
    } catch (e) {
      setErr(e.message || 'Save failed.');
    } finally { setSaving(false); }
  };

  const inp = { width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 5, padding: '7px 9px', fontSize: 12, fontFamily: V.space, outline: 'none' };
  const lab = { fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' };
  const Field = ({ label, children }) => <div><label style={lab}>{label}</label>{children}</div>;

  return (
    <div style={{ background: V.card, border: `1px solid ${V.accentBrd}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 14 }}>
        {isEdit ? 'Edit Listing' : 'New Listing'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Field label="Category"><select style={inp} value={f.category} onChange={up('category')}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Company"><select style={inp} value={f.company_id} onChange={up('company_id')}><option value="">— select —</option>{[...companies].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Status"><select style={inp} value={f.status} onChange={up('status')}><option value="active">active</option><option value="pending">pending</option><option value="expired">expired</option></select></Field>
        <Field label="Image URL"><input style={inp} value={f.image_url} onChange={up('image_url')} placeholder="https://…" /></Field>
        <Field label="Contact Email"><input style={inp} value={f.contact_email} onChange={up('contact_email')} /></Field>
        <Field label="Vertical"><input style={inp} value={f.vertical} onChange={up('vertical')} placeholder="space / semiconductor…" /></Field>
        {f.category === 'equipment' && <>
          <Field label="Price"><input style={inp} type="number" value={f.price} onChange={up('price')} /></Field>
          <Field label="Condition"><select style={inp} value={f.condition} onChange={up('condition')}><option value="">—</option><option value="new">new</option><option value="used">used</option><option value="refurbished">refurbished</option></select></Field>
        </>}
        {f.category === 'job' && <>
          <Field label="Job Type"><select style={inp} value={f.job_type} onChange={up('job_type')}><option value="">—</option><option>full-time</option><option>part-time</option><option>contract</option><option>internship</option></select></Field>
          <Field label="Location"><input style={inp} value={f.location} onChange={up('location')} /></Field>
          <Field label="Salary Min"><input style={inp} type="number" value={f.salary_min} onChange={up('salary_min')} /></Field>
          <Field label="Salary Max"><input style={inp} type="number" value={f.salary_max} onChange={up('salary_max')} /></Field>
          <Field label="Apply URL"><input style={inp} value={f.apply_url} onChange={up('apply_url')} /></Field>
          <Field label="Remote"><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V.text, fontFamily: V.space, paddingTop: 6 }}><input type="checkbox" checked={f.remote} onChange={up('remote')} style={{ accentColor: V.accent }} /> Remote</label></Field>
        </>}
        {f.category === 'event' && <>
          <Field label="Event Date"><input style={inp} type="datetime-local" value={f.event_date} onChange={up('event_date')} /></Field>
          <Field label="End Date"><input style={inp} type="datetime-local" value={f.event_end_date} onChange={up('event_end_date')} /></Field>
          <Field label="Event Location"><input style={inp} value={f.event_location} onChange={up('event_location')} /></Field>
          <Field label="Event Type"><select style={inp} value={f.event_type} onChange={up('event_type')}><option value="">—</option><option>conference</option><option>meetup</option><option>webinar</option><option>workshop</option><option>expo</option></select></Field>
          <Field label="Organizer"><input style={inp} value={f.organizer} onChange={up('organizer')} /></Field>
          <Field label="Virtual URL"><input style={inp} value={f.virtual_url} onChange={up('virtual_url')} /></Field>
        </>}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lab}>Description</label>
        <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={f.description} onChange={up('description')} />
      </div>
      {err && <div style={{ color: '#FCA5A5', fontSize: 12, fontFamily: V.space, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving} style={{ background: V.accent, border: 'none', color: '#fff', borderRadius: 6, padding: '7px 18px', fontSize: 13, fontWeight: 700, fontFamily: V.space, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create listing')}
        </button>
        <button onClick={onClose} disabled={saving} style={{ background: 'transparent', border: `1px solid ${V.border}`, color: V.muted, borderRadius: 6, padding: '7px 16px', fontSize: 13, fontFamily: V.space, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}

export default function ListingsSection({ listings, companyMap, companies, handleListingToggle, adminSupabase, fetchData, selectedTenantId, V }) {
  const [listingFilter, setListingFilter] = useState('all');
  const [form, setForm] = useState(null); // null | {} (new) | listing (edit)

  const filteredListings = listingFilter === 'all'
    ? listings
    : listings.filter(l => l.category === listingFilter);

  const handleDelete = async (listing) => {
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return;
    const { error } = await adminSupabase.from('directory_listings').delete().eq('id', listing.id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    await fetchData();
  };

  return (
    <AdminSection
      title="Listings"
      V={V}
      action={
        selectedTenantId ? (
          <button onClick={() => setForm({})} style={{
            background: V.accent, border: 'none', color: '#fff', borderRadius: 6,
            padding: '6px 14px', fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            + New Listing
          </button>
        ) : (
          <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>Select a directory to add listings</span>
        )
      }
    >
      {form && (
        <ListingForm
          initial={form.id ? form : null}
          companies={companies || []}
          tenantId={selectedTenantId}
          adminSupabase={adminSupabase}
          fetchData={fetchData}
          onClose={() => setForm(null)}
          V={V}
        />
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setListingFilter(cat)} style={{
            background: listingFilter === cat ? V.accentDim : 'transparent',
            border: `1px solid ${listingFilter === cat ? V.accentBrd : V.border}`,
            color: listingFilter === cat ? V.accent : V.muted,
            borderRadius: 6, padding: '5px 12px', fontSize: 12,
            fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
            textTransform: 'capitalize',
          }}>
            {cat}
          </button>
        ))}
      </div>

      <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 190px', gap: 12, padding: '8px 16px', background: V.card2 }}>
          {['Listing', 'Status', 'Posted', 'Actions'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>
        {filteredListings.slice(0, 100).map(listing => (
          <ListingRow
            key={listing.id}
            listing={listing}
            company={companyMap[listing.company_id]}
            onToggle={handleListingToggle}
            onEdit={(l) => setForm(l)}
            onDelete={handleDelete}
            V={V}
          />
        ))}
        {filteredListings.length === 0 && (
          <div style={{ padding: '24px 16px', color: V.dim, fontSize: 13, fontFamily: V.space }}>No listings.</div>
        )}
        {filteredListings.length > 100 && (
          <div style={{ padding: '12px 16px', color: V.dim, fontSize: 12, fontFamily: V.mono, textAlign: 'center' }}>
            Showing 100 of {filteredListings.length}
          </div>
        )}
      </div>
    </AdminSection>
  );
}
