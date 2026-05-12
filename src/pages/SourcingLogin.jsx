import React, { useState, useEffect } from 'react';
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

  // Password recovery flow
  const [showNewPw, setShowNewPw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [newPwLoading, setNewPwLoading] = useState(false);
  const [newPwError, setNewPwError] = useState('');
  const [newPwDone, setNewPwDone] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setShowNewPw(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    if (newPw.length < 6) { setNewPwError('Password must be at least 6 characters.'); return; }
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

      let activeMember = member;

      // Auto-provision member if auth succeeded but no member record exists
      if (memberErr || !member) {
        if (!tenant?.id) {
          setError('No member account found. Please sign up first.');
          return;
        }

        // Find their company in this tenant
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
          return;
        }

        activeMember = newMember;
      }

      if (activeMember.status === 'approved') {
        navigate(activeMember.role === 'admin' ? '/admin' : `${basePath}/portal`);
      } else if (activeMember.status === 'pending') {
        setStatusMessage('Your account is pending review. You will receive an email when approved.');
      } else if (activeMember.status === 'rejected') {
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

  // Password recovery screen
  if (showNewPw) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="login-card" style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>sourcing.directory</div>
          {newPwDone ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>
                <svg width="40" height="40" fill="none" stroke="var(--emerald)" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div className="login-title">Password updated</div>
              <div className="login-sub" style={{ marginBottom: 20 }}>You can now sign in with your new password.</div>
              <Link to={basePath + '/login'} className="login-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }} onClick={() => { setShowNewPw(false); setNewPwDone(false); }}>
                Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="login-title">Set new password</div>
              <div className="login-sub">Choose a new password for your account.</div>
              <form onSubmit={handleSetNewPassword}>
                <label className="login-label">New Password</label>
                <input
                  className="login-input"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  autoFocus
                />
                {newPwError && <div style={{ color: '#FB7185', fontSize: 13, marginBottom: 12 }}>{newPwError}</div>}
                <button className="login-btn" type="submit" disabled={newPwLoading}>
                  {newPwLoading ? 'Saving...' : 'Save Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

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
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--tx)' }}>
      {/* v10 Hero */}
      <div className="browse-hero" style={{ minHeight: 180 }}>
        <div className="browse-hero-bg" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80')" }} />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content">
          <Link to={basePath} className="browse-back" style={{ textDecoration: 'none' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
            Back
          </Link>
        </div>
      </div>

      <div className="login-wrap" style={{ paddingTop: 24 }}>
        <div className="login-card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>sourcing.directory</div>
          <div className="login-title">Welcome back</div>
          <div className="login-sub">Sign in to manage your company and post content.</div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column' }}>
            <label className="login-label">Email</label>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoFocus
            />
            <label className="login-label">Password</label>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
            />

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

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--tx3)' }}>
            Don't have an account? <Link to={`${basePath}/signup`} style={{ color: 'var(--cyan)', textDecoration: 'none' }}>Sign up</Link>
          </div>
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
