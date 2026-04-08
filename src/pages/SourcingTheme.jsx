import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

// ─── Theme Context ─────────────────────────────────────────────────────────────
export const SourcingThemeContext = createContext({ dark: true, toggle: () => {} });

export function SourcingThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem('sourcing-theme');
      return stored !== null ? stored === 'dark' : true; // default dark
    } catch {
      return true;
    }
  });

  const toggle = () => {
    setDark(prev => {
      const next = !prev;
      try { localStorage.setItem('sourcing-theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  };

  return (
    <SourcingThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </SourcingThemeContext.Provider>
  );
}

export function useSourcingTheme() {
  return useContext(SourcingThemeContext);
}

// ─── Token builder ─────────────────────────────────────────────────────────────
// Returns V tokens for the current theme mode.
export function getTokens(dark) {
  // v10 design system -- always dark
  return {
    bg:        'var(--bg, #06060A)',
    card:      'var(--s1, #0E0E14)',
    card2:     'var(--s2, #15151E)',
    cardHov:   'var(--s3, #1C1C28)',
    accent:    'var(--cyan, #22D3EE)',
    accentHov: '#06B6D4',
    accentDim: 'var(--cyan-dim, rgba(34,211,238,0.08))',
    accentBrd: 'var(--cyan-brd, rgba(34,211,238,0.2))',
    blue:      '#3B82F6',
    text:      'var(--tx, #F0F0F5)',
    heading:   '#ffffff',
    muted:     'var(--tx2, rgba(240,240,245,0.55))',
    dim:       'var(--tx3, rgba(240,240,245,0.25))',
    border:    'var(--bd, rgba(255,255,255,0.06))',
    borderHov: 'var(--cyan-brd, rgba(34,211,238,0.2))',
    green:     'var(--emerald, #34D399)',
    violet:    'var(--violet, #A78BFA)',
    amber:     'var(--amber, #FBBF24)',
    rose:      'var(--rose, #FB7185)',
    navBg:     'rgba(6,6,10,0.94)',
    font:      "'Inter', system-ui, sans-serif",
    // Keep old font refs for backward compat during migration
    syne:      "'Inter', system-ui, sans-serif",
    space:     "'Inter', system-ui, sans-serif",
    mono:      "'Inter', system-ui, sans-serif",
  };
}

// ─── Tenant Hook ──────────────────────────────────────────────────────────────
// Reads tenantSlug from URL, fetches tenant record. Returns { tenant, tenantSlug, loading }.
export function useTenant() {
  const { tenantSlug } = useParams();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(!!tenantSlug);

  useEffect(() => {
    if (!tenantSlug) { setLoading(false); return; }
    let cancelled = false;
    async function load() {
      try {
        // Try API
        const res = await fetch(`/api/sourcing/tenants?slug=${tenantSlug}`);
        if (res.ok && !cancelled) { setTenant(await res.json()); setLoading(false); return; }
      } catch { /* fall through */ }
      // Direct Supabase fallback
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (url && key) {
          const sb = createClient(url, key);
          const { data } = await sb.from('directory_tenants').select('*').eq('slug', tenantSlug).single();
          if (data && !cancelled) setTenant(data);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [tenantSlug]);

  return { tenant, tenantSlug, loading };
}

// ─── Theme Toggle Button ───────────────────────────────────────────────────────
export function ThemeToggle() {
  const { dark, toggle } = useSourcingTheme();
  const V = getTokens(dark);
  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'transparent',
        border: `1px solid ${V.border}`,
        borderRadius: 7,
        padding: '5px 10px',
        cursor: 'pointer',
        color: V.muted,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        fontFamily: V.space,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = V.accent;
        e.currentTarget.style.color = V.accent;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = V.border;
        e.currentTarget.style.color = V.muted;
      }}
    >
      {dark ? (
        // Sun icon
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        // Moon icon
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
      {dark ? 'Light' : 'Dark'}
    </button>
  );
}
