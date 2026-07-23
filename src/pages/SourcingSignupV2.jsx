import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useTenant } from './SourcingTheme.jsx';
import '../osv3-tokens.css';
import '../pages/OSLayoutV3.css';

const SPACE_CERTS = ['AS9100D', 'AS9110', 'AS9120B', 'ITAR Registered', 'ISO 9001', 'MIL-STD-810', 'NADCAP', 'FAA FAR Part 145', 'DoD Secret Cleared', 'DFAR Compliant'];
const EMP_RANGES = ['1–10', '11–50', '51–200', '200–500', '500–2000', '2000+', '10,000+'];

const FREE_STEPS = ['company', 'description', 'location', 'fullname', 'auth'];

function useQueryParam(name) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

export default function SourcingSignupV2() {
  const navigate = useNavigate();
  const { tenant, tenantSlug } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : '/spaceos';

  const steps = FREE_STEPS;
  const totalSteps = steps.length;

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    name: '', description: '', city: '', state: 'AZ',
    website: '', employee_count: '', year_founded: '',
    selectedCerts: [], seats: 5,
    full_name: '', auth_email: '', auth_password: '',
  });

  const [createdCompany, setCreatedCompany] = useState(null);
  const [paymentFallback, setPaymentFallback] = useState(false);

  const set = (key, val) => { setForm(p => ({ ...p, [key]: val })); setError(''); };
  const next = () => { setError(''); setStep(s => Math.min(s + 1, totalSteps)); };
  const back = () => { setError(''); setStep(s => Math.max(s - 1, 0)); };

  if (tenant && tenant.self_service === false) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '420px', textAlign: 'center', background: 'white', border: '1px solid var(--v3-border)', borderRadius: '8px', padding: '40px 32px' }}>
          <h2 style={{ fontSize: 'var(--v3-h2-font-size)', color: 'var(--v3-ink-primary)', margin: 0 }}>Signup closed</h2>
          <p style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', marginTop: '8px' }}>Contact the administrator for access.</p>
          <Link to={basePath} style={{ display: 'inline-block', marginTop: '20px', padding: '10px 20px', background: 'var(--v3-accent)', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: 'var(--v3-body-sm-font-size)', fontWeight: 'var(--v3-font-weight-semibold)' }}>Back</Link>
        </div>
      </div>
    );
  }

  const stepName = steps[step];

  const stepValid = () => {
    switch (stepName) {
      case 'company':     return form.name.trim().length > 1;
      case 'description': return form.description.trim().length > 5;
      case 'location':    return form.city.trim().length > 0 && form.state.trim().length === 2;
      case 'certs':       return true;
      case 'fullname':    return form.full_name.trim().length > 1;
      case 'auth':        return form.auth_email.includes('@') && form.auth_password.length >= 6;
      case 'payment':     return true;
      default:            return true;
    }
  };

  const handleAccountCreate = async () => {
    if (!form.full_name.trim()) { setError('Your name is required.'); return false; }
    if (!form.auth_email.trim()) { setError('Email is required.'); return false; }
    if (!form.auth_password || form.auth_password.length < 6) { setError('Password must be at least 6 characters.'); return false; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/sourcing/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_email: form.auth_email.trim(),
          auth_password: form.auth_password,
          full_name: form.full_name.trim(),
          name: form.name.trim(),
          description: form.description.trim(),
          website: form.website.trim() || null,
          email: form.auth_email.trim(),
          vertical: 'space',
          city: form.city.trim() || null,
          state: form.state || 'AZ',
          employee_count: form.employee_count || null,
          year_founded: form.year_founded || null,
          tenant_id: tenant?.id || null,
          selectedCerts: form.selectedCerts,
          membership_tier: 'free',
          plan_type: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed.');

      fetch('/api/sourcing/welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.auth_email.trim(),
          company_name: form.name.trim(),
          org_name: tenant?.name || 'Space Rising',
          company_slug: data.company_slug,
          base_url: window.location.origin,
        }),
      }).catch(() => {});

      if (supabase) {
        await supabase.auth.signInWithPassword({
          email: form.auth_email.trim(),
          password: form.auth_password,
        }).catch(() => {});
      }

      setCreatedCompany({ id: data.company_id || data.id, slug: data.company_slug });
      return { id: data.company_id || data.id, slug: data.company_slug };
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutRedirect = async (company) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/sourcing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company?.id || createdCompany?.id,
          company_slug: company?.slug || createdCompany?.slug,
          email: form.auth_email.trim(),
          plan_type: planType || 'small-annual',
        }),
      });
      if (res.status === 503) {
        setPaymentFallback(true);
        setSubmitted(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.checkout_url) {
        throw new Error(data.error || data.message || 'Could not start checkout.');
      }
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err.message || 'Checkout failed. Please try again.');
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '420px', textAlign: 'center', background: 'white', border: '1px solid var(--v3-border)', borderRadius: '8px', padding: '40px 32px' }}>
          <h2 style={{ fontSize: 'var(--v3-h2-font-size)', color: 'var(--v3-ink-primary)', margin: 0 }}>Welcome</h2>
          <p style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', marginTop: '12px', marginBottom: '24px' }}>
            {paymentFallback ? "Your account is set up. We'll send you a payment link via email." : 'Account created. Check your email to continue.'}
          </p>
          <Link to={basePath} style={{ display: 'inline-block', padding: '10px 20px', background: 'var(--v3-accent)', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: 'var(--v3-body-sm-font-size)', fontWeight: 'var(--v3-font-weight-semibold)' }}>Explore</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        <div style={{ marginBottom: '20px', display: 'flex', gap: '4px', justifyContent: 'center' }}>
          {steps.map((s, i) => (
            <div key={s} style={{ width: '8px', height: '8px', borderRadius: '50%', background: i <= step ? 'var(--v3-accent)' : 'var(--v3-border)', transition: 'all var(--v3-transition-fast)' }} />
          ))}
        </div>

        <div style={{ background: 'white', border: '1px solid var(--v3-border)', borderRadius: '8px', padding: '40px 32px' }}>
          {stepName === 'company' && (
            <>
              <h2 style={{ fontSize: 'var(--v3-h2-font-size)', color: 'var(--v3-ink-primary)', margin: '0 0 8px' }}>Company name</h2>
              <p style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', margin: '0 0 20px' }}>What's your organization called?</p>
              <input placeholder="Company Name" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--v3-border)', borderRadius: '6px', fontSize: 'var(--v3-body-sm-font-size)', boxSizing: 'border-box', marginBottom: '20px' }} />
            </>
          )}

          {stepName === 'description' && (
            <>
              <h2 style={{ fontSize: 'var(--v3-h2-font-size)', color: 'var(--v3-ink-primary)', margin: '0 0 8px' }}>About your company</h2>
              <p style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', margin: '0 0 20px' }}>Brief overview of what you do</p>
              <textarea placeholder="What does your company do?" value={form.description} onChange={(e) => set('description', e.target.value)} autoFocus style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--v3-border)', borderRadius: '6px', fontSize: 'var(--v3-body-sm-font-size)', boxSizing: 'border-box', minHeight: '100px', marginBottom: '20px', fontFamily: 'var(--v3-font-family-base)' }} />
            </>
          )}

          {stepName === 'location' && (
            <>
              <h2 style={{ fontSize: 'var(--v3-h2-font-size)', color: 'var(--v3-ink-primary)', margin: '0 0 8px' }}>Location</h2>
              <p style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', margin: '0 0 20px' }}>Where are you based?</p>
              <input placeholder="City" value={form.city} onChange={(e) => set('city', e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--v3-border)', borderRadius: '6px', fontSize: 'var(--v3-body-sm-font-size)', boxSizing: 'border-box', marginBottom: '12px' }} />
              <select value={form.state} onChange={(e) => set('state', e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--v3-border)', borderRadius: '6px', fontSize: 'var(--v3-body-sm-font-size)', boxSizing: 'border-box', marginBottom: '20px' }}>
                <option value="AZ">Arizona</option>
                <option value="CA">California</option>
                <option value="TX">Texas</option>
                <option value="FL">Florida</option>
                <option value="Other">Other</option>
              </select>
            </>
          )}

          {stepName === 'certs' && (
            <>
              <h2 style={{ fontSize: 'var(--v3-h2-font-size)', color: 'var(--v3-ink-primary)', margin: '0 0 8px' }}>Certifications (optional)</h2>
              <p style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', margin: '0 0 20px' }}>Which apply to your company?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                {SPACE_CERTS.map((cert) => (
                  <button
                    key={cert}
                    type="button"
                    onClick={() => set('selectedCerts', form.selectedCerts.includes(cert) ? form.selectedCerts.filter(c => c !== cert) : [...form.selectedCerts, cert])}
                    style={{ padding: '6px 12px', border: form.selectedCerts.includes(cert) ? '1px solid var(--v3-accent)' : '1px solid var(--v3-border)', background: form.selectedCerts.includes(cert) ? 'var(--v3-panel-bg)' : 'white', borderRadius: '6px', fontSize: 'var(--v3-body-sm-font-size)', cursor: 'pointer', transition: 'all var(--v3-transition-fast)' }}
                  >
                    {cert}
                  </button>
                ))}
              </div>
            </>
          )}

          {stepName === 'fullname' && (
            <>
              <h2 style={{ fontSize: 'var(--v3-h2-font-size)', color: 'var(--v3-ink-primary)', margin: '0 0 8px' }}>Your name</h2>
              <p style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', margin: '0 0 20px' }}>How should we address you?</p>
              <input placeholder="Full Name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} autoFocus style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--v3-border)', borderRadius: '6px', fontSize: 'var(--v3-body-sm-font-size)', boxSizing: 'border-box', marginBottom: '20px' }} />
            </>
          )}

          {stepName === 'auth' && (
            <>
              <h2 style={{ fontSize: 'var(--v3-h2-font-size)', color: 'var(--v3-ink-primary)', margin: '0 0 8px' }}>Account details</h2>
              <p style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', margin: '0 0 20px' }}>Create your login</p>
              <input type="email" placeholder="Email" value={form.auth_email} onChange={(e) => set('auth_email', e.target.value)} autoFocus style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--v3-border)', borderRadius: '6px', fontSize: 'var(--v3-body-sm-font-size)', boxSizing: 'border-box', marginBottom: '12px' }} />
              <input type="password" placeholder="Password (6+ characters)" value={form.auth_password} onChange={(e) => set('auth_password', e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--v3-border)', borderRadius: '6px', fontSize: 'var(--v3-body-sm-font-size)', boxSizing: 'border-box', marginBottom: '20px' }} />
            </>
          )}

          {error && <div style={{ padding: '12px', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '6px', color: '#DC2626', fontSize: 'var(--v3-body-sm-font-size)', marginBottom: '20px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
            {step > 0 && <button onClick={back} style={{ padding: '10px 20px', background: 'white', border: '1px solid var(--v3-border)', borderRadius: '6px', cursor: 'pointer', fontSize: 'var(--v3-body-sm-font-size)', fontWeight: 'var(--v3-font-weight-semibold)' }}>Back</button>}
            {step < totalSteps - 1 ? (
              <button onClick={next} disabled={!stepValid()} style={{ marginLeft: 'auto', padding: '10px 20px', background: stepValid() ? 'var(--v3-accent)' : '#D3D3D3', color: 'white', border: 'none', borderRadius: '6px', cursor: stepValid() ? 'pointer' : 'not-allowed', fontSize: 'var(--v3-body-sm-font-size)', fontWeight: 'var(--v3-font-weight-semibold)' }}>Continue</button>
            ) : (
              <button onClick={async () => { const result = await handleAccountCreate(); if (result) { setSubmitted(true); } }} disabled={!stepValid() || loading} style={{ marginLeft: 'auto', padding: '10px 20px', background: stepValid() && !loading ? 'var(--v3-accent)' : '#D3D3D3', color: 'white', border: 'none', borderRadius: '6px', cursor: stepValid() && !loading ? 'pointer' : 'not-allowed', fontSize: 'var(--v3-body-sm-font-size)', fontWeight: 'var(--v3-font-weight-semibold)' }}>{loading ? 'Creating...' : 'Create Account'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
