import React, { useState } from 'react';
import { AdminSection } from './AdminUI.jsx';
import { logAudit } from './audit.js';

// Status + priority vocab. Order of STATUSES drives the board column order.
const STATUSES = [
  { key: 'needs_fix', label: 'Needs Fix', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.4)',  text: '#FCA5A5' },
  { key: 'in_review', label: 'In Review', bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.4)',  text: '#FDE68A' },
  { key: 'done',      label: 'Done',      bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.4)',  text: '#86EFAC' },
];
const PRIORITIES = [
  { key: 'high',   label: 'High',   color: '#FCA5A5' },
  { key: 'medium', label: 'Medium', color: '#FDE68A' },
  { key: 'low',    label: 'Low',    color: '#93C5FD' },
];

const statusMeta = (s) => STATUSES.find(x => x.key === s) || STATUSES[0];
const priorityMeta = (p) => PRIORITIES.find(x => x.key === p) || PRIORITIES[1];

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function TicketsSection({ V, adminSupabase, selectedTenantId, currentUserEmail }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Expandable notes thread per ticket
  const [expandedId, setExpandedId] = useState(null);
  const [comments, setComments] = useState({}); // ticketId -> [comment]
  const [commentDraft, setCommentDraft] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);

  // New-ticket form
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ title: '', description: '', priority: 'medium', assigned_to: '', area: '', link: '' });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const load = React.useCallback(async () => {
    if (!adminSupabase) return;
    setLoading(true);
    let q = adminSupabase.from('admin_tickets').select('*').order('created_at', { ascending: false }).limit(500);
    if (selectedTenantId) q = q.eq('tenant_id', selectedTenantId);
    const { data } = await q;
    setTickets(data || []);
    setLoading(false);
  }, [selectedTenantId]);
  React.useEffect(() => { load(); }, [load]);

  const createTicket = async () => {
    const title = draft.title.trim();
    if (!title) { setFormErr('A title is required.'); return; }
    if (!adminSupabase) return;
    setSaving(true);
    setFormErr('');
    try {
      const { data, error } = await adminSupabase.from('admin_tickets').insert({
        tenant_id: selectedTenantId || null,
        title,
        description: draft.description.trim() || null,
        priority: draft.priority,
        assigned_to: draft.assigned_to.trim() || null,
        area: draft.area.trim() || null,
        link: draft.link.trim() || null,
        created_by: currentUserEmail || null,
        status: 'needs_fix',
      }).select().single();
      if (error) throw error;
      logAudit(adminSupabase, { tenant_id: selectedTenantId, actor_email: currentUserEmail, action: 'ticket.create', entity_type: 'ticket', entity_id: data?.id, detail: { title } });
      setDraft({ title: '', description: '', priority: 'medium', assigned_to: '', area: '', link: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setFormErr(err.message || 'Failed to create ticket.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (ticket, status) => {
    if (!adminSupabase) return;
    setBusy(ticket.id);
    try {
      await adminSupabase.from('admin_tickets').update({ status, updated_by: currentUserEmail || null, updated_at: new Date().toISOString() }).eq('id', ticket.id);
      logAudit(adminSupabase, { tenant_id: selectedTenantId, actor_email: currentUserEmail, action: `ticket.status.${status}`, entity_type: 'ticket', entity_id: ticket.id, detail: { title: ticket.title } });
      await load();
    } finally { setBusy(null); }
  };

  const setPriority = async (ticket, priority) => {
    if (!adminSupabase) return;
    setBusy(ticket.id);
    try {
      await adminSupabase.from('admin_tickets').update({ priority, updated_by: currentUserEmail || null, updated_at: new Date().toISOString() }).eq('id', ticket.id);
      await load();
    } finally { setBusy(null); }
  };

  // Notes thread — load + add comments for a ticket.
  const toggleExpand = async (ticket) => {
    if (expandedId === ticket.id) { setExpandedId(null); return; }
    setExpandedId(ticket.id);
    setCommentDraft('');
    if (!comments[ticket.id] && adminSupabase) {
      const { data } = await adminSupabase.from('admin_ticket_comments')
        .select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true });
      setComments(c => ({ ...c, [ticket.id]: data || [] }));
    }
  };
  const addComment = async (ticket) => {
    const body = commentDraft.trim();
    if (!body || !adminSupabase) return;
    setCommentBusy(true);
    try {
      const { data, error } = await adminSupabase.from('admin_ticket_comments')
        .insert({ ticket_id: ticket.id, author: currentUserEmail || null, body, is_agent: false }).select().single();
      if (error) throw error;
      setComments(c => ({ ...c, [ticket.id]: [...(c[ticket.id] || []), data] }));
      setCommentDraft('');
    } finally { setCommentBusy(false); }
  };

  const deleteTicket = async (ticket) => {
    if (!adminSupabase) return;
    if (!window.confirm(`Delete ticket "${ticket.title}"? This cannot be undone.`)) return;
    setBusy(ticket.id);
    try {
      await adminSupabase.from('admin_tickets').delete().eq('id', ticket.id);
      logAudit(adminSupabase, { tenant_id: selectedTenantId, actor_email: currentUserEmail, action: 'ticket.delete', entity_type: 'ticket', entity_id: ticket.id, detail: { title: ticket.title } });
      await load();
    } finally { setBusy(null); }
  };

  const filtered = React.useMemo(() => {
    const ql = query.trim().toLowerCase();
    return tickets.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!ql) return true;
      return [t.title, t.description, t.assigned_to, t.created_by, t.area].filter(Boolean).some(v => String(v).toLowerCase().includes(ql));
    });
  }, [tickets, query, statusFilter]);

  const counts = React.useMemo(() => {
    const c = { needs_fix: 0, in_review: 0, done: 0 };
    tickets.forEach(t => { if (c[t.status] != null) c[t.status] += 1; });
    return c;
  }, [tickets]);

  const inputStyle = {
    width: '100%', background: V.card2, border: `1px solid ${V.border}`,
    color: V.text, borderRadius: 6, padding: '8px 10px', fontSize: 13,
    fontFamily: V.space, outline: 'none',
  };
  const labelStyle = {
    fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim,
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block',
  };

  return (
    <AdminSection
      title={`Tickets — ${counts.needs_fix} needs fix · ${counts.in_review} in review · ${counts.done} done`}
      V={V}
      action={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tickets…"
            style={{ ...inputStyle, width: 'auto', minWidth: 200 }}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="all">All statuses</option>
            {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button onClick={() => { setShowForm(v => !v); setFormErr(''); }} style={{
            background: V.accent, border: 'none', color: '#fff', borderRadius: 6,
            padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {showForm ? 'Close' : '+ New ticket'}
          </button>
        </div>
      }
    >
      {/* New-ticket form */}
      {showForm && (
        <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: 18, marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Title</label>
              <input style={inputStyle} value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} placeholder="What needs fixing?" autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select style={inputStyle} value={draft.priority} onChange={e => setDraft(p => ({ ...p, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assigned to (optional)</label>
              <input style={inputStyle} value={draft.assigned_to} onChange={e => setDraft(p => ({ ...p, assigned_to: e.target.value }))} placeholder="name or email" />
            </div>
            <div>
              <label style={labelStyle}>Area / screen (optional)</label>
              <input style={inputStyle} value={draft.area} onChange={e => setDraft(p => ({ ...p, area: e.target.value }))} placeholder="Homepage, Deal Bank, Jobs…" />
            </div>
            <div>
              <label style={labelStyle}>Link (optional)</label>
              <input style={inputStyle} value={draft.link} onChange={e => setDraft(p => ({ ...p, link: e.target.value }))} placeholder="https://… where to see it" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Description (optional)</label>
            <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={draft.description} onChange={e => setDraft(p => ({ ...p, description: e.target.value }))} placeholder="Steps to reproduce, links, context…" />
          </div>
          {formErr && <div style={{ color: '#FCA5A5', fontSize: 12, fontFamily: V.space, marginBottom: 10 }}>{formErr}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createTicket} disabled={saving} style={{
              background: V.accent, border: 'none', color: '#fff', borderRadius: 6,
              padding: '8px 16px', fontSize: 12, fontWeight: 700, fontFamily: V.space,
              cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
            }}>{saving ? 'Saving…' : 'Create ticket'}</button>
            <button onClick={() => { setShowForm(false); setFormErr(''); }} disabled={saving} style={{
              background: 'transparent', border: `1px solid ${V.border}`, color: V.muted,
              borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Ticket list */}
      <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 130px 90px 150px', gap: 12, padding: '8px 16px', background: V.card2 }}>
          {['Ticket', 'Priority', 'Status', 'Assigned', 'Created / By', 'Actions'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '24px 16px', color: V.dim, fontSize: 13, fontFamily: V.space }}>Loading tickets…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '32px 16px', color: V.dim, fontSize: 13, fontFamily: V.space, textAlign: 'center' }}>
            {query || statusFilter !== 'all' ? 'No tickets match your filter.' : 'No tickets yet. Create the first one to start the list.'}
          </div>
        ) : filtered.map(t => {
          const sm = statusMeta(t.status);
          const pm = priorityMeta(t.priority);
          return (
            <React.Fragment key={t.id}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 110px 110px 130px 90px 150px',
              gap: 12, padding: '12px 16px', alignItems: 'center',
              borderBottom: expandedId === t.id ? 'none' : `1px solid ${V.border}`, opacity: busy === t.id ? 0.5 : 1,
            }}>
              <div style={{ minWidth: 0 }}>
                <button type="button" onClick={() => toggleExpand(t)} title="Open notes" style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', display: 'block', width: '100%' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: V.space, color: V.text }}>
                    <span style={{ color: V.dim, fontSize: 11, marginRight: 6 }}>{expandedId === t.id ? '▾' : '▸'}</span>{t.title}
                  </div>
                </button>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  {t.area && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, border: `1px solid ${V.border}`, borderRadius: 3, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.area}</span>}
                  {t.link && <a href={t.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: V.accent, fontFamily: V.mono, textDecoration: 'none' }}>open ↗</a>}
                  {t.description && (
                    <span style={{ fontSize: 12, color: V.dim, fontFamily: V.space, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>{t.description}</span>
                  )}
                </div>
              </div>
              <div>
                <select value={t.priority} onChange={e => setPriority(t, e.target.value)} disabled={busy === t.id} style={{
                  background: V.card2, border: `1px solid ${V.border}`, color: pm.color,
                  borderRadius: 5, padding: '4px 6px', fontSize: 11, fontWeight: 700, fontFamily: V.mono, cursor: 'pointer',
                }}>
                  {PRIORITIES.map(p => <option key={p.key} value={p.key} style={{ color: '#111' }}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <span style={{
                  background: sm.bg, border: `1px solid ${sm.border}`, color: sm.text,
                  fontSize: 10, fontWeight: 700, fontFamily: V.mono, padding: '3px 8px', borderRadius: 3,
                  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                }}>{sm.label}</span>
              </div>
              <div style={{ fontSize: 12, color: V.dim, fontFamily: V.mono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.assigned_to || '—'}</div>
              <div style={{ fontSize: 12, color: V.dim, fontFamily: V.mono }}>
                {formatDate(t.created_at)}
                <div style={{ fontSize: 10, color: V.dim, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.85 }}>
                  by {t.created_by ? String(t.created_by).split('@')[0] : 'unknown'}
                </div>
                {t.updated_by && (
                  <div style={{ fontSize: 10, color: V.dim, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.7 }}>
                    moved by {String(t.updated_by).split('@')[0]}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {STATUSES.filter(s => s.key !== t.status).map(s => (
                  <button key={s.key} onClick={() => setStatus(t, s.key)} disabled={busy === t.id} title={`Move to ${s.label}`} style={{
                    background: s.bg, border: `1px solid ${s.border}`, color: s.text,
                    borderRadius: 5, padding: '4px 8px', fontSize: 10, fontWeight: 700, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>{s.label}</button>
                ))}
                <button onClick={() => deleteTicket(t)} disabled={busy === t.id} title="Delete ticket" style={{
                  background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.5)', color: '#FCA5A5',
                  borderRadius: 5, padding: '4px 8px', fontSize: 10, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                }}>Delete</button>
              </div>
            </div>
            {expandedId === t.id && (
              <div style={{ padding: '8px 16px 18px', borderBottom: `1px solid ${V.border}`, background: V.card2 }}>
                <div style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Notes</div>
                {(comments[t.id] || []).length === 0 ? (
                  <div style={{ fontSize: 12, color: V.dim, fontFamily: V.space, marginBottom: 10 }}>No notes yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    {(comments[t.id] || []).map(c => (
                      <div key={c.id} style={{ fontSize: 13, fontFamily: V.space, color: V.text, borderLeft: `2px solid ${c.is_agent ? V.accent : V.border}`, paddingLeft: 10 }}>
                        <div>{c.body}</div>
                        <div style={{ fontSize: 10, color: V.dim, fontFamily: V.mono, marginTop: 2 }}>
                          {c.is_agent ? 'agent' : (c.author ? String(c.author).split('@')[0] : 'unknown')} · {formatDate(c.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={commentDraft} onChange={e => setCommentDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addComment(t); }} placeholder="Add a note…" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => addComment(t)} disabled={commentBusy || !commentDraft.trim()} style={{ background: V.accent, border: 'none', color: '#fff', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: commentBusy ? 'wait' : 'pointer', opacity: commentBusy || !commentDraft.trim() ? 0.6 : 1 }}>Add</button>
                </div>
              </div>
            )}
            </React.Fragment>
          );
        })}
      </div>
    </AdminSection>
  );
}
