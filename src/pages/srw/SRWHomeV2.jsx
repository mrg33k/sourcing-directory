import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

// R7-veo3-pilot — Earth-from-orbit Veo 3 video. Loop-with-parallax bg layer
// per research/2026-05-31-per-section-hero-motion-direction.md. The legacy
// HERO_VIDEO constant below is from the original Squarespace mirror and is
// not used by the V2 home hero — kept for reference until removed in R8.
const HERO_VIDEO_VEO3 = '/v2-assets/home-hero.mp4';

// home-search-takeover — the hero search drops a visitor straight into the OS.
// Companies is the live directory search (?q=); the rest route into their section
// carrying the query. Order = how people enter the OS most often.
const SEARCH_CATEGORIES = [
  { key: 'companies',  label: 'Companies',  hint: 'The space-economy directory',      to: (q) => `/spaceos${q ? `?q=${encodeURIComponent(q)}` : ''}` },
  { key: 'jobs',       label: 'Jobs',       hint: 'Roles across the ecosystem',        to: (q) => `/spaceos/jobs${q ? `?q=${encodeURIComponent(q)}` : ''}` },
  { key: 'deal-bank',  label: 'Deal Bank',  hint: 'Capital, raises, and investors',    to: (q) => `/spaceos/deal-bank${q ? `?q=${encodeURIComponent(q)}` : ''}` },
  { key: 'reports',    label: 'Reports',    hint: 'Blueprints and market intelligence',to: (q) => `/spaceos/reports${q ? `?q=${encodeURIComponent(q)}` : ''}` },
  { key: 'events',     label: 'Events',     hint: 'Conferences and convenings',        to: (q) => `/spaceos/events${q ? `?q=${encodeURIComponent(q)}` : ''}` },
  { key: 'grants',     label: 'Grants',     hint: 'Funding and opportunities',         to: (q) => `/spaceos/grants${q ? `?q=${encodeURIComponent(q)}` : ''}` },
  { key: 'articles',   label: 'Articles',   hint: 'Dispatches and knowledge',          to: (q) => `/spaceos/articles${q ? `?q=${encodeURIComponent(q)}` : ''}` },
];

// Legacy — unused by V2.
const HERO_VIDEO = '/videos/spacerising-hero.mp4';
const HERO_POSTER = 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/341f4645-4175-4b09-a77f-0c2ba6d6b47f/Hero-Image-banner.jpg?format=2500w';
const HERO_OVERLAY = 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/be97f7c9-2222-4898-bdf5-e893d1cfa297/Hero-Image-banner-text_no+date.png?format=2500w';
const ROCKET_BG = 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/e4769b24-1ded-425b-b1a8-0d7e0a77a5b9/AdobeStock_1565186160.jpeg?format=2500w';

// polish-directory-1: stats include parseable target / prefix / suffix /
// decimals so the count-up animation (in the section effect below) can
// interpolate from 0 → target on scroll-into-view. The display `num`
// stays as the canonical brand string for the prefers-reduced-motion
// snapshot.
const STATS = [
  { num: '$570B', target: 570, prefix: '$', suffix: 'B', decimals: 0, label: 'Global Market' },
  { num: '$2T',   target: 2,   prefix: '$', suffix: 'T', decimals: 0, label: 'Projected by 2040' },
  { num: '80%',   target: 80,  prefix: '',  suffix: '%', decimals: 0, label: 'Commercial Activity' },
  { num: '7.4%',  target: 7.4, prefix: '',  suffix: '%', decimals: 1, label: 'Annual Growth Rate' },
];

// The Six Space Market Missions (Taryn's deck, slide 41). Framed as missions, each
// with a one-word market. Defense (Secure Space) intentionally LAST. The heavy
// per-mission visual treatment is a later pass; this is the structural swap.
const OPPORTUNITIES = [
  { title: 'Build Space',      market: 'Infrastructure' },
  { title: 'Move in Space',    market: 'Mobility' },
  { title: 'Live in Space',    market: 'Life' },
  { title: 'Prosper in Space', market: 'Industry' },
  { title: 'Operate in Space', market: 'Intelligence' },
  { title: 'Secure Space',     market: 'Defense' },
];

// Each service row mirrors .org exactly: a single <p> per service with a
// brick-red <strong> "name", a line break, then black body text with black
// inline <strong> for highlighted terms. Order matches .org left-to-right.
const SERVICES = [
  {
    name: 'Space Congress™',
    body: (<>Cross-sector convenings for <strong>regional space alignment.</strong></>),
    to: '/srw-v2/space-congress',
  },
  {
    name: 'SpaceOS™',
    body: (<>The <strong>intelligence infrastructure</strong> connecting the space economy.</>),
    to: '/space-rising-v2',
  },
  {
    name: 'Partnerships',
    body: (<><strong>Commercialization initiatives</strong> partnered with businesses to enter and scale within the space economy.</>),
    to: '/srw-v2/partnerships',
  },
];

export default function SRWHomeV2() {
  useSRWTitle('Space Rising V2 | A New Way To Space');
  const navigate = useNavigate();

  // home-search-takeover — the hero search opens a full-screen takeover that
  // routes the visitor into the OS. searchOpen drives the overlay; searchValue
  // is the live query that every category link carries.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef(null);

  const openSearch = () => setSearchOpen(true);
  const closeSearch = () => setSearchOpen(false);
  const goToCategory = (cat) => { closeSearch(); navigate(cat.to(searchValue.trim())); };
  const onSearchSubmit = (e) => {
    e.preventDefault();
    // Enter defaults to the directory (Companies) carrying the query.
    goToCategory(SEARCH_CATEGORIES[0]);
  };

  // Focus the takeover input when it opens; Esc closes; lock body scroll.
  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 60);
    const onKey = (e) => { if (e.key === 'Escape') closeSearch(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [searchOpen]);

  // Contact form state
  const [contact, setContact] = useState({ first_name: '', last_name: '', email: '', message: '' });
  const [contactStatus, setContactStatus] = useState('idle'); // idle | submitting | success | error
  const [contactError, setContactError] = useState('');

  // polish-directory-1 — stats block count-up animation.
  // Numbers interpolate from 0 → target over 1.6s with ease-out-cubic when
  // the section scrolls into view. Fires exactly once per page load.
  // prefers-reduced-motion → snap to final values immediately so the
  // section never sits at 0 for users with motion disabled.
  const statsRef = useRef(null);
  const [statValues, setStatValues] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? STATS.map(s => s.target)
      : STATS.map(() => 0)
  );
  useEffect(() => {
    const sec = statsRef.current;
    if (!sec) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let fired = false;
    let raf = 0;
    const startAnim = () => {
      const t0 = performance.now();
      const dur = 1600;
      const tick = (now) => {
        const t = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setStatValues(STATS.map(s => s.target * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fired) {
        fired = true;
        // Flip data-stats-visible on the section so the amber bar reveal
        // CSS transition fires alongside the count-up.
        sec.setAttribute('data-stats-visible', 'true');
        startAnim();
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(sec);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // polish-opps-reveal — opportunities grid scroll-into-view reveal.
  // Tiles fade-up + slide-up with stagger when the grid enters the viewport.
  // Single IO at threshold 0.25, fires once. Drives CSS via data-opps-revealed
  // (no setState — pure DOM attribute flip, lighter than a React rerender).
  // prefers-reduced-motion: tiles render at final state via the CSS guard.
  const oppsGridRef = useRef(null);
  useEffect(() => {
    const grid = oppsGridRef.current;
    if (!grid) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      grid.setAttribute('data-opps-revealed', 'true');
      return;
    }
    let fired = false;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fired) {
        fired = true;
        grid.setAttribute('data-opps-revealed', 'true');
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(grid);
    return () => io.disconnect();
  }, []);

  async function handleContact(e) {
    e.preventDefault();
    if (!contact.email || !contact.email.includes('@')) {
      setContactError('Please enter a valid email address.');
      return;
    }
    setContactStatus('submitting');
    setContactError('');
    try {
      const res = await fetch('/api/sourcing/srw-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_type: 'contact', ...contact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setContactStatus('success');
    } catch (err) {
      setContactError(err.message || 'Something went wrong. Please try again.');
      setContactStatus('error');
    }
  }

  // Reverse parallax for the rocket band: image translates UPWARD as the
  // user scrolls down through the section (opposite of background-attachment:fixed).
  const bandRef = useRef(null);
  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = band.getBoundingClientRect();
        const vh = window.innerHeight;
        // progress: 0 when band top reaches viewport bottom, 1 when band bottom leaves the top
        const progress = (vh - rect.top) / (vh + rect.height);
        const clamped = Math.max(0, Math.min(1, progress));
        band.style.setProperty('--srw-band-shift', `${-clamped * 140}px`);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // R7-veo3-pilot — Hero video: loop-with-parallax. Video plays its own slow
  // loop (8s, autoplay muted). As the user scrolls, the video translates upward
  // at 0.4× scroll velocity so the foreground content "rises" off it. Paused
  // when out of viewport to spare GPU. Disabled under prefers-reduced-motion
  // (CSS-side display: none); the static earth.png poster remains visible.
  const heroVideoRef = useRef(null);
  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    // polish-srw-cleanup mobile follow-up: skip the parallax loop on phones
    // entirely. Touch devices don't benefit from the effect and the scroll
    // handler costs CPU. Matches the CSS-side mobile override.
    if (window.matchMedia('(max-width: 768px)').matches) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = Math.max(0, window.scrollY);
        // polish-srw-cleanup: 0.2× velocity, cap at 60px. Previous 0.4×/200px
        // overshot the 10% over-extent on most viewport heights (10% of ~600px
        // hero = ~60px buffer) — translating 200px exposed dark page bg at the
        // bottom edge of the hero. 60px stays safely within the buffer at any
        // sensible viewport size.
        const offset = Math.min(y * 0.2, 60);
        video.style.transform = `translate3d(0, ${-offset}px, 0)`;
      });
    };

    const onCanPlay = () => video.classList.add('is-ready');
    video.addEventListener('canplay', onCanPlay);
    if (video.readyState >= 3) onCanPlay();

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const p = video.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.05 }
    );
    io.observe(video);

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      io.disconnect();
      video.removeEventListener('canplay', onCanPlay);
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div data-srw="v2">
      <SRWNavV2 />

      {/* R4 (nat-geo-uplift) — premium editorial hero. Earth-from-orbit photo as
          full-bleed bg, editorial type lockup overlay with amber-frame label.
          R7-veo3-pilot — Veo 3 Earth-from-orbit video plays over the static
          poster, fading in once buffered. Loop-with-parallax via heroVideoRef. */}
      <header className="srw-hero-v2">
        {/* polish-srw-cleanup: dropped duplicate static .srw-hero-v2-bg div.
            The <video poster="/v2-assets/earth.png"> renders the static
            earth.png until canplay, so the bg div was visual redundancy.
            Removing it kills the "two-image-stack reveal during parallax"
            artifact (Patrik 2026-05-31). prefers-reduced-motion still
            sees the poster image because the video element stays in DOM
            via display:none only on the video itself when needed; the
            poster keeps showing. */}
        <video
          ref={heroVideoRef}
          className="srw-hero-v2-video"
          src={HERO_VIDEO_VEO3}
          poster="/v2-assets/home-hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="srw-hero-v2-veil" aria-hidden="true" />
        <div className="srw-hero-v2-inner">
          <div className="srw-hero-v2-eyebrow">
            <span className="srw-hero-v2-eyebrow-mark" /> THE PLATFORM OF RECORD
          </div>
          <h1 className="srw-hero-v2-headline">A new way to&nbsp;space<span className="srw-hero-v2-dot">.</span></h1>
          <p className="srw-hero-v2-sub">
            The interactive intelligence infrastructure for the global space economy. Where suppliers, manufacturers, capital, and missions find each other.
          </p>
          {/* home-search-takeover — the hero's primary action. Click opens the
              full-screen takeover; the visitor types and lands in the OS. */}
          <button type="button" className="srw-hero-search-trigger" onClick={openSearch} aria-label="Search SpaceOS">
            <svg className="srw-hero-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="srw-hero-search-placeholder">What do you need from space today?</span>
            <span className="srw-hero-search-kbd">Search</span>
          </button>
          <div className="srw-hero-v2-cta-row srw-hero-v2-cta-row-slim">
            <Link to="/spaceos" className="srw-hero-v2-cta-secondary">Enter SpaceOS&trade;</Link>
            <Link to="/srw-v2/about" className="srw-hero-v2-cta-secondary">About Space Rising</Link>
          </div>
        </div>
      </header>

      {/* home-search-takeover — full-screen overlay over the orbital bg. Big
          query input + the category rows that carry the query into the OS. */}
      {searchOpen && (
        <div className="srw-search-takeover" role="dialog" aria-modal="true" aria-label="Search SpaceOS">
          <button type="button" className="srw-search-takeover-scrim" aria-label="Close search" onClick={closeSearch} />
          <div className="srw-search-takeover-panel">
            <div className="srw-search-takeover-top">
              <form className="srw-search-takeover-form" onSubmit={onSearchSubmit}>
                <svg className="srw-search-takeover-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchInputRef}
                  className="srw-search-takeover-input"
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="What do you need from space today?"
                  autoComplete="off"
                  spellCheck="false"
                />
                <button type="button" className="srw-search-takeover-close" onClick={closeSearch} aria-label="Close">Esc</button>
              </form>
            </div>
            <div className="srw-search-takeover-cats">
              <div className="srw-search-takeover-cats-label">
                {searchValue.trim() ? <>Find <span>{searchValue.trim()}</span> in</> : 'Jump into'}
              </div>
              {SEARCH_CATEGORIES.map((cat) => (
                <button type="button" className="srw-search-cat-row" key={cat.key} onClick={() => goToCategory(cat)}>
                  <span className="srw-search-cat-label">{cat.label}</span>
                  <span className="srw-search-cat-hint">{cat.hint}</span>
                  <span className="srw-search-cat-arrow" aria-hidden="true">&rarr;</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* The space economy is scaling — stat block.
          polish-directory-1: count-up animation on the four numbers fires
          once when the section scrolls into view (statsRef + IntersectionObserver).
          Each stat is wrapped in .srw-stat-bar for the new amber accent
          underline that grows in on the same scroll trigger. */}
      <section
        ref={statsRef}
        className="srw-section srw-section-tight srw-stats-section"
        style={{ textAlign: 'center' }}
      >
        <div className="srw-wrap">
          <h1 className="srw-h2-thin">THE SPACE ECONOMY IS SCALING</h1>
          <p className="srw-section-sub-center">we are now entering a mainstream economic infrastructure</p>
          <div className="srw-stats">
            {STATS.map((s, i) => (
              <div className="srw-stat" key={s.label}>
                <div className="srw-stat-num">
                  {s.prefix}
                  {s.decimals === 0
                    ? Math.round(statValues[i])
                    : statValues[i].toFixed(s.decimals)}
                  {s.suffix}
                </div>
                <div className="srw-stat-bar" aria-hidden="true" />
                <div className="srw-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Emerging Opportunities — polish-opps-reveal: scroll-into-view fade-up
          + stagger on the tiles, hover lift on desktop. Same IO + threshold
          0.25 pattern as the stats blocks; data-opps-revealed flips on the
          grid for CSS to drive the stagger via nth-child transition-delays. */}
      <section className="srw-section" style={{ textAlign: 'center', paddingTop: 0 }}>
        <div className="srw-wrap">
          <h2 className="srw-h2-mid">THE SIX SPACE MARKET MISSIONS</h2>
          <div ref={oppsGridRef} className="srw-opp-grid">
            {OPPORTUNITIES.map((o) => (
              <div className="srw-opp" key={o.title}>
                <span className="srw-opp-market">{o.market}</span>
                <span className="srw-opp-label">{o.title}</span>
                <span className="srw-opp-rule" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Connective layer — orange rocket band (reverse parallax driven by JS) */}
      <section
        ref={bandRef}
        className="srw-band srw-band-rocket"
        style={{ '--srw-band-bg-image': `url(${ROCKET_BG})` }}
      >
        <div className="srw-band-bg" />
        <div className="srw-band-veil-rocket" />
        <div className="srw-wrap srw-band-inner">
          <p className="srw-band-copy">
            Space Rising serves as the <strong>connective layer</strong> across the evolving space economy. We translate regional activity into coordinated strategy.
          </p>
          <Link to="/srw-v2/about" className="srw-link-plain">ABOUT&nbsp;→</Link>
        </div>
      </section>

      {/* We mobilize space ecosystems through — white bg, 2-column (heading L, services R)
          Matches spacerising.org: brick-red service names, black body with bold accents. */}
      <section className="srw-mobilize-section">
        <div className="srw-wrap">
          <div className="srw-mobilize-grid">
            <h2 className="srw-mobilize-heading">WE MOBILIZE SPACE ECOSYSTEMS THROUGH</h2>
            <div className="srw-services">
              {SERVICES.map((s) => (
                <Link to={s.to} className="srw-service" key={s.name}>
                  <p>
                    <strong className="srw-service-name">{s.name}</strong>
                    <br /><br />
                    {s.body}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact form — polish-srw-home-contact-form: line-style rebuild,
          editorial section head (eyebrow + amber-period title) above the form,
          mobile box override dropped, section bg matches palette (#0B0B0D),
          duplicate FIRST NAME / LAST NAME hint labels removed. */}
      <section className="srw-contact-form">
        <div className="srw-wrap">
          <div className="srw-contact-head">
            <div className="srw-contact-eyebrow">CONTACT</div>
            <h2 className="srw-h2-thin">Get in touch with Space Rising</h2>
          </div>
          {contactStatus === 'success' ? (
            <div className="srw-contact-success">
              <p>Message received — we'll be in touch.</p>
            </div>
          ) : (
            <form className="srw-form" onSubmit={handleContact} noValidate>
              <div className="srw-form-row">
                <label>
                  <span>Name <em>(required)</em></span>
                  <div className="srw-form-double">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={contact.first_name}
                      onChange={(e) => setContact((p) => ({ ...p, first_name: e.target.value }))}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={contact.last_name}
                      onChange={(e) => setContact((p) => ({ ...p, last_name: e.target.value }))}
                    />
                  </div>
                </label>
              </div>
              <div className="srw-form-row">
                <label>
                  <span>Email <em>(required)</em></span>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
                    required
                  />
                </label>
              </div>
              <div className="srw-form-row">
                <label>
                  <span>Message <em>(required)</em></span>
                  <textarea
                    rows={6}
                    value={contact.message}
                    onChange={(e) => setContact((p) => ({ ...p, message: e.target.value }))}
                    required
                  />
                </label>
              </div>
              {contactError && <div className="srw-form-error">{contactError}</div>}
              <button
                type="submit"
                className="srw-btn-outline"
                disabled={contactStatus === 'submitting'}
              >
                {contactStatus === 'submitting' ? 'SUBMITTING...' : 'SUBMIT'}
              </button>
            </form>
          )}
        </div>
      </section>

      <SRWFooterV2 />
    </div>
  );
}
