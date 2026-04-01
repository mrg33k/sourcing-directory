import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

const VERTICALS = [
  { key: 'semiconductor', label: 'Semiconductor', color: '#29B6F6', icon: '💡' },
  { key: 'space',         label: 'Space & Aerospace', color: '#7C3AED', icon: '🚀' },
  { key: 'biotech',       label: 'Biotech', color: '#22C55E', icon: '🧬' },
  { key: 'defense',       label: 'Defense', color: '#EF4444', icon: '🛡️' },
];

const VERTICAL_CERTS = {
  semiconductor: ['ISO 9001', 'ISO 14001', 'ISO 45001', 'ITAR Registered', 'AS9100D', 'ANSI/ESD S20.20', 'AEC-Q100', 'IPC-7711/7721', 'JEDEC Standards'],
  space:         ['AS9100D', 'AS9120B', 'ITAR Registered', 'ISO 9001', 'MIL-STD-810', 'NADCAP', 'FAA FAR Part 145', 'DoD Secret Cleared', 'DFAR Compliant'],
  biotech:       ['ISO 13485', 'ISO 9001', 'cGMP', 'FDA 21 CFR Part 820', 'ISO 14155', 'CE Marked', 'ICH Q10', 'USP Compliance'],
  defense:       ['ITAR Registered', 'ISO 9001', 'AS9100D', 'CMMC Level 2', 'MIL-STD-810', 'DoD Secret Cleared', 'NIST 800-171', 'DFAR Compliant'],
};

const EMP_RANGES = [
  { value: '1-10',     label: '1-10' },
  { value: '11-50',    label: '11-50' },
  { value: '51-200',   label: '51-200' },
  { value: '200-500',  label: '200-500' },
  { value: '500-2000', label: '500-2000' },
  { value: '2000+',    label: '2000+' },
  { value: '10000+',   label: '10,000+' },
];

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function InputField({ label, required, V, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>
        {label}{required && <span style={{ color: V.accent }}> *</span>}
      </label>
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
          width: '100%', boxSizing: 'border-box',
          resize: 'vertical', minHeight: 80,
          ...(props.style || {}),
        }}
      />
    </div>
  );
}

function SelectField({ label, required, options, value, onChange, V }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>
        {label}{required && <span style={{ color: V.accent }}> *</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: V.card2, border: `1px solid ${V.border}`,
          color: value ? V.text : V.dim, borderRadius: 7, padding: '10px 12px',
          fontSize: 14, fontFamily: V.space, outline: 'none',
          width: '100%', boxSizing: 'border-box', appearance: 'none', cursor: 'pointer',
        }}
      >
        <option value="" style={{ background: V.card2 }}>Select...</option>
        {options.map(opt => (
          <option key={opt.value || opt} value={opt.value || opt} style={{ background: V.card2 }}>
            {opt.label || opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function StepBar({ step, total, V }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < step ? V.accent : i === step ? `${V.accent}60` : 'rgba(255,255,255,0.1)',
            transition: 'all 0.3s',
          }}
        />
      ))}
    </div>
  );
}

// ─── Inner component ──────────────────────────────────────────────────────────
function SourcingSignupInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const navigate = useNavigate();
  const { tenant, tenantSlug } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : '/';
  const [step, setStep] = useState(0);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    vertical: '',
    org_id: '',
    name: '',
    website: '',
    phone: '',
    email: '',
    city: '',
    state: 'AZ',
    employee_count: '',
    year_founded: '',
    description: '',
    selectedCerts: [],
    // Auth fields
    auth_email: '',
    auth_password: '',
    full_name: '',
  });

  useEffect(() => {
    if (!form.vertical || !supabase) return;
    supabase
      .from('directory_organizations')
      .select('*')
      .eq('vertical', form.vertical)
      .then(({ data, error }) => {
        if (!error) setOrgs(data || []);
        // On error, silently leave orgs empty -- org select is optional
      });
  }, [form.vertical]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const toggleCert = (cert) => {
    set('selectedCerts', form.selectedCerts.includes(cert)
      ? form.selectedCerts.filter(c => c !== cert)
      : [...form.selectedCerts, cert]
    );
  };

  const validate = () => {
    if (step === 0 && !form.vertical) return 'Please select an industry vertical.';
    if (step === 1) {
      if (!form.name.trim()) return 'Company name is required.';
      if (!form.description.trim()) return 'Description is required.';
      if (!form.full_name.trim()) return 'Your name is required.';
      if (!form.auth_email.trim()) return 'Login email is required.';
      if (!form.auth_password || form.auth_password.length < 6) return 'Password must be at least 6 characters.';
    }
    return '';
  };

  const handleNext = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!supabase) {
      setError('Supabase not configured. Run the migration first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // 1. Create Supabase auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.auth_email.trim(),
        password: form.auth_password,
      });
      if (authErr) throw authErr;

      const slug = slugify(form.name);

      // 2. Insert company (status: pending)
      const companyPayload = {
        name: form.name.trim(),
        slug,
        description: form.description.trim(),
        website: form.website.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        vertical: form.vertical,
        city: form.city.trim() || null,
        state: form.state || 'AZ',
        employee_count: form.employee_count || null,
        year_founded: form.year_founded ? parseInt(form.year_founded) : null,
        organization_id: form.org_id || null,
        membership_tier: 'free',
        status: 'pending',
      };

      // Add tenant_id if we have a tenant
      if (tenant?.id) companyPayload.tenant_id = tenant.id;

      const { data: company, error: companyErr } = await supabase
        .from('directory_companies')
        .insert(companyPayload)
        .select()
        .single();

      if (companyErr) throw companyErr;

      // 3. Insert directory_members record
      if (tenant?.id) {
        const { error: memberErr } = await supabase
          .from('directory_members')
          .insert({
            tenant_id: tenant.id,
            company_id: company.id,
            email: form.auth_email.trim(),
            full_name: form.full_name.trim(),
            status: 'pending',
            auth_user_id: authData.user?.id || null,
          });
        if (memberErr) console.error('Member insert error:', memberErr);
      }

      // 4. Insert certifications
      if (form.selectedCerts.length > 0) {
        const certRows = form.selectedCerts.map(cert => ({
          company_id: company.id,
          cert_name: cert,
          cert_value: 'true',
          vertical: form.vertical,
          ...(tenant?.id ? { tenant_id: tenant.id } : {}),
        }));
        await supabase.from('directory_certifications').insert(certRows);
      }

      setStep(3);

      // Fire-and-forget welcome email -- don't block on success/failure
      const emailTo = form.auth_email.trim() || form.email.trim();
      if (emailTo) {
        fetch('/api/sourcing/welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailTo,
            company_name: form.name.trim(),
            org_name: tenant?.name || 'AOM Sourcing Directory',
            company_slug: slug,
            base_url: window.location.origin,
          }),
        }).catch(() => {}); // intentional no-op on failure
      }
    } catch (err) {
      console.error('Signup error:', err);
      if (err.message?.includes('duplicate key') || err.message?.includes('unique')) {
        setError('A company with this name already exists, or that email is already registered. Try a different name or email.');
      } else if (err.message?.includes('already registered')) {
        setError('That email is already registered. Try signing in instead.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const availableCerts = VERTICAL_CERTS[form.vertical] || [];
  const vConfig = VERTICALS.find(v => v.key === form.vertical);

  // If tenant has self_service disabled, show message
  if (tenant && tenant.self_service === false) {
    return (
      <div style={{ minHeight: '100vh', background: V.bg, color: V.text, overflowX: 'hidden' }}>
        <div style={{
          borderBottom: `1px solid ${V.border}`,
          padding: '0 24px',
          display: 'flex', alignItems: 'center', gap: 16, height: 60,
          background: V.navBg,
        }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 800, fontFamily: V.syne, color: V.accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>AOM</span>
          </Link>
          <span style={{ color: V.dim, fontSize: 13 }}>/</span>
          <Link to={basePath} style={{ textDecoration: 'none', fontSize: 13, color: V.muted, fontFamily: V.space }}>Sourcing Directory</Link>
        </div>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: V.syne, color: V.heading, marginBottom: 12 }}>
            Signup Not Available
          </div>
          <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, lineHeight: 1.6, marginBottom: 24 }}>
            Signup is not available for this directory. Contact the directory administrator.
          </p>
          <Link to={basePath} style={{ color: V.accent, fontFamily: V.space, fontSize: 14, textDecoration: 'none', fontWeight: 600 }}>
            Back to Directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: V.bg, color: V.text, overflowX: 'hidden', maxWidth: '100vw' }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: ${V.dim}; }
        input:focus, textarea:focus, select:focus {
          border-color: ${V.accent} !important;
          box-shadow: 0 0 0 2px ${V.accentDim};
        }
      `}</style>

      {/* Nav */}
      <div style={{
        borderBottom: `1px solid ${V.border}`,
        padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 16, height: 60,
        background: V.navBg,
      }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: V.syne, color: V.accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            AOM
          </span>
        </Link>
        <span style={{ color: V.dim, fontSize: 13 }}>/</span>
        <Link to={basePath} style={{ textDecoration: 'none', fontSize: 13, color: V.muted, fontFamily: V.space }}>
          Sourcing Directory
        </Link>
        <span style={{ color: V.dim, fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: V.text, fontFamily: V.space }}>Add Your Company</span>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: V.accent, fontFamily: V.mono, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
            Free Listing
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: V.syne, color: V.heading, margin: '0 0 10px', lineHeight: 1.15 }}>
            List Your Company
          </h1>
          <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, margin: 0, lineHeight: 1.6 }}>
            Get found by procurement teams, contractors, and partners in Arizona's advanced industries.
          </p>
        </div>

        {step < 3 && <StepBar step={step} total={3} V={V} />}

        {/* Step 0: Choose vertical */}
        {step === 0 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 20 }}>
              What industry are you in?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {VERTICALS.map(v => (
                <button
                  key={v.key}
                  onClick={() => set('vertical', v.key)}
                  style={{
                    background: form.vertical === v.key ? `${v.color}15` : V.card,
                    border: `2px solid ${form.vertical === v.key ? v.color : V.border}`,
                    borderRadius: 10, padding: '16px 14px',
                    display: 'flex', flexDirection: 'column', gap: 6,
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 22 }}>{v.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.text }}>
                    {v.label}
                  </div>
                  {form.vertical === v.key && (
                    <div style={{ fontSize: 10, color: v.color, fontFamily: V.mono, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Selected
                    </div>
                  )}
                </button>
              ))}
            </div>

            {error && <div style={{ color: '#EF4444', fontSize: 13, fontFamily: V.space, marginBottom: 12 }}>{error}</div>}

            <button
              onClick={handleNext}
              disabled={!form.vertical}
              style={{
                width: '100%', background: form.vertical ? V.accent : V.accentDim,
                border: 'none', color: form.vertical ? '#fff' : V.dim,
                borderRadius: 8, padding: '12px 0', fontSize: 15,
                fontWeight: 700, fontFamily: V.space, cursor: form.vertical ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 1: Company info */}
        {step === 1 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 20 }}>{vConfig?.icon}</span>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: V.syne, color: V.text }}>
                Company Information
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <InputField label="Company Name" required placeholder="Acme Semiconductor LLC" value={form.name} onChange={e => set('name', e.target.value)} V={V} />
              <TextareaField label="Description" required placeholder="Brief description of your company, capabilities, and specialties..." value={form.description} onChange={e => set('description', e.target.value)} rows={3} V={V} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <InputField label="City" placeholder="Phoenix" value={form.city} onChange={e => set('city', e.target.value)} V={V} />
                <InputField label="State" placeholder="AZ" value={form.state} onChange={e => set('state', e.target.value)} maxLength={2} V={V} />
              </div>

              <InputField label="Website" placeholder="https://yourcompany.com" type="url" value={form.website} onChange={e => set('website', e.target.value)} V={V} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <InputField label="Phone" placeholder="(480) 555-0100" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} V={V} />
                <InputField label="Email" placeholder="info@company.com" type="email" value={form.email} onChange={e => set('email', e.target.value)} V={V} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <SelectField label="Employees" options={EMP_RANGES} value={form.employee_count} onChange={v => set('employee_count', v)} V={V} />
                <InputField label="Year Founded" placeholder="2010" type="number" min="1900" max={new Date().getFullYear()} value={form.year_founded} onChange={e => set('year_founded', e.target.value)} V={V} />
              </div>

              {/* Account section */}
              <div style={{ borderTop: `1px solid ${V.border}`, paddingTop: 16, marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Your Account
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <InputField label="Your Full Name" required placeholder="Jane Smith" value={form.full_name} onChange={e => set('full_name', e.target.value)} V={V} />
                  <InputField label="Login Email" required placeholder="you@company.com" type="email" value={form.auth_email} onChange={e => set('auth_email', e.target.value)} V={V} />
                  <InputField label="Password" required placeholder="Minimum 6 characters" type="password" value={form.auth_password} onChange={e => set('auth_password', e.target.value)} V={V} />
                </div>
              </div>
            </div>

            {error && <div style={{ color: '#EF4444', fontSize: 13, fontFamily: V.space, marginTop: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => { setStep(0); setError(''); }}
                style={{
                  flex: 1, background: 'transparent', border: `1px solid ${V.border}`,
                  color: V.muted, borderRadius: 8, padding: '11px 0',
                  fontSize: 14, fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                style={{
                  flex: 2, background: V.accent, border: 'none', color: '#fff',
                  borderRadius: 8, padding: '11px 0',
                  fontSize: 14, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Certs + org */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 6 }}>
              Certifications & Memberships
            </div>
            <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space, marginBottom: 20 }}>
              Select all certifications that apply.
            </div>

            {availableCerts.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  Certifications
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {availableCerts.map(cert => {
                    const checked = form.selectedCerts.includes(cert);
                    return (
                      <label
                        key={cert}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: checked ? V.accentDim : V.card,
                          border: `1px solid ${checked ? V.accentBrd : V.border}`,
                          borderRadius: 7, padding: '10px 14px',
                          cursor: 'pointer', transition: 'all 0.12s',
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          background: checked ? V.accent : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${checked ? V.accent : V.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color: '#fff',
                        }}>
                          {checked ? '✓' : ''}
                        </div>
                        <input type="checkbox" checked={checked} onChange={() => toggleCert(cert)} style={{ display: 'none' }} />
                        <span style={{ fontSize: 13, fontFamily: V.mono, color: checked ? V.text : V.muted }}>
                          {cert}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {orgs.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  Member Organization (optional)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {orgs.map(org => {
                    const selected = form.org_id === org.id;
                    return (
                      <label
                        key={org.id}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          background: selected ? V.accentDim : V.card,
                          border: `1px solid ${selected ? V.accentBrd : V.border}`,
                          borderRadius: 7, padding: '12px 14px', cursor: 'pointer',
                          transition: 'all 0.12s',
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                          background: selected ? V.accent : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${selected ? V.accent : V.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: '#fff', marginTop: 1,
                        }}>
                          {selected ? '●' : ''}
                        </div>
                        <input type="radio" name="org" checked={selected} onChange={() => set('org_id', org.id)} style={{ display: 'none' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: V.space, color: V.text, marginBottom: 2 }}>{org.name}</div>
                          {org.description && (
                            <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, lineHeight: 1.4 }}>
                              {org.description.slice(0, 100)}...
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: form.org_id === '' ? `${V.muted}15` : V.card,
                    border: `1px solid ${form.org_id === '' ? V.muted : V.border}`,
                    borderRadius: 7, padding: '10px 14px', cursor: 'pointer',
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      background: form.org_id === '' ? V.muted : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${form.org_id === '' ? V.muted : V.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: '#fff',
                    }}>
                      {form.org_id === '' ? '●' : ''}
                    </div>
                    <input type="radio" name="org" checked={form.org_id === ''} onChange={() => set('org_id', '')} style={{ display: 'none' }} />
                    <span style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
                      Not a member of any organization
                    </span>
                  </label>
                </div>
              </div>
            )}

            {!supabase && (
              <div style={{
                background: V.accentDim, border: `1px solid ${V.accentBrd}`,
                borderRadius: 7, padding: '12px 14px', marginBottom: 16,
                fontSize: 12, color: V.accent, fontFamily: V.space,
              }}>
                Supabase not configured -- listing cannot be saved yet. Run the migration first.
              </div>
            )}

            {error && <div style={{ color: '#EF4444', fontSize: 13, fontFamily: V.space, marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setStep(1); setError(''); }}
                style={{
                  flex: 1, background: 'transparent', border: `1px solid ${V.border}`,
                  color: V.muted, borderRadius: 8, padding: '11px 0',
                  fontSize: 14, fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  flex: 2, background: loading ? `${V.accent}60` : V.accent,
                  border: 'none', color: '#fff', borderRadius: 8, padding: '11px 0',
                  fontSize: 14, fontWeight: 700, fontFamily: V.space,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {loading ? (
                  <>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', animation: 'spin 0.8s linear infinite' }} />
                    Submitting...
                  </>
                ) : 'Submit Listing →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: V.accentDim, border: `2px solid ${V.accentBrd}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, margin: '0 auto 20px', color: V.accent,
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: V.syne, color: V.heading, margin: '0 0 12px' }}>
              You're on the list.
            </h2>
            <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, maxWidth: 380, margin: '0 auto 28px', lineHeight: 1.6 }}>
              Your listing has been submitted for review. You'll receive an email when approved.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 280, margin: '0 auto' }}>
              <Link
                to={basePath}
                style={{
                  background: V.accent, color: '#fff', textDecoration: 'none',
                  borderRadius: 8, padding: '11px 0', fontSize: 14,
                  fontWeight: 700, fontFamily: V.space, display: 'block', textAlign: 'center',
                }}
              >
                Browse the Directory
              </Link>
              <Link
                to={`${basePath}/login`}
                style={{
                  background: 'transparent', color: V.muted, textDecoration: 'none',
                  border: `1px solid ${V.border}`, borderRadius: 8, padding: '11px 0',
                  fontSize: 14, fontWeight: 600, fontFamily: V.space, display: 'block', textAlign: 'center',
                }}
              >
                Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SourcingSignup() {
  return (
    <SourcingThemeProvider>
      <SourcingSignupInner />
    </SourcingThemeProvider>
  );
}
