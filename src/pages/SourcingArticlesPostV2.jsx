// SourcingArticlesPostV2.jsx
// nat-geo-uplift — V2 post form for Articles.
// Supabase logic preserved exactly from SourcingArticlesPost.jsx.
// Visual system: dark BG (#06060A), amber accent (#E8A23A), line-style inputs.
// GATED to signed-in community members, mirroring SourcingDiscoveryPostV2 — you
// must have an account to contribute. The Shell offsets the fixed 155px nav so
// the hero never renders underneath it.

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

const VERTICALS = [
  { key: 'semiconductor', label: 'Semiconductor' },
  { key: 'space',         label: 'Space & Aerospace' },
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

function SelectField({ label, required, hint, value, onChange, options, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Label required={required}>{label}</Label>
      {hint && <Hint>{hint}</Hint>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 6,
          color: value ? TEXT : DIM,
          padding: '10px 12px',
          fontSize: 14,
          fontFamily: FONT,
          width: '100%',
          outline: 'none',
          cursor: 'pointer',
          boxSizing: 'border-box',
          appearance: 'none',
        }}
      >
        {children || (
          <>
            <option value="">Select…</option>
            {options.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </>
        )}
      </select>
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

// Shell — owns the page chrome AND the fixed-nav offset. SRWNavV2 is
// position:fixed at 155px tall; without the paddingTop the hero would render
// underneath it (the bug this round fixes). Everything else nests inside.
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
      <div style={{ paddingTop: 'var(--srw-nav-h, 155px)' }}>
        {children}
      </div>
    </div>
  );
}

export default function SourcingArticlesPostV2() {
  // ── Auth state — you must be signed in to contribute ───────────────────────
  const [session, setSession]     = useState(null);
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

  const [companies, setCompanies]   = useState([]);
  const [tagsInput, setTagsInput]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [done, setDone]             = useState(false);

  const [form, setForm] = useState({
    company_id:       '',
    vertical:         '',
    title:            '',
    excerpt:          '',
    body:             '',
    cover_image_url:  '',
    read_time_min:    '',
  });

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('directory_companies')
      .select('id, name, vertical')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => setCompanies(data || []));
  }, []);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim())    { setError('Title is required.');                     return; }
    if (!form.body.trim())     { setError('Article body is required.');               return; }
    if (!form.vertical)        { setError('Please select an industry vertical.');     return; }
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
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const payload = {
        company_id:       form.company_id || null,
        title:            form.title.trim(),
        description:      form.excerpt.trim() || null,
        body:             form.body.trim(),
        excerpt:          form.excerpt.trim() || null,
        cover_image_url:  form.cover_image_url.trim() || null,
        read_time_min:    form.read_time_min ? parseInt(form.read_time_min) : null,
        tags:             tags.length > 0 ? tags : null,
        vertical:         form.vertical,
        category:         'article',
        status:           'pending',
      };

      const { error: insertErr } = await supabase
        .from('directory_listings')
        .insert(payload);

      if (insertErr) throw insertErr;
      setDone(true);
    } catch (err) {
      console.error('Article post error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── While we resolve the session, show a neutral shell (never flash the form
  // to a signed-out visitor before the gate appears). ─────────────────────────
  if (!authReady) {
    return (
      <Shell>
        <V2ChipNav active="articles" />
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '120px 24px', textAlign: 'center', color: MUTED, fontFamily: FONT, fontSize: 14 }}>
          Loading…
        </div>
      </Shell>
    );
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <Shell>
        <V2ChipNav active="articles" />
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14, fontFamily: FONT }}>
            Industry Articles
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: TEXT, lineHeight: 1.15, fontFamily: FONT }}>
            Sign in to post an article<span style={{ color: AMBER }}>.</span>
          </div>
          <div style={{ fontSize: 15, color: MUTED, marginTop: 14, lineHeight: 1.6, fontFamily: FONT }}>
            Publishing to the Space OS articles feed is open to the community — you just need an account. Sign in or create one to share insights, company news, or technical content, and it will appear here once reviewed.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
            <Link to="/space-rising-v2/login" style={{
              background: AMBER, color: '#06060A', textDecoration: 'none',
              borderRadius: 6, padding: '12px 28px', fontWeight: 700, fontSize: 14, fontFamily: FONT,
            }}>
              Sign in / Create account
            </Link>
            <Link to="/space-rising-v2/articles" style={{
              background: 'transparent', border: `1px solid ${BORDER}`,
              color: MUTED, borderRadius: 6, padding: '12px 28px',
              fontSize: 14, fontWeight: 600, fontFamily: FONT, textDecoration: 'none',
            }}>
              Browse articles
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
            Article Submitted<span style={{ color: AMBER }}>.</span>
          </div>
          <div style={{ fontSize: 15, color: MUTED, marginBottom: 28, lineHeight: 1.6, maxWidth: 400, margin: '0 auto 28px', fontFamily: FONT }}>
            Your article has been submitted for review. It will appear on the articles page once an admin approves it.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/space-rising-v2/articles" style={{
              background: AMBER, color: '#06060A', textDecoration: 'none',
              borderRadius: 6, padding: '12px 28px', fontWeight: 700, fontSize: 14, fontFamily: FONT,
            }}>
              View Articles
            </Link>
            <button
              onClick={() => {
                setDone(false);
                setForm({ company_id: '', vertical: '', title: '', excerpt: '', body: '', cover_image_url: '', read_time_min: '' });
                setTagsInput('');
              }}
              style={{
                background: 'transparent', border: `1px solid ${BORDER}`,
                color: MUTED, borderRadius: 6, padding: '12px 28px',
                fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
              }}
            >
              Post Another
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
            Industry Articles
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: TEXT, lineHeight: 1.1, fontFamily: FONT }}>
            Post an Article<span style={{ color: AMBER }}>.</span>
          </div>
          <div style={{ fontSize: 15, color: MUTED, marginTop: 10, lineHeight: 1.6, fontFamily: FONT }}>
            Share insights, company news, or technical content with Arizona's advanced tech community.
          </div>
          <Link to="/space-rising-v2/articles" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 13, color: MUTED, textDecoration: 'none', fontFamily: FONT }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Articles
          </Link>
        </div>
      </div>

      <V2ChipNav active="articles" />

      {/* Form */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 80px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

            {/* Attribution */}
            <div>
              <SectionHeader>Attribution</SectionHeader>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Label>Author Company</Label>
                  <select
                    value={form.company_id}
                    onChange={e => {
                      const cid = e.target.value;
                      set('company_id', cid);
                      if (cid && !form.vertical) {
                        const comp = companies.find(c => c.id === cid);
                        if (comp) set('vertical', comp.vertical);
                      }
                    }}
                    style={{
                      background: CARD, border: `1px solid ${BORDER}`,
                      borderRadius: 6,
                      color: form.company_id ? TEXT : DIM,
                      padding: '10px 12px', fontSize: 14, fontFamily: FONT,
                      width: '100%', outline: 'none', cursor: 'pointer',
                      boxSizing: 'border-box', appearance: 'none',
                    }}
                  >
                    <option value="">Select company…</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <SelectField
                  label="Industry Vertical"
                  required
                  value={form.vertical}
                  onChange={v => set('vertical', v)}
                  options={VERTICALS}
                >
                  <option value="">Select…</option>
                  {VERTICALS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                </SelectField>
              </div>
            </div>

            {/* Article Content */}
            <div>
              <SectionHeader>Article Content</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <InputField
                  label="Article Title"
                  required
                  placeholder="e.g. Arizona's Semiconductor Workforce: What 2026 Holds"
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                />
                <TextareaField
                  label="Excerpt / Summary"
                  hint="A short 1–2 sentence summary shown on the article card."
                  placeholder="A brief description of what this article covers…"
                  value={form.excerpt}
                  onChange={e => set('excerpt', e.target.value)}
                  rows={2}
                  style={{ minHeight: 70 }}
                />
                <TextareaField
                  label="Article Body"
                  required
                  hint="Markdown is supported. Use blank lines to separate paragraphs."
                  placeholder="Write your full article here…"
                  value={form.body}
                  onChange={e => set('body', e.target.value)}
                  rows={18}
                  style={{ minHeight: 340, fontFamily: MONO, fontSize: 13 }}
                />
              </div>
            </div>

            {/* Media & Metadata */}
            <div>
              <SectionHeader>Media &amp; Metadata</SectionHeader>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <InputField
                  label="Cover Image URL"
                  hint="Optional. Direct link to a cover image."
                  placeholder="https://…"
                  type="url"
                  value={form.cover_image_url}
                  onChange={e => set('cover_image_url', e.target.value)}
                />
                <InputField
                  label="Read Time (minutes)"
                  hint="Estimated read time."
                  placeholder="5"
                  type="number"
                  min="1"
                  max="120"
                  value={form.read_time_min}
                  onChange={e => set('read_time_min', e.target.value)}
                />
              </div>
              <div style={{ marginTop: 20 }}>
                <InputField
                  label="Tags"
                  hint="Comma-separated. e.g. CHIPS Act, Workforce, TSMC"
                  placeholder="Supply Chain, Semiconductor, Arizona"
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
