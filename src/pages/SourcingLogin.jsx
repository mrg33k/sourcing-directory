import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens, useTenant } from './SourcingTheme.jsx';

// ─── Inner component ──────────────────────────────────────────────────────────
function SourcingLoginInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const navigate = useNavigate();
  const { tenant, tenantSlug, loading: tenantLoading } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    const target = (resetEmail || email).trim();
    if (!target) {
      setResetMessage('Please enter your email address.');
      return;
    }
    setResetLoading(true);
    setResetMessage('');
    try {
      const res = await fetch('/api/sourcing/reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: target,
          org_name: tenant?.name || 'AOM Sourcing Directory',
          redirect_to: `${window.location.origin}${basePath}/login`,
        }),
      });
      if (res.ok) {
        setResetMessage('Password reset email sent. Check your inbox.');
      } else {
        const data = await res.json();
        setResetMessage(data.error || 'Failed to send reset email. Please try again.');
      }
    } catch (err) {
      setResetMessage('Something went wrong. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase not configured. Run the migration first.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    setError('');
    setStatusMessage('');

    try {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authErr) throw authErr;

      // Check member status in directory_members
      const { data: member, error: memberErr } = await supabase
        .from('directory_members')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .eq('tenant_id', tenant?.id)
        .single();

      if (memberErr || !member) {
        setError('No member account found for this directory. Please sign up first.');
        return;
      }

      if (member.status === 'approved') {
        navigate(`${basePath}/portal`);
      } else if (member.status === 'pending') {
        setStatusMessage('Your account is pending review. You will receive an email when approved.');
      } else if (member.status === 'rejected') {
        setStatusMessage('Your application was not approved. Please contact the directory administrator.');
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.message?.includes('Invalid login credentials')) {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (tenantLoading) {
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
    <div style={{ minHeight: '100vh', background: V.bg, color: V.text, overflowX: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: ${V.dim}; }
        input:focus {
          border-color: ${V.accent} !important;
          box-shadow: 0 0 0 2px ${V.accentDim};
        }
      `}</style>

      {/* Nav */}
      <div style={{
        borderBottom: `1px solid ${V.border}`,
        padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 16, height: 60,
        background: V.navBg,
      }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: V.syne, color: V.accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            AOM
          </span>
        </Link>
        <span style={{ color: V.dim, fontSize: 13 }}>/</span>
        <Link to={basePath} style={{ textDecoration: 'none', fontSize: 13, color: V.muted, fontFamily: V.space }}>
          {tenant?.nav_label || tenant?.name || 'Sourcing Directory'}
        </Link>
        <span style={{ color: V.dim, fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: V.text, fontFamily: V.space }}>Sign In</span>
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 11, color: V.accent, fontFamily: V.mono, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
            Member Portal
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: V.syne, color: V.heading, margin: '0 0 10px', lineHeight: 1.15 }}>
            Sign In
          </h1>
          <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, margin: 0, lineHeight: 1.6 }}>
            Access your company profile and manage listings.
          </p>
        </div>

        <form onSubmit={handleLogin} style={{
          background: V.card, border: `1px solid ${V.border}`,
          borderRadius: 12, padding: '32px 28px',
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>
              Email <span style={{ color: V.accent }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoFocus
              style={{
                background: V.card2, border: `1px solid ${V.border}`,
                color: V.text, borderRadius: 7, padding: '12px 14px',
                fontSize: 14, fontFamily: V.space, outline: 'none',
                width: '100%',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>
              Password <span style={{ color: V.accent }}>*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              style={{
                background: V.card2, border: `1px solid ${V.border}`,
                color: V.text, borderRadius: 7, padding: '12px 14px',
                fontSize: 14, fontFamily: V.space, outline: 'none',
                width: '100%',
              }}
            />
          </div>

          <div style={{ textAlign: 'right', marginTop: -8 }}>
            <button
              type="button"
              onClick={() => { setShowReset(!showReset); setResetEmail(email); setResetMessage(''); }}
              style={{
                background: 'none', border: 'none', color: V.accent,
                fontSize: 12, fontFamily: V.space, cursor: 'pointer',
                padding: 0, textDecoration: 'underline',
              }}
            >
              Forgot password?
            </button>
          </div>

          {showReset && (
            <div style={{
              background: 'rgba(41,182,246,0.05)', border: `1px solid rgba(41,182,246,0.15)`,
              borderRadius: 8, padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ fontSize: 13, color: V.text, fontFamily: V.space, fontWeight: 600 }}>
                Reset your password
              </div>
              <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, lineHeight: 1.5 }}>
                Enter your email and we'll send you a link to reset your password.
              </div>
              <input
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  background: V.card2, border: `1px solid ${V.border}`,
                  color: V.text, borderRadius: 7, padding: '10px 12px',
                  fontSize: 13, fontFamily: V.space, outline: 'none',
                  width: '100%',
                }}
              />
              {resetMessage && (
                <div style={{
                  fontSize: 12, fontFamily: V.space, lineHeight: 1.5,
                  color: resetMessage.includes('sent') ? '#10B981' : '#EF4444',
                }}>
                  {resetMessage}
                </div>
              )}
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={resetLoading}
                style={{
                  background: resetLoading ? `${V.accent}60` : V.accent,
                  border: 'none', color: '#fff', borderRadius: 6, padding: '9px 0',
                  fontSize: 13, fontWeight: 600, fontFamily: V.space,
                  cursor: resetLoading ? 'not-allowed' : 'pointer',
                  width: '100%',
                }}
              >
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          )}

          {error && (
            <div style={{ color: '#EF4444', fontSize: 13, fontFamily: V.space, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {statusMessage && (
            <div style={{ color: '#FDBA74', fontSize: 13, fontFamily: V.space, padding: '12px 14px', background: 'rgba(234,179,8,0.08)', borderRadius: 6, border: '1px solid rgba(234,179,8,0.2)', lineHeight: 1.5 }}>
              {statusMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', background: loading ? `${V.accent}60` : V.accent,
              border: 'none', color: '#fff', borderRadius: 8, padding: '13px 0',
              fontSize: 15, fontWeight: 700, fontFamily: V.space,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', animation: 'spin 0.8s linear infinite' }} />
                Signing in...
              </>
            ) : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
            Don't have an account?{' '}
          </span>
          <Link
            to={`${basePath}/signup`}
            style={{ fontSize: 13, color: V.accent, fontFamily: V.space, textDecoration: 'none', fontWeight: 600 }}
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SourcingLogin() {
  return (
    <SourcingThemeProvider>
      <SourcingLoginInner />
    </SourcingThemeProvider>
  );
}
