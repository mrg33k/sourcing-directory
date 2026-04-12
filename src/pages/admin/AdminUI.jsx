import React from 'react';

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, color, sub, V }) {
  return (
    <div style={{
      background: V.card, border: `1px solid ${V.border}`,
      borderRadius: 10, padding: '18px 20px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: V.syne, color: color || V.heading, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: V.dim, fontFamily: V.space, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
export function AdminSection({ title, children, action, V }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${V.border}`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: V.syne, color: V.heading }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────
export function StatusPill({ status }) {
  const colors = {
    active:  { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.4)',   text: '#86EFAC' },
    pending: { bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.4)',   text: '#FDE68A' },
    expired: { bg: 'rgba(138,132,124,0.1)', border: 'rgba(138,132,124,0.4)', text: '#8A847C' },
    inactive:{ bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.4)',   text: '#FCA5A5' },
    sold:    { bg: 'rgba(138,132,124,0.1)', border: 'rgba(138,132,124,0.4)', text: '#8A847C' },
  };
  const c = colors[status] || colors.inactive;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
      padding: '2px 7px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {status}
    </span>
  );
}

// ─── Company Row ──────────────────────────────────────────────────────────────
export function CompanyRow({ company, onAction, refreshing, V }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 80px 80px 120px',
      gap: 12, padding: '12px 16px', alignItems: 'center',
      borderBottom: `1px solid ${V.border}`,
      opacity: refreshing ? 0.5 : 1,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: V.space, color: V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {company.name}
        </div>
        <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
          {company.vertical} · {[company.city, company.state].filter(Boolean).join(', ')}
        </div>
      </div>
      <div><StatusPill status={company.status} /></div>
      <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>{company.membership_tier}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {company.status === 'pending' && (
          <button onClick={() => onAction(company.id, 'approve')} style={{
            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
            color: '#86EFAC', borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Approve
          </button>
        )}
        {company.status === 'active' && (
          <button onClick={() => onAction(company.id, 'deactivate')} style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#FCA5A5', borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Deactivate
          </button>
        )}
        {!company.featured && company.status === 'active' && (
          <button onClick={() => onAction(company.id, 'feature')} style={{
            background: V.accentDim, border: `1px solid ${V.accentBrd}`,
            color: V.accent, borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Feature
          </button>
        )}
        {company.featured && (
          <button onClick={() => onAction(company.id, 'unfeature')} style={{
            background: 'rgba(255,255,255,0.06)', border: `1px solid ${V.border}`,
            color: V.muted, borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
          }}>
            Unfeature
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Listing Row ──────────────────────────────────────────────────────────────
export function ListingRow({ listing, company, onToggle, V }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 80px 70px 80px',
      gap: 12, padding: '10px 16px', alignItems: 'center',
      borderBottom: `1px solid ${V.border}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: V.space, color: V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {listing.title}
        </div>
        <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>{company?.name || 'Unknown'} · {listing.category}</div>
      </div>
      <div><StatusPill status={listing.status} /></div>
      <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
        {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
      <div>
        {listing.status === 'active' ? (
          <button onClick={() => onToggle(listing.id, 'deactivate')} style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#FCA5A5', borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Remove
          </button>
        ) : (
          <button onClick={() => onToggle(listing.id, 'activate')} style={{
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            color: '#86EFAC', borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Restore
          </button>
        )}
      </div>
    </div>
  );
}
