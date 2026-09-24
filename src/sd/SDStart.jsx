// "Where would you like to start?" — the user's industries, each opens its directory.

import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SDLogo from './SDLogo.jsx';
import { INDUSTRIES, directoryHref, loadProfile } from './industries.js';
import './sd.css';

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
);

export default function SDStart() {
  const nav = useNavigate();
  const profile = loadProfile();
  const mine = profile?.industries?.length
    ? INDUSTRIES.filter((i) => profile.industries.includes(i.slug))
    : INDUSTRIES;
  // Live directories first so the highlighted card always opens something.
  const list = [...mine].sort((a, b) => Number(b.live) - Number(a.live));
  const others = INDUSTRIES.filter((i) => !mine.includes(i));

  useEffect(() => { document.title = 'Where would you like to start? | Sourcing Directory'; }, []);

  return (
    <div className="sd-page">
      <header className="sd-top">
        <Link to="/" style={{ textDecoration: 'none' }}><SDLogo size="md" /></Link>
        <Link className="sd-top__link" to="/get-started">
          Edit industries
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>
        </Link>
      </header>

      <main className="sd-start">
        <h1 className="sd-onb__h1">Where would you like to start?<span className="sd-dot">.</span></h1>
        <p className="sd-onb__sub" style={{ marginBottom: 0 }}>Choose one of your industries. You can switch directories anytime.</p>

        <div className="sd-start__grid">
          {list.map((ind, i) => {
            const href = directoryHref(ind);
            const body = (
              <>
                <img src={ind.wide || ind.image} alt="" />
                {!ind.live ? <span className="sd-soon">Coming soon</span> : null}
                <span className="sd-start__name">{ind.name}</span>
                <span className="sd-start__open">
                  {ind.live ? 'Open directory' : 'Opening soon'}
                  <span className="sd-start__arrow"><Arrow /></span>
                </span>
              </>
            );
            const cls = `sd-tile${i === 0 && ind.live ? ' is-first' : ''}${ind.live ? '' : ' is-soon'}`;
            return href
              ? <Link key={ind.slug} to={href} className={cls}>{body}</Link>
              : <div key={ind.slug} className={cls} aria-disabled="true">{body}</div>;
          })}
        </div>

        <div className="sd-start__more">
          {others.length
            ? <button type="button" onClick={() => nav('/get-started')}>Explore more industries <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg></button>
            : <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }}>More industries are on the way.</span>}
        </div>
      </main>
    </div>
  );
}
