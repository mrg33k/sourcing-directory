import React from 'react';
import { Link } from 'react-router-dom';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';
import './srw-blueprint.css';

const WHAT_YOU_GET = [
  { label: 'Jobs, Grants & Deal Flow',     desc: 'Open roles, funding opportunities, and active deal flow across the Arizona space sector.' },
  { label: 'Events & Briefings',           desc: 'Conferences, roundtables, and insider briefings keeping the ecosystem connected.' },
  { label: 'Reports & White Papers',       desc: 'Original research, industry analysis, and the Arizona Space Blueprint™ — included free.' },
  { label: 'Marketplace Access',           desc: 'Connect with suppliers, partners, and service providers across the space supply chain.' },
];

const FINDINGS = [
  { num: '01', headline: 'Scale, not innovation, is the constraint.',  body: 'Arizona leads in space manufacturing concentration. The bottleneck is scaling production — not the ideas or technology to do it.' },
  { num: '02', headline: 'People are the bottleneck.',                 body: 'Workforce pipeline gaps limit how fast the industry can grow. Talent coordination across universities and industry is the unlock.' },
  { num: '03', headline: 'Infrastructure is coordination.',            body: "The physical assets exist. What's missing is the connective layer that lets them work together at speed." },
  { num: '04', headline: 'Power determines possibility.',              body: "Energy availability and grid access will define which space economy ambitions are achievable in Arizona — and which aren't." },
];

export default function SRWBlueprintV2() {
  useSRWTitle('Arizona Space Blueprint™ | Space Rising');

  return (
    <div data-srw="v2" data-page="blueprint">
      <SRWNavV2 />

      {/* ── Hero ── */}
      <header className="bp-hero">
        <div className="bp-hero-img" />
        <div className="bp-hero-overlay" />
        <div className="bp-hero-inner srw-wrap">
          <div className="srw-pg-eyebrow">THE ARIZONA SPACE BLUEPRINT™</div>
          <h1 className="bp-hero-title">
            One Subscription.<br />Unlimited Access to<br />the Space Economy<span className="srw-pg-period">.</span>
          </h1>
          <p className="bp-hero-sub">
            Join SpaceOS and gain access to the opportunities, intelligence,
            and connections shaping the future of space.
          </p>
          <div className="bp-hero-cta-row">
            <Link to="/srw-v2/sign-up" className="srw-pg-cta solid">Join SpaceOS — $500/yr →</Link>
            <a href="#blueprint" className="srw-pg-cta line">Get the Blueprint only — $142</a>
          </div>
          <p className="bp-hero-note">Arizona Space Blueprint™ included free with every membership.</p>
        </div>
      </header>

      {/* ── What you get ── */}
      <section className="srw-pg-section bp-access">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">MEMBERSHIP ACCESS</div>
            <h2 className="srw-pg-section-title">
              Everything you need to move inside the space economy<span className="srw-pg-period">.</span>
            </h2>
          </div>
          <div className="bp-access-grid">
            {WHAT_YOU_GET.map((item) => (
              <div className="bp-access-card" key={item.label}>
                <div className="bp-access-check">✓</div>
                <div>
                  <div className="bp-access-label">{item.label}</div>
                  <div className="bp-access-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Blueprint callout ── */}
      <section className="bp-callout" id="blueprint">
        <div className="srw-wrap">
          <div className="bp-callout-inner">
            <div className="bp-callout-left">
              <div className="srw-pg-eyebrow">INCLUDED WITH MEMBERSHIP</div>
              <h2 className="bp-callout-title">
                Get the Arizona Space Blueprint™<span className="srw-pg-period">.</span>
              </h2>
              <p className="bp-callout-body">
                37 pages built from Arizona's first Space Congress™ findings, industry data,
                and conversations with the people already building the state's space economy.
                This is the first operating document produced by the Space Rising community.
              </p>
              <p className="bp-callout-body" style={{ marginTop: '1rem' }}>
                Arizona has the manufacturing. Arizona has the talent. Arizona has the research.
                What Arizona hasn't had — until now — is a coordinated plan.
              </p>
              <div className="bp-callout-pricing">
                <div className="bp-price-block">
                  <div className="bp-price-label">WITH MEMBERSHIP</div>
                  <div className="bp-price-value">Free</div>
                  <div className="bp-price-sub">$500/year · less than $42/month</div>
                  <Link to="/srw-v2/sign-up" className="srw-pg-cta solid" style={{ display: 'inline-block', marginTop: '1.25rem' }}>
                    Join SpaceOS →
                  </Link>
                </div>
                <div className="bp-price-divider" />
                <div className="bp-price-block">
                  <div className="bp-price-label">STANDALONE</div>
                  <div className="bp-price-value">$142</div>
                  <div className="bp-price-sub">One-time purchase</div>
                  <a href="mailto:hello@spacerising.org?subject=Arizona Space Blueprint" className="srw-pg-cta line" style={{ display: 'inline-block', marginTop: '1.25rem' }}>
                    Buy the Blueprint →
                  </a>
                </div>
              </div>
            </div>
            <div className="bp-callout-badge">
              <div className="bp-badge-inner">
                <div className="bp-badge-icon">◈</div>
                <div className="bp-badge-name">Arizona Space Blueprint™</div>
                <div className="bp-badge-pages">37 pages</div>
                <div className="bp-badge-tag">Space Congress™ 2025</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Key findings ── */}
      <section className="srw-pg-section">
        <div className="srw-wrap">
          <div className="srw-pg-section-head">
            <div className="srw-pg-eyebrow">KEY FINDINGS</div>
            <h2 className="srw-pg-section-title">
              What Arizona's first Space Congress™ revealed<span className="srw-pg-period">.</span>
            </h2>
            <p className="srw-pg-section-lede">
              Four findings. Drawn from industry data, Congress attendees, university leaders, and the executives already building Arizona's space economy.
            </p>
          </div>
          <div className="bp-findings-grid">
            {FINDINGS.map((f) => (
              <div className="bp-finding" key={f.num}>
                <div className="bp-finding-num">{f.num}</div>
                <div className="bp-finding-headline">{f.headline}</div>
                <div className="bp-finding-body">{f.body}</div>
              </div>
            ))}
          </div>
          <p className="bp-findings-cta-note">
            Full analysis — including data, methodology, and implementation roadmap — in the Arizona Space Blueprint™.
          </p>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="bp-bottom-cta">
        <div className="srw-wrap">
          <div className="srw-pg-eyebrow" style={{ textAlign: 'center' }}>JOIN THE MOVEMENT</div>
          <h2 className="bp-bottom-title">
            The Blueprint is not the end product<span className="srw-pg-period">.</span><br />
            It's the starting point<span className="srw-pg-period">.</span>
          </h2>
          <p className="bp-bottom-sub">
            The work now moves into implementation through SpaceOS. Join the platform. Get the Blueprint. Help build Arizona's next chapter.
          </p>
          <div className="bp-hero-cta-row" style={{ justifyContent: 'center' }}>
            <Link to="/srw-v2/sign-up" className="srw-pg-cta solid">Join SpaceOS — $500/yr →</Link>
            <a href="mailto:hello@spacerising.org?subject=Arizona Space Blueprint" className="srw-pg-cta line">Get the Blueprint only</a>
          </div>
        </div>
      </section>

      <SRWFooterV2 />
    </div>
  );
}
