// Onboarding — "Tell us about your work." Profile + role + industries → /start.
// Accounts are paused (no database), so the profile lives on this device and a
// copy of the signup (never the password) is emailed to the team.

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import SDLogo from './SDLogo.jsx';
import { INDUSTRIES, loadProfile, saveProfile } from './industries.js';
import './sd.css';

const ROLES = [
  { key: 'buyer', label: 'Buyer' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'both', label: 'Both' },
];

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>
);

export default function SDOnboarding() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const prior = loadProfile() || {};
  const [name, setName] = useState(prior.name || '');
  const [email, setEmail] = useState(params.get('email') || prior.email || '');
  const [company, setCompany] = useState(prior.company || '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState(prior.role || 'buyer');
  const [picked, setPicked] = useState(() => {
    const pre = params.get('industry');
    if (pre) return [pre];
    return prior.industries?.length ? prior.industries : INDUSTRIES.map((i) => i.slug);
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = 'Create your account | Sourcing Directory'; }, []);

  const toggle = (slug) => setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Add your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('Enter a valid work email.');
    if (!picked.length) return setErr('Pick at least one industry.');
    setErr(''); setBusy(true);
    const profile = { name: name.trim(), email: email.trim(), company: company.trim(), role, industries: picked };
    saveProfile(profile);
    try {
      await fetch('/api/sd-signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
    } catch { /* offline is fine, the profile is saved on the device */ }
    nav('/start');
  };

  return (
    <div className="sd-page">
      <header className="sd-top">
        <Link to="/" style={{ textDecoration: 'none' }}><SDLogo size="md" /></Link>
        <Link className="sd-top__link" to="/start">Sign in</Link>
      </header>

      <main className="sd-onb">
        <h1 className="sd-onb__h1">Tell us about your work<span className="sd-dot">.</span></h1>
        <p className="sd-onb__sub">Create your account and choose the industries you want to explore.</p>

        <form onSubmit={submit} noValidate>
          <div className="sd-onb__cols">
            <section className="sd-card sd-onb__form">
              <label className="sd-field"><span className="sd-label">Full name</span>
                <input className="sd-input" autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="sd-field"><span className="sd-label">Work email</span>
                <input className="sd-input" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="sd-field"><span className="sd-label">Company</span>
                <input className="sd-input" autoComplete="organization" placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label className="sd-field"><span className="sd-label">Password</span>
                <span style={{ position: 'relative', display: 'block' }}>
                  <input className="sd-input" type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Create a password"
                    value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 56 }} />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: '#fff', cursor: 'pointer', padding: 6 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </span>
              </label>
              <div className="sd-field">
                <span className="sd-label">How will you use Sourcing Directory?</span>
                <div className="sd-onb__roles" role="radiogroup" aria-label="How will you use Sourcing Directory?">
                  {ROLES.map((r) => (
                    <button key={r.key} type="button" role="radio" aria-checked={role === r.key}
                      className={`sd-role${role === r.key ? ' is-on' : ''}`} onClick={() => setRole(r.key)}>
                      <span className="sd-role__dot" />{r.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="sd-card">
              <h2 className="sd-onb__ind-h">Your industries</h2>
              <p className="sd-onb__ind-sub">Select all that apply.</p>
              <div className="sd-onb__ind">
                {INDUSTRIES.map((ind) => {
                  const on = picked.includes(ind.slug);
                  return (
                    <button key={ind.slug} type="button" className={`sd-tile${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggle(ind.slug)}>
                      <img src={ind.image} alt="" />
                      {!ind.live ? <span className="sd-soon">Coming soon</span> : null}
                      <span className="sd-check">{on ? <Check /> : null}</span>
                      <span className="sd-tile__label">{ind.name}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="sd-more-link" onClick={() => setErr('More industries are on the way. Pick the closest one for now.')}>
                More industries
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg>
              </button>
            </section>
          </div>

          {err ? <p className="sd-error" style={{ marginTop: 16, textAlign: 'center' }}>{err}</p> : null}

          <div className="sd-onb__submit">
            <button className="sd-btn sd-btn--block" type="submit" disabled={busy} style={{ height: 60, fontSize: 22 }}>
              {busy ? 'Creating…' : 'Create account'}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg>
            </button>
          </div>
          <p className="sd-onb__foot">Already have an account? <Link to="/start">Sign in</Link></p>
        </form>
      </main>
    </div>
  );
}
