import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingNav } from './SourcingMarketplace.jsx';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

// ─── Notification preference definitions ─────────────────────────────────────
const PREF_KEYS = [
  'companies_new',
  'articles_semiconductor',
  'articles_space',
  'articles_biotech',
  'articles_defense',
  'jobs_new',
  'events_new',
];

const DEFAULT_PREFS = Object.fromEntries(PREF_KEYS.map(k => [k, true]));

// ─── Toggle switch ─────────────────────────────────────────────────────────
function ToggleSwitch({ on, onToggle, accent, V }) {
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

// ─── Section label ─────────────────────────────────────────────────────────
function SectionLabel({ label, V }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, fontFamily: V.mono,
      color: V.accent, letterSpacing: '0.12em', textTransform: 'uppercase',
      marginBottom: 16,
    }}>
      {label}
    </div>
  );
}

// ─── Pref row ──────────────────────────────────────────────────────────────
function PrefRow({ label, sublabel, enabled, onToggle, accent, V, saving }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px',
      gap: 16,
      opacity: saving ? 0.6 : 1,
      transition: 'opacity 0.15s',
    }}>
      <div>
        <div style={{ fontSize: 15, fontFamily: V.space, color: V.text }}>{label}</div>
        {sublabel && (
          <div style={{ fontSize: 12, fontFamily: V.space, color: V.dim, marginTop: 2 }}>{sublabel}</div>
        )}
      </div>
      <ToggleSwitch on={enabled} onToggle={onToggle} accent={accent} V={V} />
    </div>
  );
}

// ─── Inner component ──────────────────────────────────────────────────────
function SourcingSettingsInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const { tenant, loading: tenantLoading } = useTenant();

  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [frequency, setFrequency] = useState('real-time');
  const [savingKey, setSavingKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);
  const [error, setError] = useState('');

  const basePath = tenantSlug ? `/${tenantSlug}` : '/';
  const accent = tenant?.brand_color || V.accent;

  // Check auth on mount -- redirect to login if no session
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate(`${basePath}/login`, { replace: true });
        return;
      }
      setAuthUser(session.user);
    };
    checkAuth();
  }, [navigate, basePath]);

  // Load existing preferences from Supabase
  const loadPrefs = useCallback(async () => {
    if (!supabase || !authUser || !tenant) return;
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('user_notification_preferences')
        .select('preference_key, enabled, frequency')
        .eq('user_id', authUser.id)
        .eq('tenant_id', tenant.id);

      if (fetchErr) throw fetchErr;

      if (data && data.length > 0) {
        const loaded = { ...DEFAULT_PREFS };
        let freq = 'real-time';
        for (const row of data) {
          if (row.preference_key === 'digest_frequency') {
            freq = row.frequency || 'real-time';
          } else {
            loaded[row.preference_key] = row.enabled;
          }
        }
        setPrefs(loaded);
        setFrequency(freq);
      }
    } catch (err) {
      console.error('Failed to load notification prefs:', err);
      setError('Could not load preferences.');
    } finally {
      setLoading(false);
    }
  }, [authUser, tenant]);

  useEffect(() => {
    if (authUser && tenant) loadPrefs();
  }, [authUser, tenant, loadPrefs]);

  // Upsert a single preference row
  const savePref = async (key, enabled, freq) => {
    if (!supabase || !authUser || !tenant) return;
    setSavingKey(key);
    setError('');
    try {
      const payload = {
        user_id: authUser.id,
        tenant_id: tenant.id,
        preference_key: key,
        enabled: enabled,
        frequency: freq,
        updated_at: new Date().toISOString(),
      };
      const { error: upsertErr } = await supabase
        .from('user_notification_preferences')
        .upsert(payload, { onConflict: 'user_id,tenant_id,preference_key' });

      if (upsertErr) throw upsertErr;

      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 1500);
    } catch (err) {
      console.error('Failed to save pref:', err);
      setError('Failed to save. Try again.');
    } finally {
      setSavingKey(null);
    }
  };

  const togglePref = async (key) => {
    const newVal = !prefs[key];
    setPrefs(prev => ({ ...prev, [key]: newVal }));
    await savePref(key, newVal, frequency);
  };

  const setFreq = async (val) => {
    setFrequency(val);
    await savePref('digest_frequency', true, val);
  };

  if (tenantLoading || (loading && !authUser)) {
    return (
      <div style={{ minHeight: '100vh', background: V.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: `2px solid ${V.border}`, borderTop: `2px solid ${V.accent}`,
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: V.bg, color: V.text }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        a { color: inherit; }
      `}</style>

      <SourcingNav
        active="settings"
        tenantSlug={tenantSlug}
        tenantName={tenant?.nav_label || tenant?.name}
        features={tenant?.features}
        brandColor={tenant?.brand_color}
      />

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '48px 24px 80px' }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800, fontFamily: V.syne,
            color: V.heading, margin: '0 0 8px',
          }}>
            Notification Preferences
          </h1>
          <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, margin: 0 }}>
            Control which emails you receive from{' '}
            {tenant?.name || 'this directory'}.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 24,
            fontSize: 13, fontFamily: V.space, color: '#f87171',
          }}>
            {error}
          </div>
        )}

        {/* ── Companies section ──────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <SectionLabel label="Companies" V={V} />
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            <PrefRow
              label="New companies in your vertical"
              sublabel="Get notified when new companies join the directory"
              enabled={prefs.companies_new}
              onToggle={() => togglePref('companies_new')}
              accent={accent}
              V={V}
              saving={savingKey === 'companies_new'}
            />
          </div>
        </div>

        {/* ── Articles section ───────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <SectionLabel label="Articles & Reports" V={V} />
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            {[
              { key: 'articles_semiconductor', label: 'Semiconductor', sublabel: 'New semiconductor industry articles' },
              { key: 'articles_space',         label: 'Space & Aerospace', sublabel: 'New space and aerospace articles' },
              { key: 'articles_biotech',       label: 'Biotech & Life Sciences', sublabel: 'New biotech and life science articles' },
              { key: 'articles_defense',       label: 'Defense & Security', sublabel: 'New defense and security articles' },
            ].map((item, i) => (
              <div key={item.key} style={{ borderTop: i > 0 ? `1px solid ${V.border}` : 'none' }}>
                <PrefRow
                  label={item.label}
                  sublabel={item.sublabel}
                  enabled={prefs[item.key]}
                  onToggle={() => togglePref(item.key)}
                  accent={accent}
                  V={V}
                  saving={savingKey === item.key}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Listings section ───────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <SectionLabel label="Listings" V={V} />
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            <PrefRow
              label="New job postings"
              sublabel="Get notified when new jobs are posted"
              enabled={prefs.jobs_new}
              onToggle={() => togglePref('jobs_new')}
              accent={accent}
              V={V}
              saving={savingKey === 'jobs_new'}
            />
            <div style={{ borderTop: `1px solid ${V.border}` }}>
              <PrefRow
                label="New events"
                sublabel="Get notified about upcoming events"
                enabled={prefs.events_new}
                onToggle={() => togglePref('events_new')}
                accent={accent}
                V={V}
                saving={savingKey === 'events_new'}
              />
            </div>
          </div>
        </div>

        {/* ── Frequency section ──────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <SectionLabel label="Email Frequency" V={V} />
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            {[
              { val: 'real-time', label: 'Real-time', sublabel: 'Receive emails as events happen' },
              { val: 'weekly',    label: 'Weekly digest', sublabel: 'One summary email per week' },
            ].map((opt, i) => {
              const selected = frequency === opt.val;
              return (
                <div
                  key={opt.val}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderTop: i > 0 ? `1px solid ${V.border}` : 'none',
                    cursor: 'pointer',
                    background: selected ? `${accent}08` : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => setFreq(opt.val)}
                >
                  <div>
                    <div style={{ fontSize: 15, fontFamily: V.space, color: V.text }}>{opt.label}</div>
                    <div style={{ fontSize: 12, fontFamily: V.space, color: V.dim, marginTop: 2 }}>{opt.sublabel}</div>
                  </div>
                  <div style={{
                    width: 20, height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${selected ? accent : V.border}`,
                    background: selected ? accent : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}>
                    {selected && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save feedback / status */}
        {savedKey && (
          <div style={{
            fontSize: 13, fontFamily: V.space, color: V.green,
            padding: '8px 16px', background: `${V.green}12`,
            border: `1px solid ${V.green}30`, borderRadius: 8,
            display: 'inline-block',
          }}>
            Saved
          </div>
        )}

        {/* Back to portal */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${V.border}` }}>
          <Link
            to={`${basePath}/portal`}
            style={{
              fontSize: 13, fontFamily: V.space, color: V.muted,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            Back to My Portal
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function SourcingSettings() {
  return (
    <SourcingThemeProvider>
      <SourcingSettingsInner />
    </SourcingThemeProvider>
  );
}
