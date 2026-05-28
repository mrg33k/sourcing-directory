import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw.css';

// Background matches the sign-up hero on spacerising.org
const HERO_BG = 'https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/341f4645-4175-4b09-a77f-0c2ba6d6b47f/Hero-Image-banner.jpg?format=2500w';

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

export default function SRWSignUp() {
  useSRWTitle('Sign Up | Space Rising');

  const [fields, setFields] = useState(INITIAL);
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
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
    <div data-srw>
      <SRWNav />

      {/* Hero — astronaut image, same asset as .org's sign-up */}
      <header className="srw-signup-hero">
        <div className="srw-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-hero-veil" />
        <div className="srw-wrap srw-signup-hero-inner">
          <h1 className="srw-signup-headline">Welcome to Space Rising</h1>
          <p className="srw-signup-sub">Stay in the know and get access to <strong>SpaceOS™</strong></p>
        </div>
      </header>

      {/* Form */}
      <section className="srw-signup-section">
        <div className="srw-wrap srw-signup-wrap">

          {status === 'success' ? (
            <div className="srw-signup-success">
              <div className="srw-signup-success-icon">✓</div>
              <h2>You're on the list.</h2>
              <p>Check your inbox — we sent a welcome email with your next steps.</p>
              <Link to="/space-rising" className="srw-btn-primary">Access SpaceOS™</Link>
            </div>
          ) : (
            <form className="srw-form srw-signup-form" onSubmit={handleSubmit} noValidate>

              {/* Name */}
              <div className="srw-form-row">
                <label className="srw-form-label">
                  Name <em>(required)</em>
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
                  <div className="srw-form-hint">
                    <span>First Name</span><span>Last Name</span>
                  </div>
                </label>
              </div>

              {/* Email */}
              <div className="srw-form-row">
                <label className="srw-form-label">
                  Email <em>(required)</em>
                  <input
                    type="email"
                    value={fields.email}
                    onChange={(e) => set('email', e.target.value)}
                    required
                  />
                </label>
                <label className="srw-form-checkbox-row">
                  <input
                    type="checkbox"
                    checked={fields.newsletter_opt_in}
                    onChange={(e) => set('newsletter_opt_in', e.target.checked)}
                  />
                  <span>Sign up for news and updates</span>
                </label>
              </div>

              {/* Organization */}
              <div className="srw-form-row">
                <label className="srw-form-label">
                  Organization <em>(required)</em>
                  <input
                    type="text"
                    value={fields.organization}
                    onChange={(e) => set('organization', e.target.value)}
                    required
                  />
                </label>
              </div>

              {/* Areas of Interest */}
              <div className="srw-form-row">
                <span className="srw-form-label">
                  Areas of Interest <em>(required)</em>
                </span>
                <div className="srw-form-chips">
                  {AREAS.map((area) => (
                    <button
                      key={area}
                      type="button"
                      className={`srw-chip${fields.areas_of_interest.includes(area) ? ' active' : ''}`}
                      onClick={() => toggleArea(area)}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="srw-form-row">
                <label className="srw-form-label">
                  Message
                  <textarea
                    rows={5}
                    value={fields.message}
                    onChange={(e) => set('message', e.target.value)}
                  />
                </label>
              </div>

              {/* Error */}
              {errorMsg && (
                <div className="srw-form-error">{errorMsg}</div>
              )}

              <button
                type="submit"
                className="srw-btn-outline"
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? 'SUBMITTING...' : 'SUBMIT'}
              </button>

            </form>
          )}
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
