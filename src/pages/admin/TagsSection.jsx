import React, { useState } from 'react';
import { AdminSection } from './AdminUI.jsx';
import { logAudit } from './audit.js';

export default function TagsSection({ V, adminSupabase, selectedTenantId, currentUserEmail }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  // Add-tag form
  const [draft, setDraft] = useState({ name: '', description: '', parent_tag_id: '' });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const load = React.useCallback(async () => {
    if (!adminSupabase) return;
    setLoading(true);
    let q = adminSupabase.from('directory_tags').select('*').order('created_at', { ascending: true }).limit(1000);
    if (selectedTenantId) q = q.eq('tenant_id', selectedTenantId);
    const { data } = await q;
    setTags(data || []);
    setLoading(false);
  }, [selectedTenantId]);
  React.useEffect(() => { load(); }, [load]);

  const topTags = React.useMemo(() => tags.filter(t => !t.parent_tag_id), [tags]);
  const subsByParent = React.useMemo(() => {
    const m = {};
    tags.filter(t => t.parent_tag_id).forEach(t => { (m[t.parent_tag_id] ||= []).push(t); });
    return m;
  }, [tags]);

  const addTag = async () => {
    const name = draft.name.trim();
    if (!name) { setFormErr('A tag name is required.'); return; }
    if (!adminSupabase) return;
    setSaving(true); setFormErr('');
    try {
      const parent = draft.parent_tag_id || null;
      const { data, error } = await adminSupabase.from('directory_tags').insert({
        tenant_id: selectedTenantId || null,
        name,
        category: parent ? 'sub' : 'market_goal',
        parent_tag_id: parent,
        description: draft.description.trim() || null,
        status: 'active',
      }).select().single();
      if (error) throw error;
      logAudit(adminSupabase, { tenant_id: selectedTenantId, actor_email: currentUserEmail, action: 'tag.create', entity_type: 'tag', entity_id: data?.id, detail: { name, parent } });
      setDraft({ name: '', description: '', parent_tag_id: '' });
      await load();
    } catch (err) {
      setFormErr(err.message?.includes('duplicate') ? 'A tag with that name already exists.' : (err.message || 'Failed to add tag.'));
    } finally { setSaving(false); }
  };

  const setStatus = async (tag, status) => {
    if (!adminSupabase) return;
    setBusy(tag.id);
    try {
      await adminSupabase.from('directory_tags').update({ status, updated_at: new Date().toISOString() }).eq('id', tag.id);
      logAudit(adminSupabase, { tenant_id: selectedTenantId, actor_email: currentUserEmail, action: `tag.${status}`, entity_type: 'tag', entity_id: tag.id, detail: { name: tag.name } });
      await load();
    } finally { setBusy(null); }
  };

  const deleteTag = async (tag) => {
    if (!adminSupabase) return;
    const subCount = (subsByParent[tag.id] || []).length;
    const warn = subCount ? ` This also deletes its ${subCount} sub-tag${subCount === 1 ? '' : 's'}.` : '';
    if (!window.confirm(`Delete tag "${tag.name}"?${warn} This cannot be undone.`)) return;
    setBusy(tag.id);
    try {
      await adminSupabase.from('directory_tags').delete().eq('id', tag.id);
      logAudit(adminSupabase, { tenant_id: selectedTenantId, actor_email: currentUserEmail, action: 'tag.delete', entity_type: 'tag', entity_id: tag.id, detail: { name: tag.name } });
      await load();
    } finally { setBusy(null); }
  };

  const inputStyle = {
    width: '100%', background: V.card2, border: `1px solid ${V.border}`,
    color: V.text, borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: V.space, outline: 'none',
  };
  const labelStyle = {
    fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim,
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block',
  };

  const statusPill = (status) => (
    <span style={{
      background: status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(138,132,124,0.1)',
      border: `1px solid ${status === 'active' ? 'rgba(34,197,94,0.4)' : 'rgba(138,132,124,0.4)'}`,
      color: status === 'active' ? '#86EFAC' : '#8A847C',
      fontSize: 9, fontWeight: 700, fontFamily: V.mono, padding: '2px 6px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>{status}</span>
  );

  const tagActions = (tag) => (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {tag.status === 'active' ? (
        <button onClick={() => setStatus(tag, 'retired')} disabled={busy === tag.id} style={{
          background: 'rgba(255,255,255,0.06)', border: `1px solid ${V.border}`, color: V.muted,
          borderRadius: 5, padding: '4px 8px', fontSize: 10, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
        }}>Retire</button>
      ) : (
        <button onClick={() => setStatus(tag, 'active')} disabled={busy === tag.id} style={{
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#86EFAC',
          borderRadius: 5, padding: '4px 8px', fontSize: 10, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
        }}>Reactivate</button>
      )}
      <button onClick={() => deleteTag(tag)} disabled={busy === tag.id} style={{
        background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.5)', color: '#FCA5A5',
        borderRadius: 5, padding: '4px 8px', fontSize: 10, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
      }}>Delete</button>
    </div>
  );

  return (
    <AdminSection
      title={`Tags — ${topTags.length} market tags · ${tags.length - topTags.length} sub-tags`}
      V={V}
    >
      {/* Add-tag form */}
      <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: 18, marginBottom: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Tag name</label>
            <input style={inputStyle} value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Launch Vehicles" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
          </div>
          <div>
            <label style={labelStyle}>Parent (blank = top market tag)</label>
            <select style={inputStyle} value={draft.parent_tag_id} onChange={e => setDraft(p => ({ ...p, parent_tag_id: e.target.value }))}>
              <option value="">— Top-level market tag —</option>
              {topTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Market / note (optional)</label>
            <input style={inputStyle} value={draft.description} onChange={e => setDraft(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Mobility" />
          </div>
        </div>
        {formErr && <div style={{ color: '#FCA5A5', fontSize: 12, fontFamily: V.space, marginBottom: 10 }}>{formErr}</div>}
        <button onClick={addTag} disabled={saving} style={{
          background: V.accent, border: 'none', color: '#fff', borderRadius: 6,
          padding: '8px 16px', fontSize: 12, fontWeight: 700, fontFamily: V.space,
          cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
        }}>{saving ? 'Adding…' : '+ Add tag'}</button>
      </div>

      {/* Taxonomy */}
      {loading ? (
        <div style={{ padding: '24px 0', color: V.dim, fontSize: 13, fontFamily: V.space }}>Loading tags…</div>
      ) : topTags.length === 0 ? (
        <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '32px 16px', textAlign: 'center', color: V.dim, fontSize: 13, fontFamily: V.space }}>
          No tags yet. Seed the six market missions (scripts/seed-directory-tags.mjs) or add the first tag above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {topTags.map(top => {
            const subs = subsByParent[top.id] || [];
            return (
              <div key={top.id} style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, overflow: 'hidden', opacity: busy === top.id ? 0.5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: V.card2, borderBottom: subs.length ? `1px solid ${V.border}` : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.heading }}>{top.name}</span>
                      {top.description && <span style={{ fontSize: 11, color: V.accent, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{top.description}</span>}
                      {statusPill(top.status)}
                    </div>
                  </div>
                  {tagActions(top)}
                </div>
                {subs.map(sub => (
                  <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 10px 32px', borderBottom: `1px solid ${V.border}`, opacity: busy === sub.id ? 0.5 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: V.dim, fontFamily: V.mono, fontSize: 12 }}>↳</span>
                      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: V.space, color: V.text }}>{sub.name}</span>
                      {sub.description && <span style={{ fontSize: 11, color: V.dim, fontFamily: V.space }}>{sub.description}</span>}
                      {statusPill(sub.status)}
                    </div>
                    {tagActions(sub)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </AdminSection>
  );
}
