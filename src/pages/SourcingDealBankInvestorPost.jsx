// SourcingDealBankInvestorPost.jsx
// Deal Bank Round A (2026-06-09) — public "List your firm" submission form.
// Route: /space-rising-v2/deal-bank/list-your-firm.
// Posts to /api/sourcing/deal-bank-submit-investor (service role, forces
// status='pending'). Firm appears in the admin queue; once approved it shows
// on the Investors lane + profile. contact_email_internal is collected here
// but NEVER rendered publicly — admins use it to route founder intros.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { V2ChipNav } from './V2ChipNav.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';

const TEXT   = '#E8E4DA';
const MUTED  = 'rgba(232,228,218,0.55)';
const DIM    = 'rgba(232,228,218,0.30)';
const AMBER  = '#E8A23A';
const BORDER = 'rgba(232,228,218,0.12)';
const CARD   = 'rgba(18,20,28,0.50)';
const FONT   = '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif';

const DEAL_TYPE_OPTIONS = [
  'VC', 'PE', 'Family Office', 'Angel Group', 'Corporate VC', 'Accelerator',
];

function Label({ children, required }) {
  return (
    <label style={{ fontSize: 12, color: MUTED, fontFamily: FONT, fontWeight: 600 }}>
      {children}{required && <span style={{ color: AMBER }}> *</span>}
    </label>
  );
}

function Hint({ children }) {
  return <div style={{ fontSize: 11, color: DIM, fontFamily: FONT }}>{children}</div>;
}

const lineInput = {
  background: 'transparent', border: 'none', borderBottom: `1px solid ${BORDER}`,
  color: TEXT, padding: '10px 0', fontSize: 15, fontFamily: FONT, width: '100%',
  outline: 'none', boxSizing: 'border-box',
};

function InputField({ label, required, hint, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Label required={required}>{label}</Label>
      {hint && <Hint>{hint}</Hint>}
      <input
        {...props}
        style={lineInput}
        onFocus={(e) => { e.target.style.borderBottomColor = AMBER; }}
        onBlur={(e) => { e.target.style.borderBottomColor = BORDER; }}
      />
    </div>
  );
}

function TextareaField({ label, required, hint, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Label required={required}>{label}</Label>
      {hint && <Hint>{hint}</Hint>}
      <textarea
        {...props}
        style={{ ...lineInput, resize: 'vertical', minHeight: 110 }}
        onFocus={(e) => { e.target.style.borderBottomColor = AMBER; }}
        onBlur={(e) => { e.target.style.borderBottomColor = BORDER; }}
      />
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 8, marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: FONT }}>
        {children}
      </div>
    </div>
  );
}

const PAGE_VARS = {
  '--bg': 'transparent', '--tx': '#E8E4DA',
  '--tx2': 'rgba(232,228,218,0.60)', '--tx3': 'rgba(232,228,218,0.25)',
  '--s1': 'rgba(11,11,13,0.72)', '--s2': 'rgba(11,11,13,0.82)', '--s3': 'rgba(11,11,13,0.92)',
  '--bd': 'rgba(232,228,218,0.10)', '--bd2': 'rgba(232,228,218,0.16)',
  '--cyan': '#E8A23A', '--cyan-dim': 'rgba(232,162,58,0.10)', '--cyan-brd': 'rgba(232,162,58,0.32)',
};

export default function SourcingDealBankInvestorPost() {
  const [form, setForm] = useState({
    firm_name: '', website: '', criteria: '',
    check_size_min: '', check_size_max: '',
    deals_last_18mo: '', linkedin_url: '', contact_email_internal: '',
  });
  const [dealTypes, setDealTypes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggleDealType = (t) =>
    setDealTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firm_name.trim()) { setError('Firm name is required.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/sourcing/deal-bank-submit-investor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, deal_types: dealTypes }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Submit failed (${r.status})`);
      setDone(true);
    } catch (err) {
      console.error('Investor submit error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div data-tenant={TENANT_SLUG_V2} style={{ minHeight: '100dvh', background: 'var(--bg)', color: TEXT, fontFamily: FONT, ...PAGE_VARS }}>
        <div style={{ textAlign: 'center', padding: '96px 24px' }}>
          <div style={{ fontSize: 48, color: AMBER, marginBottom: 20 }}>✓</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, marginBottom: 12 }}>
            Firm submitted<span style={{ color: AMBER }}>.</span>
          </div>
          <div style={{ fontSize: 15, color: MUTED, marginBottom: 28, lineHeight: 1.6, maxWidth: 480, margin: '0 auto 28px' }}>
            Thanks — your firm is in review. Once the Space Rising team approves it, your profile goes live on the Investors lane. Your contact email stays internal; founders reach you through Space Rising.
          </div>
          <Link to="/space-rising-v2/deal-bank" style={{ background: AMBER, color: '#0B0B0D', textDecoration: 'none', borderRadius: 6, padding: '12px 28px', fontWeight: 700, fontSize: 14 }}>
            Back to Deal Bank
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div data-tenant={TENANT_SLUG_V2} style={{ minHeight: '100dvh', background: 'var(--bg)', color: TEXT, fontFamily: FONT, position: 'relative', ...PAGE_VARS }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: ${DIM}; }
      `}</style>

      <div className="browse-hero" style={{ '--page-hero-bg': "url('/v2-assets/earth.png')" }}>
        <div className="browse-hero-bg" />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <div className="browse-hero-toprow">
            <Link to="/space-rising-v2/deal-bank" className="browse-back" style={{ textDecoration: 'none' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
              Deal Bank
            </Link>
            <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
          </div>
          <div className="browse-title">List your firm.</div>
          <div className="browse-sub">
            Free investor profile. Get discovered by Space Rising companies raising — founders reach you through us, so your inbox stays clean.
          </div>
        </div>
      </div>

      <V2ChipNav active="deal-bank" />

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 88px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

            <div>
              <SectionHeader>Firm</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <InputField label="Firm name" required value={form.firm_name} onChange={set('firm_name')} placeholder="Orbit Ventures" />
                <InputField label="Website" type="url" value={form.website} onChange={set('website')} placeholder="https://orbitventures.com" />
                <InputField label="LinkedIn" type="url" value={form.linkedin_url} onChange={set('linkedin_url')} placeholder="https://linkedin.com/company/..." />
              </div>
            </div>

            <div>
              <SectionHeader>Investment focus</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <TextareaField label="Criteria / thesis" value={form.criteria} onChange={set('criteria')} placeholder="What you back: sectors, stages, and what makes a space company a fit for you." />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Label>Deal types</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {DEAL_TYPE_OPTIONS.map((t) => {
                      const on = dealTypes.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleDealType(t)}
                          style={{
                            font: 'inherit', fontSize: 13, cursor: 'pointer',
                            padding: '7px 14px', borderRadius: 999,
                            border: `1px solid ${on ? 'rgba(232,162,58,0.55)' : BORDER}`,
                            background: on ? 'rgba(232,162,58,0.14)' : 'transparent',
                            color: on ? AMBER : MUTED,
                          }}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <InputField label="Check size — min ($)" type="text" inputMode="numeric" value={form.check_size_min} onChange={set('check_size_min')} placeholder="250000" />
                  <InputField label="Check size — max ($)" type="text" inputMode="numeric" value={form.check_size_max} onChange={set('check_size_max')} placeholder="2000000" />
                </div>
                <InputField label="Deals in last 18 months" type="text" inputMode="numeric" value={form.deals_last_18mo} onChange={set('deals_last_18mo')} placeholder="6" />
              </div>
            </div>

            <div>
              <SectionHeader>Contact (internal only)</SectionHeader>
              <InputField
                label="Contact email"
                type="email"
                value={form.contact_email_internal}
                onChange={set('contact_email_internal')}
                placeholder="deals@orbitventures.com"
                hint="Never shown publicly. Space Rising uses it to route founder intros to you."
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '12px 16px', fontSize: 13, color: '#FCA5A5' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                background: AMBER, border: 'none', color: '#0B0B0D', borderRadius: 6,
                padding: '14px', fontSize: 15, fontWeight: 700, fontFamily: FONT,
                cursor: submitting ? 'not-allowed' : 'pointer', width: '100%',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Submitting...' : 'Submit firm for review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
