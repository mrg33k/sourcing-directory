import React, { useState } from 'react';
import { AdminSection, ListingRow } from './AdminUI.jsx';

const CATEGORIES = ['equipment', 'services', 'products', 'job', 'event', 'article', 'podcast', 'video', 'whitepaper', 'news', 'person', 'rfp', 'grant'];

const EMPTY = {
  category: 'event', company_id: '', title: '', description: '', status: 'active',
  image_url: '', contact_email: '', vertical: '',
  // equipment
  price: '', condition: '',
  // job
  job_type: '', location: '', remote: false, salary_min: '', salary_max: '', apply_url: '',
  // event
  event_date: '', event_end_date: '', event_location: '', event_type: '', organizer: '', virtual_url: '',
  // podcast
  author_name: '',
  // whitepaper / article
  cover_image_url: '',
  // rfp
  deadline: '',
  // grant
  grant_agency: '',
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
        price: ['equipment', 'services', 'products'].includes(f.category) ? num(f.price) : null,
        condition: ['equipment', 'services', 'products'].includes(f.category) ? (f.condition || null) : null,
        job_type: f.category === 'job' ? (f.job_type || null) : null,
        location: (f.category === 'job' || f.category === 'podcast' || f.category === 'video') ? (f.location || null) : null,
        remote: f.category === 'job' ? !!f.remote : null,
        salary_min: ['job', 'grant'].includes(f.category) ? num(f.salary_min) : null,
        salary_max: ['job', 'grant'].includes(f.category) ? num(f.salary_max) : null,
        apply_url: ['job', 'whitepaper', 'services', 'products', 'rfp', 'grant'].includes(f.category) ? (f.apply_url || null) : null,
        event_date: f.category === 'event' && f.event_date
          ? new Date(f.event_date).toISOString()
          : (f.category === 'news' && f.event_date ? new Date(f.event_date).toISOString() : null),
        event_end_date: f.category === 'event' && f.event_end_date ? new Date(f.event_end_date).toISOString() : null,
        event_location: f.category === 'event' ? (f.event_location || null) : null,
        event_type: f.category === 'event' ? (f.event_type || null) : null,
        organizer: f.category === 'event' ? (f.organizer || null) : null,
        virtual_url: (f.category === 'event' || f.category === 'podcast' || f.category === 'video' || f.category === 'news' || f.category === 'person') ? (f.virtual_url || null) : null,
        author_name: (f.category === 'podcast' || f.category === 'video' || f.category === 'article' || f.category === 'whitepaper' || f.category === 'news' || f.category === 'person' || f.category === 'rfp') ? (f.author_name || null) : null,
        cover_image_url: (f.category === 'article' || f.category === 'whitepaper' || f.category === 'video') ? (f.cover_image_url || null) : null,
        deadline: ['rfp', 'grant'].includes(f.category) && f.deadline ? new Date(f.deadline).toISOString() : null,
        grant_agency: f.category === 'grant' ? (f.grant_agency || null) : null,
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
      <div style={{ marginBottom: 12 }}>
        <label style={lab}>Title</label>
        <input style={inp} value={f.title} onChange={up('title')} placeholder="Listing title" />
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
        {f.category === 'services' && <>
          <Field label="Service Type"><input style={inp} value={f.vertical} onChange={up('vertical')} placeholder="e.g. Engineering, Testing, Consulting" /></Field>
          <Field label="Rate / Price"><input style={inp} type="number" value={f.price} onChange={up('price')} placeholder="e.g. 150 (hourly or fixed)" /></Field>
          <Field label="Pricing Model"><select style={inp} value={f.condition} onChange={up('condition')}><option value="">—</option><option value="hourly">hourly</option><option value="fixed">fixed</option><option value="custom">custom</option><option value="quote">quote only</option></select></Field>
          <Field label="Website / Contact URL"><input style={inp} value={f.apply_url} onChange={up('apply_url')} placeholder="https://…" /></Field>
        </>}
        {f.category === 'products' && <>
          <Field label="Price"><input style={inp} type="number" value={f.price} onChange={up('price')} /></Field>
          <Field label="Condition"><select style={inp} value={f.condition} onChange={up('condition')}><option value="">—</option><option value="new">new</option><option value="like-new">like new</option><option value="used">used</option><option value="refurbished">refurbished</option></select></Field>
          <Field label="Product Type"><input style={inp} value={f.vertical} onChange={up('vertical')} placeholder="e.g. Propulsion, Sensors, Software" /></Field>
          <Field label="Buy / Info URL"><input style={inp} value={f.apply_url} onChange={up('apply_url')} placeholder="https://…" /></Field>
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
        {f.category === 'podcast' && <>
          <Field label="Host / Guest"><input style={inp} value={f.author_name} onChange={up('author_name')} placeholder="e.g. David Ariosto" /></Field>
          <Field label="Audio / Video URL"><input style={inp} value={f.virtual_url} onChange={up('virtual_url')} placeholder="https://…" /></Field>
          <Field label="Duration"><input style={inp} value={f.location} onChange={up('location')} placeholder="e.g. 48 min" /></Field>
        </>}
        {f.category === 'video' && <>
          <Field label="Source / Outlet"><input style={inp} value={f.author_name} onChange={up('author_name')} placeholder="e.g. FOX 10 Phoenix, YouTube, PBS" /></Field>
          <Field label="Video URL"><input style={inp} value={f.virtual_url} onChange={up('virtual_url')} placeholder="https://youtube.com/watch?v=… or direct video link" /></Field>
          <Field label="Thumbnail URL"><input style={inp} value={f.cover_image_url} onChange={up('cover_image_url')} placeholder="https://… (optional)" /></Field>
          <Field label="Duration"><input style={inp} value={f.location} onChange={up('location')} placeholder="e.g. 4 min, 45 min" /></Field>
        </>}
        {f.category === 'whitepaper' && <>
          <Field label="Document URL"><input style={inp} value={f.apply_url} onChange={up('apply_url')} placeholder="https://…" /></Field>
          <Field label="Cover Image URL"><input style={inp} value={f.cover_image_url} onChange={up('cover_image_url')} placeholder="https://…" /></Field>
          <Field label="Author / Publisher"><input style={inp} value={f.author_name} onChange={up('author_name')} /></Field>
        </>}
        {f.category === 'news' && <>
          <Field label="Outlet / Source"><input style={inp} value={f.author_name} onChange={up('author_name')} placeholder="e.g. KTAR, AZPBS, FOX 10" /></Field>
          <Field label="Article URL"><input style={inp} value={f.virtual_url} onChange={up('virtual_url')} placeholder="https://…" /></Field>
          <Field label="Publication Date"><input style={inp} type="date" value={f.event_date ? f.event_date.slice(0, 10) : ''} onChange={e => setF(prev => ({ ...prev, event_date: e.target.value }))} /></Field>
          <Field label="Topic"><input style={inp} value={f.vertical} onChange={up('vertical')} placeholder="Space Congress / Aerospace / Policy / Local" /></Field>
        </>}
        {f.category === 'person' && <>
          <Field label="Role / Title"><input style={inp} value={f.author_name} onChange={up('author_name')} placeholder="e.g. Chairman, CEO, Director" /></Field>
          <Field label="Organization"><input style={inp} value={f.vertical} onChange={up('vertical')} placeholder="e.g. Arizona Space Commission" /></Field>
          <Field label="Profile URL"><input style={inp} value={f.virtual_url} onChange={up('virtual_url')} placeholder="https://linkedin.com/in/…" /></Field>
        </>}
        {f.category === 'rfp' && <>
          <Field label="Issuing Agency"><input style={inp} value={f.author_name} onChange={up('author_name')} placeholder="e.g. NASA, DoD, Arizona Commerce Authority" /></Field>
          <Field label="Solicitation URL"><input style={inp} value={f.apply_url} onChange={up('apply_url')} placeholder="https://sam.gov/…" /></Field>
          <Field label="Deadline"><input style={inp} type="date" value={f.deadline ? f.deadline.slice(0, 10) : ''} onChange={e => setF(prev => ({ ...prev, deadline: e.target.value }))} /></Field>
          <Field label="Type"><input style={inp} value={f.vertical} onChange={up('vertical')} placeholder="Federal / NASA / DoD / State" /></Field>
        </>}
        {f.category === 'grant' && <>
          <Field label="Grant Agency"><input style={inp} value={f.grant_agency} onChange={up('grant_agency')} placeholder="e.g. NASA, NSF, Arizona Commerce Authority" /></Field>
          <Field label="Grant Type"><input style={inp} value={f.vertical} onChange={up('vertical')} placeholder="SBIR / STTR / Federal / State / Foundation" /></Field>
          <Field label="Amount Min ($)"><input style={inp} type="number" value={f.salary_min} onChange={up('salary_min')} placeholder="e.g. 50000" /></Field>
          <Field label="Amount Max ($)"><input style={inp} type="number" value={f.salary_max} onChange={up('salary_max')} placeholder="e.g. 250000" /></Field>
          <Field label="Deadline"><input style={inp} type="date" value={f.deadline ? f.deadline.slice(0, 10) : ''} onChange={e => setF(prev => ({ ...prev, deadline: e.target.value }))} /></Field>
          <Field label="Application URL"><input style={inp} value={f.apply_url} onChange={up('apply_url')} placeholder="https://sbir.nasa.gov/…" /></Field>
          <Field label="Eligibility (in Description)"><span style={{ fontSize: 10, color: V.dim, fontFamily: V.space }}>Use the Description field below for eligibility criteria.</span></Field>
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
