// SourcingArticlesPostV2.jsx
// nat-geo-uplift — V2 post form for Articles.
// Supabase logic preserved exactly from SourcingArticlesPost.jsx.
// Visual system: dark BG (#06060A), amber accent (#E8A23A), line-style inputs.
// GATED to signed-in community members, mirroring SourcingDiscoveryPostV2 — you
// must have an account to contribute. The Shell offsets the fixed 155px nav so
// the hero never renders underneath it.

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import snarkdown from 'snarkdown';
import { supabase } from '../lib/supabase.js';
import SRWNavV2 from './srw/SRWNavV2.jsx';
import './srw/srw-v2.css';
import { V2ChipNav } from './V2ChipNav.jsx';

// ~200 words/min is the editorial standard for estimated read time.
function estimateReadMinutes(text) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  return Math.max(1, Math.round(words / 200));
}

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
  { key: 'semiconductor',  label: 'Semiconductor' },
  { key: 'space',          label: 'Space & Aerospace' },
  { key: 'space-medicine', label: 'Space Medicine & Life Sciences' },
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
    <div data-srw="v2" style={{
      minHeight: '100dvh', background: BG, color: TEXT, fontFamily: FONT,
      '--tx2': MUTED, '--tx3': DIM,
      '--s1': 'rgba(6,6,10,0.72)', '--s2': 'rgba(6,6,10,0.82)',
      '--bd': BORDER, '--bd2': 'rgba(245,238,215,0.16)',
      '--cyan': AMBER, '--cyan-dim': 'rgba(232,162,58,0.10)', '--cyan-brd': 'rgba(232,162,58,0.32)',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: ${DIM}; }
        select option { background: #111; color: ${TEXT}; }
        input[type="number"]::-webkit-inner-spin-button { filter: invert(0.4); }
        .article-md-preview > *:first-child { margin-top: 0; }
        .article-md-preview > *:last-child { margin-bottom: 0; }
        .article-md-preview h1, .article-md-preview h2, .article-md-preview h3 {
          font-family: ${FONT}; font-weight: 700; color: ${TEXT};
          line-height: 1.25; margin: 1.4em 0 0.5em;
        }
        .article-md-preview h1 { font-size: 24px; }
        .article-md-preview h2 { font-size: 19px; }
        .article-md-preview h3 { font-size: 16px; }
        .article-md-preview p { margin: 0 0 1em; }
        .article-md-preview a { color: ${AMBER}; text-decoration: underline; }
        .article-md-preview strong { color: ${TEXT}; font-weight: 700; }
        .article-md-preview ul, .article-md-preview ol { margin: 0 0 1em; padding-left: 1.4em; }
        .article-md-preview li { margin: 0.25em 0; }
        .article-md-preview blockquote {
          margin: 0 0 1em; padding: 4px 0 4px 16px;
          border-left: 2px solid ${AMBER}; color: ${MUTED};
        }
        .article-md-preview code {
          font-family: ${MONO}; font-size: 0.9em;
          background: rgba(245,238,215,0.08); padding: 1px 5px; border-radius: 4px;
        }
        .article-md-preview img { max-width: 100%; border-radius: 8px; }
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
      // Prefill the byline from the signed-in member's name so authorship is
      // theirs by default (they can still edit it).
      const name = session?.user?.user_metadata?.full_name
        || session?.user?.user_metadata?.name || '';
      if (name) setForm(prev => (prev.author_name ? prev : { ...prev, author_name: name }));
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
  const [bodyView, setBodyView]     = useState('write'); // 'write' | 'preview'
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverDragging, setCoverDragging]   = useState(false);

  const [form, setForm] = useState({
    author_name:      '',
    company_id:       '',
    vertical:         '',
    title:            '',
    excerpt:          '',
    body:             '',
    cover_image_url:  '',
    read_time_min:    '',
  });

  // Live, auto-calculated read time from the body (author can still override).
  const autoReadMin = useMemo(() => estimateReadMinutes(form.body), [form.body]);

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

  // Upload a cover image via the serverless endpoint (service-role write to the
  // public sourcing-reports bucket), then store the returned public URL.
  const handleCoverUpload = async (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError('Cover image must be under 8 MB.'); return; }
    setError(null);
    setCoverUploading(true);
    try {
      const { data: { session: live } } = await supabase.auth.getSession();
      if (!live) { setError('Your session expired. Please sign in again.'); return; }
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch('/api/sourcing/upload-article-cover', {
        method: 'POST',
        headers: { Authorization: `Bearer ${live.access_token}` },
        body: fd,
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Upload failed');
      set('cover_image_url', json.coverUrl);
    } catch (err) {
      setError(err.message || 'Cover upload failed. You can paste an image URL instead.');
    } finally {
      setCoverUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.author_name.trim()) { setError('Author name is required.');             return; }
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
        author_name:      form.author_name.trim(),
        company_id:       form.company_id || null,
        title:            form.title.trim(),
        description:      form.excerpt.trim() || null,
        body:             form.body.trim(),
        excerpt:          form.excerpt.trim() || null,
        cover_image_url:  form.cover_image_url.trim() || null,
        read_time_min:    form.read_time_min ? parseInt(form.read_time_min) : (autoReadMin || null),
        tags:             tags.length > 0 ? tags : null,
        vertical:         form.vertical,
        category:         'article',
        status:           'pending',
      };

      let { error: insertErr } = await supabase
        .from('directory_listings')
        .insert(payload);

      // Graceful fallback: if the author_name column has not been provisioned
      // yet, drop it and resubmit so posting never breaks on schema drift.
      if (insertErr && /author_name/i.test(insertErr.message || '')) {
        const { author_name, ...rest } = payload;
        ({ error: insertErr } = await supabase.from('directory_listings').insert(rest));
      }

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
            Publishing to the Space OS articles feed is open to the community. You just need an account. Sign in or create one to share insights, company news, or technical content, and it will appear here once reviewed.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
            <Link to="/spaceos/login" style={{
              background: AMBER, color: '#06060A', textDecoration: 'none',
              borderRadius: 6, padding: '12px 28px', fontWeight: 700, fontSize: 14, fontFamily: FONT,
            }}>
              Sign in / Create account
            </Link>
            <Link to="/spaceos/articles" style={{
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
            <Link to="/spaceos/articles" style={{
              background: AMBER, color: '#06060A', textDecoration: 'none',
              borderRadius: 6, padding: '12px 28px', fontWeight: 700, fontSize: 14, fontFamily: FONT,
            }}>
              View Articles
            </Link>
            <button
              onClick={() => {
                setDone(false);
                setBodyView('write');
                setForm(prev => ({ author_name: prev.author_name, company_id: '', vertical: '', title: '', excerpt: '', body: '', cover_image_url: '', read_time_min: '' }));
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
          <Link to="/spaceos/articles" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 13, color: MUTED, textDecoration: 'none', fontFamily: FONT }}>
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
              <div style={{ marginBottom: 20 }}>
                <InputField
                  label="Author Name"
                  required
                  hint="Your byline, shown on the published article."
                  placeholder="e.g. Christine Rincon, MSN, RN, CCRN"
                  value={form.author_name}
                  onChange={e => set('author_name', e.target.value)}
                />
              </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Label required>Article Body</Label>
                    <div style={{ display: 'inline-flex', gap: 2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 2 }}>
                      {['write', 'preview'].map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setBodyView(mode)}
                          style={{
                            background: bodyView === mode ? AMBER : 'transparent',
                            color: bodyView === mode ? '#06060A' : MUTED,
                            border: 'none', borderRadius: 4, padding: '4px 14px',
                            fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Hint>Markdown is supported. Use blank lines to separate paragraphs.</Hint>
                  {bodyView === 'write' ? (
                    <textarea
                      value={form.body}
                      onChange={e => set('body', e.target.value)}
                      rows={18}
                      placeholder="Write your full article here…"
                      style={lineInputStyle({ resize: 'vertical', minHeight: 340, fontFamily: MONO, fontSize: 13 })}
                      onFocus={e => { e.target.style.borderBottomColor = AMBER; }}
                      onBlur={e  => { e.target.style.borderBottomColor = BORDER; }}
                    />
                  ) : (
                    <div
                      className="article-md-preview"
                      style={{
                        minHeight: 340, padding: '18px 20px', borderRadius: 8,
                        border: `1px solid ${BORDER}`, background: CARD,
                        fontSize: 15, lineHeight: 1.7, color: TEXT, fontFamily: FONT,
                      }}
                      dangerouslySetInnerHTML={{
                        __html: form.body.trim()
                          ? snarkdown(form.body)
                          : `<span style="color:${DIM}">Nothing to preview yet. Switch to Write and start your article.</span>`,
                      }}
                    />
                  )}
                  <div style={{ fontSize: 11, color: DIM, fontFamily: MONO }}>
                    {form.body.trim() ? form.body.trim().split(/\s+/).filter(Boolean).length : 0} words · about {autoReadMin || 0} min read
                  </div>
                </div>
              </div>
            </div>

            {/* Media & Metadata */}
            <div>
              <SectionHeader>Media &amp; Metadata</SectionHeader>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Label>Cover Image</Label>
                <Hint>Optional. Drag an image in or upload a file. PNG, JPG, WEBP, or GIF, up to 8 MB.</Hint>
                <div
                  onDragOver={e => { e.preventDefault(); if (!coverDragging) setCoverDragging(true); }}
                  onDragLeave={e => { e.preventDefault(); setCoverDragging(false); }}
                  onDrop={e => {
                    e.preventDefault();
                    setCoverDragging(false);
                    const f = e.dataTransfer?.files?.[0];
                    if (f) handleCoverUpload(f);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, marginTop: 6,
                    padding: 12, marginLeft: -12, borderRadius: 10,
                    border: `1px solid ${coverDragging ? AMBER : 'transparent'}`,
                    background: coverDragging ? 'rgba(232,162,58,0.06)' : 'transparent',
                    transition: 'background 120ms, border-color 120ms',
                  }}
                >
                  {form.cover_image_url ? (
                    <img
                      src={form.cover_image_url}
                      alt="Cover preview"
                      style={{ width: 76, height: 76, borderRadius: 8, objectFit: 'cover', border: `1px solid ${BORDER}` }}
                    />
                  ) : (
                    <div style={{
                      width: 76, height: 76, borderRadius: 8,
                      border: `1px dashed ${coverDragging ? AMBER : BORDER}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: coverDragging ? AMBER : DIM,
                    }}>
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                    <label style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: 'transparent', border: `1px solid ${AMBER}`, color: AMBER,
                      borderRadius: 6, padding: '9px 18px', fontSize: 13, fontWeight: 600,
                      fontFamily: FONT, cursor: coverUploading ? 'wait' : 'pointer', opacity: coverUploading ? 0.6 : 1,
                    }}>
                      {coverUploading ? 'Uploading…' : (form.cover_image_url ? 'Replace image' : 'Upload image')}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        style={{ display: 'none' }}
                        disabled={coverUploading}
                        onChange={e => { handleCoverUpload(e.target.files?.[0]); e.target.value = ''; }}
                      />
                    </label>
                    {form.cover_image_url && (
                      <button
                        type="button"
                        onClick={() => set('cover_image_url', '')}
                        style={{ background: 'none', border: 'none', color: MUTED, fontSize: 12, fontFamily: FONT, cursor: 'pointer', padding: 0 }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
                <InputField
                  label="Read Time (minutes)"
                  hint={`Auto-set to ~${autoReadMin || 0} min from your article. Edit only to override.`}
                  placeholder={String(autoReadMin || 5)}
                  type="number"
                  min="1"
                  max="120"
                  value={form.read_time_min}
                  onChange={e => set('read_time_min', e.target.value)}
                />
                <InputField
                  label="Tags"
                  hint="Comma-separated. e.g. Space Medicine, Workforce"
                  placeholder="Space Medicine, Clinical, Arizona"
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
