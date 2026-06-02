// SourcingEventsPostV2.jsx
// nat-geo-uplift — V2 post form for Events.
// Supabase logic preserved exactly from SourcingEventsPost.jsx.
// Visual system: dark BG (#06060A), amber accent (#E8A23A), line-style inputs.
// No SourcingThemeProvider, no SourcingNav, no MembershipGate.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import SRWNavV2 from './srw/SRWNavV2.jsx';
import { V2ChipNav } from './V2ChipNav.jsx';

const BG      = '#06060A';
const TEXT    = '#F5EED7';
const MUTED   = 'rgba(245,238,215,0.55)';
const DIM     = 'rgba(245,238,215,0.3)';
const AMBER   = '#E8A23A';
const BORDER  = 'rgba(245,238,215,0.10)';
const CARD    = 'rgba(245,238,215,0.04)';
const FONT    = "'Space Grotesk', sans-serif";

const VERTICALS = [
  { key: 'semiconductor', label: 'Semiconductor' },
  { key: 'space',         label: 'Space & Aerospace' },
];

const EVENT_TYPES = [
  { key: 'conference', label: 'Conference' },
  { key: 'meetup',     label: 'Meetup' },
  { key: 'webinar',    label: 'Webinar' },
  { key: 'workshop',   label: 'Workshop' },
  { key: 'expo',       label: 'Expo' },
];

function Label({ children, required }) {
  return (
    <label style={{ fontSize: 12, color: MUTED, fontFamily: FONT, fontWeight: 600 }}>
      {children}{required && <span style={{ color: AMBER }}> *</span>}
    </label>
  );
}

function Hint({ children }) {
  return <div style={{ fontSize: 11, color: DIM, fontFamily: FONT }}>{children}</div>;
}

function lineInputStyle() {
  return {
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${BORDER}`,
    color: TEXT,
    padding: '10px 0',
    fontSize: 15,
    fontFamily: FONT,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function InputField({ label, required, hint, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Label required={required}>{label}</Label>
      {hint && <Hint>{hint}</Hint>}
      <input
        {...props}
        style={lineInputStyle()}
        onFocus={e => { e.target.style.borderBottomColor = AMBER; }}
        onBlur={e  => { e.target.style.borderBottomColor = BORDER; }}
      />
    </div>
  );
}

function SelectField({ label, required, children, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Label required={required}>{label}</Label>
      <select
        {...props}
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 6,
          color: TEXT,
          padding: '10px 12px',
          fontSize: 14,
          fontFamily: FONT,
          width: '100%',
          outline: 'none',
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </select>
    </div>
  );
}

function TextareaField({ label, required, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Label required={required}>{label}</Label>
      <textarea
        {...props}
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${BORDER}`,
          color: TEXT,
          padding: '10px 0',
          fontSize: 15,
          fontFamily: FONT,
          width: '100%',
          outline: 'none',
          resize: 'vertical',
          minHeight: 120,
          boxSizing: 'border-box',
        }}
        onFocus={e => { e.target.style.borderBottomColor = AMBER; }}
        onBlur={e  => { e.target.style.borderBottomColor = BORDER; }}
      />
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 8, marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: FONT }}>
        {children}
      </div>
    </div>
  );
}

export default function SourcingEventsPostV2() {
  const [form, setForm] = useState({
    company_name:   '',
    company_email:  '',
    title:          '',
    description:    '',
    event_type:     'meetup',
    event_date:     '',
    event_end_date: '',
    event_location: '',
    virtual_url:    '',
    organizer:      '',
    contact_email:  '',
    vertical:       'semiconductor',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [done, setDone]             = useState(false);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.event_type || !form.vertical || !form.company_email) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!form.event_date) {
      setError('Event date is required.');
      return;
    }
    if (!supabase) {
      setError('Database not configured. Contact the administrator.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      let companyId = null;
      const { data: existingCo } = await supabase
        .from('directory_companies')
        .select('id')
        .eq('email', form.company_email)
        .single();

      if (existingCo) {
        companyId = existingCo.id;
      } else {
        const slug = (form.company_name || 'organizer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
        const { data: newCo, error: coError } = await supabase
          .from('directory_companies')
          .insert({
            name:     form.company_name || 'Unknown Organizer',
            slug,
            email:    form.company_email,
            vertical: form.vertical,
            status:   'pending',
          })
          .select('id')
          .single();
        if (coError) throw coError;
        companyId = newCo.id;
      }

      const { error: insertError } = await supabase
        .from('directory_listings')
        .insert({
          company_id:     companyId,
          title:          form.title,
          description:    form.description,
          category:       'event',
          status:         'pending',
          event_type:     form.event_type,
          event_date:     form.event_date     ? new Date(form.event_date).toISOString()     : null,
          event_end_date: form.event_end_date ? new Date(form.event_end_date).toISOString() : null,
          event_location: form.event_location || null,
          virtual_url:    form.virtual_url    || null,
          organizer:      form.organizer || form.company_name || null,
          contact_email:  form.contact_email  || null,
          vertical:       form.vertical,
        });

      if (insertError) throw insertError;
      setDone(true);
    } catch (err) {
      console.error('Post event error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div data-tenant="space-rising-v2" style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: FONT }}>
        <style>{`* { box-sizing: border-box; }`}</style>
        <SRWNavV2 />
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ fontSize: 48, color: AMBER, marginBottom: 20 }}>✓</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, marginBottom: 12, fontFamily: FONT }}>
            Event Posted<span style={{ color: AMBER }}>.</span>
          </div>
          <div style={{ fontSize: 15, color: MUTED, marginBottom: 28, lineHeight: 1.6, fontFamily: FONT }}>
            Your event is now listed. Industry professionals can find and RSVP.
          </div>
          <Link to="/space-rising-v2/events" style={{
            background: AMBER, color: '#06060A', textDecoration: 'none',
            borderRadius: 6, padding: '12px 28px', fontWeight: 700, fontSize: 14, fontFamily: FONT,
          }}>
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div data-tenant="space-rising-v2" style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: FONT }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: ${DIM}; }
        select option { background: #111; color: ${TEXT}; }
        input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(0.4); }
      `}</style>

      <SRWNavV2 />

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(232,162,58,0.06) 0%, transparent 100%)',
        borderBottom: `1px solid ${BORDER}`,
        padding: '48px 24px 32px',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12, fontFamily: FONT }}>
            Post an Event
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: TEXT, lineHeight: 1.1, fontFamily: FONT }}>
            List an Industry Event<span style={{ color: AMBER }}>.</span>
          </div>
          <Link to="/space-rising-v2/events" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 13, color: MUTED, textDecoration: 'none', fontFamily: FONT }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Events
          </Link>
        </div>
      </div>

      <V2ChipNav active="events" />

      {/* Form content */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 80px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

            {/* Organizer */}
            <div>
              <SectionHeader>Organizer</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <InputField label="Organization / Company Name" required value={form.company_name} onChange={set('company_name')} placeholder="S3C Arizona" />
                <InputField label="Organization Email" required type="email" value={form.company_email} onChange={set('company_email')} placeholder="events@organization.org" hint="Used to link event to your directory profile." />
                <InputField label="Organizer Display Name" value={form.organizer} onChange={set('organizer')} placeholder="S3C Arizona Events Team" hint="Shown on the event listing. Defaults to your organization name." />
              </div>
            </div>

            {/* Event Details */}
            <div>
              <SectionHeader>Event Details</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <InputField label="Event Title" required value={form.title} onChange={set('title')} placeholder="AZ Semiconductor Summit 2026" />
                <TextareaField label="Description" value={form.description} onChange={set('description')} placeholder="What will attendees experience? Include agenda highlights, speakers, networking opportunities..." />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <SelectField label="Event Type" required value={form.event_type} onChange={set('event_type')}>
                    {EVENT_TYPES.map(et => <option key={et.key} value={et.key}>{et.label}</option>)}
                  </SelectField>
                  <SelectField label="Industry Vertical" required value={form.vertical} onChange={set('vertical')}>
                    {VERTICALS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                  </SelectField>
                </div>
              </div>
            </div>

            {/* Date & Location */}
            <div>
              <SectionHeader>Date &amp; Location</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <InputField label="Start Date & Time" required type="datetime-local" value={form.event_date} onChange={set('event_date')} />
                  <InputField label="End Date & Time" type="datetime-local" value={form.event_end_date} onChange={set('event_end_date')} />
                </div>
                <InputField label="Physical Location" value={form.event_location} onChange={set('event_location')} placeholder="Phoenix Convention Center, 100 N 3rd St, Phoenix, AZ" hint="Full address. Leave blank if virtual-only." />
                <InputField label="Virtual / Livestream URL" type="url" value={form.virtual_url} onChange={set('virtual_url')} placeholder="https://zoom.us/j/..." hint="For webinars or hybrid events." />
              </div>
            </div>

            {/* Registration */}
            <div>
              <SectionHeader>Registration / RSVP</SectionHeader>
              <InputField label="Contact Email for RSVPs" type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="rsvp@organization.org" hint="Attendees will RSVP to this email." />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 6, padding: '12px 16px', fontSize: 13,
                color: '#FCA5A5', fontFamily: FONT,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                background: AMBER,
                border: 'none',
                color: '#06060A',
                borderRadius: 6,
                padding: '14px',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: FONT,
                cursor: submitting ? 'not-allowed' : 'pointer',
                width: '100%',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Posting Event...' : 'Post Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
