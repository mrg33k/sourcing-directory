import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

const AREAS = [
  'Commercial',
  'Economic Development',
  'Defense',
  'Governance',
  'Education',
  'Partnerships',
  'Infrastructure',
  'Outreach',
];

const INITIAL = {
  first_name: '',
  last_name: '',
  email: '',
  newsletter_opt_in: true,
  organization: '',
  areas_of_interest: [],
  message: '',
};

export default function SRWSignUpV2() {
  useSRWTitle('Subscribe | Space Rising');

  const [fields, setFields] = useState(INITIAL);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function set(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArea(area) {
    setFields((prev) => ({
      ...prev,
      areas_of_interest: prev.areas_of_interest.includes(area)
        ? prev.areas_of_interest.filter((a) => a !== area)
        : [...prev.areas_of_interest, area],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fields.email || !fields.email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/sourcing/srw-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_type: 'subscribe', ...fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setStatus('success');
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div data-srw="v2">
      <SRWNavV2 />

      <header
        className="srw-pg-hero"
        style={{ '--srw-pg-hero-bg': "url('/v2-assets/earth.png')" }}
      >
        <div className="srw-pg-hero-inner">
          <div className="srw-pg-eyebrow">SUBSCRIBE</div>
          <h1 className="srw-pg-title">Stay in the room<span className="srw-pg-period">.</span></h1>
          <p className="srw-pg-sub">
            Updates on Space Congress, Arizona ecosystem activity, and access to SpaceOS™. We send when we have something to say — not on a schedule.
          </p>
        </div>
      </header>

      <section className="srw-pg-section">
        <div className="srw-wrap" style={{ maxWidth: 760 }}>
          {status === 'success' ? (
            <div style={{ padding: '40px 0', textAlign: 'left' }}>
              <div className="srw-pg-eyebrow">YOU'RE ON THE LIST</div>
              <h2 className="srw-pg-section-title">Check your inbox<span className="srw-pg-period">.</span></h2>
              <p className="srw-pg-section-lede">
                We sent a welcome — it has your next steps and the SpaceOS™ link.
              </p>
              <div style={{ marginTop: 32 }}>
                <Link to="/spaceos" className="srw-pg-cta solid">Enter SpaceOS™ →</Link>
              </div>
            </div>
          ) : (
            <form className="srw-form" onSubmit={handleSubmit} noValidate>
              <div className="srw-form-row">
                <label>
                  <span>Name <em>(required)</em></span>
                  <div className="srw-form-double">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={fields.first_name}
                      onChange={(e) => set('first_name', e.target.value)}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={fields.last_name}
                      onChange={(e) => set('last_name', e.target.value)}
                    />
                  </div>
                </label>
              </div>

              <div className="srw-form-row">
                <label>
                  <span>Email <em>(required)</em></span>
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={fields.email}
                    onChange={(e) => set('email', e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="srw-form-row">
                <label>
                  <span>Organization <em>(required)</em></span>
                  <input
                    type="text"
                    placeholder="Acme Aerospace"
                    value={fields.organization}
                    onChange={(e) => set('organization', e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="srw-form-row">
                <span style={{
                  display: 'block',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 18,
                  color: 'var(--srw-text)',
                  marginBottom: 12,
                  fontWeight: 300,
                }}>
                  Areas of Interest <em style={{ fontStyle: 'normal', fontSize: 13, color: 'var(--srw-text-3)', marginLeft: 6 }}>(select all that apply)</em>
                </span>
                <div className="srw-pg-form-chip-row">
                  {AREAS.map((area) => (
                    <button
                      key={area}
                      type="button"
                      className={`srw-pg-form-chip${fields.areas_of_interest.includes(area) ? ' active' : ''}`}
                      onClick={() => toggleArea(area)}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              <div className="srw-form-row">
                <label>
                  <span>Message <em>(optional)</em></span>
                  <textarea
                    rows={5}
                    placeholder="Anything we should know?"
                    value={fields.message}
                    onChange={(e) => set('message', e.target.value)}
                  />
                </label>
              </div>

              <div className="srw-form-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={fields.newsletter_opt_in}
                    onChange={(e) => set('newsletter_opt_in', e.target.checked)}
                  />
                  <span style={{ fontSize: 14, color: 'var(--srw-text-2)' }}>Send me news + updates when we have something to share.</span>
                </label>
              </div>

              {errorMsg && (
                <div className="srw-form-error" style={{ color: '#F4A78A', fontSize: 13, marginTop: 6 }}>{errorMsg}</div>
              )}

              <div style={{ marginTop: 24 }}>
                <button
                  type="submit"
                  className="srw-pg-cta solid"
                  disabled={status === 'submitting'}
                  style={{ border: 'none', cursor: status === 'submitting' ? 'not-allowed' : 'pointer', opacity: status === 'submitting' ? 0.5 : 1 }}
                >
                  {status === 'submitting' ? 'Sending…' : 'Subscribe →'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <SRWFooterV2 />
    </div>
  );
}
