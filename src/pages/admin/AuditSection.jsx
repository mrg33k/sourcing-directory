import React from 'react';
import { AdminSection } from './AdminUI.jsx';

export default function AuditSection({ adminSupabase, selectedTenantId, V }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!adminSupabase) return;
    setLoading(true);
    let q = adminSupabase.from('directory_audit').select('*').order('created_at', { ascending: false }).limit(200);
    if (selectedTenantId) q = q.eq('tenant_id', selectedTenantId);
    const { data } = await q;
    setRows(data || []);
    setLoading(false);
  }, [selectedTenantId]);
  React.useEffect(() => { load(); }, [load]);

  const fmt = (ts) => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch { return '—'; }
  };

  return (
    <AdminSection
      title={`Audit Log (${rows.length})`}
      V={V}
      action={
        <button onClick={load} disabled={loading} style={{
          background: 'rgba(255,255,255,0.06)', border: `1px solid ${V.border}`, color: V.text,
          borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, fontFamily: V.space,
          cursor: loading ? 'wait' : 'pointer',
        }}>{loading ? 'Loading…' : 'Refresh'}</button>
      }
    >
      <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 160px 1fr', gap: 12, padding: '8px 16px', background: V.card2 }}>
          {['When', 'Actor', 'Action', 'Entity'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</div>
          ))}
        </div>
        {rows.map(r => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 160px 1fr', gap: 12, padding: '9px 16px', alignItems: 'center', borderBottom: `1px solid ${V.border}` }}>
            <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>{fmt(r.created_at)}</div>
            <div style={{ fontSize: 12, color: V.text, fontFamily: V.space, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.actor_email || 'system'}</div>
            <div>
              <span style={{ background: V.accentDim, border: `1px solid ${V.accentBrd}`, color: V.accent, fontSize: 10, fontWeight: 700, fontFamily: V.mono, padding: '2px 7px', borderRadius: 3 }}>{r.action}</span>
            </div>
            <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.entity_type || '—'}{r.entity_id ? ` · ${String(r.entity_id).slice(0, 8)}` : ''}{r.detail && r.detail.email ? ` · ${r.detail.email}` : ''}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ padding: '24px 16px', color: V.dim, fontSize: 13, fontFamily: V.space }}>
            {loading ? 'Loading…' : 'No audit entries yet. Actions you take (approve, delete, role changes) will appear here.'}
          </div>
        )}
      </div>
    </AdminSection>
  );
}
