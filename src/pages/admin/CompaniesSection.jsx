import React from 'react';
import { AdminSection, CompanyRow } from './AdminUI.jsx';

const PAGE_SIZE = 25;

const SORTS = {
  'name':     { label: 'Name A–Z',   fn: (a, b) => (a.name || '').localeCompare(b.name || '') },
  'name_desc':{ label: 'Name Z–A',   fn: (a, b) => (b.name || '').localeCompare(a.name || '') },
  'newest':   { label: 'Newest',     fn: (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0) },
  'oldest':   { label: 'Oldest',     fn: (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0) },
  'vertical': { label: 'Vertical',   fn: (a, b) => (a.vertical || '').localeCompare(b.vertical || '') },
  'status':   { label: 'Status',     fn: (a, b) => (a.status || '').localeCompare(b.status || '') },
};

export default function CompaniesSection({
  companies, pendingCompanies, importPreview, setImportPreview,
  importStatus, setImportStatus, importFileRef, refreshing,
  handleImportFile, handleImportConfirm, handleCompanyAction,
  handleApproveAll, V, selectedTenantId,
}) {
  const [query, setQuery] = React.useState('');
  const [sortKey, setSortKey] = React.useState('name');
  const [page, setPage] = React.useState(0);

  const activeCompanies = React.useMemo(
    () => companies.filter(c => c.status !== 'pending'),
    [companies]
  );

  // search + sort the (non-pending) main list
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = activeCompanies;
    if (q) {
      rows = rows.filter(c =>
        [c.name, c.vertical, c.city, c.state, c.status, c.membership_tier]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      );
    }
    return [...rows].sort((SORTS[sortKey] || SORTS.name).fn);
  }, [activeCompanies, query, sortKey]);

  // reset to first page whenever the filter/sort changes
  React.useEffect(() => { setPage(0); }, [query, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const inputStyle = {
    background: V.card2, border: `1px solid ${V.border}`, color: V.text,
    borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: V.space,
    outline: 'none',
  };

  return (
    <AdminSection
      title={
        <div>
          <div>Companies</div>
          <div style={{ fontSize: '0.75rem', color: V.dim, fontWeight: 400, marginTop: 2, fontFamily: V.mono }}>
            {activeCompanies.length} active{pendingCompanies.length > 0 ? ` · ${pendingCompanies.length} pending` : ''}
          </div>
        </div>
      }
      V={V}
      action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedTenantId && (
            <label style={{
              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)',
              color: '#93C5FD', borderRadius: 6, padding: '6px 14px',
              fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
              Import CSV
              <input
                ref={importFileRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleImportFile}
                onClick={e => { e.target.value = ''; setImportPreview(null); setImportStatus(''); }}
              />
            </label>
          )}
          {pendingCompanies.length > 0 && (
            <button onClick={handleApproveAll} style={{
              background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
              color: '#86EFAC', borderRadius: 6, padding: '6px 14px',
              fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
              Approve All Pending ({pendingCompanies.length})
            </button>
          )}
        </div>
      }
    >
      {/* CSV Import Preview */}
      {importPreview && (
        <div style={{ background: V.card, border: `1px solid rgba(59,130,246,0.35)`, borderRadius: 10, padding: '20px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 4 }}>
            Import Preview — {importPreview.rows.length} rows detected
          </div>
          <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
            Columns: {importPreview.headers.join(', ')}
          </div>
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: V.space }}>
              <thead>
                <tr style={{ background: V.card2 }}>
                  {['name', 'description', 'website', 'city', 'vertical', 'membership_tier', 'certifications'].map(col => (
                    <th key={col} style={{ padding: '6px 10px', textAlign: 'left', color: V.dim, fontFamily: V.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${V.border}` }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importPreview.rows.slice(0, 5).map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${V.border}`, opacity: !row.name ? 0.4 : 1 }}>
                    {['name', 'description', 'website', 'city', 'vertical', 'membership_tier', 'certifications'].map(col => (
                      <td key={col} style={{ padding: '7px 10px', color: V.text, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row[col] || <span style={{ color: V.dim }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {importPreview.rows.length > 5 && (
              <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, padding: '6px 10px' }}>
                + {importPreview.rows.length - 5} more rows not shown
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={handleImportConfirm} style={{
              background: V.accent, border: 'none', color: '#fff',
              borderRadius: 7, padding: '8px 20px', fontSize: 13,
              fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
            }}>
              Import {importPreview.rows.length} Companies
            </button>
            <button onClick={() => { setImportPreview(null); setImportStatus(''); }} style={{
              background: 'transparent', border: `1px solid ${V.border}`,
              color: V.muted, borderRadius: 7, padding: '8px 16px',
              fontSize: 13, fontFamily: V.space, cursor: 'pointer',
            }}>
              Cancel
            </button>
            {importStatus && (
              <span style={{ fontSize: 12, color: importStatus.startsWith('Error') || importStatus.startsWith('Could') ? '#EF4444' : V.accent, fontFamily: V.space }}>
                {importStatus}
              </span>
            )}
          </div>
        </div>
      )}
      {!importPreview && importStatus && (
        <div style={{ fontSize: 13, color: V.accent, fontFamily: V.space, marginBottom: 14 }}>
          {importStatus}
        </div>
      )}

      {pendingCompanies.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#FDBA74', fontFamily: V.mono, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Pending Approval
          </div>
          <div style={{ background: V.card, border: `1px solid rgba(234,179,8,0.2)`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 110px 1fr', gap: 12, padding: '8px 16px', background: V.card2 }}>
              {['Company', 'Status', 'Tier', 'Source', 'Actions'].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
            {pendingCompanies.map(c => (
              <CompanyRow key={c.id} company={c} onAction={handleCompanyAction} refreshing={refreshing[c.id]} V={V} />
            ))}
          </div>
        </div>
      )}

      {/* Search + sort controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name, vertical, city, status…"
          style={{ ...inputStyle, flex: '1 1 280px', minWidth: 200 }}
        />
        <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {Object.entries(SORTS).map(([k, s]) => (
            <option key={k} value={k}>{s.label}</option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, whiteSpace: 'nowrap' }}>
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </span>
      </div>

      <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 110px 1fr', gap: 12, padding: '8px 16px', background: V.card2 }}>
          {['Company', 'Status', 'Tier', 'Source', 'Actions'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>
        {pageRows.map(c => (
          <CompanyRow key={c.id} company={c} onAction={handleCompanyAction} refreshing={refreshing[c.id]} V={V} />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '24px 16px', color: V.dim, fontSize: 13, fontFamily: V.space }}>
            {query ? `No companies match "${query}".` : 'No companies yet.'}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            style={{
              background: 'transparent', border: `1px solid ${V.border}`,
              color: safePage === 0 ? V.dim : V.text, borderRadius: 6, padding: '6px 14px',
              fontSize: 12, fontWeight: 600, fontFamily: V.space,
              cursor: safePage === 0 ? 'default' : 'pointer', opacity: safePage === 0 ? 0.5 : 1,
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: V.muted, fontFamily: V.mono }}>
            Page {safePage + 1} of {pageCount}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            style={{
              background: 'transparent', border: `1px solid ${V.border}`,
              color: safePage >= pageCount - 1 ? V.dim : V.text, borderRadius: 6, padding: '6px 14px',
              fontSize: 12, fontWeight: 600, fontFamily: V.space,
              cursor: safePage >= pageCount - 1 ? 'default' : 'pointer', opacity: safePage >= pageCount - 1 ? 0.5 : 1,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </AdminSection>
  );
}
