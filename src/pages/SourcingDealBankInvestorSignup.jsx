// SourcingDealBankInvestorSignup.jsx
// Deal Bank R6 (Round A, 2026-06-09) — Public investor firm signup form.
// Route: /space-rising-v2/deal-bank/investors/signup
// No auth gate. Submits to deal_bank_investors (status='pending'),
// appears in admin queue for approval.

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';

function SourcingDealBankInvestorSignupInner() {
  const navigate = useNavigate();
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);

  const [formData, setFormData] = useState({
    firm_name: '',
    website: '',
    criteria: '',
    check_size_min: '',
    check_size_max: '',
    deal_types: [],
    deals_last_18mo: '',
    linkedin_url: '',
    contact_email_internal: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const DEAL_TYPE_OPTIONS = [
    'VC',
    'PE',
    'Family fund',
    'Angel group',
    'Other',
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        deal_types: checked
          ? [...prev.deal_types, value]
          : prev.deal_types.filter((dt) => dt !== value),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: insertError } = await supabase
        .from('deal_bank_investors')
        .insert([
          {
            firm_name: formData.firm_name.trim(),
            website: formData.website.trim() || null,
            criteria: formData.criteria.trim() || null,
            check_size_min: formData.check_size_min ? parseFloat(formData.check_size_min) : null,
            check_size_max: formData.check_size_max ? parseFloat(formData.check_size_max) : null,
            deal_types: formData.deal_types.length > 0 ? formData.deal_types : null,
            deals_last_18mo: formData.deals_last_18mo ? parseInt(formData.deals_last_18mo, 10) : null,
            linkedin_url: formData.linkedin_url.trim() || null,
            contact_email_internal: formData.contact_email_internal.trim(),
            status: 'pending',
          },
        ]);

      if (insertError) {
        setError(`Submission failed: ${insertError.message}`);
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setLoading(false);

      // Redirect to success message after 2 seconds
      setTimeout(() => {
        navigate(`/${TENANT_SLUG_V2}/deal-bank?tab=investors`);
      }, 2000);
    } catch (err) {
      setError(`Unexpected error: ${err.message}`);
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div
        data-tenant={TENANT_SLUG_V2}
        style={{
          minHeight: '100dvh',
          background: 'var(--bg)',
          color: 'var(--tx)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
          '--bg': 'transparent',
          '--tx': '#E8E4DA',
          '--tx2': 'rgba(232,228,218,0.60)',
          '--tx3': 'rgba(232,228,218,0.25)',
          '--s1': 'rgba(11,11,13,0.72)',
          '--s2': 'rgba(11,11,13,0.82)',
          '--s3': 'rgba(11,11,13,0.92)',
          '--bd': 'rgba(232,228,218,0.10)',
          '--bd2': 'rgba(232,228,218,0.16)',
          '--cyan': '#E8A23A',
          '--cyan-dim': 'rgba(232,162,58,0.10)',
          '--cyan-brd': 'rgba(232,162,58,0.32)',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
            Thank you.
          </div>
          <div style={{ fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, marginBottom: 24 }}>
            Your firm listing has been submitted for review. You'll hear from us within 1–2 business days.
          </div>
          <Link
            to={`/${TENANT_SLUG_V2}/deal-bank?tab=investors`}
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              border: '1px solid var(--cyan)',
              borderRadius: 6,
              color: 'var(--cyan)',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            BACK TO INVESTORS
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      data-tenant={TENANT_SLUG_V2}
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--tx)',
        position: 'relative',
        fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
        '--bg': 'transparent',
        '--tx': '#E8E4DA',
        '--tx2': 'rgba(232,228,218,0.60)',
        '--tx3': 'rgba(232,228,218,0.25)',
        '--s1': 'rgba(11,11,13,0.72)',
        '--s2': 'rgba(11,11,13,0.82)',
        '--s3': 'rgba(11,11,13,0.92)',
        '--bd': 'rgba(232,228,218,0.10)',
        '--bd2': 'rgba(232,228,218,0.16)',
        '--cyan': '#E8A23A',
        '--cyan-dim': 'rgba(232,162,58,0.10)',
        '--cyan-brd': 'rgba(232,162,58,0.32)',
      }}
    >
      <div className="browse-hero" style={{ '--page-hero-bg': "url('/v2-assets/earth.png')" }}>
        <div className="browse-hero-bg" />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <div className="browse-hero-toprow">
            <Link to={`/${TENANT_SLUG_V2}/deal-bank`} className="browse-back" style={{ textDecoration: 'none' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" />
              </svg>
              Deal Bank
            </Link>
            <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
          </div>
          <div className="browse-title">List your firm.</div>
          <div className="browse-sub">Join Space Rising's investor network.</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        {error && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 6,
              color: '#ef4444',
              fontSize: 12,
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        <FormField
          label="Firm Name"
          name="firm_name"
          type="text"
          value={formData.firm_name}
          onChange={handleChange}
          required
          placeholder="e.g. Orbit Ventures"
        />

        <FormField
          label="Website"
          name="website"
          type="url"
          value={formData.website}
          onChange={handleChange}
          placeholder="https://example.com"
        />

        <FormField
          label="Investment Thesis / What You Look For"
          name="criteria"
          type="textarea"
          value={formData.criteria}
          onChange={handleChange}
          placeholder="Describe your investment focus and criteria..."
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <FormField
            label="Check Size Min (USD)"
            name="check_size_min"
            type="number"
            value={formData.check_size_min}
            onChange={handleChange}
            placeholder="e.g. 250000"
          />
          <FormField
            label="Check Size Max (USD)"
            name="check_size_max"
            type="number"
            value={formData.check_size_max}
            onChange={handleChange}
            placeholder="e.g. 2000000"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx2)' }}>
            Deal Types
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {DEAL_TYPE_OPTIONS.map((option) => (
              <label
                key={option}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  value={option}
                  checked={formData.deal_types.includes(option)}
                  onChange={handleChange}
                  style={{ cursor: 'pointer' }}
                />
                {option}
              </label>
            ))}
          </div>
        </div>

        <FormField
          label="Deals Last 18 Months"
          name="deals_last_18mo"
          type="number"
          value={formData.deals_last_18mo}
          onChange={handleChange}
          placeholder="e.g. 5"
        />

        <FormField
          label="LinkedIn URL"
          name="linkedin_url"
          type="url"
          value={formData.linkedin_url}
          onChange={handleChange}
          placeholder="https://linkedin.com/company/..."
        />

        <FormField
          label="Contact Email (Internal — not publicly visible)"
          name="contact_email_internal"
          type="email"
          value={formData.contact_email_internal}
          onChange={handleChange}
          required
          placeholder="contact@example.com"
        />

        <div style={{ marginTop: 32 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 24px',
              background: loading ? 'rgba(232,162,58,0.3)' : 'var(--cyan)',
              color: loading ? 'var(--tx3)' : '#000',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.05em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'SUBMITTING...' : 'SUBMIT FOR REVIEW'}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({ label, type = 'text', ...props }) {
  if (type === 'textarea') {
    return (
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx2)' }}>
          {label}
        </label>
        <textarea
          {...props}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid var(--bd)',
            borderRadius: 6,
            background: 'var(--s1)',
            color: 'var(--tx)',
            fontSize: 13,
            fontFamily: 'inherit',
            minHeight: 100,
            resize: 'vertical',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx2)' }}>
        {label}
      </label>
      <input
        type={type}
        {...props}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid var(--bd)',
          borderRadius: 6,
          background: 'var(--s1)',
          color: 'var(--tx)',
          fontSize: 13,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

export default function SourcingDealBankInvestorSignup() {
  return (
    <SourcingThemeProvider>
      <SourcingDealBankInvestorSignupInner />
    </SourcingThemeProvider>
  );
}
