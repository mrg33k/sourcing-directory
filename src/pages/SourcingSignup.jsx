import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

const VERTICALS = [
  { key: 'semiconductor', label: 'Semiconductor', color: '#29B6F6', icon: '💡', bg: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80' },
  { key: 'space',         label: 'Space & Aerospace', color: '#7C3AED', icon: '🚀', bg: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=800&q=80' },
];

const VERTICAL_CERTS = {
  semiconductor: ['ISO 9001', 'ISO 14001', 'ISO 45001', 'ITAR Registered', 'AS9100D', 'ANSI/ESD S20.20', 'AEC-Q100', 'IPC-7711/7721', 'JEDEC Standards'],
  space:         ['AS9100D', 'AS9110', 'AS9120B', 'ITAR Registered', 'ISO 9001', 'MIL-STD-810', 'NADCAP', 'FAA FAR Part 145', 'DoD Secret Cleared', 'DFAR Compliant'],
};

const EMP_RANGES = ['1-10', '11-50', '51-200', '200-500', '500-2000', '2000+', '10,000+'];

// ─── Typeform-style step wrapper ────────────────────────────────────────────
function Step({ active, children }) {
  if (!active) return null;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '0 28px', minHeight: 'calc(100dvh - 120px)',
      animation: 'fadeUp 0.35s cubic-bezier(0.16,1,0.3,1)',
    }}>
      {children}
    </div>
  );
}

function StepQuestion({ children }) {
  return <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', marginBottom: 8, lineHeight: 1.15 }}>{children}</div>;
}

function StepHint({ children }) {
  return <div style={{ fontSize: 14, color: 'var(--tx2)', marginBottom: 28, lineHeight: 1.5 }}>{children}</div>;
}

function NextBtn({ onClick, disabled, label = 'Continue' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="login-btn"
      style={{
        marginTop: 24, opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label} <span style={{ marginLeft: 6 }}>↓</span>
    </button>
  );
}

function ProgressDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i === current ? 24 : 8, height: 8, borderRadius: 4,
          background: i <= current ? 'var(--cyan)' : 'var(--s3)',
          transition: 'all 0.3s',
        }} />
      ))}
    </div>
  );
}

// ─── Inner component ──────────────────────────────────────────────────────────
function SourcingSignupInner() {
  const V = getTokens(true);
  const navigate = useNavigate();
  const { tenant, tenantSlug } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : '/';
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const totalSteps = 8;

  const [form, setForm] = useState({
    vertical: '', name: '', description: '', city: '', state: 'AZ',
    website: '', employee_count: '', year_founded: '',
    selectedCerts: [], membership_tier: 'free',
    full_name: '', auth_email: '', auth_password: '',
  });

  const set = (key, val) => { setForm(prev => ({ ...prev, [key]: val })); setError(''); };

  const next = () => { setError(''); setStep(s => Math.min(s + 1, totalSteps)); };
  const back = () => { setError(''); setStep(s => Math.max(s - 1, 0)); };

  const handleSubmit = async () => {
    if (!form.full_name.trim()) { setError('Your name is required.'); return; }
    if (!form.auth_email.trim()) { setError('Email is required.'); return; }
    if (!form.auth_password || form.auth_password.length < 6) { setError('Password must be at least 6 characters.'); return; }

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
          vertical: form.vertical,
          city: form.city.trim() || null,
          state: form.state || 'AZ',
          employee_count: form.employee_count || null,
          year_founded: form.year_founded || null,
          tenant_id: tenant?.id || null,
          selectedCerts: form.selectedCerts,
          membership_tier: form.membership_tier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed.');

      // Fire welcome email
      fetch('/api/sourcing/welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.auth_email.trim(),
          company_name: form.name.trim(),
          org_name: tenant?.name || 'AOM Sourcing Directory',
          company_slug: data.company_slug,
          base_url: window.location.origin,
        }),
      }).catch(() => {});

      setStep(totalSteps); // success screen
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const vConfig = VERTICALS.find(v => v.key === form.vertical);
  const availableCerts = VERTICAL_CERTS[form.vertical] || [];

  // Self-service disabled
  if (tenant && tenant.self_service === false) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 12 }}>Signup Not Available</div>
          <div style={{ fontSize: 14, color: 'var(--tx2)', marginBottom: 24 }}>Contact the directory administrator.</div>
          <Link to={basePath} style={{ color: 'var(--cyan)', textDecoration: 'none', fontWeight: 600 }}>Back to Directory</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)', color: 'var(--tx)',
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Background image -- changes with vertical selection */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: vConfig
          ? `linear-gradient(180deg, rgba(6,6,10,0.85) 0%, rgba(6,6,10,0.95) 50%, var(--bg) 100%), url('${vConfig.bg}')`
          : 'linear-gradient(180deg, rgba(6,6,10,0.7) 0%, var(--bg) 60%), url("https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80")',
        backgroundSize: 'cover', backgroundPosition: 'center',
        transition: 'background-image 0.6s',
      }} />

      {/* Top bar */}
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center',
        padding: 'max(env(safe-area-inset-top),16px) 20px 12px',
      }}>
        {step > 0 && step < totalSteps ? (
          <button onClick={back} style={{
            background: 'none', border: 'none', color: 'var(--tx2)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
            Back
          </button>
        ) : (
          <Link to={basePath} style={{ textDecoration: 'none', color: 'var(--tx2)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
            Back
          </Link>
        )}
        <div style={{ flex: 1 }} />
        {step < totalSteps && (
          <div style={{ fontSize: 12, color: 'var(--tx3)', fontWeight: 600 }}>
            {step + 1} of {totalSteps}
          </div>
        )}
      </div>

      {/* Progress */}
      {step < totalSteps && (
        <div style={{ position: 'relative', zIndex: 10, padding: '0 28px' }}>
          <ProgressDots current={step} total={totalSteps} />
        </div>
      )}

      {/* Steps container */}
      <div style={{ position: 'relative', zIndex: 10 }}>

        {/* Step 0: Choose directory -- branded cards like home page */}
        <Step active={step === 0}>
          <StepQuestion>Which directory do you want to join?</StepQuestion>
          <StepHint>Choose the industry that best fits your company.</StepHint>
          <div className="dir-cards" style={{ padding: 0 }}>
            {VERTICALS.map(v => {
              const cls = v.key === 'space' ? 'space' : 'semi';
              const selected = form.vertical === v.key;
              return (
                <div
                  key={v.key}
                  className={`dir-card ${cls}`}
                  onClick={() => { set('vertical', v.key); setTimeout(next, 400); }}
                  style={selected ? { border: `2px solid ${v.color}`, transform: 'scale(0.98)' } : {}}
                >
                  <div className="dir-card-bg" />
                  <div className="dir-card-overlay" />
                  <div className="dir-card-body">
                    <div className="dir-card-tag">{v.key === 'space' ? 'space & aerospace' : 'semiconductor'}</div>
                    <div className="dir-card-name">{v.label}</div>
                    <div className="dir-card-desc">
                      {v.key === 'semiconductor'
                        ? 'Chips, wafers, fabrication, testing, and electronics supply chain'
                        : 'Launch providers, satellites, defense contractors, and R&D firms'}
                    </div>
                    <div className="dir-card-foot">
                      <div className="dir-card-count">
                        <div className="dir-card-count-label" style={{ fontSize: 13 }}>
                          {selected ? 'Selected' : 'Tap to select'}
                        </div>
                      </div>
                      <div className="dir-card-arrow">
                        {selected
                          ? <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                          : <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Step>

        {/* Step 1: Company name */}
        <Step active={step === 1}>
          <StepQuestion>What's your company called?</StepQuestion>
          <StepHint>This is how you'll appear in the directory.</StepHint>
          <input
            className="login-input"
            style={{ fontSize: 18, padding: '16px', background: 'var(--s1)' }}
            placeholder="Acme Semiconductor LLC"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && form.name.trim() && next()}
            autoFocus
          />
          <NextBtn onClick={next} disabled={!form.name.trim()} />
        </Step>

        {/* Step 2: Description */}
        <Step active={step === 2}>
          <StepQuestion>Tell us about your company</StepQuestion>
          <StepHint>A brief description of what you do, your capabilities, and specialties.</StepHint>
          <textarea
            className="login-input"
            style={{ fontSize: 15, padding: '16px', minHeight: 120, resize: 'vertical', background: 'var(--s1)' }}
            placeholder="We specialize in..."
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
          <NextBtn onClick={next} disabled={!form.description.trim()} />
        </Step>

        {/* Step 3: Location + details */}
        <Step active={step === 3}>
          <StepQuestion>Where are you located?</StepQuestion>
          <StepHint>Help procurement teams find local suppliers.</StepHint>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <input
              className="login-input"
              style={{ flex: 1, background: 'var(--s1)' }}
              placeholder="City"
              value={form.city}
              onChange={e => set('city', e.target.value)}
            />
            <input
              className="login-input"
              style={{ width: 80, background: 'var(--s1)' }}
              placeholder="AZ"
              value={form.state}
              onChange={e => set('state', e.target.value)}
              maxLength={2}
            />
          </div>
          <input
            className="login-input"
            style={{ marginBottom: 14, background: 'var(--s1)' }}
            placeholder="Website (optional)"
            type="url"
            value={form.website}
            onChange={e => set('website', e.target.value)}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <select
              className="login-input"
              style={{ flex: 1, background: 'var(--s1)', cursor: 'pointer' }}
              value={form.employee_count}
              onChange={e => set('employee_count', e.target.value)}
            >
              <option value="">Employees</option>
              {EMP_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              className="login-input"
              style={{ width: 110, background: 'var(--s1)' }}
              placeholder="Year founded"
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              value={form.year_founded}
              onChange={e => set('year_founded', e.target.value)}
            />
          </div>
          <NextBtn onClick={next} />
        </Step>

        {/* Step 4: Certifications */}
        <Step active={step === 4}>
          <StepQuestion>Any certifications?</StepQuestion>
          <StepHint>Select all that apply. You can update these later.</StepHint>
          <div style={{ maxHeight: '45vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {availableCerts.map(cert => {
              const checked = form.selectedCerts.includes(cert);
              return (
                <div
                  key={cert}
                  onClick={() => set('selectedCerts', checked ? form.selectedCerts.filter(c => c !== cert) : [...form.selectedCerts, cert])}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: checked ? 'var(--cyan-dim)' : 'var(--s1)',
                    border: `1px solid ${checked ? 'var(--cyan-brd)' : 'var(--bd)'}`,
                    borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    background: checked ? 'var(--cyan)' : 'transparent',
                    border: `2px solid ${checked ? 'var(--cyan)' : 'var(--bd2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#000', fontSize: 12, fontWeight: 900,
                  }}>
                    {checked && '✓'}
                  </div>
                  <span style={{ fontSize: 14, color: checked ? 'var(--tx)' : 'var(--tx2)' }}>{cert}</span>
                </div>
              );
            })}
          </div>
          <NextBtn onClick={next} label={form.selectedCerts.length > 0 ? `Continue with ${form.selectedCerts.length} selected` : 'Skip for now'} />
        </Step>

        {/* Step 5: Membership tier */}
        <Step active={step === 5}>
          <StepQuestion>Choose your membership</StepQuestion>
          <StepHint>Free gets you listed. Paid unlocks everything.</StepHint>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Free tier */}
            <div
              onClick={() => { set('membership_tier', 'free'); setTimeout(next, 300); }}
              style={{
                background: form.membership_tier === 'free' ? 'rgba(52,211,153,0.08)' : 'var(--s1)',
                border: `2px solid ${form.membership_tier === 'free' ? 'var(--emerald)' : 'var(--bd)'}`,
                borderRadius: 'var(--r)', padding: '20px', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--emerald)' }}>Free</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>$0</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 14 }}>
                Basic directory listing and read access to all public content.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Company listing in directory', 'View all companies & events', 'Access public reports & grants'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--tx2)' }}>
                    <svg width="14" height="14" fill="none" stroke="var(--emerald)" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                    {f}
                  </div>
                ))}
              </div>
            </div>
            {/* Paid tier */}
            <div
              onClick={() => { set('membership_tier', 'paid'); setTimeout(next, 300); }}
              style={{
                background: form.membership_tier === 'paid' ? 'var(--cyan-dim)' : 'var(--s1)',
                border: `2px solid ${form.membership_tier === 'paid' ? 'var(--cyan)' : 'var(--bd)'}`,
                borderRadius: 'var(--r)', padding: '20px', cursor: 'pointer',
                transition: 'all 0.2s', position: 'relative',
              }}
            >
              <div style={{
                position: 'absolute', top: -10, right: 16,
                background: 'var(--cyan)', color: '#000', fontSize: 10, fontWeight: 800,
                padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                Recommended
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cyan)' }}>Paid Member</div>
                <div>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>$1,000</span>
                  <span style={{ fontSize: 12, color: 'var(--tx3)', marginLeft: 4 }}>/seat/yr</span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 14 }}>
                Full platform access. Post content, access intelligence, VIP events.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Everything in Free', 'Post jobs, events, articles', 'Monthly intelligence reports', 'KPI dashboard & analytics', 'Space Congress VIP access'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--tx2)' }}>
                    <svg width="14" height="14" fill="none" stroke="var(--cyan)" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                    {f}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 12 }}>
                Volume: 5-14 seats $850/seat, 15-49 $700/seat, 50+ custom
              </div>
            </div>
          </div>
        </Step>

        {/* Step 6: Your name */}
        <Step active={step === 6}>
          <StepQuestion>What's your name?</StepQuestion>
          <StepHint>This is who we'll address in emails and on your profile.</StepHint>
          <input
            className="login-input"
            style={{ fontSize: 18, padding: '16px', background: 'var(--s1)' }}
            placeholder="Jane Smith"
            value={form.full_name}
            onChange={e => set('full_name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && form.full_name.trim() && next()}
            autoFocus
          />
          <NextBtn onClick={next} disabled={!form.full_name.trim()} />
        </Step>

        {/* Step 7: Email + password */}
        <Step active={step === 7}>
          <StepQuestion>Create your account</StepQuestion>
          <StepHint>You'll use this to sign in and manage your listing.</StepHint>
          <input
            className="login-input"
            style={{ background: 'var(--s1)' }}
            placeholder="you@company.com"
            type="email"
            value={form.auth_email}
            onChange={e => set('auth_email', e.target.value)}
          />
          <input
            className="login-input"
            style={{ background: 'var(--s1)' }}
            placeholder="Password (min 6 characters)"
            type="password"
            value={form.auth_password}
            onChange={e => set('auth_password', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && form.auth_email.trim() && form.auth_password.length >= 6 && handleSubmit()}
          />
          {error && <div style={{ color: '#FB7185', fontSize: 13, marginTop: 8 }}>{error}</div>}
          <button
            className="login-btn"
            onClick={handleSubmit}
            disabled={loading || !form.auth_email.trim() || form.auth_password.length < 6}
            style={{ marginTop: 24, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--tx3)' }}>
            Already have an account? <Link to={`${basePath}/login`} style={{ color: 'var(--cyan)', textDecoration: 'none' }}>Sign in</Link>
          </div>
        </Step>

        {/* Success */}
        <Step active={step === totalSteps}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
              background: 'var(--cyan-dim)', border: '2px solid var(--cyan-brd)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="32" height="32" fill="none" stroke="var(--cyan)" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <StepQuestion>You're in</StepQuestion>
            <StepHint>
              Your company has been listed. Check your email for a welcome message with next steps.
            </StepHint>
            <Link
              to={basePath}
              className="login-btn"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 24 }}
            >
              Browse the Directory
            </Link>
          </div>
        </Step>
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
