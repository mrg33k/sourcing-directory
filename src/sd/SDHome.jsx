// Front door — "Find the right source." Email → onboarding.

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SDLogo from './SDLogo.jsx';
import { INDUSTRIES, loadProfile } from './industries.js';
import './sd.css';

export default function SDHome() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const known = loadProfile();

  useEffect(() => { document.title = 'Sourcing Directory | Find the right source'; }, []);

  const go = (e) => {
    e.preventDefault();
    const v = email.trim();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setErr('Enter a valid work email.'); return; }
    nav(`/get-started${v ? `?email=${encodeURIComponent(v)}` : ''}`);
  };

  return (
    <div className="sd-page">
      <header className="sd-top">
        <Link to="/" style={{ textDecoration: 'none' }}><SDLogo size="md" /></Link>
        {known
          ? <Link className="sd-top__link" to="/start">My directories</Link>
          : <Link className="sd-top__link" to="/start">Sign in</Link>}
      </header>

      <main className="sd-home">
        <div>
          <h1 className="sd-home__h1">Find the<br />right source<span className="sd-dot">.</span></h1>
          <p className="sd-home__sub">Explore suppliers across manufacturing, aerospace, construction, semiconductors, and beyond.</p>
          <form className="sd-home__form" onSubmit={go} noValidate>
            <label className="sd-home__email">
              <svg width="30" height="22" viewBox="0 0 30 22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="1" y="1" width="28" height="20" rx="2" /><path d="M1.5 2l13.5 10L28.5 2" /></svg>
              <input className="sd-input" type="email" inputMode="email" autoComplete="email" placeholder="Work email"
                aria-label="Work email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} />
            </label>
            <button className="sd-btn" type="submit">Get started
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg>
            </button>
          </form>
          {err ? <p className="sd-error" style={{ marginTop: 10 }}>{err}</p> : null}
          <p className="sd-home__note">Create your account to choose your industries.</p>
        </div>

        <div className="sd-home__grid">
          {INDUSTRIES.map((ind) => (
            <Link key={ind.slug} to={`/get-started?industry=${ind.slug}`} className="sd-tile">
              <img src={ind.image} alt="" loading="eager" />
              <span className="sd-tile__label">{ind.name}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
