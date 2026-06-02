// SourcingLoginV2.jsx
// nat-geo-uplift — V2-skinned login.
// Uses the srsv2-* signup aesthetic (line-style inputs, amber accents).
// Auth logic mirrors SourcingLogin.jsx: signInWithPassword + PASSWORD_RECOVERY +
// /api/sourcing/reset-email. On success → /space-rising-v2.

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider } from './SourcingTheme.jsx';
import '../space-rising-theme-v2.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';
const BASE_PATH_V2 = '/space-rising-v2';

function SourcingLoginV2Inner() {
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Forgot password flow
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // PASSWORD_RECOVERY flow (Supabase magic link)
  const [showNewPw, setShowNewPw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [newPwLoading, setNewPwLoading] = useState(false);
  const [newPwError, setNewPwError] = useState('');
  const [newPwDone, setNewPwDone] = useState(false);

  // Tenant row for org_name on reset-email
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from('directory_tenants')
        .select('*')
        .eq('slug', TENANT_DB_LOOKUP_SLUG)
        .single();
      if (data) setTenant(data);
    })();
  }, []);

  // Recovery hook
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setShowNewPw(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    if (newPw.length < 6) {
      setNewPwError('Password must be at least 6 characters.');
      return;
    }
    setNewPwLoading(true);
    setNewPwError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setNewPwDone(true);
    } catch (err) {
      setNewPwError(err.message || 'Failed to update password.');
    } finally {
      setNewPwLoading(false);
    }
  };

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
          org_name: tenant?.name || 'Space Rising',
          redirect_to: `${window.location.origin}${BASE_PATH_V2}/login`,
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
      setError('Supabase not configured.');
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

      // Member status check, mirroring V1
      const { data: member, error: memberErr } = await supabase
        .from('directory_members')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .eq('tenant_id', tenant?.id)
        .single();

      let activeMember = member;

      if (memberErr || !member) {
        if (!tenant?.id) {
          setError('No member account found. Please sign up first.');
          setLoading(false);
          return;
        }
        const { data: companies } = await supabase
          .from('directory_companies')
          .select('id')
          .eq('email', authData.user.email)
          .eq('tenant_id', tenant.id)
          .limit(1);

        const { data: newMember, error: provisionErr } = await supabase
          .from('directory_members')
          .insert({
            tenant_id: tenant.id,
            auth_user_id: authData.user.id,
            email: authData.user.email,
            full_name: authData.user.user_metadata?.full_name || authData.user.email.split('@')[0],
            company_id: companies?.[0]?.id || null,
            status: 'approved',
            role: 'member',
          })
          .select()
          .single();

        if (provisionErr) {
          console.error('Auto-provision member failed:', provisionErr);
          setError('Could not set up your account. Please contact support.');
          setLoading(false);
          return;
        }
        activeMember = newMember;
      }

      if (activeMember.status === 'approved') {
        navigate(activeMember.role === 'admin' ? '/admin' : `${BASE_PATH_V2}/portal`);
      } else if (activeMember.status === 'pending') {
        setStatusMessage('Your account is pending review. You will receive an email when approved.');
      } else if (activeMember.status === 'rejected') {
        setStatusMessage('Your application was not approved. Please contact the directory administrator.');
      }
    } catch (err) {
      console.error('LoginV2 error:', err);
      if (err.message?.includes('Invalid login credentials')) {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // PASSWORD_RECOVERY view
  if (showNewPw) {
    return (
      <div className="srsv2-shell" data-tenant="space-rising-v2">
        <div className="srsv2-veil" />
        <div className="srsv2-topbar">
          <Link to={BASE_PATH_V2} className="srsv2-wordmark">SPACE RISING</Link>
          <div className="srsv2-progress" />
          <Link to={BASE_PATH_V2} className="srsv2-close" aria-label="Close">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </Link>
        </div>
        <div className="srsv2-body">
          {newPwDone ? (
            <div className="srsv2-step srsv2-step-success">
              <div className="srsv2-eyebrow">UPDATED</div>
              <div className="srsv2-title">Password set<span className="srsv2-period">.</span></div>
              <div className="srsv2-sub">You can now sign in with your new password.</div>
              <div className="srsv2-cta-row">
                <button
                  type="button"
                  className="srsv2-cta srsv2-cta-solid"
                  onClick={() => { setShowNewPw(false); setNewPwDone(false); }}
                >
                  Sign In
                </button>
              </div>
            </div>
          ) : (
            <div className="srsv2-step">
              <div className="srsv2-eyebrow">RESET PASSWORD</div>
              <h1 className="srsv2-title">Choose a new password<span className="srsv2-period">.</span></h1>
              <div className="srsv2-sub">Minimum 6 characters.</div>
              <form onSubmit={handleSetNewPassword}>
                <label className="srsv2-field">
                  <span className="srsv2-label">New Password</span>
                  <input
                    className="srsv2-input"
                    type="password"
                    placeholder="••••••••"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    autoFocus
                  />
                </label>
                {newPwError && <div className="srsv2-error">{newPwError}</div>}
                <div className="srsv2-actions">
                  <button
                    type="submit"
                    className="srsv2-cta srsv2-cta-solid"
                    disabled={newPwLoading}
                  >
                    {newPwLoading ? 'Saving…' : 'Save Password'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="srsv2-shell" data-tenant="space-rising-v2">
      <div className="srsv2-veil" />

      <div className="srsv2-topbar">
        <Link to={BASE_PATH_V2} className="srsv2-wordmark">SPACE RISING</Link>
        <div className="srsv2-progress" />
        <Link to={BASE_PATH_V2} className="srsv2-close" aria-label="Close">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </Link>
      </div>

      <div className="srsv2-body">
        <div className="srsv2-step">
          <div className="srsv2-eyebrow">SIGN IN</div>
          <h1 className="srsv2-title">Welcome back<span className="srsv2-period">.</span></h1>
          <div className="srsv2-sub">Sign in to manage your listing and post content.</div>

          <form onSubmit={handleLogin}>
            <label className="srsv2-field">
              <span className="srsv2-label">Email</span>
              <input
                className="srsv2-input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </label>
            <label className="srsv2-field">
              <span className="srsv2-label">Password</span>
              <input
                className="srsv2-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => { setShowReset(!showReset); setResetEmail(email); setResetMessage(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(232,228,218,0.55)',
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Forgot your password?
              </button>
            </div>

            {showReset && (
              <div style={{
                marginTop: 20,
                padding: '20px 22px',
                border: '1px solid rgba(232,228,218,0.10)',
                borderRadius: 10,
                background: 'rgba(11,11,13,0.55)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(232,228,218,0.55)',
                }}>
                  Reset password
                </div>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="srsv2-input"
                  style={{ fontSize: 16 }}
                />
                {resetMessage && (
                  <div style={{
                    fontSize: 13,
                    color: resetMessage.includes('sent') ? '#86EFAC' : '#FCA5A5',
                    fontFamily: 'inherit',
                  }}>
                    {resetMessage}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetLoading}
                  className="srsv2-cta srsv2-cta-line"
                  style={{ alignSelf: 'flex-start' }}
                >
                  {resetLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </div>
            )}

            {error && <div className="srsv2-error">{error}</div>}
            {statusMessage && (
              <div style={{
                marginTop: 16,
                padding: '12px 14px',
                borderRadius: 8,
                background: 'rgba(232,162,58,0.10)',
                border: '1px solid rgba(232,162,58,0.32)',
                color: '#E8A23A',
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                {statusMessage}
              </div>
            )}

            <div className="srsv2-actions">
              <button
                type="submit"
                className="srsv2-cta srsv2-cta-solid"
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </div>
          </form>

          <div style={{
            marginTop: 32,
            textAlign: 'center',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(232,228,218,0.45)',
          }}>
            New here?{' '}
            <Link
              to={`${BASE_PATH_V2}/signup`}
              style={{ color: '#E8A23A', textDecoration: 'none' }}
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SourcingLoginV2() {
  return (
    <SourcingThemeProvider>
      <SourcingLoginV2Inner />
    </SourcingThemeProvider>
  );
}
