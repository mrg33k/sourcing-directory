import React, { useState } from 'react';
import { AdminSection } from './AdminUI.jsx';

export default function ActionsSection({ pendingCompanies, exportStatus, handleApproveAll, handleExportCSV, handleMoveAllToSpace, setActiveTab, fetchData, selectedTenantId, V }) {
  const [moveStatus, setMoveStatus] = useState('');
  const [moving, setMoving] = useState(false);

  const onMoveAllToSpace = async () => {
    if (!handleMoveAllToSpace) return;
    if (!window.confirm('Reclassify all non-space companies in this tenant to the space vertical? This updates many rows.')) return;
    setMoving(true);
    setMoveStatus('');
    const updated = await handleMoveAllToSpace();
    setMoving(false);
    if (updated === null) {
      setMoveStatus('Failed — see console');
    } else {
      setMoveStatus(`Reclassified ${updated} ${updated === 1 ? 'company' : 'companies'}`);
      setTimeout(() => setMoveStatus(''), 5000);
    }
  };

  return (
    <AdminSection title="Quick Actions" V={V}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {pendingCompanies.length > 0 ? (
          <div style={{ background: V.card, border: `1px solid rgba(234,179,8,0.25)`, borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
              Approve Pending ({pendingCompanies.length})
            </div>
            <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
              Approve all companies waiting for review.
            </div>
            <button onClick={handleApproveAll} style={{
              width: '100%', background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.4)', color: '#86EFAC',
              borderRadius: 7, padding: '9px 0', fontSize: 13,
              fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
            }}>
              Approve All
            </button>
          </div>
        ) : (
          <div style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: '18px 20px', opacity: 0.7 }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
              No pending companies
            </div>
            <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
              All submitted companies have already been reviewed.
            </div>
            <button disabled style={{
              width: '100%', background: 'rgba(148,163,184,0.12)',
              border: '1px solid rgba(148,163,184,0.22)', color: 'rgba(226,232,240,0.65)',
              borderRadius: 7, padding: '9px 0', fontSize: 13,
              fontWeight: 700, fontFamily: V.space, cursor: 'not-allowed',
            }}>
              Nothing to approve
            </button>
          </div>
        )}

        <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
            Export Companies CSV
          </div>
          <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
            Download all company data + certifications as CSV.
          </div>
          <button onClick={handleExportCSV} style={{
            width: '100%', background: V.accent,
            border: 'none', color: '#fff',
            borderRadius: 7, padding: '9px 0', fontSize: 13,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            {exportStatus || 'Export CSV'}
          </button>
        </div>

        {selectedTenantId && (
          <div style={{ background: V.card, border: `1px solid rgba(232,162,58,0.3)`, borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
              Move All to Space Vertical
            </div>
            <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
              Reclassify every non-space company in this tenant to the <span style={{ color: V.accent, fontFamily: V.mono }}>space</span> vertical. Useful to roll the full directory into Space Rising.
            </div>
            <button onClick={onMoveAllToSpace} disabled={moving} style={{
              width: '100%', background: V.accentDim,
              border: `1px solid ${V.accentBrd}`, color: V.accent,
              borderRadius: 7, padding: '9px 0', fontSize: 13,
              fontWeight: 700, fontFamily: V.space,
              cursor: moving ? 'wait' : 'pointer',
              opacity: moving ? 0.6 : 1,
            }}>
              {moving ? 'Reclassifying…' : (moveStatus || 'Move All to Space')}
            </button>
          </div>
        )}

        {selectedTenantId && (
          <div style={{ background: V.card, border: `1px solid rgba(59,130,246,0.25)`, borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
              Import Companies CSV
            </div>
            <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
              Bulk-import companies from a CSV file with preview.
            </div>
            <button onClick={() => setActiveTab('companies')} style={{
              width: '100%', background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.35)', color: '#93C5FD',
              borderRadius: 7, padding: '9px 0', fontSize: 13,
              fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
            }}>
              Go to Companies
            </button>
          </div>
        )}

        <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
            Add Organization
          </div>
          <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
            Create a new industry vertical organization
          </div>
          <button onClick={() => setActiveTab('orgs')} style={{
            width: '100%', background: 'rgba(59,130,246,0.12)',
            border: '1px solid rgba(59,130,246,0.35)', color: '#93C5FD',
            borderRadius: 7, padding: '9px 0', fontSize: 13,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Go to Organizations
          </button>
        </div>

        <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
            Refresh Data
          </div>
          <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
            Reload all data from Supabase.
          </div>
          <button onClick={fetchData} style={{
            width: '100%', background: 'transparent',
            border: `1px solid ${V.border}`, color: V.text,
            borderRadius: 7, padding: '9px 0', fontSize: 13,
            fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
          }}>
            Refresh
          </button>
        </div>
      </div>
    </AdminSection>
  );
}
