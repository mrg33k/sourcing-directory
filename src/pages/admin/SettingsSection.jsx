import React from 'react';
import { AdminSection } from './AdminUI.jsx';

const FEATURE_KEYS = ['jobs', 'marketplace', 'events', 'articles', 'signup'];

function Toggle({ on, onClick, V }) {
  return (
    <button type="button" onClick={onClick} style={{
      width: 42, height: 23, borderRadius: 12, border: 'none',
      background: on ? V.accent : V.border, cursor: 'pointer', position: 'relative', flexShrink: 0,
    }}>
      <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 22 : 3, transition: 'left 0.15s' }} />
    </button>
  );
}

export default function SettingsSection({ tenant, adminSupabase, setTenants, V }) {
  if (!tenant) {
    return (
      <AdminSection title="Settings" V={V}>
        <div style={{ padding: '24px 16px', color: V.dim, fontSize: 13, fontFamily: V.space }}>
          Select a directory (top-left switcher) to edit its settings.
        </div>
      </AdminSection>
    );
  }

  const initFeatures = () => {
    const base = { jobs: true, marketplace: true, events: true, articles: true, signup: true };
    return { ...base, ...(tenant.features || {}) };
  };
  const [f, setF] = React.useState({
    name: tenant.name || '', nav_label: tenant.nav_label || '', website: tenant.website || '',
    vertical: tenant.vertical || '', brand_color: tenant.brand_color || '#E8A23A',
    logo_url: tenant.logo_url || '', hero_text: tenant.hero_text || '', description: tenant.description || '',
    features: initFeatures(),
  });
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  // resync when the selected tenant changes
  React.useEffect(() => {
    setF({
      name: tenant.name || '', nav_label: tenant.nav_label || '', website: tenant.website || '',
      vertical: tenant.vertical || '', brand_color: tenant.brand_color || '#E8A23A',
      logo_url: tenant.logo_url || '', hero_text: tenant.hero_text || '', description: tenant.description || '',
      features: initFeatures(),
    });
    setMsg('');
  }, [tenant.id]);

  const up = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }));
  const toggleFeat = (k) => setF(prev => ({ ...prev, features: { ...prev.features, [k]: !prev.features[k] } }));

  const uploadLogo = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !adminSupabase) return;
    setUploading(true); setMsg('');
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const key = `directory-logos/${tenant.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await adminSupabase.storage.from('sourcing-reports').upload(key, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = adminSupabase.storage.from('sourcing-reports').getPublicUrl(key);
      setF(prev => ({ ...prev, logo_url: data.publicUrl }));
    } catch (err) { setMsg('Logo upload failed: ' + err.message); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!adminSupabase) return;
    setSaving(true); setMsg('');
    try {
      const row = {
        name: f.name.trim() || tenant.name, nav_label: f.nav_label || null, website: f.website || null,
        vertical: f.vertical || tenant.vertical, brand_color: f.brand_color || null,
        logo_url: f.logo_url || null, hero_text: f.hero_text || null, description: f.description || null,
        features: f.features,
      };
      const { error } = await adminSupabase.from('directory_tenants').update(row).eq('id', tenant.id);
      if (error) throw error;
      if (setTenants) setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, ...row } : t));
      setMsg('Saved.');
      setTimeout(() => setMsg(''), 2500);
    } catch (err) { setMsg('Save failed: ' + err.message); }
    finally { setSaving(false); }
  };

  const inp = { width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: V.space, outline: 'none' };
  const lab = { fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' };
  const Field = ({ label, children }) => <div><label style={lab}>{label}</label>{children}</div>;

  return (
    <AdminSection title={`Settings — ${tenant.name}`} V={V}>
      <div style={{ maxWidth: 720, background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
          <Field label="Directory Name"><input style={inp} value={f.name} onChange={up('name')} /></Field>
          <Field label="Nav Label"><input style={inp} value={f.nav_label} onChange={up('nav_label')} placeholder="short header label" /></Field>
          <Field label="Website"><input style={inp} value={f.website} onChange={up('website')} placeholder="https://…" /></Field>
          <Field label="Vertical"><input style={inp} value={f.vertical} onChange={up('vertical')} /></Field>
          <Field label="Brand Color">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(f.brand_color) ? f.brand_color : '#E8A23A'} onChange={up('brand_color')} style={{ width: 38, height: 34, border: `1px solid ${V.border}`, borderRadius: 6, background: V.card2, cursor: 'pointer', padding: 2 }} />
              <input style={{ ...inp, flex: 1 }} value={f.brand_color} onChange={up('brand_color')} placeholder="#E8A23A" />
            </div>
          </Field>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lab}>Logo</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {f.logo_url
              ? <img src={f.logo_url} alt="logo" style={{ width: 46, height: 46, objectFit: 'contain', borderRadius: 6, border: `1px solid ${V.border}`, background: '#fff' }} />
              : <div style={{ width: 46, height: 46, borderRadius: 6, border: `1px dashed ${V.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: V.dim, fontSize: 10, fontFamily: V.mono }}>none</div>}
            <label style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)', color: '#93C5FD', borderRadius: 6, padding: '7px 13px', fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1, whiteSpace: 'nowrap' }}>
              {uploading ? 'Uploading…' : (f.logo_url ? 'Replace' : 'Upload')}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadLogo} disabled={uploading} />
            </label>
            <input style={{ ...inp, flex: '1 1 200px' }} value={f.logo_url} onChange={up('logo_url')} placeholder="…or paste an image URL" />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lab}>Hero Text</label>
          <textarea style={{ ...inp, minHeight: 54, resize: 'vertical' }} value={f.hero_text} onChange={up('hero_text')} placeholder="Tagline shown on the directory hero" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={lab}>Description</label>
          <textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={f.description} onChange={up('description')} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lab}>Features</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {FEATURE_KEYS.map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: V.card2, border: `1px solid ${V.border}`, borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, fontFamily: V.space, color: V.text, textTransform: 'capitalize' }}>{k}</span>
                <Toggle on={!!f.features[k]} onClick={() => toggleFeat(k)} V={V} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={save} disabled={saving} style={{ background: V.accent, border: 'none', color: '#fff', borderRadius: 7, padding: '8px 22px', fontSize: 13, fontWeight: 700, fontFamily: V.space, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {msg && <span style={{ fontSize: 12, fontFamily: V.space, color: msg.startsWith('Save failed') || msg.startsWith('Logo') ? '#FCA5A5' : V.green }}>{msg}</span>}
        </div>
      </div>
    </AdminSection>
  );
}
