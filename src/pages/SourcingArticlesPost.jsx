import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingNav } from './SourcingMarketplace.jsx';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

const VERTICALS = [
  { key: 'semiconductor', label: 'Semiconductor' },
  { key: 'space',         label: 'Space & Aerospace' },
  { key: 'biotech',       label: 'Biotech' },
  { key: 'defense',       label: 'Defense' },
];

function InputField({ label, required, hint, V, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>
        {label}{required && <span style={{ color: V.accent }}> *</span>}
      </label>
      {hint && <div style={{ fontSize: 11, color: V.dim, fontFamily: V.space }}>{hint}</div>}
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

function TextareaField({ label, required, hint, V, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>
        {label}{required && <span style={{ color: V.accent }}> *</span>}
      </label>
      {hint && <div style={{ fontSize: 11, color: V.dim, fontFamily: V.space }}>{hint}</div>}
      <textarea
        {...props}
        style={{
          background: V.card2, border: `1px solid ${V.border}`,
          color: V.text, borderRadius: 7, padding: '10px 12px',
          fontSize: 14, fontFamily: V.space, outline: 'none',
          width: '100%', boxSizing: 'border-box',
          resize: 'vertical', minHeight: 100,
          ...(props.style || {}),
        }}
      />
    </div>
  );
}

function SelectField({ label, required, options, value, onChange, V }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>
        {label}{required && <span style={{ color: V.accent }}> *</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: V.card2, border: `1px solid ${V.border}`,
          color: value ? V.text : V.dim, borderRadius: 7, padding: '10px 12px',
          fontSize: 14, fontFamily: V.space, outline: 'none',
          width: '100%', boxSizing: 'border-box', appearance: 'none', cursor: 'pointer',
        }}
      >
        <option value="" style={{ background: V.card2 }}>Select...</option>
        {options.map(opt => (
          <option key={opt.key} value={opt.key} style={{ background: V.card2 }}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function SourcingArticlesPostInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const navigate = useNavigate();
  const { tenantSlug } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : '/';

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [tagsInput, setTagsInput] = useState('');

  const [form, setForm] = useState({
    company_id: '',
    vertical: '',
    title: '',
    excerpt: '',
    body: '',
    cover_image_url: '',
    read_time_min: '',
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
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.body.trim()) { setError('Article body is required.'); return; }
    if (!form.vertical) { setError('Please select an industry vertical.'); return; }

    if (!supabase) {
      setError('Supabase not configured. Run migrations first.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const payload = {
        company_id: form.company_id || null,
        title: form.title.trim(),
        description: form.excerpt.trim() || null,
        body: form.body.trim(),
        excerpt: form.excerpt.trim() || null,
        cover_image_url: form.cover_image_url.trim() || null,
        read_time_min: form.read_time_min ? parseInt(form.read_time_min) : null,
        tags: tags.length > 0 ? tags : null,
        vertical: form.vertical,
        category: 'article',
        status: 'pending',
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
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: V.bg, color: V.text }}>
        <SourcingNav active="articles" tenantSlug={tenantSlug} />
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
            Article Submitted for Review
          </h2>
          <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, maxWidth: 360, margin: '0 auto 28px', lineHeight: 1.6 }}>
            Your article has been submitted for review. It will appear on the articles page once approved by an admin.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Link
              to={`${basePath}/articles`}
              style={{
                background: V.accent, color: '#fff', textDecoration: 'none',
                borderRadius: 8, padding: '10px 20px', fontSize: 13,
                fontWeight: 700, fontFamily: V.space,
              }}
            >
              View Articles
            </Link>
            <button
              onClick={() => { setDone(false); setForm({ company_id: '', vertical: '', title: '', excerpt: '', body: '', cover_image_url: '', read_time_min: '' }); setTagsInput(''); }}
              style={{
                background: 'transparent', border: `1px solid ${V.border}`,
                color: V.muted, borderRadius: 8, padding: '10px 20px',
                fontSize: 13, fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
              }}
            >
              Post Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: V.bg, color: V.text }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: ${V.dim}; }
        input:focus, textarea:focus, select:focus {
          border-color: ${V.accentBrd} !important;
          box-shadow: 0 0 0 2px ${V.accentDim};
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <SourcingNav active="articles" tenantSlug={tenantSlug} />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: V.accent, fontFamily: V.mono, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
            Industry Articles
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: V.syne, color: V.heading, margin: '0 0 10px', lineHeight: 1.15 }}>
            Post an Article
          </h1>
          <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, margin: 0, lineHeight: 1.6 }}>
            Share industry insights, company news, or technical content with Arizona's advanced tech community.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>
                Author Company
              </label>
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
                  background: V.card2, border: `1px solid ${V.border}`,
                  color: form.company_id ? V.text : V.dim, borderRadius: 7, padding: '10px 12px',
                  fontSize: 14, fontFamily: V.space, outline: 'none',
                  width: '100%', appearance: 'none', cursor: 'pointer',
                }}
              >
                <option value="" style={{ background: V.card2 }}>Select company...</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id} style={{ background: V.card2 }}>{c.name}</option>
                ))}
              </select>
            </div>
            <SelectField
              label="Industry Vertical"
              required
              options={VERTICALS}
              value={form.vertical}
              onChange={v => set('vertical', v)}
              V={V}
            />
          </div>

          <InputField
            label="Article Title"
            required
            placeholder="e.g. Arizona's Semiconductor Workforce: What 2026 Holds"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            V={V}
          />

          <TextareaField
            label="Excerpt / Summary"
            hint="A short 1-2 sentence summary shown on the article card."
            placeholder="A brief description of what this article covers..."
            value={form.excerpt}
            onChange={e => set('excerpt', e.target.value)}
            rows={2}
            V={V}
          />

          <TextareaField
            label="Article Body"
            required
            hint="Markdown is supported. Use blank lines to separate paragraphs."
            placeholder="Write your full article here..."
            value={form.body}
            onChange={e => set('body', e.target.value)}
            rows={16}
            style={{ minHeight: 320, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
            V={V}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <InputField
              label="Cover Image URL"
              hint="Optional. Direct link to cover image."
              placeholder="https://..."
              type="url"
              value={form.cover_image_url}
              onChange={e => set('cover_image_url', e.target.value)}
              V={V}
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
              V={V}
            />
          </div>

          <InputField
            label="Tags"
            hint="Comma-separated. e.g. CHIPS Act, Workforce, TSMC"
            placeholder="Supply Chain, Semiconductor, Arizona"
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            V={V}
          />

          {!supabase && (
            <div style={{
              background: V.accentDim, border: `1px solid ${V.accentBrd}`,
              borderRadius: 7, padding: '12px 14px',
              fontSize: 12, color: V.accent, fontFamily: V.space,
            }}>
              Supabase not configured -- article cannot be saved yet. Run the migrations first.
            </div>
          )}

          {error && (
            <div style={{ color: '#EF4444', fontSize: 13, fontFamily: V.space }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Link
              to={`${basePath}/articles`}
              style={{
                flex: 1, background: 'transparent', border: `1px solid ${V.border}`,
                color: V.muted, borderRadius: 8, padding: '11px 0',
                fontSize: 14, fontWeight: 600, fontFamily: V.space,
                display: 'block', textAlign: 'center', textDecoration: 'none',
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2, background: loading ? `${V.accent}66` : V.accent,
                border: 'none', color: '#fff', borderRadius: 8, padding: '11px 0',
                fontSize: 14, fontWeight: 700, fontFamily: V.space,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', animation: 'spin 0.8s linear infinite' }} />
                  Publishing...
                </>
              ) : 'Publish Article'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SourcingArticlesPost() {
  return (
    <SourcingThemeProvider>
      <SourcingArticlesPostInner />
    </SourcingThemeProvider>
  );
}
