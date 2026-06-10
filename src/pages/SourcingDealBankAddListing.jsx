// SourcingDealBankAddListing.jsx
// Deal Bank R7 (Round B, 2026-06-09) — Company form to add a deal bank listing.
// Route: /space-rising-v2/deal-bank/investments/add
// Gated to existing directory companies. Form submits to deal_bank_listings (status='pending').

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';

const ROUND_STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D', 'Series D+', 'Growth'];

function SourcingDealBankAddListingInner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);

  // Edit mode: ?edit=<listing_id> loads an existing listing for the signed-in
  // company owner to revise. Without it, this is the public "add" flow.
  const editId = searchParams.get('edit');
  const isEdit = !!editId;

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(searchParams.get('company_id') || '');
  const [companiesLoading, setCompaniesLoading] = useState(true);

  const [formData, setFormData] = useState({
    exec_summary: '',
    capital_sought: '',
    round_stage: '',
    revenue_y1: '',
    revenue_y2: '',
    revenue_y3: '',
    deck_url: '',
    leadership: [{ name: '', title: '', photo_url: '', bio: '', linkedin_url: '' }],
  });

  const [deckFile, setDeckFile] = useState(null);
  const [deckUploading, setDeckUploading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [prefilling, setPrefilling] = useState(isEdit);

  // Edit mode — pull the existing listing through the ownership-verified
  // endpoint (deal_bank_listings has no member self-read policy for non-public
  // rows, so we don't hit the table directly here).
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) { setError('Please sign in from your portal to edit this listing.'); setPrefilling(false); return; }
        // Need the company_id to authorize: read it from the listing row first
        // via the endpoint's get-by-listing path (company verified server-side).
        const { data: listingRow } = await supabase
          .from('deal_bank_listings').select('company_id').eq('id', editId).maybeSingle();
        const companyId = listingRow?.company_id || searchParams.get('company_id');
        if (!companyId) { setError('Could not find this listing.'); setPrefilling(false); return; }
        const resp = await fetch('/api/sourcing/deal-bank-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'get', company_id: companyId, listing_id: editId }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) { setError(data.error || 'Could not load this listing.'); setPrefilling(false); return; }
        const l = data.listing;
        if (cancelled || !l) { if (!cancelled) { setError('Listing not found.'); setPrefilling(false); } return; }
        setSelectedCompanyId(l.company_id || '');
        setFormData({
          exec_summary: l.exec_summary || '',
          capital_sought: l.capital_sought || '',
          round_stage: l.round_stage || '',
          revenue_y1: l.revenue_y1 != null ? String(l.revenue_y1) : '',
          revenue_y2: l.revenue_y2 != null ? String(l.revenue_y2) : '',
          revenue_y3: l.revenue_y3 != null ? String(l.revenue_y3) : '',
          deck_url: l.deck_url || '',
          leadership: Array.isArray(l.leadership) && l.leadership.length > 0
            ? l.leadership.map((m) => ({ name: m.name || '', title: m.title || '', photo_url: m.photo_url || '', bio: m.bio || '', linkedin_url: m.linkedin_url || '' }))
            : [{ name: '', title: '', photo_url: '', bio: '', linkedin_url: '' }],
        });
        setPrefilling(false);
      } catch (err) {
        if (!cancelled) { setError(err.message || 'Could not load this listing.'); setPrefilling(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, editId, searchParams]);

  // Fetch available companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('directory_companies')
          .select('id, name, vertical, state')
          .order('name', { ascending: true });

        if (error) throw error;
        setCompanies(data || []);
      } catch (err) {
        console.error('Error fetching companies:', err);
        setCompanies([]);
      } finally {
        setCompaniesLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLeadershipChange = (index, field, value) => {
    const newLeadership = [...formData.leadership];
    newLeadership[index] = { ...newLeadership[index], [field]: value };
    setFormData((prev) => ({
      ...prev,
      leadership: newLeadership,
    }));
  };

  const addLeadershipRow = () => {
    setFormData((prev) => ({
      ...prev,
      leadership: [...prev.leadership, { name: '', title: '', photo_url: '', bio: '', linkedin_url: '' }],
    }));
  };

  const removeLeadershipRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      leadership: prev.leadership.filter((_, i) => i !== index),
    }));
  };

  const uploadDeckFile = async () => {
    if (!deckFile) return null; // No file to upload

    setDeckUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError('Please sign in to upload a deck.'); return null; }

      // Upload file to the disk-based endpoint
      const formData = new FormData();
      formData.append('file', deckFile);
      formData.append('company_id', selectedCompanyId);

      const uploadRes = await fetch('/api/sourcing/upload-deal-bank-deck', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        setError(err.error || 'Failed to upload deck');
        setDeckUploading(false);
        return null;
      }

      const { deckUrl } = await uploadRes.json();
      setDeckUploading(false);
      return deckUrl;
    } catch (err) {
      setError(`Deck upload failed: ${err.message}`);
      setDeckUploading(false);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedCompanyId) {
      setError('Please select a company');
      return;
    }

    setLoading(true);

    try {
      // Upload deck file if selected
      let deckUrl = formData.deck_url;
      if (deckFile) {
        deckUrl = await uploadDeckFile();
        if (!deckUrl) {
          setLoading(false);
          return;
        }
      }

      // Filter out empty leadership entries
      const leadership = formData.leadership.filter((l) => l.name || l.title);

      // ── Edit mode: update through the ownership-verified endpoint ──
      if (isEdit) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) { setError('Your session expired. Please sign in again.'); setLoading(false); return; }
        const resp = await fetch('/api/sourcing/deal-bank-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'update',
            company_id: selectedCompanyId,
            listing_id: editId,
            fields: {
              exec_summary: formData.exec_summary,
              capital_sought: formData.capital_sought,
              round_stage: formData.round_stage,
              revenue_y1: formData.revenue_y1,
              revenue_y2: formData.revenue_y2,
              revenue_y3: formData.revenue_y3,
              deck_url: formData.deck_url,
              leadership: leadership.length > 0 ? leadership : null,
            },
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) { setError(data.error || 'Could not save your changes.'); setLoading(false); return; }
        setSubmitted(true);
        setLoading(false);
        setTimeout(() => navigate(`/${TENANT_SLUG_V2}/portal`), 2000);
        return;
      }

      const { data, error: insertError } = await supabase
        .from('deal_bank_listings')
        .insert([
          {
            company_id: selectedCompanyId,
            exec_summary: formData.exec_summary.trim() || null,
            capital_sought: formData.capital_sought.trim() || null,
            round_stage: formData.round_stage || null,
            revenue_y1: formData.revenue_y1 ? parseFloat(formData.revenue_y1) : null,
            revenue_y2: formData.revenue_y2 ? parseFloat(formData.revenue_y2) : null,
            revenue_y3: formData.revenue_y3 ? parseFloat(formData.revenue_y3) : null,
            deck_url: formData.deck_url.trim() || null,
            leadership: leadership.length > 0 ? leadership : null,
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

      // Redirect to listings after 2 seconds
      setTimeout(() => {
        navigate(`/${TENANT_SLUG_V2}/deal-bank?tab=investments`);
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
            {isEdit ? 'Saved.' : 'Thank you.'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, marginBottom: 24 }}>
            {isEdit
              ? 'Your changes have been submitted. Updated listings go back to review before they appear publicly again.'
              : "Your listing has been submitted for review. You'll hear from us within 1–2 business days."}
          </div>
          <Link
            to={isEdit ? `/${TENANT_SLUG_V2}/portal` : `/${TENANT_SLUG_V2}/deal-bank?tab=investments`}
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
            {isEdit ? 'BACK TO PORTAL' : 'BACK TO INVESTMENTS'}
          </Link>
        </div>
      </div>
    );
  }

  if (prefilling) {
    return (
      <div
        data-tenant={TENANT_SLUG_V2}
        style={{
          minHeight: '100dvh', background: 'transparent', color: '#E8E4DA',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 13,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(232,228,218,0.5)',
        }}
      >
        Loading your listing…
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
          <div className="browse-title">{isEdit ? 'Edit your listing.' : 'Add your listing.'}</div>
          <div className="browse-sub">
            {isEdit
              ? 'Update your details. Saved changes go back to review before they appear publicly again.'
              : "Tell investors about your company and the round you're raising."}
          </div>
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
          label="Company"
          type="select"
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          required
          disabled={companiesLoading || isEdit}
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
        />

        <FormField
          label="Executive Summary"
          name="exec_summary"
          type="textarea"
          value={formData.exec_summary}
          onChange={handleChange}
          placeholder="Describe your company, what you're building, and why..."
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <FormField
            label="Capital Seeking"
            name="capital_sought"
            type="text"
            value={formData.capital_sought}
            onChange={handleChange}
            placeholder="e.g. $2M or $2,000,000"
          />
          <FormField
            label="Round Stage"
            name="round_stage"
            type="select"
            value={formData.round_stage}
            onChange={handleChange}
            options={ROUND_STAGES.map((s) => ({ value: s, label: s }))}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx2)' }}>
            Revenue Projections (Optional)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            <FormField
              label="Year 1"
              name="revenue_y1"
              type="number"
              value={formData.revenue_y1}
              onChange={handleChange}
              placeholder="e.g. 500000"
            />
            <FormField
              label="Year 2"
              name="revenue_y2"
              type="number"
              value={formData.revenue_y2}
              onChange={handleChange}
              placeholder="e.g. 1500000"
            />
            <FormField
              label="Year 3"
              name="revenue_y3"
              type="number"
              value={formData.revenue_y3}
              onChange={handleChange}
              placeholder="e.g. 4000000"
            />
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx2)' }}>
            Pitch Deck (Optional)
          </label>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setDeckFile(e.target.files?.[0] || null)}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1px solid var(--bd)',
                borderRadius: 6,
                background: 'var(--s1)',
                color: 'var(--tx)',
                fontSize: 13,
              }}
            />
            {deckFile && (
              <button
                type="button"
                onClick={() => setDeckFile(null)}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 6,
                  color: '#ef4444',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                Clear
              </button>
            )}
          </div>
          {deckFile && (
            <div style={{ fontSize: 12, color: 'var(--tx2)', marginBottom: 8 }}>
              Selected: {deckFile.name}
            </div>
          )}
          {formData.deck_url && !deckFile && (
            <div style={{ fontSize: 12, color: 'var(--tx2)', marginBottom: 8 }}>
              Current deck: <a href={formData.deck_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>view</a>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx2)' }}>
            Leadership Team (Optional)
          </label>
          {formData.leadership.map((leader, idx) => (
            <div key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(232,228,218,0.10)' }}>
              <FormField
                label={`Name ${idx + 1}`}
                type="text"
                value={leader.name}
                onChange={(e) => handleLeadershipChange(idx, 'name', e.target.value)}
                placeholder="e.g. Jane Doe"
              />
              <FormField
                label={`Title ${idx + 1}`}
                type="text"
                value={leader.title}
                onChange={(e) => handleLeadershipChange(idx, 'title', e.target.value)}
                placeholder="e.g. CEO"
              />
              <FormField
                label={`Bio ${idx + 1}`}
                type="textarea"
                value={leader.bio}
                onChange={(e) => handleLeadershipChange(idx, 'bio', e.target.value)}
                placeholder="Brief background..."
              />
              <FormField
                label={`LinkedIn ${idx + 1}`}
                type="url"
                value={leader.linkedin_url}
                onChange={(e) => handleLeadershipChange(idx, 'linkedin_url', e.target.value)}
                placeholder="https://linkedin.com/in/..."
              />
              {formData.leadership.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLeadershipRow(idx)}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: 4,
                    color: '#ef4444',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addLeadershipRow}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--cyan)',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--cyan)',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            + Add Team Member
          </button>
        </div>

        <div style={{ marginTop: 32 }}>
          <button
            type="submit"
            disabled={loading || companiesLoading}
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
              textTransform: 'uppercase',
            }}
          >
            {loading ? 'SAVING...' : (isEdit ? 'SAVE CHANGES' : 'SUBMIT FOR REVIEW')}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({ label, name, type = 'text', options, ...props }) {
  if (type === 'textarea') {
    return (
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx2)' }}>
          {label}
        </label>
        <textarea
          name={name}
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

  if (type === 'select') {
    return (
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx2)' }}>
          {label}
        </label>
        <select
          name={name}
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
            cursor: 'pointer',
          }}
        >
          <option value="">Select {label.toLowerCase()}</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
        name={name}
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

export default function SourcingDealBankAddListing() {
  return (
    <SourcingThemeProvider>
      <SourcingDealBankAddListingInner />
    </SourcingThemeProvider>
  );
}
