import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useTenant } from './SourcingTheme.jsx';
import '../space-rising-theme-v2.css';

const SPACE_CERTS = ['AS9100D', 'AS9110', 'AS9120B', 'ITAR Registered', 'ISO 9001', 'MIL-STD-810', 'NADCAP', 'FAA FAR Part 145', 'DoD Secret Cleared', 'DFAR Compliant'];
const EMP_RANGES = ['1–10', '11–50', '51–200', '200–500', '500–2000', '2000+', '10,000+'];

const FREE_STEPS  = ['company', 'description', 'location', 'fullname', 'auth'];
const PAID_STEPS  = ['company', 'description', 'location', 'certs', 'fullname', 'auth', 'payment'];

const PLAN_PRICING = {
  'small-annual':  { label: '<25 employees',    amount: '$500',    billing: 'billed annually',    btnLabel: 'Pay $500 with Stripe →' },
  'small-monthly': { label: '<25 employees',    amount: '$50/mo',  billing: 'recurring monthly',  btnLabel: 'Subscribe $50/mo →' },
  'mid-annual':    { label: '25–199 employees', amount: '$1,000',  billing: 'billed annually',    btnLabel: 'Pay $1,000 with Stripe →' },
  'mid-monthly':   { label: '25–199 employees', amount: '$100/mo', billing: 'recurring monthly',  btnLabel: 'Subscribe $100/mo →' },
  'large-annual':  { label: '200+ employees',   amount: '$2,700',  billing: 'billed annually',    btnLabel: 'Pay $2,700 with Stripe →' },
  'large-monthly': { label: '200+ employees',   amount: '$250/mo', billing: 'recurring monthly',  btnLabel: 'Subscribe $250/mo →' },
};

function useQueryParam(name) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

export default function SourcingSignupV2() {
  const navigate = useNavigate();
  const { tenant, tenantSlug } = useTenant();
  const tierParam = useQueryParam('tier');
  const planParam = useQueryParam('plan'); // e.g. 'small-annual', 'mid-monthly', 'large-annual'
  const tier = tierParam === 'free' ? 'free' : 'paid';
  const validPlanTypes = Object.keys(PLAN_PRICING);
  const planType = planParam && validPlanTypes.includes(planParam)
    ? planParam
    : tier === 'paid' ? 'small-annual' : null;
  const isAnnual = planType?.endsWith('-annual');
  const basePath = tenantSlug ? `/${tenantSlug}` : '/space-rising-v2';

  const steps = tier === 'free' ? FREE_STEPS : PAID_STEPS;
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

  // After the auth-step signup POST succeeds, we stash company_id + slug here so
  // the payment step can create a checkout session against the live row.
  const [createdCompany, setCreatedCompany] = useState(null);
  // When the Stripe checkout endpoint returns 503 (env vars not set), or paid
  // signup completes without payment wiring, we surface this and fall back to
  // "we'll email you a link" copy on the welcome screen.
  const [paymentFallback, setPaymentFallback] = useState(false);

  const set = (key, val) => { setForm(p => ({ ...p, [key]: val })); setError(''); };
  const next = () => { setError(''); setStep(s => Math.min(s + 1, totalSteps)); };
  const back = () => { setError(''); setStep(s => Math.max(s - 1, 0)); };

  // Self-service disabled
  if (tenant && tenant.self_service === false) {
    return (
      <div className="srsv2-shell" data-tenant="space-rising-v2">
        <div className="srsv2-veil" />
        <div className="srsv2-card">
          <div className="srsv2-eyebrow">SIGNUP CLOSED</div>
          <div className="srsv2-title">This directory isn't open.<span className="srsv2-period">.</span></div>
          <div className="srsv2-sub">Contact the administrator for access.</div>
          <Link to={basePath} className="srsv2-cta srsv2-cta-line">Back to directory</Link>
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

  // Step 1 of the paid flow (and the only submit for free flow): create the
  // company row, send the welcome email, sign the user in. After this fires
  // successfully on the paid path we hold the company_id and advance to payment.
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
          membership_tier: tier,
          plan_type: tier === 'paid' ? planType : null,
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

  // Step 2 of the paid flow: take the just-created company → POST to the
  // Stripe checkout-session endpoint → redirect to the hosted checkout URL.
  // If the endpoint reports 503 (env vars not set yet), fall back to the
  // welcome screen with "we'll email a link" copy so the UX still completes.
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
        // Press-go state: env vars not set yet. Land on welcome with fallback copy.
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
      setError(err.message || 'Checkout failed — try again or contact us.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!stepValid()) return;
    // Free tier: auth step submits AND finalizes — welcome screen renders next.
    if (stepName === 'auth' && tier === 'free') {
      const company = await handleAccountCreate();
      if (company) setSubmitted(true);
      return;
    }
    // Paid tier: auth step creates the account then advances to payment.
    if (stepName === 'auth' && tier === 'paid') {
      const company = await handleAccountCreate();
      if (company) next();
      return;
    }
    // Paid tier payment step: redirect into Stripe (or fall back to welcome).
    if (stepName === 'payment') {
      return handleCheckoutRedirect(createdCompany);
    }
    next();
  };

  return (
    <div className="srsv2-shell" data-tenant="space-rising-v2">
      <div className="srsv2-veil" />

      {/* Top bar */}
      <div className="srsv2-topbar">
        <Link to={basePath} className="srsv2-wordmark">SPACE RISING</Link>
        <div className="srsv2-progress">
          {!submitted && (
            <span>
              {String(step + 1).padStart(2, '0')} <span className="srsv2-progress-sep">/</span> {String(totalSteps).padStart(2, '0')}
            </span>
          )}
        </div>
        <Link to={basePath} className="srsv2-close" aria-label="Close">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </Link>
      </div>

      {/* Progress rail */}
      {!submitted && (
        <div className="srsv2-rail">
          <div className="srsv2-rail-fill" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
        </div>
      )}

      {/* Body */}
      <div className="srsv2-body">
        {submitted ? (
          <div className="srsv2-step srsv2-step-success">
            <div className="srsv2-eyebrow">YOU'RE IN</div>
            <div className="srsv2-title srsv2-title-xl">
              Welcome to the room, {form.full_name.trim().split(/\s+/)[0] || 'friend'}<span className="srsv2-period">.</span>
            </div>
            <div className="srsv2-sub">
              {tier === 'paid'
                ? (paymentFallback
                    ? `Your account is in. We'll email ${form.auth_email} a payment link to complete your membership — secure checkout is being switched on.`
                    : `Your account is in. We'll email ${form.auth_email} the receipt once Stripe confirms the payment.`)
                : `Your company listing is live. We sent a welcome to ${form.auth_email}.`}
            </div>
            <div className="srsv2-cta-row">
              <Link to={basePath} className="srsv2-cta srsv2-cta-solid">Enter the directory</Link>
            </div>
          </div>
        ) : (
          <StepView
            stepName={stepName}
            stepIndex={step}
            tier={tier}
            planType={planType}
            isAnnual={isAnnual}
            form={form}
            set={set}
            error={error}
            loading={loading}
            onContinue={handleContinue}
            onBack={back}
            canContinue={stepValid()}
          />
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Step views
// ────────────────────────────────────────────────────────────────────────────────

function StepView({ stepName, stepIndex, tier, planType, isAnnual, form, set, error, loading, onContinue, onBack, canContinue }) {
  const inputRef = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus?.(), 380);
    return () => clearTimeout(t);
  }, [stepName]);

  const eyebrowFor = (name) => {
    switch (name) {
      case 'company':     return 'YOUR COMPANY';
      case 'description': return 'WHAT YOU DO';
      case 'location':    return 'WHERE YOU OPERATE';
      case 'certs':       return 'CERTIFICATIONS';
      case 'seats':       return 'YOUR TEAM'; // kept for safety; step removed from PAID_STEPS
      case 'fullname':    return 'WHO YOU ARE';
      case 'auth':        return 'YOUR ACCOUNT';
      case 'payment':     return 'PAYMENT';
      default:            return '';
    }
  };

  return (
    <div key={stepName} className="srsv2-step">
      <div className="srsv2-eyebrow">{eyebrowFor(stepName)}</div>

      {stepName === 'company' && (
        <>
          <h1 className="srsv2-title">What's the company called<span className="srsv2-period">?</span></h1>
          <div className="srsv2-sub">This is how you'll appear in the directory.</div>
          <input
            ref={inputRef}
            className="srsv2-input"
            placeholder="Acme Aerospace"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canContinue && onContinue()}
          />
        </>
      )}

      {stepName === 'description' && (
        <>
          <h1 className="srsv2-title">Tell us what you do<span className="srsv2-period">.</span></h1>
          <div className="srsv2-sub">A short description — capabilities, focus, what makes you specific.</div>
          <textarea
            ref={inputRef}
            className="srsv2-input srsv2-textarea"
            placeholder="We design and build…"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={4}
          />
        </>
      )}

      {stepName === 'location' && (
        <>
          <h1 className="srsv2-title">Where do you operate<span className="srsv2-period">?</span></h1>
          <div className="srsv2-sub">Help procurement teams find local suppliers.</div>
          <div className="srsv2-field-grid">
            <label className="srsv2-field srsv2-field-wide">
              <span className="srsv2-label">City</span>
              <input
                ref={inputRef}
                className="srsv2-input"
                placeholder="Phoenix"
                value={form.city}
                onChange={e => set('city', e.target.value)}
              />
            </label>
            <label className="srsv2-field srsv2-field-narrow">
              <span className="srsv2-label">State</span>
              <input
                className="srsv2-input"
                placeholder="AZ"
                value={form.state}
                onChange={e => set('state', e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
              />
            </label>
            <label className="srsv2-field srsv2-field-wide">
              <span className="srsv2-label">Website <em className="srsv2-optional">optional</em></span>
              <input
                className="srsv2-input"
                placeholder="https://"
                type="url"
                value={form.website}
                onChange={e => set('website', e.target.value)}
              />
            </label>
            <label className="srsv2-field srsv2-field-narrow">
              <span className="srsv2-label">Founded <em className="srsv2-optional">optional</em></span>
              <input
                className="srsv2-input"
                placeholder="2018"
                type="number"
                min="1900"
                max={new Date().getFullYear()}
                value={form.year_founded}
                onChange={e => set('year_founded', e.target.value)}
              />
            </label>
            <label className="srsv2-field srsv2-field-full">
              <span className="srsv2-label">Team size <em className="srsv2-optional">optional</em></span>
              <select
                className="srsv2-input srsv2-select"
                value={form.employee_count}
                onChange={e => set('employee_count', e.target.value)}
              >
                <option value="">Select range</option>
                {EMP_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
        </>
      )}

      {stepName === 'certs' && (
        <>
          <h1 className="srsv2-title">What certifications do you hold<span className="srsv2-period">?</span></h1>
          <div className="srsv2-sub">Tap all that apply. You can edit these any time.</div>
          <div className="srsv2-certs">
            {SPACE_CERTS.map(cert => {
              const on = form.selectedCerts.includes(cert);
              return (
                <button
                  key={cert}
                  type="button"
                  className={`srsv2-cert ${on ? 'on' : ''}`}
                  onClick={() => set('selectedCerts', on ? form.selectedCerts.filter(c => c !== cert) : [...form.selectedCerts, cert])}
                >
                  {cert}
                </button>
              );
            })}
          </div>
        </>
      )}

      {stepName === 'seats' && (
        <>
          <h1 className="srsv2-title">How many seats do you need<span className="srsv2-period">?</span></h1>
          <div className="srsv2-sub">Slide to size your team. Pricing tiers down as you grow.</div>
          <div className="srsv2-seats">
            <div className="srsv2-seats-readout">
              <div className="srsv2-seats-count">{form.seats}</div>
              <div className="srsv2-seats-unit">{form.seats === 1 ? 'seat' : 'seats'}</div>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={form.seats}
              onChange={e => set('seats', Number(e.target.value))}
              className="srsv2-range"
            />
            <div className="srsv2-seats-price">
              {ppm ? (
                <>
                  <span className="srsv2-seats-price-big">${ppm.toLocaleString()}</span>
                  <span className="srsv2-seats-price-unit">/ seat / year</span>
                </>
              ) : (
                <span className="srsv2-seats-price-big">Custom pricing</span>
              )}
              {totalMo && (
                <div className="srsv2-seats-monthly">≈ ${totalMo.toLocaleString()} / month, billed annually</div>
              )}
            </div>
          </div>
        </>
      )}

      {stepName === 'fullname' && (
        <>
          <h1 className="srsv2-title">And your name<span className="srsv2-period">?</span></h1>
          <div className="srsv2-sub">For your profile and our emails.</div>
          <input
            ref={inputRef}
            className="srsv2-input"
            placeholder="Jane Smith"
            value={form.full_name}
            onChange={e => set('full_name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canContinue && onContinue()}
          />
        </>
      )}

      {stepName === 'auth' && (
        <>
          <h1 className="srsv2-title">Lock it in<span className="srsv2-period">.</span></h1>
          <div className="srsv2-sub">You'll use this to sign in and manage your listing.</div>
          <label className="srsv2-field">
            <span className="srsv2-label">Work email</span>
            <input
              ref={inputRef}
              className="srsv2-input"
              placeholder="you@company.com"
              type="email"
              value={form.auth_email}
              onChange={e => set('auth_email', e.target.value)}
            />
          </label>
          <label className="srsv2-field">
            <span className="srsv2-label">Password <em className="srsv2-optional">min 6 characters</em></span>
            <input
              className="srsv2-input"
              placeholder="••••••••"
              type="password"
              value={form.auth_password}
              onChange={e => set('auth_password', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canContinue && onContinue()}
            />
          </label>
        </>
      )}

      {stepName === 'payment' && (() => {
        const pp = PLAN_PRICING[planType] || PLAN_PRICING['small-annual'];
        return (
          <>
            <h1 className="srsv2-title">Pay securely<span className="srsv2-period">.</span></h1>
            <div className="srsv2-sub">
              One step. You'll be taken to a hosted Stripe checkout to confirm card details — we never see your card. Your account is already created at <strong>{form.auth_email || 'your email'}</strong>; the upgrade flips the moment payment clears.
            </div>
            <div className="srsv2-payment-summary">
              <div className="srsv2-payment-row"><span>Company size</span><span>{pp.label}</span></div>
              <div className="srsv2-payment-row"><span>Billing</span><span>{pp.billing}</span></div>
              <div className="srsv2-payment-row srsv2-payment-row-strong"><span>Amount</span><span>{pp.amount}</span></div>
            </div>
          </>
        );
      })()}

      {error && <div className="srsv2-error">{error}</div>}

      <div className="srsv2-actions">
        {stepIndex > 0 && (
          <button type="button" className="srsv2-cta srsv2-cta-line" onClick={onBack}>
            Back
          </button>
        )}
        <button
          type="button"
          className="srsv2-cta srsv2-cta-solid"
          onClick={onContinue}
          disabled={!canContinue || loading}
        >
          {loading
            ? 'Working…'
            : stepName === 'auth'
              ? (tier === 'paid' ? 'Continue to payment' : 'Create account')
              : stepName === 'payment'
                ? ((PLAN_PRICING[planType] || PLAN_PRICING['small-annual']).btnLabel)
                : 'Continue'}
        </button>
      </div>
    </div>
  );
}
