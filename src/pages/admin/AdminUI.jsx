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

// ─── Company Edit Form (inline) ────────────────────────────────────────────────
function CompanyEditForm({ company, onSave, onCancel, V }) {
  const [fields, setFields] = React.useState({
    name: company.name || '',
    description: company.description || '',
    website: company.website || '',
    phone: company.phone || '',
    email: company.email || '',
    city: company.city || '',
    state: company.state || '',
    vertical: company.vertical || '',
    membership_tier: company.membership_tier || 'free',
    employee_count: company.employee_count || '',
    year_founded: company.year_founded || '',
  });
  const [saving, setSaving] = React.useState(false);

  const update = (k) => (e) => setFields(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Cast year_founded to int if present, else null
      const out = { ...fields };
      out.year_founded = out.year_founded ? parseInt(out.year_founded, 10) || null : null;
      // Empty strings -> null for optional fields
      ['description', 'website', 'phone', 'email', 'city', 'state', 'employee_count'].forEach(k => {
        if (out[k] === '') out[k] = null;
      });
      await onSave(company.id, out);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', background: V.card2, border: `1px solid ${V.border}`,
    color: V.text, borderRadius: 5, padding: '6px 8px',
    fontSize: 12, fontFamily: V.space, outline: 'none',
  };
  const labelStyle = {
    fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim,
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block',
  };

  return (
    <div style={{
      padding: '16px 20px', background: V.card2,
      borderBottom: `1px solid ${V.border}`,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div><label style={labelStyle}>Name</label><input style={inputStyle} value={fields.name} onChange={update('name')} /></div>
        <div><label style={labelStyle}>Website</label><input style={inputStyle} value={fields.website} onChange={update('website')} placeholder="https://..." /></div>
        <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={fields.phone} onChange={update('phone')} /></div>
        <div><label style={labelStyle}>Email</label><input style={inputStyle} value={fields.email} onChange={update('email')} /></div>
        <div><label style={labelStyle}>City</label><input style={inputStyle} value={fields.city} onChange={update('city')} /></div>
        <div><label style={labelStyle}>State</label><input style={inputStyle} value={fields.state} onChange={update('state')} /></div>
        <div><label style={labelStyle}>Vertical</label><input style={inputStyle} value={fields.vertical} onChange={update('vertical')} /></div>
        <div>
          <label style={labelStyle}>Membership Tier</label>
          <select style={inputStyle} value={fields.membership_tier} onChange={update('membership_tier')}>
            <option value="free">free</option>
            <option value="basic">basic</option>
            <option value="standard">standard</option>
            <option value="premium">premium</option>
            <option value="founding">founding</option>
          </select>
        </div>
        <div><label style={labelStyle}>Employee Count</label><input style={inputStyle} value={fields.employee_count} onChange={update('employee_count')} placeholder="e.g. 50-100" /></div>
        <div><label style={labelStyle}>Year Founded</label><input style={inputStyle} value={fields.year_founded} onChange={update('year_founded')} placeholder="2020" /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Description</label>
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: V.space }}
          value={fields.description}
          onChange={update('description')}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSave} disabled={saving} style={{
          background: V.accent, border: 'none', color: '#fff',
          borderRadius: 5, padding: '6px 14px', fontSize: 12,
          fontWeight: 700, fontFamily: V.space, cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} disabled={saving} style={{
          background: 'transparent', border: `1px solid ${V.border}`,
          color: V.muted, borderRadius: 5, padding: '6px 14px',
          fontSize: 12, fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Company Row ──────────────────────────────────────────────────────────────
export function CompanyRow({ company, onAction, refreshing, V, selectable = false, selected = false, onToggleSelect }) {
  const companySource = company.source && String(company.source).trim() ? company.source : 'manual';
  const [editing, setEditing] = React.useState(false);
  const gridCols = selectable ? '32px 1fr 80px 80px 110px 1fr' : '1fr 80px 80px 110px 1fr';

  const handleDelete = () => {
    if (window.confirm(`Delete "${company.name}"? This cannot be undone.`)) {
      onAction(company.id, 'delete');
    }
  };

  const handleSaveEdit = async (id, fields) => {
    await onAction(id, 'update', fields);
    setEditing(false);
  };

  if (editing) {
    return (
      <CompanyEditForm
        company={company}
        onSave={handleSaveEdit}
        onCancel={() => setEditing(false)}
        V={V}
      />
    );
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: gridCols,
      gap: 12, padding: '12px 16px', alignItems: 'center',
      borderBottom: `1px solid ${V.border}`,
      opacity: refreshing ? 0.5 : 1,
      background: selected ? V.accentDim : 'transparent',
    }}>
      {selectable && (
        <div>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect && onToggleSelect(company.id)}
            style={{ width: 15, height: 15, accentColor: V.accent, cursor: 'pointer' }}
          />
        </div>
      )}
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
      <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, textTransform: 'lowercase' }}>{companySource}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {company.status === 'pending' && (
          <button onClick={() => onAction(company.id, 'approve')} style={{
            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
            color: '#86EFAC', borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Approve
          </button>
        )}
        {company.status === 'pending' && (
          <button onClick={() => onAction(company.id, 'reject')} style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#FCA5A5', borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Reject
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
        <button onClick={() => setEditing(true)} style={{
          background: 'rgba(255,255,255,0.06)', border: `1px solid ${V.border}`,
          color: V.text, borderRadius: 5, padding: '4px 8px', fontSize: 11,
          fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
        }}>
          Edit
        </button>
        <button onClick={handleDelete} style={{
          background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.5)',
          color: '#FCA5A5', borderRadius: 5, padding: '4px 8px', fontSize: 11,
          fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
        }}>
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Listing Row ──────────────────────────────────────────────────────────────
export function ListingRow({ listing, company, onToggle, onEdit, onDelete, V }) {
  const btn = (label, onClick, bg, bd, fg) => (
    <button onClick={onClick} style={{
      background: bg, border: `1px solid ${bd}`, color: fg,
      borderRadius: 5, padding: '4px 8px', fontSize: 11,
      fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
    }}>{label}</button>
  );
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 80px 70px 190px',
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
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {listing.status === 'active'
          ? btn('Remove', () => onToggle(listing.id, 'deactivate'), 'rgba(239,68,68,0.1)', 'rgba(239,68,68,0.3)', '#FCA5A5')
          : btn('Restore', () => onToggle(listing.id, 'activate'), 'rgba(34,197,94,0.1)', 'rgba(34,197,94,0.3)', '#86EFAC')}
        {onEdit && btn('Edit', () => onEdit(listing), 'rgba(255,255,255,0.06)', V.border, V.text)}
        {onDelete && btn('Delete', () => onDelete(listing), 'rgba(239,68,68,0.18)', 'rgba(239,68,68,0.5)', '#FCA5A5')}
      </div>
    </div>
  );
}
