import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingNav } from './SourcingMarketplace.jsx';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

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

function CardField({ label, children, style, V }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
      <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

function FakeInput({ placeholder, mono, V }) {
  return (
    <div style={{
      background: V.card2, border: `1px solid ${V.border}`,
      color: V.dim, borderRadius: 7, padding: '10px 12px',
      fontSize: 14, fontFamily: mono ? V.mono : V.space,
      width: '100%', boxSizing: 'border-box',
      cursor: 'not-allowed',
    }}>
      {placeholder}
    </div>
  );
}

// ─── Inner Component ──────────────────────────────────────────────────────────
function SourcingCheckoutInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { tenant, tenantSlug } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : '/';

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orgSlug = searchParams.get('org') || '';
  const tierName = searchParams.get('tier') || 'Member';
  const price = parseInt(searchParams.get('price') || '0', 10);

  const [org, setOrg] = useState(null);
  const [companySlug, setCompanySlug] = useState(searchParams.get('company') || '');
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    company_name: '',
    contact_email: '',
    contact_name: '',
  });
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!supabase) return;
    if (orgSlug) {
      supabase.from('directory_organizations').select('*').eq('slug', orgSlug).single()
        .then(({ data }) => setOrg(data));
    }
    if (companySlug) {
      supabase.from('directory_companies').select('*').eq('slug', companySlug).single()
        .then(({ data }) => {
          if (data) {
            setCompany(data);
            setForm(prev => ({ ...prev, company_name: data.name, contact_email: data.email || '' }));
          }
        });
    }
  }, [orgSlug, companySlug]);

  const tierToDb = (name) => {
    const n = name.toLowerCase();
    if (n.includes('enterprise') || n.includes('premier') || n.includes('sponsor')) return 'enterprise';
    if (n.includes('pro') || n.includes('member')) return 'pro';
    return 'basic';
  };

  const handleComplete = async () => {
    if (!supabase) { setError('Supabase not configured. Run migrations first.'); return; }
    if (!form.company_name.trim()) { setError('Company name is required.'); return; }

    setLoading(true);
    setError('');
    try {
      if (company) {
        const { error: updateErr } = await supabase
          .from('directory_companies')
          .update({ membership_tier: tierToDb(tierName) })
          .eq('id', company.id);
        if (updateErr) throw updateErr;
      }
      setDone(true);
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: V.bg, color: V.text }}>
        <SourcingNav active="directory" tenantSlug={tenantSlug} tenantName={tenant?.nav_label || tenant?.name} features={tenant?.features} brandColor={tenant?.brand_color} />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: V.accentDim, border: `2px solid ${V.accentBrd}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 20px', color: V.accent,
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: V.syne, color: V.heading, margin: '0 0 12px' }}>
            Membership Confirmed
          </h2>
          <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, maxWidth: 380, margin: '0 auto 8px', lineHeight: 1.6 }}>
            <strong style={{ color: V.text }}>{tierName}</strong> plan activated for <strong style={{ color: V.text }}>{form.company_name}</strong>.
          </p>
          <p style={{ fontSize: 13, color: V.dim, fontFamily: V.space, maxWidth: 380, margin: '0 auto 28px', lineHeight: 1.5 }}>
            Your membership tier has been updated. Ben from the AOM team will follow up within 24 hours to collect payment and confirm access.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {orgSlug && (
              <Link
                to={`${basePath}/org/${orgSlug}`}
                style={{
                  background: V.accent, color: '#fff', textDecoration: 'none',
                  borderRadius: 8, padding: '10px 20px', fontSize: 13,
                  fontWeight: 700, fontFamily: V.space,
                }}
              >
                Back to Organization
              </Link>
            )}
            <Link
              to={basePath}
              style={{
                background: 'transparent', color: V.muted, textDecoration: 'none',
                border: `1px solid ${V.border}`, borderRadius: 8, padding: '10px 20px',
                fontSize: 13, fontWeight: 600, fontFamily: V.space,
              }}
            >
              Browse Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: V.bg, color: V.text }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: ${V.dim}; }
        input:focus { border-color: ${V.accentBrd} !important; box-shadow: 0 0 0 2px ${V.accentDim}; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <SourcingNav active="directory" tenantSlug={tenantSlug} tenantName={tenant?.nav_label || tenant?.name} features={tenant?.features} brandColor={tenant?.brand_color} />

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 80px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, alignItems: 'start' }}>
        {/* Left: Form */}
        <div>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: V.accent, fontFamily: V.mono, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
              Membership
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: V.syne, color: V.heading, margin: '0 0 8px', lineHeight: 1.15 }}>
              Complete Membership
            </h1>
            <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, margin: 0, lineHeight: 1.6 }}>
              {org ? `Joining ${org.name}` : 'Membership enrollment'} — {tierName} plan.
            </p>
          </div>

          {/* Company info */}
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, padding: '20px 20px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              Company Information
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <InputField
                label="Company Name"
                required
                placeholder="Acme Semiconductor LLC"
                value={form.company_name}
                onChange={e => set('company_name', e.target.value)}
                V={V}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <InputField
                  label="Contact Name"
                  placeholder="Jane Smith"
                  value={form.contact_name}
                  onChange={e => set('contact_name', e.target.value)}
                  V={V}
                />
                <InputField
                  label="Contact Email"
                  type="email"
                  placeholder="jane@company.com"
                  value={form.contact_email}
                  onChange={e => set('contact_email', e.target.value)}
                  V={V}
                />
              </div>
            </div>
          </div>

          {/* Payment form (placeholder) */}
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, padding: '20px 20px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Payment Details
              </div>
              <div style={{
                background: V.accentDim, border: `1px solid ${V.accentBrd}`,
                color: V.accent, fontSize: 10, fontFamily: V.mono, fontWeight: 700,
                padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Secure
              </div>
            </div>

            <div style={{
              background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 7, padding: '12px 14px', marginBottom: 16,
              fontSize: 13, color: '#93C5FD', fontFamily: V.space, lineHeight: 1.5,
            }}>
              Payment is handled manually for now. Clicking "Complete Membership" will update your tier and Ben will follow up to collect payment within 24 hours. Stripe integration coming soon.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.5, pointerEvents: 'none' }}>
              <CardField label="Card Number" V={V}>
                <FakeInput placeholder="•••• •••• •••• ••••" mono V={V} />
              </CardField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <CardField label="Expiry" V={V}>
                  <FakeInput placeholder="MM / YY" mono V={V} />
                </CardField>
                <CardField label="CVC" V={V}>
                  <FakeInput placeholder="•••" V={V} />
                </CardField>
              </div>
            </div>
          </div>

          {!supabase && (
            <div style={{
              background: V.accentDim, border: `1px solid ${V.accentBrd}`,
              borderRadius: 7, padding: '12px 14px', marginBottom: 16,
              fontSize: 12, color: V.accent, fontFamily: V.space,
            }}>
              Supabase not configured. Run migrations to enable this.
            </div>
          )}

          {error && (
            <div style={{ color: '#EF4444', fontSize: 13, fontFamily: V.space, marginBottom: 16 }}>{error}</div>
          )}

          <button
            onClick={handleComplete}
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? `${V.accent}66` : V.accent,
              border: 'none', color: '#fff', borderRadius: 8, padding: '14px 0',
              fontSize: 15, fontWeight: 700, fontFamily: V.space,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', animation: 'spin 0.8s linear infinite' }} />
                Processing...
              </>
            ) : `Complete Membership — $${price.toLocaleString()}/yr`}
          </button>
        </div>

        {/* Right: Order summary */}
        <div style={{
          background: V.card, border: `1px solid ${V.border}`,
          borderRadius: 12, padding: '22px', position: 'sticky', top: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
            Order Summary
          </div>

          {org && (
            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${V.border}` }}>
              <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space, marginBottom: 4 }}>Organization</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.heading }}>{org.name}</div>
            </div>
          )}

          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${V.border}` }}>
            <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space, marginBottom: 4 }}>Plan</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.heading }}>{tierName}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 14, color: V.muted, fontFamily: V.space }}>Annual fee</span>
            <span style={{ fontSize: 22, fontWeight: 800, fontFamily: V.mono, color: V.heading }}>
              ${price.toLocaleString()}
            </span>
          </div>

          <div style={{
            background: V.accentDim, border: `1px solid ${V.accentBrd}`,
            borderRadius: 7, padding: '10px 12px',
            fontSize: 12, color: V.accent, fontFamily: V.space, lineHeight: 1.5,
          }}>
            No charge today. Ben will contact you to finalize payment.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SourcingCheckout() {
  return (
    <SourcingThemeProvider>
      <SourcingCheckoutInner />
    </SourcingThemeProvider>
  );
}
