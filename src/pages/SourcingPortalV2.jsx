import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import '../space-rising-theme-v2.css';

// ─── V2 design tokens (hardcoded — no getTokens, no SourcingThemeProvider) ───
const V2 = {
  bg: '#06060A',
  card: '#0D0D12',
  card2: '#111115',
  border: 'rgba(255,255,255,0.08)',
  text: '#E8E4DA',
  heading: '#E8E4DA',
  muted: 'rgba(232,228,218,0.55)',
  dim: 'rgba(232,228,218,0.35)',
  accent: '#E8A23A',
  accentDim: 'rgba(232,162,58,0.08)',
  accentBrd: 'rgba(232,162,58,0.25)',
  space: 'Space Grotesk, sans-serif',
  mono: 'JetBrains Mono, ui-monospace, monospace',
  red: '#EF4444',
  green: '#86EFAC',
};

// ─── Tenant + route constants ─────────────────────────────────────────────────
const TENANT_DB_LOOKUP_SLUG = 'space-rising';
const BASE_PATH_V2 = '/spaceos';

// ─── Listing metadata ─────────────────────────────────────────────────────────
const LISTING_CATEGORIES = [
  { key: 'equipment', label: 'Equipment' },
  { key: 'job',       label: 'Job' },
  { key: 'event',     label: 'Event' },
];

const CONDITIONS = [
  { key: 'new',         label: 'New' },
  { key: 'used',        label: 'Used' },
  { key: 'refurbished', label: 'Refurbished' },
];

const statusColors = {
  active:  { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.4)',   text: '#86EFAC' },
  pending: { bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.4)',   text: '#FDE68A' },
  sold:    { bg: 'rgba(138,132,124,0.1)', border: 'rgba(138,132,124,0.4)', text: '#8A847C' },
  expired: { bg: 'rgba(138,132,124,0.1)', border: 'rgba(138,132,124,0.4)', text: '#8A847C' },
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function SourcingPortalV2() {
  const navigate = useNavigate();

  // ── Auth + tenant state ────────────────────────────────────────────────────
  const [authUser, setAuthUser] = useState(null);
  const [tenant, setTenant] = useState(null);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [member, setMember] = useState(null);
  const [company, setCompany] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [showNewListing, setShowNewListing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // ── Edit forms ─────────────────────────────────────────────────────────────
  const [editForm, setEditForm] = useState({
    name: '', description: '', website: '', phone: '', email: '', logo_url: '',
  });

  const [listingForm, setListingForm] = useState({
    category: 'equipment', title: '', description: '', price: '', condition: 'new',
    contact_email: '', location: '', salary_range: '', employment_type: 'Full Time',
  });
  const [listingStatus, setListingStatus] = useState('');

  // ── Deal Bank listing state ────────────────────────────────────────────────
  const [dealBankListing, setDealBankListing] = useState(null);
  const [dealBankEditing, setDealBankEditing] = useState(false);
  const [dealBankSaving, setDealBankSaving] = useState(false);
  const [dealBankError, setDealBankError] = useState('');
  const [dealBankDeckFile, setDealBankDeckFile] = useState(null);
  const [dealBankDeckUploading, setDealBankDeckUploading] = useState(false);
  const [dealBankEditForm, setDealBankEditForm] = useState({
    exec_summary: '',
    capital_sought: '',
    round_stage: '',
    revenue_y1: '',
    revenue_y2: '',
    revenue_y3: '',
    deck_url: '',
    leadership: [],
  });

  // ── Tenant fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('directory_tenants')
      .select('*')
      .eq('slug', TENANT_DB_LOOKUP_SLUG)
      .single()
      .then(({ data }) => { if (data) setTenant(data); });
  }, []);

  // ── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate(`${BASE_PATH_V2}/login`, { replace: true });
        return;
      }
      setAuthUser(session.user);
    });
  }, [navigate]);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!supabase || !authUser || !tenant) return;
    setLoading(true);
    try {
      // Get member record
      const { data: memberData, error: memberErr } = await supabase
        .from('directory_members')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .eq('tenant_id', tenant.id)
        .single();

      let resolvedMember = memberData;

      // Auto-provision member if auth succeeded but no record exists
      if (memberErr || !memberData) {
        const { data: companies } = await supabase
          .from('directory_companies')
          .select('id')
          .eq('email', authUser.email)
          .eq('tenant_id', tenant.id)
          .limit(1);

        const { data: newMember, error: provisionErr } = await supabase
          .from('directory_members')
          .insert({
            tenant_id: tenant.id,
            auth_user_id: authUser.id,
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
            company_id: companies?.[0]?.id || null,
            status: 'approved',
            role: 'member',
          })
          .select()
          .single();

        if (provisionErr) {
          setError('Could not set up your account. Please contact support.');
          setLoading(false);
          return;
        }
        resolvedMember = newMember;
      }

      // Admins belong in the admin panel, not the member portal. The login-form
      // redirect only fires on a fresh credential submit; an admin who arrives
      // here with an existing session (or via a bookmark / directory account
      // link) would otherwise be stranded on the member view. (2026-06-16)
      if (resolvedMember.role === 'admin') {
        navigate('/admin', { replace: true });
        return;
      }

      setMember(resolvedMember);

      // Get company
      if (resolvedMember.company_id) {
        const { data: companyData } = await supabase
          .from('directory_companies')
          .select('*')
          .eq('id', resolvedMember.company_id)
          .single();
        if (companyData) {
          setCompany(companyData);
          setEditForm({
            name: companyData.name || '',
            description: companyData.description || '',
            website: companyData.website || '',
            phone: companyData.phone || '',
            email: companyData.email || '',
            logo_url: companyData.logo_url || '',
          });
        }

        // Get listings for this company
        const { data: listingsData } = await supabase
          .from('directory_listings')
          .select('*')
          .eq('company_id', resolvedMember.company_id)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });
        setListings(listingsData || []);

        // Get deal bank listing for this company
        const { data: dealBankData } = await supabase
          .from('deal_bank_listings')
          .select('*')
          .eq('company_id', resolvedMember.company_id)
          .maybeSingle();
        if (dealBankData) {
          setDealBankListing(dealBankData);
          setDealBankEditForm({
            exec_summary: dealBankData.exec_summary || '',
            capital_sought: dealBankData.capital_sought || '',
            round_stage: dealBankData.round_stage || '',
            revenue_y1: dealBankData.revenue_y1 || '',
            revenue_y2: dealBankData.revenue_y2 || '',
            revenue_y3: dealBankData.revenue_y3 || '',
            deck_url: dealBankData.deck_url || '',
            leadership: dealBankData.leadership || [],
          });
        }
      }
    } catch (err) {
      console.error('Portal V2 fetch error:', err);
      setError('Failed to load portal data.');
    } finally {
      setLoading(false);
    }
  }, [authUser, tenant, navigate]);

  useEffect(() => {
    if (authUser && tenant) fetchData();
  }, [authUser, tenant, fetchData]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!supabase || !company) return;
    setSaving(true);
    setError('');
    try {
      // Save through the server endpoint, not a direct table update. The member's
      // browser client is subject to RLS, and directory_companies has no member
      // self-update policy (only admins), so a direct update silently affects 0
      // rows — the portal flashed "Saved" but nothing persisted. The endpoint
      // verifies ownership server-side and writes via the service role.
      // (space-rising directory fix 2026-06-05)
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');

      const resp = await fetch('/api/sourcing/update-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          company_id: company.id,
          fields: {
            name: editForm.name,
            description: editForm.description,
            website: editForm.website,
            phone: editForm.phone,
            email: editForm.email,
            logo_url: editForm.logo_url,
          },
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to save your changes.');

      setCompany({ ...company, ...(data.company || editForm) });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    if (!supabase || !company || !tenant) return;
    if (!listingForm.title.trim()) { setListingStatus('Title is required.'); return; }

    setListingStatus('Saving...');
    try {
      const payload = {
        company_id: company.id,
        tenant_id: tenant.id,
        title: listingForm.title.trim(),
        description: listingForm.description.trim() || null,
        category: listingForm.category,
        status: 'active',
        contact_email: listingForm.contact_email.trim() || company.email || null,
      };

      if (listingForm.category === 'equipment') {
        payload.price = listingForm.price ? parseFloat(listingForm.price) : null;
        payload.condition = listingForm.condition;
      }
      if (listingForm.category === 'job') {
        payload.salary_range = listingForm.salary_range.trim() || null;
        payload.employment_type = listingForm.employment_type || null;
        payload.location = listingForm.location.trim() || null;
      }

      const { error: insertErr } = await supabase
        .from('directory_listings')
        .insert(payload);

      if (insertErr) throw insertErr;

      setListingStatus('');
      setListingForm({
        category: 'equipment', title: '', description: '', price: '', condition: 'new',
        contact_email: '', location: '', salary_range: '', employment_type: 'Full Time',
      });
      setShowNewListing(false);
      await fetchData();
    } catch (err) {
      setListingStatus('Error: ' + err.message);
    }
  };

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    navigate(`${BASE_PATH_V2}/login`);
  };

  const uploadDealBankDeckFile = async () => {
    if (!dealBankDeckFile) return null;

    setDealBankDeckUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setDealBankError('Please sign in to upload a deck.');
        return null;
      }

      const formData = new FormData();
      formData.append('file', dealBankDeckFile);
      formData.append('company_id', company.id);

      const uploadRes = await fetch('/api/sourcing/upload-deal-bank-deck', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        setDealBankError(err.error || 'Failed to upload deck');
        setDealBankDeckUploading(false);
        return null;
      }

      const { deckUrl } = await uploadRes.json();
      setDealBankDeckUploading(false);
      setDealBankDeckFile(null);
      return deckUrl;
    } catch (err) {
      setDealBankError(`Deck upload failed: ${err.message}`);
      setDealBankDeckUploading(false);
      return null;
    }
  };

  const handleSaveDealBankListing = async () => {
    if (!supabase || !company) return;
    setDealBankSaving(true);
    setDealBankError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');

      // Upload deck file if selected
      let deckUrl = dealBankEditForm.deck_url;
      if (dealBankDeckFile) {
        deckUrl = await uploadDealBankDeckFile();
        if (!deckUrl) {
          setDealBankSaving(false);
          return;
        }
      }

      const resp = await fetch('/api/sourcing/update-deal-bank-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          company_id: company.id,
          fields: {
            exec_summary: dealBankEditForm.exec_summary.trim() || null,
            capital_sought: dealBankEditForm.capital_sought ? parseFloat(dealBankEditForm.capital_sought) : null,
            round_stage: dealBankEditForm.round_stage || null,
            revenue_y1: dealBankEditForm.revenue_y1 ? parseFloat(dealBankEditForm.revenue_y1) : null,
            revenue_y2: dealBankEditForm.revenue_y2 ? parseFloat(dealBankEditForm.revenue_y2) : null,
            revenue_y3: dealBankEditForm.revenue_y3 ? parseFloat(dealBankEditForm.revenue_y3) : null,
            deck_url: deckUrl || null,
            leadership: dealBankEditForm.leadership || [],
          },
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to save your listing.');

      setDealBankListing(data.listing || { ...dealBankListing, ...dealBankEditForm, deck_url: deckUrl });
      setDealBankEditing(false);
    } catch (err) {
      setDealBankError(err.message);
    } finally {
      setDealBankSaving(false);
    }
  };

  const handleWithdrawDealBankListing = async () => {
    if (!supabase || !dealBankListing) return;
    if (!confirm('Are you sure you want to withdraw your listing? You can re-submit it later.')) return;

    setDealBankSaving(true);
    setDealBankError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');

      const resp = await fetch('/api/sourcing/withdraw-deal-bank-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listing_id: dealBankListing.id }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to withdraw your listing.');

      setDealBankListing(data.listing || { ...dealBankListing, status: 'withdrawn' });
    } catch (err) {
      setDealBankError(err.message);
    } finally {
      setDealBankSaving(false);
    }
  };

  // ── DealBankListingCard component ─────────────────────────────────────────
  const DealBankListingCard = () => {
    if (!dealBankListing && !dealBankEditing) {
      // No listing — show prompt to create one
      return (
        <div style={{
          background: V2.card, border: `1px solid ${V2.border}`,
          borderRadius: 12, padding: '24px 20px', marginBottom: 32,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, fontFamily: V2.space,
            color: V2.heading, marginBottom: 12,
          }}>
            My Deal Bank Listing
          </div>
          <p style={{
            fontSize: 13, color: V2.muted, fontFamily: V2.space,
            lineHeight: 1.6, margin: 0,
          }}>
            You haven't posted a Deal Bank listing yet. To list your company as raising capital,{' '}
            <Link
              to={`${BASE_PATH_V2}/deal-bank/investments/add`}
              style={{ color: V2.accent, fontWeight: 600 }}
            >
              create a new listing
            </Link>
            .
          </p>
        </div>
      );
    }

    const statusMap = {
      pending: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.4)', text: '#FDE68A', label: 'Pending Approval' },
      approved: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.4)', text: '#86EFAC', label: 'Approved' },
      rejected: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.4)', text: '#FCA5A5', label: 'Rejected' },
      withdrawn: { bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.4)', text: '#D1D5DB', label: 'Withdrawn' },
    };
    const status = dealBankListing?.status || 'pending';
    const colors = statusMap[status] || statusMap.pending;

    if (dealBankEditing) {
      return (
        <div style={{
          background: V2.card, border: `1px solid ${V2.accentBrd}`,
          borderRadius: 12, padding: '24px 20px', marginBottom: 32,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, fontFamily: V2.space,
            color: V2.heading, marginBottom: 16,
          }}>
            Edit Your Deal Bank Listing
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveDealBankListing();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {/* Executive Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                Executive Summary
              </label>
              <textarea
                value={dealBankEditForm.exec_summary}
                onChange={(e) => setDealBankEditForm(f => ({ ...f, exec_summary: e.target.value }))}
                placeholder="Brief overview of your business, market, and why you're raising."
                style={{
                  background: V2.card2, border: `1px solid ${V2.border}`,
                  color: V2.text, borderRadius: 7, padding: '10px 12px',
                  fontSize: 13, fontFamily: V2.space, width: '100%',
                  minHeight: 80, resize: 'vertical',
                }}
              />
            </div>

            {/* Capital Sought & Round Stage (2-col) */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                  Capital Sought ($M)
                </label>
                <input
                  type="number"
                  value={dealBankEditForm.capital_sought}
                  onChange={(e) => setDealBankEditForm(f => ({ ...f, capital_sought: e.target.value }))}
                  placeholder="e.g. 5"
                  step="0.1"
                  style={{
                    background: V2.card2, border: `1px solid ${V2.border}`,
                    color: V2.text, borderRadius: 7, padding: '10px 12px',
                    fontSize: 13, fontFamily: V2.space, width: '100%',
                  }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                  Round Stage
                </label>
                <select
                  value={dealBankEditForm.round_stage}
                  onChange={(e) => setDealBankEditForm(f => ({ ...f, round_stage: e.target.value }))}
                  style={{
                    background: V2.card2, border: `1px solid ${V2.border}`,
                    color: V2.text, borderRadius: 7, padding: '10px 12px',
                    fontSize: 13, fontFamily: V2.space, width: '100%',
                  }}
                >
                  <option value="">Select round</option>
                  <option value="Pre-Seed">Pre-Seed</option>
                  <option value="Seed">Seed</option>
                  <option value="Series A">Series A</option>
                  <option value="Series B">Series B</option>
                  <option value="Series C">Series C</option>
                  <option value="Series D">Series D</option>
                  <option value="Series D+">Series D+</option>
                  <option value="Growth">Growth</option>
                </select>
              </div>
            </div>

            {/* Revenue Projections Y1-3 (3-col) */}
            <div style={{ display: 'flex', gap: 12 }}>
              {['revenue_y1', 'revenue_y2', 'revenue_y3'].map((field, i) => (
                <div key={field} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                    Year {i + 1} Revenue ($M)
                  </label>
                  <input
                    type="number"
                    value={dealBankEditForm[field]}
                    onChange={(e) => setDealBankEditForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder="0"
                    step="0.1"
                    style={{
                      background: V2.card2, border: `1px solid ${V2.border}`,
                      color: V2.text, borderRadius: 7, padding: '10px 12px',
                      fontSize: 13, fontFamily: V2.space, width: '100%',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Pitch Deck */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                Pitch Deck
              </label>

              {/* File upload or current deck display */}
              {dealBankDeckFile ? (
                <div style={{
                  background: V2.card2, border: `1px solid ${V2.accentBrd}`,
                  color: V2.text, borderRadius: 7, padding: '10px 12px',
                  fontSize: 13, fontFamily: V2.space, width: '100%',
                }}>
                  <div style={{ marginBottom: 8 }}>
                    Selected: {dealBankDeckFile.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDealBankDeckFile(null)}
                    style={{
                      background: 'transparent', color: V2.red, border: 'none',
                      fontSize: 11, cursor: 'pointer', fontFamily: V2.space,
                    }}
                  >
                    Clear selection
                  </button>
                </div>
              ) : (
                <>
                  {dealBankEditForm.deck_url && (
                    <div style={{
                      background: V2.card2, border: `1px solid ${V2.border}`,
                      color: V2.muted, borderRadius: 7, padding: '10px 12px',
                      fontSize: 12, fontFamily: V2.space, width: '100%',
                      marginBottom: 8,
                    }}>
                      <div style={{ marginBottom: 6 }}>Current deck:</div>
                      <a
                        href={dealBankEditForm.deck_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: V2.accent, textDecoration: 'underline', fontSize: 11 }}
                      >
                        Download
                      </a>
                      <button
                        type="button"
                        onClick={() => setDealBankEditForm(f => ({ ...f, deck_url: '' }))}
                        style={{
                          background: 'transparent', color: V2.red, border: 'none',
                          fontSize: 11, cursor: 'pointer', marginLeft: 12, fontFamily: V2.space,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <label
                    style={{
                      display: 'block', background: V2.card2, border: `2px dashed ${V2.border}`,
                      color: V2.muted, borderRadius: 7, padding: '16px 12px',
                      fontSize: 12, fontFamily: V2.space, width: '100%',
                      textAlign: 'center', cursor: 'pointer',
                    }}
                  >
                    Click to upload deck (PDF, DOCX, etc.)
                    <input
                      type="file"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setDealBankDeckFile(e.target.files[0]);
                        }
                      }}
                      accept=".pdf,.docx,.doc,.pptx,.ppt"
                      style={{ display: 'none' }}
                    />
                  </label>
                </>
              )}

              {/* Or paste a URL */}
              {!dealBankDeckFile && (
                <>
                  <div style={{ fontSize: 11, color: V2.muted, textAlign: 'center' }}>or paste a URL</div>
                  <input
                    type="url"
                    value={dealBankEditForm.deck_url}
                    onChange={(e) => setDealBankEditForm(f => ({ ...f, deck_url: e.target.value }))}
                    placeholder="https://example.com/deck.pdf"
                    style={{
                      background: V2.card2, border: `1px solid ${V2.border}`,
                      color: V2.text, borderRadius: 7, padding: '10px 12px',
                      fontSize: 13, fontFamily: V2.space, width: '100%',
                    }}
                  />
                </>
              )}
            </div>

            {/* Error message */}
            {dealBankError && (
              <div style={{ fontSize: 12, color: V2.red, fontFamily: V2.space }}>
                {dealBankError}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                type="submit"
                disabled={dealBankSaving}
                style={{
                  background: V2.accent, color: '#000', border: 'none',
                  borderRadius: 7, padding: '10px 16px', fontSize: 12,
                  fontWeight: 700, fontFamily: V2.space, cursor: 'pointer',
                  opacity: dealBankSaving ? 0.6 : 1,
                }}
              >
                {dealBankSaving ? 'Saving...' : 'Save Listing'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDealBankEditing(false);
                  setDealBankError('');
                }}
                style={{
                  background: 'transparent', color: V2.accent, border: `1px solid ${V2.accentBrd}`,
                  borderRadius: 7, padding: '10px 16px', fontSize: 12,
                  fontWeight: 700, fontFamily: V2.space, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      );
    }

    // Display view (not editing)
    return (
      <div style={{
        background: V2.card, border: `1px solid ${V2.border}`,
        borderRadius: 12, padding: '24px 20px', marginBottom: 32,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, fontFamily: V2.space,
            color: V2.heading,
          }}>
            My Deal Bank Listing
          </div>
          <div style={{
            background: colors.bg, border: `1px solid ${colors.border}`,
            color: colors.text, borderRadius: 5, padding: '4px 10px',
            fontSize: 11, fontWeight: 600, fontFamily: V2.space,
          }}>
            {colors.label}
          </div>
        </div>

        {/* Capital Grid */}
        {dealBankListing?.capital_sought && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 1, background: V2.card2, border: `1px solid ${V2.border}`,
            borderRadius: 8, overflow: 'hidden', marginBottom: 16,
          }}>
            {[
              { label: 'Capital Sought', value: `$${dealBankListing.capital_sought}M` },
              { label: 'Round', value: dealBankListing.round_stage || '—' },
              { label: 'Year 1 Revenue', value: dealBankListing.revenue_y1 ? `$${dealBankListing.revenue_y1}M` : '—' },
              { label: 'Year 2 Revenue', value: dealBankListing.revenue_y2 ? `$${dealBankListing.revenue_y2}M` : '—' },
              { label: 'Year 3 Revenue', value: dealBankListing.revenue_y3 ? `$${dealBankListing.revenue_y3}M` : '—' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '12px', borderRight: i < 4 ? `1px solid ${V2.border}` : 'none' }}>
                <div style={{
                  fontSize: 10, color: V2.muted, fontFamily: V2.mono,
                  textTransform: 'uppercase', marginBottom: 4,
                }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 13, color: V2.text, fontFamily: V2.space, fontWeight: 600 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {dealBankListing?.exec_summary && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 11, color: V2.muted, fontFamily: V2.mono,
              textTransform: 'uppercase', marginBottom: 6,
            }}>
              Executive Summary
            </div>
            <p style={{
              fontSize: 13, color: V2.text, fontFamily: V2.space,
              lineHeight: 1.6, margin: 0,
            }}>
              {dealBankListing.exec_summary}
            </p>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => {
              setDealBankEditing(true);
              setDealBankError('');
            }}
            style={{
              background: V2.accentDim, color: V2.accent, border: `1px solid ${V2.accentBrd}`,
              borderRadius: 7, padding: '8px 14px', fontSize: 12,
              fontWeight: 600, fontFamily: V2.space, cursor: 'pointer',
            }}
          >
            Edit
          </button>
          <button
            onClick={handleWithdrawDealBankListing}
            disabled={dealBankSaving}
            style={{
              background: 'transparent', color: V2.red, border: `1px solid rgba(239,68,68,0.3)`,
              borderRadius: 7, padding: '8px 14px', fontSize: 12,
              fontWeight: 600, fontFamily: V2.space, cursor: 'pointer',
              opacity: dealBankSaving ? 0.6 : 1,
            }}
          >
            {dealBankSaving ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </div>
      </div>
    );
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: V2.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: `2px solid ${V2.border}`,
          borderTop: `2px solid ${V2.accent}`,
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: V2.bg }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        a { color: inherit; text-decoration: none; }
        input::placeholder, textarea::placeholder { color: ${V2.dim}; }
        input:focus, textarea:focus, select:focus {
          border-color: ${V2.accent} !important;
          box-shadow: 0 0 0 2px ${V2.accentDim};
          outline: none;
        }
      `}</style>

      {/* ── Portal topbar ── */}
      <div style={{
        borderBottom: `1px solid ${V2.border}`,
        background: V2.card,
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <Link
          to="/srw-v2"
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: V2.accent,
            fontFamily: V2.space,
          }}
        >
          SPACE RISING
        </Link>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            to={BASE_PATH_V2}
            style={{
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: V2.muted,
              fontFamily: V2.mono,
            }}
          >
            ← Directory
          </Link>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: `1px solid ${V2.accentBrd}`,
              color: V2.accent,
              borderRadius: 6,
              padding: '6px 14px',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: V2.mono,
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 11,
            fontFamily: V2.mono,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: V2.accent,
            marginBottom: 8,
          }}>
            MEMBER PORTAL
          </div>
          <h1 style={{
            fontSize: 28,
            fontFamily: V2.space,
            fontWeight: 700,
            color: V2.heading,
            margin: '0 0 32px',
          }}>
            {member?.full_name
              ? `Welcome, ${member.full_name.split(' ')[0]}`
              : 'Your Portal'}
            <span style={{ color: V2.accent }}>.</span>
          </h1>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
          <Link
            to={`${BASE_PATH_V2}/articles/post`}
            style={{
              background: V2.accentDim,
              border: `1px solid ${V2.accentBrd}`,
              color: V2.accent,
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: V2.space,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            + Post an Article
          </Link>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            color: V2.red,
            fontSize: 13,
            fontFamily: V2.space,
            padding: '12px 14px',
            background: 'rgba(239,68,68,0.08)',
            borderRadius: 8,
            border: '1px solid rgba(239,68,68,0.2)',
            marginBottom: 24,
          }}>
            {error}
          </div>
        )}

        {/* ── Company Profile Card ── */}
        {company && (
          <div style={{
            background: V2.card,
            border: `1px solid ${V2.border}`,
            borderRadius: 12,
            padding: '28px 24px',
            marginBottom: 32,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, fontFamily: V2.mono,
                color: V2.accent, letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                Company Profile
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {saved && (
                  <span style={{ fontSize: 12, color: V2.green, fontFamily: V2.space, fontWeight: 600 }}>
                    Saved
                  </span>
                )}
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    style={{
                      background: V2.accentDim,
                      border: `1px solid ${V2.accentBrd}`,
                      color: V2.accent,
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: V2.space,
                      cursor: 'pointer',
                    }}
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditForm({
                          name: company.name || '',
                          description: company.description || '',
                          website: company.website || '',
                          phone: company.phone || '',
                          email: company.email || '',
                          logo_url: company.logo_url || '',
                        });
                      }}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${V2.border}`,
                        color: V2.muted,
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: V2.space,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      style={{
                        background: saving ? `${V2.accent}60` : V2.accent,
                        border: 'none',
                        color: '#fff',
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: V2.space,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {saving ? (
                        <>
                          <div style={{
                            width: 12, height: 12, borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTop: '2px solid #fff',
                            animation: 'spin 0.8s linear infinite',
                          }} />
                          Saving...
                        </>
                      ) : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                    Company Name
                  </label>
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    style={{
                      background: V2.card2, border: `1px solid ${V2.border}`,
                      color: V2.text, borderRadius: 7, padding: '10px 12px',
                      fontSize: 14, fontFamily: V2.space, width: '100%',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                    Description
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    style={{
                      background: V2.card2, border: `1px solid ${V2.border}`,
                      color: V2.text, borderRadius: 7, padding: '10px 12px',
                      fontSize: 14, fontFamily: V2.space, width: '100%',
                      resize: 'vertical', minHeight: 80,
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                      Website
                    </label>
                    <input
                      value={editForm.website}
                      onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                      placeholder="https://company.com"
                      style={{
                        background: V2.card2, border: `1px solid ${V2.border}`,
                        color: V2.text, borderRadius: 7, padding: '10px 12px',
                        fontSize: 14, fontFamily: V2.space, width: '100%',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                      Phone
                    </label>
                    <input
                      value={editForm.phone}
                      onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="(480) 555-0100"
                      style={{
                        background: V2.card2, border: `1px solid ${V2.border}`,
                        color: V2.text, borderRadius: 7, padding: '10px 12px',
                        fontSize: 14, fontFamily: V2.space, width: '100%',
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                      Email
                    </label>
                    <input
                      value={editForm.email}
                      onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="info@company.com"
                      style={{
                        background: V2.card2, border: `1px solid ${V2.border}`,
                        color: V2.text, borderRadius: 7, padding: '10px 12px',
                        fontSize: 14, fontFamily: V2.space, width: '100%',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                      Logo URL
                    </label>
                    <input
                      value={editForm.logo_url}
                      onChange={e => setEditForm(f => ({ ...f, logo_url: e.target.value }))}
                      placeholder="https://..."
                      style={{
                        background: V2.card2, border: `1px solid ${V2.border}`,
                        color: V2.text, borderRadius: 7, padding: '10px 12px',
                        fontSize: 14, fontFamily: V2.space, width: '100%',
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  {company.logo_url && (
                    <img
                      src={company.logo_url}
                      alt=""
                      style={{
                        width: 48, height: 48, borderRadius: 8,
                        objectFit: 'cover', border: `1px solid ${V2.border}`,
                      }}
                    />
                  )}
                  <div>
                    <div style={{
                      fontSize: 18, fontWeight: 700, fontFamily: V2.space, color: V2.heading,
                    }}>
                      {company.name}
                    </div>
                    <div style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space }}>
                      {[company.city, company.state].filter(Boolean).join(', ')}
                      {company.vertical && ` · ${company.vertical}`}
                    </div>
                  </div>
                </div>
                {company.description && (
                  <p style={{
                    fontSize: 13, color: V2.muted, fontFamily: V2.space,
                    lineHeight: 1.6, margin: '0 0 12px',
                  }}>
                    {company.description}
                  </p>
                )}
                <div style={{
                  display: 'flex', gap: 16, flexWrap: 'wrap',
                  fontSize: 12, fontFamily: V2.mono, color: V2.dim,
                }}>
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: V2.accent }}
                    >
                      {company.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {company.phone && <span>{company.phone}</span>}
                  {company.email && <span>{company.email}</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Deal Bank Listing Card ── */}
        {company && <DealBankListingCard />}

        {/* No company linked — info state */}
        {!company && !loading && (
          <div style={{
            background: V2.card, border: `1px solid ${V2.border}`,
            borderRadius: 12, padding: '28px 24px', marginBottom: 32,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: V2.muted, fontFamily: V2.space }}>
              No company profile linked to your account. Contact Space Rising to get set up.
            </div>
          </div>
        )}

        {/* ── Listings Section ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: 16,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, fontFamily: V2.mono,
              color: V2.accent, letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Your Listings ({listings.length})
            </div>
            <button
              onClick={() => setShowNewListing(s => !s)}
              style={{
                background: showNewListing ? V2.accentDim : V2.accent,
                border: showNewListing ? `1px solid ${V2.accentBrd}` : 'none',
                color: showNewListing ? V2.accent : '#fff',
                borderRadius: 7,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: V2.space,
                cursor: 'pointer',
              }}
            >
              {showNewListing ? 'Cancel' : '+ Post New Listing'}
            </button>
          </div>

          {/* New Listing Form */}
          {showNewListing && (
            <div style={{
              background: V2.card, border: `1px solid ${V2.accentBrd}`,
              borderRadius: 10, padding: '24px 20px', marginBottom: 16,
            }}>
              <div style={{
                fontSize: 14, fontWeight: 700, fontFamily: V2.space,
                color: V2.heading, marginBottom: 16,
              }}>
                New Listing
              </div>
              <form onSubmit={handleCreateListing} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Category selector */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {LISTING_CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setListingForm(f => ({ ...f, category: cat.key }))}
                      style={{
                        background: listingForm.category === cat.key ? V2.accentDim : 'transparent',
                        border: `1px solid ${listingForm.category === cat.key ? V2.accentBrd : V2.border}`,
                        color: listingForm.category === cat.key ? V2.accent : V2.muted,
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: V2.space,
                        cursor: 'pointer',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                    Title <span style={{ color: V2.accent }}>*</span>
                  </label>
                  <input
                    value={listingForm.title}
                    onChange={e => setListingForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={listingForm.category === 'job' ? 'e.g. Process Engineer' : 'e.g. CMP System'}
                    style={{
                      background: V2.card2, border: `1px solid ${V2.border}`,
                      color: V2.text, borderRadius: 7, padding: '10px 12px',
                      fontSize: 14, fontFamily: V2.space, width: '100%',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                    Description
                  </label>
                  <textarea
                    value={listingForm.description}
                    onChange={e => setListingForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    placeholder="Details about the listing..."
                    style={{
                      background: V2.card2, border: `1px solid ${V2.border}`,
                      color: V2.text, borderRadius: 7, padding: '10px 12px',
                      fontSize: 14, fontFamily: V2.space, width: '100%',
                      resize: 'vertical', minHeight: 80,
                    }}
                  />
                </div>

                {/* Equipment-specific fields */}
                {listingForm.category === 'equipment' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                        Price ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={listingForm.price}
                        onChange={e => setListingForm(f => ({ ...f, price: e.target.value }))}
                        placeholder="25000"
                        style={{
                          background: V2.card2, border: `1px solid ${V2.border}`,
                          color: V2.text, borderRadius: 7, padding: '10px 12px',
                          fontSize: 14, fontFamily: V2.space, width: '100%',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                        Condition
                      </label>
                      <select
                        value={listingForm.condition}
                        onChange={e => setListingForm(f => ({ ...f, condition: e.target.value }))}
                        style={{
                          background: V2.card2, border: `1px solid ${V2.border}`,
                          color: V2.text, borderRadius: 7, padding: '10px 12px',
                          fontSize: 14, fontFamily: V2.space, width: '100%',
                          appearance: 'none', cursor: 'pointer',
                        }}
                      >
                        {CONDITIONS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Job-specific fields */}
                {listingForm.category === 'job' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                        Salary Range
                      </label>
                      <input
                        value={listingForm.salary_range}
                        onChange={e => setListingForm(f => ({ ...f, salary_range: e.target.value }))}
                        placeholder="$80-120K"
                        style={{
                          background: V2.card2, border: `1px solid ${V2.border}`,
                          color: V2.text, borderRadius: 7, padding: '10px 12px',
                          fontSize: 14, fontFamily: V2.space, width: '100%',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                        Type
                      </label>
                      <select
                        value={listingForm.employment_type}
                        onChange={e => setListingForm(f => ({ ...f, employment_type: e.target.value }))}
                        style={{
                          background: V2.card2, border: `1px solid ${V2.border}`,
                          color: V2.text, borderRadius: 7, padding: '10px 12px',
                          fontSize: 14, fontFamily: V2.space, width: '100%',
                          appearance: 'none', cursor: 'pointer',
                        }}
                      >
                        <option value="Full Time">Full Time</option>
                        <option value="Part Time">Part Time</option>
                        <option value="Contract">Contract</option>
                        <option value="Internship">Internship</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                        Location
                      </label>
                      <input
                        value={listingForm.location}
                        onChange={e => setListingForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="Phoenix, AZ"
                        style={{
                          background: V2.card2, border: `1px solid ${V2.border}`,
                          color: V2.text, borderRadius: 7, padding: '10px 12px',
                          fontSize: 14, fontFamily: V2.space, width: '100%',
                        }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, color: V2.muted, fontFamily: V2.space, fontWeight: 600 }}>
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={listingForm.contact_email}
                    onChange={e => setListingForm(f => ({ ...f, contact_email: e.target.value }))}
                    placeholder={company?.email || 'contact@company.com'}
                    style={{
                      background: V2.card2, border: `1px solid ${V2.border}`,
                      color: V2.text, borderRadius: 7, padding: '10px 12px',
                      fontSize: 14, fontFamily: V2.space, width: '100%',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    type="submit"
                    style={{
                      background: V2.accent,
                      border: 'none',
                      color: '#fff',
                      borderRadius: 7,
                      padding: '10px 22px',
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: V2.space,
                      cursor: 'pointer',
                    }}
                  >
                    Post Listing
                  </button>
                  {listingStatus && (
                    <span style={{
                      fontSize: 12,
                      fontFamily: V2.space,
                      color: listingStatus.startsWith('Error') ? V2.red : V2.accent,
                    }}>
                      {listingStatus}
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Listings table */}
          {listings.length > 0 ? (
            <div style={{
              background: V2.card,
              border: `1px solid ${V2.border}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                gap: 12, padding: '8px 16px', background: V2.card2,
              }}>
                {['Listing', 'Category', 'Status', 'Posted'].map(h => (
                  <div key={h} style={{
                    fontSize: 10, fontWeight: 700, fontFamily: V2.mono,
                    color: V2.dim, textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>
                    {h}
                  </div>
                ))}
              </div>
              {listings.map(listing => {
                const sc = statusColors[listing.status] || statusColors.pending;
                return (
                  <div
                    key={listing.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                      gap: 12, padding: '12px 16px', alignItems: 'center',
                      borderBottom: `1px solid ${V2.border}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600, fontFamily: V2.space,
                        color: V2.text, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {listing.title}
                      </div>
                      {listing.price && (
                        <div style={{ fontSize: 11, color: V2.accent, fontFamily: V2.mono, fontWeight: 700 }}>
                          ${listing.price.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: V2.muted, fontFamily: V2.mono, textTransform: 'capitalize' }}>
                      {listing.category}
                    </div>
                    <div>
                      <span style={{
                        background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text,
                        fontSize: 10, fontWeight: 700, fontFamily: V2.mono,
                        padding: '2px 7px', borderRadius: 3,
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                      }}>
                        {listing.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: V2.dim, fontFamily: V2.mono }}>
                      {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              background: V2.card, border: `1px solid ${V2.border}`,
              borderRadius: 10, padding: '40px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>&#9881;&#65039;</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V2.space, color: V2.text, marginBottom: 6 }}>
                No listings yet
              </div>
              <div style={{ fontSize: 13, color: V2.muted, fontFamily: V2.space }}>
                Post your first listing to get started.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Deal Bank Listing Card (founder edit/withdraw, deal-bank Round C) ─────────
// Shows the signed-in company's Deal Bank listing with its review status and
// self-serve Edit / Withdraw / Reactivate controls. Reads + writes go through
