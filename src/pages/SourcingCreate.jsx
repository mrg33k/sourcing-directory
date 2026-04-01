import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens, ThemeToggle } from './SourcingTheme.jsx';

// ─── Vertical options ────────────────────────────────────────────────────────
const VERTICALS = [
  { key: 'semiconductor', label: 'Semiconductor' },
  { key: 'space',         label: 'Space & Aerospace' },
  { key: 'biotech',       label: 'Biotech & Life Sciences' },
  { key: 'defense',       label: 'Defense & Security' },
  { key: 'custom',        label: 'Custom...' },
];

const DEFAULT_FEATURES = { jobs: true, marketplace: true, events: true, articles: true, signup: true };

// ─── Slug generator ──────────────────────────────────────────────────────────
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// ─── Progress dots ───────────────────────────────────────────────────────────
function ProgressDots({ step, total, V, accent }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 40 }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? 28 : 8,
            height: 8,
            borderRadius: 4,
            background: i <= step ? accent : V.border,
            transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      ))}
    </div>
  );
}

// ─── Shared input styles ─────────────────────────────────────────────────────
function inputStyle(V) {
  return {
    width: '100%',
    background: V.card,
    border: `1px solid ${V.border}`,
    borderRadius: 8,
    padding: '14px 16px',
    fontSize: 15,
    fontFamily: V.space,
    color: V.text,
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };
}

function labelStyle(V) {
  return {
    fontSize: 12,
    fontWeight: 700,
    fontFamily: V.mono,
    color: V.muted,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 10,
    display: 'block',
  };
}

// ─── Step 1: Name + Vertical ─────────────────────────────────────────────────
function Step1({ data, onChange, V, accent }) {
  const nameRef = useRef(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <label style={labelStyle(V)}>Directory Name</label>
        <input
          ref={nameRef}
          type="text"
          value={data.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="e.g. SC3 Arizona Semiconductor"
          style={inputStyle(V)}
        />
        {data.name && (
          <div style={{
            fontSize: 12, fontFamily: V.mono, color: V.dim, marginTop: 6,
          }}>
            slug: {toSlug(data.name) || '...'}
          </div>
        )}
      </div>

      <div>
        <label style={labelStyle(V)}>Industry Vertical</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {VERTICALS.map(v => {
            const selected = data.vertical === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => onChange({ vertical: v.key, customVertical: v.key === 'custom' ? data.customVertical : '' })}
                style={{
                  background: selected ? `${accent}18` : V.card,
                  border: `1px solid ${selected ? accent : V.border}`,
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontSize: 14,
                  fontFamily: V.space,
                  fontWeight: selected ? 700 : 500,
                  color: selected ? accent : V.muted,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
        {data.vertical === 'custom' && (
          <input
            type="text"
            value={data.customVertical}
            onChange={e => onChange({ customVertical: e.target.value })}
            placeholder="Enter custom vertical..."
            style={{ ...inputStyle(V), marginTop: 12 }}
            autoFocus
          />
        )}
      </div>
    </div>
  );
}

// ─── Step 2: Description + Brand Color ───────────────────────────────────────
function Step2({ data, onChange, V, accent }) {
  const descRef = useRef(null);
  useEffect(() => { descRef.current?.focus(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <label style={labelStyle(V)}>Short Description</label>
        <textarea
          ref={descRef}
          value={data.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="What is this directory about? One or two sentences."
          rows={3}
          style={{
            ...inputStyle(V),
            resize: 'vertical',
            minHeight: 80,
            lineHeight: 1.5,
          }}
        />
      </div>

      <div>
        <label style={labelStyle(V)}>Brand Color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="color"
              value={data.brandColor}
              onChange={e => onChange({ brandColor: e.target.value })}
              style={{
                width: 48, height: 48,
                border: `2px solid ${V.border}`,
                borderRadius: 10,
                cursor: 'pointer',
                background: 'transparent',
                padding: 2,
              }}
            />
          </div>
          <input
            type="text"
            value={data.brandColor}
            onChange={e => onChange({ brandColor: e.target.value })}
            style={{ ...inputStyle(V), width: 140, fontFamily: V.mono }}
          />
          <div style={{
            width: 80, height: 48, borderRadius: 8,
            background: data.brandColor,
            border: `1px solid ${V.border}`,
            transition: 'background 0.2s',
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Features ────────────────────────────────────────────────────────
function ToggleSwitch({ on, onToggle, V, accent }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: 44, height: 24,
        borderRadius: 12,
        border: 'none',
        background: on ? accent : V.border,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18,
        borderRadius: '50%',
        background: '#fff',
        position: 'absolute',
        top: 3,
        left: on ? 23 : 3,
        transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function Step3({ data, onChange, V, accent }) {
  const featureLabels = {
    jobs: 'Job Board',
    marketplace: 'Marketplace',
    events: 'Events Calendar',
    articles: 'Articles & News',
    signup: 'Company Signup',
  };

  const toggleFeature = (key) => {
    onChange({ features: { ...data.features, [key]: !data.features[key] } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle(V)}>Enable Features</label>
      <div style={{
        background: V.card, border: `1px solid ${V.border}`,
        borderRadius: 10, overflow: 'hidden',
      }}>
        {Object.keys(featureLabels).map((key, i) => (
          <div
            key={key}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px',
              borderTop: i > 0 ? `1px solid ${V.border}` : 'none',
            }}
          >
            <span style={{ fontSize: 15, fontFamily: V.space, color: V.text }}>
              {featureLabels[key]}
            </span>
            <ToggleSwitch on={data.features[key]} onToggle={() => toggleFeature(key)} V={V} accent={accent} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 4: Seed Companies ──────────────────────────────────────────────────
function Step4({ data, onChange, V, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <label style={labelStyle(V)}>Seed with AI-sourced companies?</label>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          {[{ val: true, label: 'Yes, seed companies' }, { val: false, label: 'No, start empty' }].map(opt => (
            <button
              key={String(opt.val)}
              type="button"
              onClick={() => onChange({ seed: opt.val })}
              style={{
                flex: 1,
                background: data.seed === opt.val ? `${accent}18` : V.card,
                border: `1px solid ${data.seed === opt.val ? accent : V.border}`,
                borderRadius: 8,
                padding: '14px 18px',
                fontSize: 14,
                fontFamily: V.space,
                fontWeight: data.seed === opt.val ? 700 : 500,
                color: data.seed === opt.val ? accent : V.muted,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {data.seed && (
        <>
          <div>
            <label style={labelStyle(V)}>How many companies?</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
              <input
                type="range"
                min={5} max={50} step={5}
                value={data.seedCount}
                onChange={e => onChange({ seedCount: parseInt(e.target.value) })}
                style={{
                  flex: 1,
                  accentColor: accent,
                  height: 6,
                }}
              />
              <span style={{
                fontSize: 20, fontWeight: 800, fontFamily: V.mono, color: accent,
                minWidth: 36, textAlign: 'center',
              }}>
                {data.seedCount}
              </span>
            </div>
          </div>

          <div>
            <label style={labelStyle(V)}>Target Region</label>
            <input
              type="text"
              value={data.seedRegion}
              onChange={e => onChange({ seedRegion: e.target.value })}
              placeholder="e.g. Arizona, Texas, Nationwide"
              style={inputStyle(V)}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Final: Summary ──────────────────────────────────────────────────────────
function StepSummary({ data, V, accent }) {
  const verticalLabel = data.vertical === 'custom'
    ? data.customVertical
    : VERTICALS.find(v => v.key === data.vertical)?.label || data.vertical;

  const enabledFeatures = Object.entries(data.features)
    .filter(([, v]) => v)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));

  return (
    <div style={{
      background: V.card, border: `1px solid ${V.border}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Header preview */}
      <div style={{
        padding: '24px 24px 20px',
        background: `linear-gradient(135deg, ${data.brandColor}15, transparent)`,
        borderBottom: `1px solid ${V.border}`,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          background: `${data.brandColor}20`,
          border: `1px solid ${data.brandColor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 800, fontFamily: V.syne,
          color: data.brandColor, marginBottom: 12,
        }}>
          {data.name ? data.name.charAt(0) : '?'}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: V.syne, color: V.heading }}>
          {data.name || 'Untitled Directory'}
        </div>
        <div style={{
          fontSize: 12, fontFamily: V.mono, color: data.brandColor,
          textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4,
        }}>
          {verticalLabel}
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {data.description && (
          <div>
            <div style={{ ...labelStyle(V), marginBottom: 4 }}>Description</div>
            <div style={{ fontSize: 14, fontFamily: V.space, color: V.text, lineHeight: 1.5 }}>
              {data.description}
            </div>
          </div>
        )}

        <div>
          <div style={{ ...labelStyle(V), marginBottom: 6 }}>Features</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {enabledFeatures.map(f => (
              <span key={f} style={{
                background: `${accent}12`, border: `1px solid ${accent}35`,
                color: accent, fontSize: 11, fontWeight: 700, fontFamily: V.mono,
                padding: '3px 10px', borderRadius: 4,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {data.seed && (
          <div>
            <div style={{ ...labelStyle(V), marginBottom: 4 }}>Seed Companies</div>
            <div style={{ fontSize: 14, fontFamily: V.space, color: V.text }}>
              {data.seedCount} companies in {data.seedRegion || 'Arizona'}
            </div>
          </div>
        )}

        <div>
          <div style={{ ...labelStyle(V), marginBottom: 4 }}>Slug</div>
          <div style={{ fontSize: 14, fontFamily: V.mono, color: V.dim }}>
            /{toSlug(data.name) || '...'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inner component ─────────────────────────────────────────────────────────
function SourcingCreateInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const navigate = useNavigate();
  const accent = V.accent;

  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const containerRef = useRef(null);

  const [data, setData] = useState({
    name: '',
    vertical: '',
    customVertical: '',
    description: '',
    brandColor: '#1B5E20',
    features: { ...DEFAULT_FEATURES },
    seed: false,
    seedCount: 20,
    seedRegion: 'Arizona',
  });

  const update = (patch) => setData(prev => ({ ...prev, ...patch }));

  const totalSteps = 5; // 0-4
  const canNext = () => {
    if (step === 0) return data.name.trim() && (data.vertical && (data.vertical !== 'custom' || data.customVertical.trim()));
    return true;
  };

  const goNext = () => {
    if (step < totalSteps - 1 && canNext()) {
      setDirection(1);
      setStep(s => s + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(s => s - 1);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && step < totalSteps - 1 && canNext()) {
      e.preventDefault();
      goNext();
    }
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);

    const slug = toSlug(data.name);
    const vertical = data.vertical === 'custom' ? data.customVertical.trim().toLowerCase() : data.vertical;
    const payload = {
      name: data.name.trim(),
      slug,
      vertical,
      description: data.description.trim() || null,
      brand_color: data.brandColor,
      features: data.features,
      hero_text: data.description.trim() || null,
      nav_label: data.name.trim(),
      status: 'active',
    };

    try {
      // Try direct Supabase insert first
      if (supabase) {
        const { data: created, error: insertErr } = await supabase
          .from('directory_tenants')
          .insert(payload)
          .select()
          .single();

        if (insertErr) throw new Error(insertErr.message);

        // If seed requested, call the agent API to bulk-seed
        if (data.seed && created?.id) {
          try {
            await fetch('/api/sourcing/agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `Seed ${data.seedCount} ${vertical} companies in ${data.seedRegion || 'Arizona'} for tenant ${created.id}. Use the tenant_id ${created.id} for all inserts. These should be real companies in the ${vertical} industry.`,
                mode: 'admin',
                tenantId: created.id,
              }),
            });
          } catch (seedErr) {
            console.warn('Seed request sent, agent will process async:', seedErr);
          }
        }

        navigate(`/${slug}`);
        return;
      }

      // Fallback: try API
      const res = await fetch('/api/sourcing/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        if (data.seed && created?.id) {
          fetch('/api/sourcing/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `Seed ${data.seedCount} ${vertical} companies in ${data.seedRegion || 'Arizona'} for tenant ${created.id}.`,
              mode: 'admin',
              tenantId: created.id,
            }),
          }).catch(() => {});
        }
        navigate(`/${slug}`);
      } else {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  };

  const stepTitles = [
    'Name your directory',
    'Describe it',
    'Choose features',
    'Seed companies',
    'Review & create',
  ];

  const renderStep = () => {
    switch (step) {
      case 0: return <Step1 data={data} onChange={update} V={V} accent={accent} />;
      case 1: return <Step2 data={data} onChange={update} V={V} accent={accent} />;
      case 2: return <Step3 data={data} onChange={update} V={V} accent={accent} />;
      case 3: return <Step4 data={data} onChange={update} V={V} accent={accent} />;
      case 4: return <StepSummary data={data} V={V} accent={accent} />;
      default: return null;
    }
  };

  return (
    <div
      style={{ minHeight: '100vh', background: V.bg, color: V.text }}
      onKeyDown={handleKeyDown}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(${direction > 0 ? '40' : '-40'}px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        * { box-sizing: border-box; }
        a { color: inherit; }
        input:focus, textarea:focus { border-color: ${accent} !important; box-shadow: 0 0 0 2px ${V.accentDim}; }
        input::placeholder, textarea::placeholder { color: ${V.dim}; }
        input[type="color"] { -webkit-appearance: none; }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 2px; }
        input[type="color"]::-webkit-color-swatch { border: none; border-radius: 6px; }
      `}</style>

      {/* Nav */}
      <div style={{ borderBottom: `1px solid ${V.border}`, background: V.navBg }}>
        <div style={{
          padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, height: 56,
        }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span style={{
              fontSize: 13, fontWeight: 800, fontFamily: V.syne,
              color: accent, letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              AOM
            </span>
          </Link>
          <span style={{ color: V.dim, fontSize: 13 }}>/</span>
          <Link to="/" style={{ textDecoration: 'none', fontSize: 13, color: V.muted, fontFamily: V.space }}>
            Sourcing
          </Link>
          <span style={{ color: V.dim, fontSize: 13 }}>/</span>
          <span style={{ fontSize: 13, color: V.text, fontFamily: V.space }}>New Directory</span>
          <div style={{ flex: 1 }} />
          <ThemeToggle />
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px 80px' }}>
        <ProgressDots step={step} total={totalSteps} V={V} accent={accent} />

        {/* Step title */}
        <h2 style={{
          fontSize: 28, fontWeight: 800, fontFamily: V.syne,
          color: V.heading, textAlign: 'center', margin: '0 0 8px',
        }}>
          {stepTitles[step]}
        </h2>
        <p style={{
          fontSize: 14, color: V.muted, fontFamily: V.space,
          textAlign: 'center', margin: '0 0 36px',
        }}>
          Step {step + 1} of {totalSteps}
        </p>

        {/* Animated step content */}
        <div
          key={step}
          ref={containerRef}
          style={{ animation: 'fadeSlideIn 0.3s ease forwards' }}
        >
          {renderStep()}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 20, padding: '12px 16px', borderRadius: 8,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', fontSize: 13, fontFamily: V.space,
          }}>
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 40, gap: 12,
        }}>
          <button
            type="button"
            onClick={step === 0 ? () => navigate('/') : goBack}
            style={{
              background: 'transparent',
              border: `1px solid ${V.border}`,
              borderRadius: 8,
              padding: '12px 20px',
              fontSize: 14,
              fontFamily: V.space,
              fontWeight: 600,
              color: V.muted,
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < totalSteps - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext()}
              style={{
                background: canNext() ? accent : V.border,
                border: 'none',
                borderRadius: 8,
                padding: '12px 28px',
                fontSize: 14,
                fontFamily: V.space,
                fontWeight: 700,
                color: canNext() ? '#fff' : V.dim,
                cursor: canNext() ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              Continue
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !data.name.trim()}
              style={{
                background: creating ? V.border : accent,
                border: 'none',
                borderRadius: 8,
                padding: '12px 28px',
                fontSize: 14,
                fontFamily: V.space,
                fontWeight: 700,
                color: '#fff',
                cursor: creating ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {creating ? (
                <>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid #fff',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Creating...
                </>
              ) : (
                <>
                  Create Directory
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function SourcingCreate() {
  return (
    <SourcingThemeProvider>
      <SourcingCreateInner />
    </SourcingThemeProvider>
  );
}
