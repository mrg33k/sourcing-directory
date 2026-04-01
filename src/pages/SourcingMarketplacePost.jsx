import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingNav } from './SourcingMarketplace.jsx';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

const VERTICALS = [
  { key: 'semiconductor', label: 'Semiconductor' },
  { key: 'space',         label: 'Space & Aerospace' },
  { key: 'biotech',       label: 'Biotech' },
  { key: 'defense',       label: 'Defense' },
];

const CONDITIONS = [
  { key: 'new',         label: 'New' },
  { key: 'used',        label: 'Used' },
  { key: 'refurbished', label: 'Refurbished' },
];

function InputField({ label, required, hint, V, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>
        {label}{required && <span style={{ color: V.accent }}> *</span>}
      </label>
      {hint && <div style={{ fontSize: 11, color: V.dim, fontFamily: V.space }}>{hint}</div>}
      <input
        {...props}
        style={{
          background: V.card2, border: `1px solid ${V.border}`,
          color: V.text, borderRadius: 7, padding: '10px 12px',
          fontSize: 14, fontFamily: V.space, outline: 'none',
          width: '100%', boxSizing: 'border-box',
          ...(props.style || {}),
        }}
      />
    </div>
  );
}

function SelectField({ label, required, children, V, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>
        {label}{required && <span style={{ color: V.accent }}> *</span>}
      </label>
      <select
        {...props}
        style={{
          background: V.card2, border: `1px solid ${V.border}`,
          color: V.text, borderRadius: 7, padding: '10px 12px',
          fontSize: 14, fontFamily: V.space, outline: 'none',
          width: '100%', boxSizing: 'border-box', cursor: 'pointer',
          ...(props.style || {}),
        }}
      >
        {children}
      </select>
    </div>
  );
}

function TextareaField({ label, required, V, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>
        {label}{required && <span style={{ color: V.accent }}> *</span>}
      </label>
      <textarea
        {...props}
        style={{
          background: V.card2, border: `1px solid ${V.border}`,
          color: V.text, borderRadius: 7, padding: '10px 12px',
          fontSize: 14, fontFamily: V.space, outline: 'none',
          width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 120,
          ...(props.style || {}),
        }}
      />
    </div>
  );
}

function SourcingMarketplacePostInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const navigate = useNavigate();
  const { tenantSlug } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : '/';

  const [form, setForm] = useState({
    company_name: '',
    company_email: '',
    title: '',
    description: '',
    price: '',
    condition: 'used',
    vertical: 'semiconductor',
    contact_email: '',
    photo_url: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.condition || !form.vertical || !form.contact_email) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!supabase) {
      setError('Database not configured. Contact the administrator.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      let companyId = null;

      const { data: existingCo } = await supabase
        .from('directory_companies')
        .select('id')
        .eq('email', form.company_email)
        .single();

      if (existingCo) {
        companyId = existingCo.id;
      } else {
        const slug = form.company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
        const { data: newCo, error: coError } = await supabase
          .from('directory_companies')
          .insert({
            name: form.company_name || 'Unknown Company',
            slug,
            email: form.company_email,
            vertical: form.vertical,
            status: 'pending',
          })
          .select('id')
          .single();
        if (coError) throw coError;
        companyId = newCo.id;
      }

      const photoUrls = form.photo_url ? [form.photo_url] : [];

      const { error: insertError } = await supabase
        .from('directory_listings')
        .insert({
          company_id: companyId,
          title: form.title,
          description: form.description,
          price: form.price ? parseFloat(form.price) : null,
          category: 'equipment',
          status: 'active',
          condition: form.condition,
          vertical: form.vertical,
          contact_email: form.contact_email,
          photo_urls: photoUrls,
          image_url: form.photo_url || null,
        });

      if (insertError) throw insertError;
      setDone(true);
    } catch (err) {
      console.error('Post listing error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: V.bg, color: V.text }}>
        <style>{`* { box-sizing: border-box; }`}</style>
        <SourcingNav active="marketplace" tenantSlug={tenantSlug} />
        <div style={{ maxWidth: 520, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: V.accentDim,
            border: `2px solid ${V.accentBrd}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 24, color: V.accent, margin: '0 auto 20px',
          }}>✓</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, fontFamily: V.syne, color: V.heading, marginBottom: 10 }}>
            Listing Submitted
          </h2>
          <p style={{ fontSize: 15, color: V.muted, fontFamily: V.space, lineHeight: 1.6, marginBottom: 28 }}>
            Your equipment listing has been submitted. It will appear in the marketplace once reviewed.
          </p>
          <Link
            to={`${basePath}/marketplace`}
            style={{
              background: V.accent, color: '#fff', textDecoration: 'none',
              borderRadius: 8, padding: '11px 24px', fontSize: 14,
              fontWeight: 700, fontFamily: V.space, display: 'inline-block',
            }}
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: V.bg, color: V.text }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: ${V.dim}; }
        input:focus, textarea:focus, select:focus { border-color: ${V.accentBrd} !important; box-shadow: 0 0 0 2px ${V.accentDim}; }
        select option { background: ${V.card2}; }
      `}</style>

      <SourcingNav active="marketplace" tenantSlug={tenantSlug} />

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ marginBottom: 28 }}>
          <Link to={`${basePath}/marketplace`} style={{ fontSize: 12, color: V.muted, fontFamily: V.space, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 16 }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Marketplace
          </Link>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.accent, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
            Post a Listing
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: V.syne, color: V.heading, margin: 0 }}>
            List Equipment for Sale
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                Your Company
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <InputField label="Company Name" required value={form.company_name} onChange={set('company_name')} placeholder="Acme Semiconductor Inc." V={V} />
                <InputField label="Company Email" required type="email" value={form.company_email} onChange={set('company_email')} placeholder="contact@company.com" hint="Used to link listing to your company profile." V={V} />
              </div>
            </div>

            <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                Listing Details
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <InputField label="Title" required value={form.title} onChange={set('title')} placeholder="Used Lam Research Etch System — 200mm" V={V} />
                <TextareaField label="Description" value={form.description} onChange={set('description')} placeholder="Include make, model, year, condition details, reason for sale, etc." V={V} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <InputField label="Price (USD)" type="number" min="0" value={form.price} onChange={set('price')} placeholder="25000" V={V} />
                  <SelectField label="Condition" required value={form.condition} onChange={set('condition')} V={V}>
                    {CONDITIONS.map(c => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </SelectField>
                </div>
                <SelectField label="Industry Vertical" required value={form.vertical} onChange={set('vertical')} V={V}>
                  {VERTICALS.map(v => (
                    <option key={v.key} value={v.key}>{v.label}</option>
                  ))}
                </SelectField>
                <InputField label="Photo URL" type="url" value={form.photo_url} onChange={set('photo_url')} placeholder="https://..." hint="Link to a hosted photo of the equipment." V={V} />
                <InputField label="Contact Email" required type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="sales@company.com" hint="Buyers will contact you at this address." V={V} />
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, padding: '12px 14px', fontSize: 13, color: '#FCA5A5', fontFamily: V.space }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                background: submitting ? `${V.accent}66` : V.accent,
                border: 'none', color: '#fff', borderRadius: 8,
                padding: '13px', fontSize: 15, fontWeight: 700,
                fontFamily: V.space, cursor: submitting ? 'not-allowed' : 'pointer',
                width: '100%',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SourcingMarketplacePost() {
  return (
    <SourcingThemeProvider>
      <SourcingMarketplacePostInner />
    </SourcingThemeProvider>
  );
}
