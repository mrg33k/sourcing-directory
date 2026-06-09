import React, { useState, useEffect, useCallback } from 'react';
import { AdminSection } from './AdminUI.jsx';
import { logAudit } from './audit.js';

const TABLE = { listing: 'deal_bank_listings', investor: 'deal_bank_investors', round: 'deal_bank_completed_rounds' };
const STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'];

function fmtNum(n) {
  if (!n) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toString();
}

export default function DealBankSection({ adminSupabase, selectedTenantId, currentUserEmail, V }) {
  const [listings, setListings] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyMap, setCompanyMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState({});
  const [form, setForm] = useState(null); // { entity, data }

  const fetchData = useCallback(async () => {
    if (!adminSupabase) return;
    setLoading(true);
    try {
      const [l, i, r, c] = await Promise.all([
        adminSupabase.from('deal_bank_listings').select('*').order('submitted_at', { ascending: false }).limit(200),
        adminSupabase.from('deal_bank_investors').select('*').order('submitted_at', { ascending: false }).limit(200),
        adminSupabase.from('deal_bank_completed_rounds').select('*').order('date', { ascending: false }).limit(100),
        adminSupabase.from('directory_companies').select('id, name').eq('status', 'active').order('name'),
      ]);
      setListings(l.data || []); setInvestors(i.data || []); setRounds(r.data || []);
      setCompanies(c.data || []);
      const map = {}; (c.data || []).forEach(co => { map[co.id] = co; }); setCompanyMap(map);
    } catch (err) { console.error('DealBank fetch error:', err); }
    finally { setLoading(false); }
  }, [adminSupabase]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const setStatus = async (entity, id, status) => {
    if (!adminSupabase) return;
    setBusy(p => ({ ...p, [id]: true }));
    try {
      await adminSupabase.from(TABLE[entity]).update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
      await fetchData();
    } finally { setBusy(p => ({ ...p, [id]: false })); }
  };
  const remove = async (entity, item) => {
    if (!adminSupabase) return;
    const label = item.company || item.firm_name || companyMap[item.company_id]?.name || 'this entry';
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setBusy(p => ({ ...p, [item.id]: true }));
    try {
      await adminSupabase.from(TABLE[entity]).delete().eq('id', item.id);
      logAudit(adminSupabase, { tenant_id: selectedTenantId, actor_email: currentUserEmail, action: `dealbank.${entity}.delete`, entity_type: `dealbank_${entity}`, entity_id: item.id, detail: { label } });
      await fetchData();
    } finally { setBusy(p => ({ ...p, [item.id]: false })); }
  };

  if (loading && !listings.length && !investors.length && !rounds.length) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: V.muted, fontFamily: V.space }}>Loading Deal Bank…</div>;
  }

  const newBtn = (entity, label) => (
    <button onClick={() => setForm({ entity, data: form?.entity === entity ? null : {} })} style={{
      background: form?.entity === entity ? V.accentDim : 'transparent',
      border: `1px solid ${form?.entity === entity ? V.accentBrd : V.border}`,
      color: form?.entity === entity ? V.accent : V.muted,
      borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
    }}>{form?.entity === entity && form?.data && !form.data.id ? 'Cancel' : `+ New ${label}`}</button>
  );
  const actions = (entity, item) => (
    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {item.status === 'pending' && entity !== 'round' && (
        <>
          <Btn label="Approve" onClick={() => setStatus(entity, item.id, 'approved')} busy={busy[item.id]} tone="green" V={V} />
          <Btn label="Reject" onClick={() => setStatus(entity, item.id, 'rejected')} busy={busy[item.id]} tone="red" V={V} />
        </>
      )}
      <Btn label="Edit" onClick={() => setForm({ entity, data: item })} busy={busy[item.id]} tone="gray" V={V} />
      <Btn label="Delete" onClick={() => remove(entity, item)} busy={busy[item.id]} tone="red2" V={V} />
    </div>
  );

  return (
    <div>
      {form && (
        <DealBankForm
          entity={form.entity} initial={form.data?.id ? form.data : null} companies={companies}
          adminSupabase={adminSupabase} onClose={() => setForm(null)} onSaved={() => { setForm(null); fetchData(); }} V={V}
        />
      )}

      <AdminSection title={`Investment Listings (${listings.length})`} V={V} action={newBtn('listing', 'Listing')}>
        {listings.length === 0 ? <Empty V={V} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {listings.map(l => (
              <Card key={l.id} title={companyMap[l.company_id]?.name || 'Unknown Company'} status={l.status} busy={busy[l.id]}
                tag="listing" tagColor="#93C5FD" tagBg="rgba(59,130,246,0.15)" excerpt={l.exec_summary}
                meta={[l.round_stage && { label: 'Stage', value: l.round_stage }, l.capital_sought && { label: 'Seeking', value: l.capital_sought }].filter(Boolean)}
                actions={actions('listing', l)} V={V} />
            ))}
          </div>
        )}
      </AdminSection>

      <AdminSection title={`Investor Profiles (${investors.length})`} V={V} action={newBtn('investor', 'Investor')}>
        {investors.length === 0 ? <Empty V={V} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {investors.map(iv => (
              <Card key={iv.id} title={iv.firm_name} status={iv.status} busy={busy[iv.id]}
                tag="investor" tagColor="#6EE7B7" tagBg="rgba(16,185,129,0.15)" excerpt={iv.criteria}
                meta={[(iv.check_size_min || iv.check_size_max) && { label: 'Check', value: `$${fmtNum(iv.check_size_min)}–$${fmtNum(iv.check_size_max)}` }, iv.deals_last_18mo != null && { label: 'Deals(18mo)', value: iv.deals_last_18mo }].filter(Boolean)}
                actions={actions('investor', iv)} V={V} />
            ))}
          </div>
        )}
      </AdminSection>

      <AdminSection title={`Completed Rounds (${rounds.length})`} V={V} action={newBtn('round', 'Round')}>
        {rounds.length === 0 ? <Empty V={V} msg="No completed rounds yet." /> : (
          <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 90px 150px', gap: 12, padding: '8px 16px', background: V.card2 }}>
              {['Company', 'Amount', 'Round', 'Date', 'Actions'].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</div>)}
            </div>
            {rounds.map(r => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 90px 150px', gap: 12, padding: '11px 16px', alignItems: 'center', borderBottom: `1px solid ${V.border}`, opacity: busy[r.id] ? 0.5 : 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: V.space, color: V.text }}>{r.company}</div>
                <div style={{ fontSize: 12, color: '#86EFAC', fontFamily: V.mono, fontWeight: 700 }}>{r.amount_raised || '—'}</div>
                <div style={{ fontSize: 11, color: V.muted, fontFamily: V.mono }}>{r.round || '—'}</div>
                <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>{r.date ? new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</div>
                {actions('round', r)}
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </div>
  );
}

function Btn({ label, onClick, busy, tone, V }) {
  const t = {
    green: { bg: 'rgba(34,197,94,0.15)', bd: 'rgba(34,197,94,0.4)', fg: '#86EFAC' },
    red:   { bg: 'rgba(239,68,68,0.1)', bd: 'rgba(239,68,68,0.3)', fg: '#FCA5A5' },
    red2:  { bg: 'rgba(239,68,68,0.18)', bd: 'rgba(239,68,68,0.5)', fg: '#FCA5A5' },
    gray:  { bg: 'rgba(255,255,255,0.06)', bd: V.border, fg: V.text },
  }[tone];
  return <button onClick={onClick} disabled={busy} style={{ background: t.bg, border: `1px solid ${t.bd}`, color: t.fg, borderRadius: 5, padding: '5px 12px', fontSize: 11, fontWeight: 700, fontFamily: V.space, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1, whiteSpace: 'nowrap' }}>{label}</button>;
}

function Empty({ V, msg }) {
  return <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '28px 24px', textAlign: 'center', fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.text }}>{msg || 'Nothing here yet.'}</div>;
}

function Card({ title, status, tag, tagColor, tagBg, excerpt, meta, actions, busy, V }) {
  return (
    <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '16px 20px', opacity: busy ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 4 }}>{title}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 4, background: tagBg, color: tagColor }}>{tag}</span>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 4, background: status === 'rejected' ? 'rgba(239,68,68,0.1)' : status === 'approved' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.15)', color: status === 'rejected' ? '#FCA5A5' : status === 'approved' ? '#86EFAC' : '#FDE68A' }}>{status}</span>
            {meta.map(({ label, value }) => <span key={label} style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}><span style={{ color: V.muted, fontWeight: 600 }}>{label}</span> {value}</span>)}
          </div>
          {excerpt && <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{excerpt}</div>}
        </div>
        {actions}
      </div>
    </div>
  );
}

const FIELDS = {
  listing: [
    { k: 'company_id', label: 'Company', type: 'company', req: true },
    { k: 'round_stage', label: 'Round Stage', type: 'text' },
    { k: 'capital_sought', label: 'Capital Sought', type: 'text' },
    { k: 'deck_url', label: 'Deck URL', type: 'text' },
    { k: 'revenue_y1', label: 'Revenue Y1', type: 'number' },
    { k: 'revenue_y2', label: 'Revenue Y2', type: 'number' },
    { k: 'revenue_y3', label: 'Revenue Y3', type: 'number' },
    { k: 'status', label: 'Status', type: 'status' },
    { k: 'exec_summary', label: 'Executive Summary', type: 'textarea', full: true },
  ],
  investor: [
    { k: 'firm_name', label: 'Firm Name', type: 'text', req: true },
    { k: 'website', label: 'Website', type: 'text' },
    { k: 'check_size_min', label: 'Check Min ($)', type: 'number' },
    { k: 'check_size_max', label: 'Check Max ($)', type: 'number' },
    { k: 'deal_types', label: 'Deal Types (comma-sep)', type: 'csv' },
    { k: 'deals_last_18mo', label: 'Deals (18mo)', type: 'number' },
    { k: 'linkedin_url', label: 'LinkedIn URL', type: 'text' },
    { k: 'contact_email_internal', label: 'Contact Email (internal)', type: 'text' },
    { k: 'status', label: 'Status', type: 'status' },
    { k: 'criteria', label: 'Criteria', type: 'textarea', full: true },
  ],
  round: [
    { k: 'company', label: 'Company', type: 'text', req: true },
    { k: 'amount_raised', label: 'Amount Raised', type: 'text' },
    { k: 'round', label: 'Round', type: 'text' },
    { k: 'date', label: 'Date', type: 'date' },
    { k: 'source_url', label: 'Source URL', type: 'text' },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true },
  ],
};

function DealBankForm({ entity, initial, companies, adminSupabase, onClose, onSaved, V }) {
  const fields = FIELDS[entity];
  const [f, setF] = useState(() => {
    const base = {};
    fields.forEach(fl => {
      let v = initial ? initial[fl.k] : '';
      if (fl.type === 'csv' && Array.isArray(v)) v = v.join(', ');
      base[fl.k] = v ?? '';
    });
    if (!initial && !base.status && fields.some(fl => fl.k === 'status')) base.status = 'approved';
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const isEdit = !!initial?.id;
  const up = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setErr('');
    const reqField = fields.find(fl => fl.req);
    if (reqField && !String(f[reqField.k] || '').trim()) return setErr(`${reqField.label} is required.`);
    setSaving(true);
    try {
      const row = {};
      fields.forEach(fl => {
        let v = f[fl.k];
        if (fl.type === 'number') v = (v === '' || v == null) ? null : Number(v);
        else if (fl.type === 'csv') v = String(v || '').split(',').map(s => s.trim()).filter(Boolean);
        else if (fl.type === 'date') v = v || null;
        else v = (v === '' ? null : v);
        row[fl.k] = v;
      });
      const resp = isEdit
        ? await adminSupabase.from(TABLE[entity]).update(row).eq('id', initial.id)
        : await adminSupabase.from(TABLE[entity]).insert(row);
      if (resp.error) throw resp.error;
      onSaved();
    } catch (e) { setErr(e.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const inp = { width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: V.space, outline: 'none' };
  const lab = { fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' };
  const labelName = { listing: 'Investment Listing', investor: 'Investor', round: 'Completed Round' }[entity];

  return (
    <div style={{ background: V.card, border: `1px solid ${V.accentBrd}`, borderRadius: 10, padding: 22, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 14 }}>{isEdit ? `Edit ${labelName}` : `New ${labelName}`}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
        {fields.filter(fl => !fl.full).map(fl => (
          <div key={fl.k}>
            <label style={lab}>{fl.label}{fl.req ? ' *' : ''}</label>
            {fl.type === 'company' ? (
              <select style={inp} value={f[fl.k]} onChange={up(fl.k)}>
                <option value="">— select —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : fl.type === 'status' ? (
              <select style={inp} value={f[fl.k]} onChange={up(fl.k)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
            ) : (
              <input style={inp} type={fl.type === 'number' ? 'number' : fl.type === 'date' ? 'date' : 'text'} value={f[fl.k]} onChange={up(fl.k)} />
            )}
          </div>
        ))}
      </div>
      {fields.filter(fl => fl.full).map(fl => (
        <div key={fl.k} style={{ marginBottom: 14 }}>
          <label style={lab}>{fl.label}</label>
          <textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={f[fl.k]} onChange={up(fl.k)} />
        </div>
      ))}
      {err && <div style={{ color: '#FCA5A5', fontSize: 12, fontFamily: V.space, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving} style={{ background: V.accent, border: 'none', color: '#06060A', borderRadius: 7, padding: '8px 20px', fontSize: 13, fontWeight: 700, fontFamily: V.space, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : (isEdit ? 'Save changes' : `Create ${labelName}`)}</button>
        <button onClick={onClose} disabled={saving} style={{ background: 'transparent', border: `1px solid ${V.border}`, color: V.muted, borderRadius: 7, padding: '8px 16px', fontSize: 13, fontFamily: V.space, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}
