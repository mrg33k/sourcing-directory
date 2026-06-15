// SourcingDiscoveryPostV2.jsx
// Discovery — community whitepaper submission form for Space OS.
// Modeled on SourcingArticlesPostV2.jsx, with one key difference: this form is
// GATED to signed-in community members (you must have an account to contribute).
// Submissions land as category='whitepaper', status='pending' for admin review.
//
// Field mapping onto the shared directory_listings table (no schema change):
//   organizer  -> author / publishing org
//   apply_url  -> direct link to the PDF / source document
//   excerpt / description -> abstract

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import SRWNavV2 from './srw/SRWNavV2.jsx';
import './srw/srw-v2.css';
import { V2ChipNav } from './V2ChipNav.jsx';

const BG     = '#06060A';
const TEXT   = '#F5EED7';
const MUTED  = 'rgba(245,238,215,0.55)';
const DIM    = 'rgba(245,238,215,0.3)';
const AMBER  = '#E8A23A';
const BORDER = 'rgba(245,238,215,0.10)';
const CARD   = 'rgba(245,238,215,0.04)';
const FONT   = "'Space Grotesk', sans-serif";
const MONO   = "'JetBrains Mono', monospace";

// directory_listings.company_id is NOT NULL, but whitepapers come from outside
// the directory. We anchor every submission to a hidden "house" company (created
// with status='pending', kept out of the live companies grid) and always show the
// real author via listing.organizer. Resolved by slug at submit time.
const LIBRARY_COMPANY_SLUG = 'space-os-discovery-library';

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

function lineInputStyle(extraStyle = {}) {
  return {
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${BORDER}`,
    color: TEXT,
    padding: '10px 0',
    fontSize: 15,
    fontFamily: FONT,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
    ...extraStyle,
  };
}

function InputField({ label, required, hint, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Label required={required}>{label}</Label>
      {hint && <Hint>{hint}</Hint>}
      <input
        {...props}
        style={lineInputStyle(props.style)}
        onFocus={e => { e.target.style.borderBottomColor = AMBER; }}
        onBlur={e  => { e.target.style.borderBottomColor = BORDER; }}
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
        style={lineInputStyle({ resize: 'vertical', minHeight: 120, ...props.style })}
        onFocus={e => { e.target.style.borderBottomColor = AMBER; }}
        onBlur={e  => { e.target.style.borderBottomColor = BORDER; }}
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

function Shell({ children }) {
  return (
    <div data-srw="v2" style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: FONT }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: ${DIM}; }
        select option { background: #111; color: ${TEXT}; }
        input[type="number"]::-webkit-inner-spin-button { filter: invert(0.4); }
      `}</style>
      <SRWNavV2 />
      {children}
    </div>
  );
}

export default function SourcingDiscoveryPostV2() {
  // ── Auth state — you must be signed in to contribute ───────────────────────
  const [session, setSession]   = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setSession(s);
    });
    return () => { mounted = false; subscription?.unsubscribe(); };
  }, []);

  const [tagsInput, setTagsInput]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [done, setDone]             = useState(false);

  const [form, setForm] = useState({
    title:            '',
    organizer:        '',
    document_url:     '',
    excerpt:          '',
    cover_image_url:  '',
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim())        { setError('Title is required.');                       return; }
    if (!form.organizer.trim())    { setError('Author or publishing organization is required.'); return; }
    if (!form.document_url.trim()) { setError('A link to the document (PDF) is required.');  return; }
    if (!form.excerpt.trim())      { setError('A short abstract is required.');              return; }
    if (!supabase) {
      setError('Database not configured. Contact the administrator.');
      return;
    }

    // Re-check the session at submit time — contributions require an account.
    const { data: { session: live } } = await supabase.auth.getSession();
    if (!live) { setError('Your session expired. Please sign in again to submit.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      // Resolve the house company that anchors whitepaper rows (FK requirement).
      const { data: lib } = await supabase
        .from('directory_companies').select('id').eq('slug', LIBRARY_COMPANY_SLUG).maybeSingle();
      if (!lib?.id) { setError('The library is not set up yet. Please try again later.'); setSubmitting(false); return; }

      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const payload = {
        company_id:       lib.id,
        title:            form.title.trim(),
        organizer:        form.organizer.trim(),       // author / publisher
        apply_url:        form.document_url.trim(),     // link to the PDF / source
        excerpt:          form.excerpt.trim(),
        description:      form.excerpt.trim(),
        cover_image_url:  form.cover_image_url.trim() || null,
        tags:             tags.length > 0 ? tags : null,
        vertical:         'space',
        category:         'whitepaper',
        status:           'pending',
      };

      const { error: insertErr } = await supabase
        .from('directory_listings')
        .insert(payload);

      if (insertErr) throw insertErr;
      setDone(true);
    } catch (err) {
      console.error('Whitepaper submit error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (authReady && !session) {
    return (
      <Shell>
        <V2ChipNav active="discovery" />
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14, fontFamily: FONT }}>
            Discovery
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: TEXT, lineHeight: 1.15, fontFamily: FONT }}>
            Sign in to contribute<span style={{ color: AMBER }}>.</span>
          </div>
          <div style={{ fontSize: 15, color: MUTED, marginTop: 14, lineHeight: 1.6, fontFamily: FONT }}>
            Submitting a whitepaper to the Space OS library is open to the community — you just need an account. Sign in or create one to share your research, then it will appear here once reviewed.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
            <Link to="/space-rising-v2/login" style={{
              background: AMBER, color: '#06060A', textDecoration: 'none',
              borderRadius: 6, padding: '12px 28px', fontWeight: 700, fontSize: 14, fontFamily: FONT,
            }}>
              Sign in / Create account
            </Link>
            <Link to="/space-rising-v2/discovery" style={{
              background: 'transparent', border: `1px solid ${BORDER}`,
              color: MUTED, borderRadius: 6, padding: '12px 28px',
              fontSize: 14, fontWeight: 600, fontFamily: FONT, textDecoration: 'none',
            }}>
              Browse whitepapers
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ fontSize: 48, color: AMBER, marginBottom: 20 }}>✓</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, marginBottom: 12, fontFamily: FONT }}>
            Whitepaper Submitted<span style={{ color: AMBER }}>.</span>
          </div>
          <div style={{ fontSize: 15, color: MUTED, marginBottom: 28, lineHeight: 1.6, maxWidth: 400, margin: '0 auto 28px', fontFamily: FONT }}>
            Thanks for contributing. Your whitepaper has been submitted for review and will appear in Discovery once an admin approves it.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/space-rising-v2/discovery" style={{
              background: AMBER, color: '#06060A', textDecoration: 'none',
              borderRadius: 6, padding: '12px 28px', fontWeight: 700, fontSize: 14, fontFamily: FONT,
            }}>
              View Discovery
            </Link>
            <button
              onClick={() => {
                setDone(false);
                setForm({ title: '', organizer: '', document_url: '', excerpt: '', cover_image_url: '' });
                setTagsInput('');
              }}
              style={{
                background: 'transparent', border: `1px solid ${BORDER}`,
                color: MUTED, borderRadius: 6, padding: '12px 28px',
                fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
              }}
            >
              Submit Another
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <Shell>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(232,162,58,0.06) 0%, transparent 100%)',
        borderBottom: `1px solid ${BORDER}`,
        padding: '48px 24px 32px',
      }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12, fontFamily: FONT }}>
            Discovery
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: TEXT, lineHeight: 1.1, fontFamily: FONT }}>
            Submit a Whitepaper<span style={{ color: AMBER }}>.</span>
          </div>
          <div style={{ fontSize: 15, color: MUTED, marginTop: 10, lineHeight: 1.6, fontFamily: FONT }}>
            Share research, technical reports, or industry analysis with the space community. Link the document and we'll add it to the library after a quick review.
          </div>
          <Link to="/space-rising-v2/discovery" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 13, color: MUTED, textDecoration: 'none', fontFamily: FONT }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Discovery
          </Link>
        </div>
      </div>

      <V2ChipNav active="discovery" />

      {/* Form */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 80px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

            {/* Document */}
            <div>
              <SectionHeader>Document</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <InputField
                  label="Whitepaper Title"
                  required
                  placeholder="e.g. The State of the Space Industry 2026"
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                />
                <InputField
                  label="Author / Publishing Organization"
                  required
                  hint="Who produced it — e.g. NASA, ESA, McKinsey, or the lead authors."
                  placeholder="e.g. World Economic Forum"
                  value={form.organizer}
                  onChange={e => set('organizer', e.target.value)}
                />
                <InputField
                  label="Document Link (PDF)"
                  required
                  hint="A public link to the PDF or the page where it can be downloaded."
                  placeholder="https://…"
                  type="url"
                  value={form.document_url}
                  onChange={e => set('document_url', e.target.value)}
                />
              </div>
            </div>

            {/* Summary */}
            <div>
              <SectionHeader>Summary</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <TextareaField
                  label="Abstract"
                  required
                  hint="A short 1–3 sentence summary of what the whitepaper covers."
                  placeholder="A brief description of the research and its findings…"
                  value={form.excerpt}
                  onChange={e => set('excerpt', e.target.value)}
                  rows={3}
                  style={{ minHeight: 90 }}
                />
              </div>
            </div>

            {/* Media & Metadata */}
            <div>
              <SectionHeader>Media &amp; Metadata</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <InputField
                  label="Cover Image URL"
                  hint="Optional. Direct link to a cover or thumbnail image."
                  placeholder="https://…"
                  type="url"
                  value={form.cover_image_url}
                  onChange={e => set('cover_image_url', e.target.value)}
                />
                <InputField
                  label="Tags"
                  hint="Comma-separated topics. e.g. Launch, Reusability, Policy"
                  placeholder="Space Economy, Policy, Earth Observation"
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 6, padding: '12px 16px', fontSize: 13,
                color: '#FCA5A5', fontFamily: FONT,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                background: AMBER,
                border: 'none',
                color: '#06060A',
                borderRadius: 6,
                padding: '14px',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: FONT,
                cursor: submitting ? 'not-allowed' : 'pointer',
                width: '100%',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>

          </div>
        </form>
      </div>
    </Shell>
  );
}
