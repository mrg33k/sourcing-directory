// SourcingLoginV2.jsx (v3 — reskinned to light/navy system)
// Auth logic unchanged: signInWithPassword + PASSWORD_RECOVERY + /api/sourcing/reset-email.
// Render inside v3 shell (light content area). On success → /spaceos or /admin.

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import '../osv3-tokens.css';
import '../pages/OSLayoutV3.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';
const BASE_PATH_V2 = '/spaceos';

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

  // PASSWORD_RECOVERY view (v3 light card)
  if (showNewPw) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {newPwDone ? (
            <div style={{
              background: 'white',
              border: '1px solid var(--v3-border)',
              borderRadius: '8px',
              padding: '40px 32px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 'var(--v3-eyebrow-font-size)', fontWeight: 'var(--v3-eyebrow-font-weight)', color: 'var(--v3-muted)', letterSpacing: 'var(--v3-eyebrow-letter-spacing)', textTransform: 'uppercase', marginBottom: '16px' }}>
                Updated
              </div>
              <h1 style={{ fontSize: 'var(--v3-h2-font-size)', fontWeight: 'var(--v3-h2-font-weight)', color: 'var(--v3-ink-primary)', margin: '0 0 12px', lineHeight: 'var(--v3-h2-line-height)' }}>
                Password set.
              </h1>
              <div style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', marginBottom: '32px', lineHeight: 'var(--v3-body-sm-line-height)' }}>
                You can now sign in with your new password.
              </div>
              <button
                type="button"
                onClick={() => { setShowNewPw(false); setNewPwDone(false); }}
                style={{
                  display: 'inline-block',
                  width: '100%',
                  padding: '10px 16px',
                  background: 'var(--v3-accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: 'var(--v3-body-sm-font-size)',
                  fontWeight: 'var(--v3-font-weight-semibold)',
                  cursor: 'pointer',
                  transition: 'background var(--v3-transition-fast)',
                }}
                onMouseEnter={(e) => e.target.style.background = '#B33A1A'}
                onMouseLeave={(e) => e.target.style.background = 'var(--v3-accent)'}
              >
                Sign In
              </button>
            </div>
          ) : (
            <div style={{
              background: 'white',
              border: '1px solid var(--v3-border)',
              borderRadius: '8px',
              padding: '40px 32px',
            }}>
              <div style={{ fontSize: 'var(--v3-eyebrow-font-size)', fontWeight: 'var(--v3-eyebrow-font-weight)', color: 'var(--v3-muted)', letterSpacing: 'var(--v3-eyebrow-letter-spacing)', textTransform: 'uppercase', marginBottom: '16px' }}>
                Reset password
              </div>
              <h1 style={{ fontSize: 'var(--v3-h2-font-size)', fontWeight: 'var(--v3-h2-font-weight)', color: 'var(--v3-ink-primary)', margin: '0 0 8px', lineHeight: 'var(--v3-h2-line-height)' }}>
                Choose a new password.
              </h1>
              <div style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', marginBottom: '28px', lineHeight: 'var(--v3-body-sm-line-height)' }}>
                Minimum 6 characters.
              </div>
              <form onSubmit={handleSetNewPassword}>
                <label style={{ display: 'block', marginBottom: '20px' }}>
                  <div style={{ fontSize: 'var(--v3-label-font-size)', fontWeight: 'var(--v3-font-weight-medium)', color: 'var(--v3-ink-secondary)', marginBottom: '8px' }}>
                    New Password
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid var(--v3-border)',
                      borderRadius: '6px',
                      fontSize: 'var(--v3-body-sm-font-size)',
                      fontFamily: 'var(--v3-font-family-base)',
                      color: 'var(--v3-ink-secondary)',
                      boxSizing: 'border-box',
                      transition: 'border-color var(--v3-transition-fast)',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--v3-accent)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--v3-border)'}
                  />
                </label>
                {newPwError && (
                  <div style={{ fontSize: 'var(--v3-body-sm-font-size)', color: '#DC2626', marginBottom: '16px' }}>
                    {newPwError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={newPwLoading}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 16px',
                    background: newPwLoading ? '#D3D3D3' : 'var(--v3-accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: 'var(--v3-body-sm-font-size)',
                    fontWeight: 'var(--v3-font-weight-semibold)',
                    cursor: newPwLoading ? 'not-allowed' : 'pointer',
                    transition: 'background var(--v3-transition-fast)',
                  }}
                >
                  {newPwLoading ? 'Saving…' : 'Save Password'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main login form (v3 light card)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{
          background: 'white',
          border: '1px solid var(--v3-border)',
          borderRadius: '8px',
          padding: '40px 32px',
        }}>
          <h2 style={{ fontSize: 'var(--v3-h2-font-size)', fontWeight: 'var(--v3-h2-font-weight)', color: 'var(--v3-ink-primary)', margin: '0 0 8px', lineHeight: 'var(--v3-h2-line-height)' }}>
            Sign in to Space OS
          </h2>
          <div style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', marginBottom: '28px', lineHeight: 'var(--v3-body-sm-line-height)' }}>
            Access your directory profile and membership features.
          </div>

          <form onSubmit={handleLogin}>
            <label style={{ display: 'block', marginBottom: '20px' }}>
              <div style={{ fontSize: 'var(--v3-label-font-size)', fontWeight: 'var(--v3-font-weight-medium)', color: 'var(--v3-ink-secondary)', marginBottom: '8px' }}>
                Email address
              </div>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--v3-border)',
                  borderRadius: '6px',
                  fontSize: 'var(--v3-body-sm-font-size)',
                  fontFamily: 'var(--v3-font-family-base)',
                  color: 'var(--v3-ink-secondary)',
                  boxSizing: 'border-box',
                  transition: 'border-color var(--v3-transition-fast)',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--v3-accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--v3-border)'}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '8px' }}>
              <div style={{ fontSize: 'var(--v3-label-font-size)', fontWeight: 'var(--v3-font-weight-medium)', color: 'var(--v3-ink-secondary)', marginBottom: '8px' }}>
                Password
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--v3-border)',
                  borderRadius: '6px',
                  fontSize: 'var(--v3-body-sm-font-size)',
                  fontFamily: 'var(--v3-font-family-base)',
                  color: 'var(--v3-ink-secondary)',
                  boxSizing: 'border-box',
                  transition: 'border-color var(--v3-transition-fast)',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--v3-accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--v3-border)'}
              />
            </label>

            <div style={{ marginTop: 16, marginBottom: 24, textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => { setShowReset(!showReset); setResetEmail(email); setResetMessage(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--v3-link)',
                  fontSize: 'var(--v3-body-sm-font-size)',
                  fontWeight: 'var(--v3-font-weight-medium)',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'none',
                  transition: 'color var(--v3-transition-fast)',
                }}
                onMouseEnter={(e) => e.target.style.color = '#1D4ED8'}
                onMouseLeave={(e) => e.target.style.color = 'var(--v3-link)'}
              >
                Forgot your password?
              </button>
            </div>

            {showReset && (
              <div style={{
                marginBottom: 20,
                padding: '16px 12px',
                border: '1px solid var(--v3-border)',
                borderRadius: '8px',
                background: 'var(--v3-panel-bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{
                  fontSize: 'var(--v3-label-font-size)',
                  fontWeight: 'var(--v3-font-weight-medium)',
                  color: 'var(--v3-muted)',
                }}>
                  Reset password
                </div>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@company.com"
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--v3-border)',
                    borderRadius: '6px',
                    fontSize: 'var(--v3-body-sm-font-size)',
                    fontFamily: 'var(--v3-font-family-base)',
                    color: 'var(--v3-ink-secondary)',
                    boxSizing: 'border-box',
                  }}
                />
                {resetMessage && (
                  <div style={{
                    fontSize: 'var(--v3-body-sm-font-size)',
                    color: resetMessage.includes('sent') ? '#16A34A' : '#DC2626',
                  }}>
                    {resetMessage}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetLoading}
                  style={{
                    padding: '8px 12px',
                    background: 'white',
                    border: '1px solid var(--v3-border)',
                    borderRadius: '6px',
                    color: 'var(--v3-accent)',
                    fontSize: 'var(--v3-body-sm-font-size)',
                    fontWeight: 'var(--v3-font-weight-medium)',
                    cursor: resetLoading ? 'not-allowed' : 'pointer',
                    opacity: resetLoading ? 0.6 : 1,
                    transition: 'all var(--v3-transition-fast)',
                    alignSelf: 'flex-start',
                  }}
                >
                  {resetLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </div>
            )}

            {error && (
              <div style={{
                fontSize: 'var(--v3-body-sm-font-size)',
                color: '#DC2626',
                marginBottom: '16px',
                padding: '12px 12px',
                background: '#FEE2E2',
                borderRadius: '6px',
              }}>
                {error}
              </div>
            )}
            {statusMessage && (
              <div style={{
                marginBottom: '16px',
                padding: '12px 12px',
                borderRadius: '6px',
                background: '#FEF3C7',
                border: '1px solid #FCD34D',
                color: '#92400E',
                fontSize: 'var(--v3-body-sm-font-size)',
                lineHeight: 'var(--v3-body-sm-line-height)',
              }}>
                {statusMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                background: loading ? '#D3D3D3' : 'var(--v3-accent)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: 'var(--v3-body-sm-font-size)',
                fontWeight: 'var(--v3-font-weight-semibold)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background var(--v3-transition-fast)',
              }}
              onMouseEnter={(e) => !loading && (e.target.style.background = '#B33A1A')}
              onMouseLeave={(e) => !loading && (e.target.style.background = 'var(--v3-accent)')}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={{
            marginTop: 24,
            textAlign: 'center',
            fontSize: 'var(--v3-body-sm-font-size)',
            color: 'var(--v3-muted)',
          }}>
            New here?{' '}
            <Link
              to="/signup"
              style={{ color: 'var(--v3-link)', textDecoration: 'none', fontWeight: 'var(--v3-font-weight-medium)' }}
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
  return <SourcingLoginV2Inner />;
}
