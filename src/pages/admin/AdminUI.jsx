import React from 'react';
import { supabase } from '../../lib/supabase.js';

// ─── Admin asset uploads ──────────────────────────────────────────────────────
//
// The browser no longer holds the service_role key, and `storage.objects` is RLS
// default-deny, so `adminSupabase.storage.from(...).upload(...)` cannot work from here
// any more and must not be called. Every admin upload goes through
// POST /api/sourcing/upload-admin-asset, which verifies the caller's JWT server-side,
// resolves their tenant reach, picks the object path itself, and hands back a signed
// upload URL good for that one path. The signed URL carries its own authorization, so
// the actual PUT needs no storage permission from the browser.
//
// These helpers live in AdminUI.jsx because it is the module the three uploading
// sections (AdminUI's own company editor, SettingsSection, ReportsSection) already
// share. Nothing about them is presentational; if a shared src/lib home opens up,
// they belong there.

const ASSET_ENDPOINT = '/api/sourcing/upload-admin-asset';

const EXT_CONTENT_TYPE = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Some browsers hand back a blank File.type; fall back to the extension. */
function contentTypeOf(file) {
  const declared = (file?.type || '').split(';')[0].trim().toLowerCase();
  if (declared) return declared;
  const ext = (file?.name || '').split('.').pop()?.toLowerCase();
  return EXT_CONTENT_TYPE[ext] || '';
}

/** POST to the admin asset endpoint. Throws with the server's message on failure. */
export async function adminAssetRequest(payload) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('You are signed out. Sign in again to continue.');

  const res = await fetch(ASSET_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Upload service failed (HTTP ${res.status})`);
  return json;
}

/**
 * Upload one admin asset and return its public URL.
 *
 * @param {File}   file        the chosen file
 * @param {object} descriptor  what it is — { kind:'company-logo', company_id }
 *                             | { kind:'tenant-logo', tenant_id }
 *                             | { kind:'report-file', report_id? }
 * The caller never names a storage path or bucket; the server derives both.
 */
export async function uploadAdminAsset(file, descriptor) {
  const contentType = contentTypeOf(file);
  if (!contentType) throw new Error('Could not determine the file type. Rename the file with a proper extension.');

  const signed = await adminAssetRequest({
    action: 'sign-upload',
    content_type: contentType,
    filename: file.name || '',
    ...descriptor,
  });

  const { error } = await supabase.storage
    .from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, { contentType });
  if (error) throw new Error(error.message || 'Upload failed.');

  return signed.publicUrl;
}

/** Delete the stored PDF a report points at. Throws if the file could not be removed. */
export async function removeReportFile(reportId) {
  return adminAssetRequest({ action: 'remove-report-file', report_id: reportId });
}

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
    active:  { bg: 'rgba(22,163,74,0.10)',  border: 'rgba(22,163,74,0.30)',  text: '#15803D' },
    pending: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#B45309' },
    expired: { bg: '#F3F4F6',               border: '#D7DEE2',               text: '#6B7280' },
    inactive:{ bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.30)',  text: '#DC2626' },
    sold:    { bg: '#F3F4F6',               border: '#D7DEE2',               text: '#6B7280' },
  };
  const c = colors[status] || colors.inactive;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: 11, fontWeight: 700, fontFamily: 'var(--v3-font-family-base)',
      padding: '2px 7px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {status}
    </span>
  );
}

// ─── Company Edit Form (inline) ────────────────────────────────────────────────
function CompanyEditForm({ company, onSave, onCancel, V, adminSupabase }) {
  const [fields, setFields] = React.useState({
    name: company.name || '',
    description: company.description || '',
    website: company.website || '',
    phone: company.phone || '',
    email: company.email || '',
    city: company.city || '',
    state: company.state || '',
    vertical: company.vertical || '',
    // membership_tier is deliberately absent. It is billing state, written by the
    // Stripe checkout flow, and PROTECTED_COLUMNS in api/sourcing/lib/tablePolicy.js
    // strips it from every admin write. Keeping it in this form meant an admin picked
    // a tier, saw "Saved", and nothing changed. It is shown read-only below instead.
    employee_count: company.employee_count || '',
    year_founded: company.year_founded || '',
    logo_url: company.logo_url || '',
  });
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadErr, setUploadErr] = React.useState('');

  const update = (k) => (e) => setFields(prev => ({ ...prev, [k]: e.target.value }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadErr('');
    setUploading(true);
    try {
      const publicUrl = await uploadAdminAsset(file, { kind: 'company-logo', company_id: company.id });
      setFields(prev => ({ ...prev, logo_url: publicUrl }));
    } catch (err) {
      setUploadErr(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      // Let the same file be re-selected after a failure.
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Cast year_founded to int if present, else null
      const out = { ...fields };
      out.year_founded = out.year_founded ? parseInt(out.year_founded, 10) || null : null;
      // Empty strings -> null for optional fields
      ['description', 'website', 'phone', 'email', 'city', 'state', 'employee_count', 'logo_url'].forEach(k => {
        if (out[k] === '') out[k] = null;
      });
      await onSave(company.id, out);
    } finally {
      setSaving(false);
    }
  };

  // ── certifications ──
  const [certs, setCerts] = React.useState([]);
  const [certName, setCertName] = React.useState('');
  const [certValue, setCertValue] = React.useState('true');
  const [certBusy, setCertBusy] = React.useState(false);
  const loadCerts = React.useCallback(async () => {
    if (!adminSupabase) return;
    const { data } = await adminSupabase.from('directory_certifications').select('*').eq('company_id', company.id).order('cert_name');
    setCerts(data || []);
  }, [company.id]);
  React.useEffect(() => { loadCerts(); }, [loadCerts]);
  const addCert = async () => {
    if (!certName.trim() || !adminSupabase) return;
    setCertBusy(true);
    try {
      await adminSupabase.from('directory_certifications').insert({
        company_id: company.id, cert_name: certName.trim(),
        cert_value: (certValue.trim() || 'true'),
        vertical: company.vertical || 'space', tenant_id: company.tenant_id,
      });
      setCertName(''); setCertValue('true');
      await loadCerts();
    } finally { setCertBusy(false); }
  };
  const removeCert = async (id) => {
    if (!adminSupabase) return;
    setCertBusy(true);
    try { await adminSupabase.from('directory_certifications').delete().eq('id', id); await loadCerts(); }
    finally { setCertBusy(false); }
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
          <div style={{ ...inputStyle, background: V.card, color: V.muted, display: 'flex', alignItems: 'center', minHeight: 29 }}>
            {company.membership_tier || 'free'}
          </div>
          <div style={{ fontSize: 10, color: V.dim, fontFamily: V.space, marginTop: 4, lineHeight: 1.4 }}>
            Billing state. Set by checkout, not editable here.
          </div>
        </div>
        <div><label style={labelStyle}>Employee Count</label><input style={inputStyle} value={fields.employee_count} onChange={update('employee_count')} placeholder="e.g. 50-100" /></div>
        <div><label style={labelStyle}>Year Founded</label><input style={inputStyle} value={fields.year_founded} onChange={update('year_founded')} placeholder="2020" /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Logo</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {fields.logo_url
            ? <img src={fields.logo_url} alt="logo" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6, border: `1px solid ${V.border}`, background: '#fff' }} />
            : <div style={{ width: 44, height: 44, borderRadius: 6, border: `1px dashed ${V.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: V.dim, fontSize: 10, fontFamily: V.mono }}>none</div>}
          <label style={{
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)',
            color: '#93C5FD', borderRadius: 5, padding: '6px 12px', fontSize: 12, fontWeight: 700,
            fontFamily: V.space, cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1, whiteSpace: 'nowrap',
          }}>
            {uploading ? 'Uploading…' : (fields.logo_url ? 'Replace logo' : 'Upload logo')}
            {/* Matches the server's allowlist exactly — SVG is excluded on purpose. */}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={handleLogoUpload} disabled={uploading} />
          </label>
          <input style={{ ...inputStyle, flex: '1 1 200px' }} value={fields.logo_url} onChange={update('logo_url')} placeholder="…or paste an image URL" />
          {fields.logo_url && (
            <button type="button" onClick={() => setFields(prev => ({ ...prev, logo_url: '' }))} style={{
              background: 'transparent', border: `1px solid ${V.border}`, color: V.muted,
              borderRadius: 5, padding: '6px 10px', fontSize: 11, fontFamily: V.space, cursor: 'pointer',
            }}>Clear</button>
          )}
        </div>
        {uploadErr && <div style={{ color: '#FCA5A5', fontSize: 11, fontFamily: V.space, marginTop: 6 }}>{uploadErr}</div>}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Description</label>
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: V.space }}
          value={fields.description}
          onChange={update('description')}
        />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Certifications</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: certs.length ? 8 : 0 }}>
          {certs.map(c => (
            <span key={c.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: V.card2, border: `1px solid ${V.border}`, borderRadius: 5,
              padding: '4px 8px', fontSize: 11, fontFamily: V.mono, color: V.text,
            }}>
              {c.cert_name}{c.cert_value && c.cert_value !== 'true' ? `: ${c.cert_value}` : ''}
              <button type="button" onClick={() => removeCert(c.id)} disabled={certBusy} title="Remove" style={{
                background: 'transparent', border: 'none', color: '#FCA5A5',
                cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0,
              }}>×</button>
            </span>
          ))}
          {certs.length === 0 && <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>none yet</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, flex: '1 1 180px' }} value={certName} onChange={e => setCertName(e.target.value)} placeholder="Cert name (e.g. AS9100D, ITAR)" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCert(); } }} />
          <input style={{ ...inputStyle, flex: '0 1 130px' }} value={certValue} onChange={e => setCertValue(e.target.value)} placeholder="value (or 'true')" />
          <button type="button" onClick={addCert} disabled={certBusy || !certName.trim()} style={{
            background: V.accentDim, border: `1px solid ${V.accentBrd}`, color: V.accent,
            borderRadius: 5, padding: '6px 14px', fontSize: 12, fontWeight: 700,
            fontFamily: V.space, cursor: certBusy ? 'wait' : 'pointer', opacity: (certBusy || !certName.trim()) ? 0.6 : 1,
          }}>Add cert</button>
        </div>
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
export function CompanyRow({ company, onAction, refreshing, V, selectable = false, selected = false, onToggleSelect, adminSupabase }) {
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
        adminSupabase={adminSupabase}
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
            background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.30)',
            color: '#15803D', borderRadius: 5, padding: '4px 8px', fontSize: 12,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Approve
          </button>
        )}
        {company.status === 'pending' && (
          <button onClick={() => onAction(company.id, 'reject')} style={{
            background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.30)',
            color: '#DC2626', borderRadius: 5, padding: '4px 8px', fontSize: 12,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Reject
          </button>
        )}
        {company.status === 'active' && (
          <button onClick={() => onAction(company.id, 'deactivate')} style={{
            background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.30)',
            color: '#DC2626', borderRadius: 5, padding: '4px 8px', fontSize: 12,
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
          background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.30)',
          color: '#DC2626', borderRadius: 5, padding: '4px 8px', fontSize: 12,
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
      borderRadius: 5, padding: '4px 8px', fontSize: 12,
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
          ? btn('Remove', () => onToggle(listing.id, 'deactivate'), 'rgba(220,38,38,0.08)', 'rgba(220,38,38,0.30)', '#DC2626')
          : btn('Restore', () => onToggle(listing.id, 'activate'), 'rgba(22,163,74,0.10)', 'rgba(22,163,74,0.30)', '#15803D')}
        {onEdit && btn('Edit', () => onEdit(listing), 'rgba(255,255,255,0.06)', V.border, V.text)}
        {onDelete && btn('Delete', () => onDelete(listing), 'rgba(220,38,38,0.08)', 'rgba(220,38,38,0.30)', '#DC2626')}
      </div>
    </div>
  );
}
