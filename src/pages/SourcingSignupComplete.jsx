// SourcingSignupComplete.jsx (v3 — reskinned)
// Return-from-Stripe-checkout welcome page. Shows polling, success, timeout, or guest states.

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import '../osv3-tokens.css';
import '../pages/OSLayoutV3.css';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 12000;

export default function SourcingSignupComplete() {
  const [status, setStatus] = useState('polling');
  const [company, setCompany] = useState(null);

  useEffect(() => {
    if (!supabase) { setStatus('guest'); return; }

    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setStatus('guest');
          return;
        }

        const { data: member } = await supabase
          .from('directory_members')
          .select('company_id')
          .eq('auth_user_id', user.id)
          .single();

        if (!member?.company_id) {
          if (!cancelled) setStatus('guest');
          return;
        }

        const { data: companyRow } = await supabase
          .from('directory_companies')
          .select('id, slug, name, membership_tier, paid_seats, paid_receipt_url, pending_checkout_session_id')
          .eq('id', member.company_id)
          .single();

        if (!companyRow) {
          if (!cancelled) setStatus('guest');
          return;
        }

        if (!cancelled) setCompany(companyRow);

        if (companyRow.membership_tier === 'paid' && companyRow.paid_at !== null) {
          if (!cancelled) setStatus('paid');
          return;
        }

        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          if (!cancelled) setStatus('timeout');
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        console.error('signup-complete poll error', err);
        if (!cancelled) setStatus('timeout');
      }
    };

    poll();
    return () => { cancelled = true; };
  }, []);

  const firstName = company?.name?.split(/\s+/)[0] || 'friend';

  const cardContent = (
    <div style={{
      background: 'white',
      border: '1px solid var(--v3-border)',
      borderRadius: '8px',
      padding: '40px 32px',
      textAlign: 'center',
      maxWidth: '420px',
      margin: '0 auto',
    }}>
      {status === 'polling' && (
        <>
          <div style={{ fontSize: 'var(--v3-eyebrow-font-size)', fontWeight: 'var(--v3-eyebrow-font-weight)', color: 'var(--v3-muted)', letterSpacing: 'var(--v3-eyebrow-letter-spacing)', textTransform: 'uppercase', marginBottom: '16px' }}>
            Finalizing
          </div>
          <h1 style={{ fontSize: 'var(--v3-h2-font-size)', fontWeight: 'var(--v3-h2-font-weight)', color: 'var(--v3-ink-primary)', margin: '0 0 12px' }}>
            Confirming your payment
          </h1>
          <div style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', marginBottom: '32px', lineHeight: 'var(--v3-body-sm-line-height)' }}>
            This usually takes a few seconds.
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--v3-border)', borderTop: '3px solid var(--v3-accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </>
      )}

      {status === 'paid' && (
        <>
          <div style={{ fontSize: 'var(--v3-eyebrow-font-size)', fontWeight: 'var(--v3-eyebrow-font-weight)', color: 'var(--v3-muted)', letterSpacing: 'var(--v3-eyebrow-letter-spacing)', textTransform: 'uppercase', marginBottom: '16px' }}>
            Welcome
          </div>
          <h1 style={{ fontSize: 'var(--v3-h2-font-size)', fontWeight: 'var(--v3-h2-font-weight)', color: 'var(--v3-ink-primary)', margin: '0 0 12px' }}>
            You're in, {firstName}.
          </h1>
          <div style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', marginBottom: '32px', lineHeight: 'var(--v3-body-sm-line-height)' }}>
            Payment confirmed. {company?.paid_seats ? `${company.paid_seats} ${company.paid_seats === 1 ? 'seat' : 'seats'} on your account.` : ''} {company?.paid_receipt_url && <a href={company.paid_receipt_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--v3-link)', textDecoration: 'none' }}>View receipt</a>}
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to={company?.slug ? `/spaceos/${company.slug}` : '/spaceos'} style={{ padding: '10px 20px', background: 'var(--v3-accent)', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: 'var(--v3-body-sm-font-size)', fontWeight: 'var(--v3-font-weight-semibold)' }}>
              View profile
            </Link>
            <Link to="/spaceos" style={{ padding: '10px 20px', background: 'white', border: '1px solid var(--v3-border)', color: 'var(--v3-ink-primary)', borderRadius: '6px', textDecoration: 'none', fontSize: 'var(--v3-body-sm-font-size)', fontWeight: 'var(--v3-font-weight-semibold)' }}>
              Browse
            </Link>
          </div>
        </>
      )}

      {status === 'timeout' && (
        <>
          <div style={{ fontSize: 'var(--v3-eyebrow-font-size)', fontWeight: 'var(--v3-eyebrow-font-weight)', color: 'var(--v3-muted)', letterSpacing: 'var(--v3-eyebrow-letter-spacing)', textTransform: 'uppercase', marginBottom: '16px' }}>
            Almost there
          </div>
          <h1 style={{ fontSize: 'var(--v3-h2-font-size)', fontWeight: 'var(--v3-h2-font-weight)', color: 'var(--v3-ink-primary)', margin: '0 0 12px' }}>
            Payment is processing.
          </h1>
          <div style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', marginBottom: '32px', lineHeight: 'var(--v3-body-sm-line-height)' }}>
            Your account is created. We'll email you when the receipt clears, usually within a minute or two.
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', background: 'var(--v3-accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: 'var(--v3-body-sm-font-size)', fontWeight: 'var(--v3-font-weight-semibold)' }}>
              Refresh
            </button>
            <Link to="/spaceos" style={{ padding: '10px 20px', background: 'white', border: '1px solid var(--v3-border)', color: 'var(--v3-ink-primary)', borderRadius: '6px', textDecoration: 'none', fontSize: 'var(--v3-body-sm-font-size)', fontWeight: 'var(--v3-font-weight-semibold)' }}>
              Browse
            </Link>
          </div>
        </>
      )}

      {status === 'guest' && (
        <>
          <div style={{ fontSize: 'var(--v3-eyebrow-font-size)', fontWeight: 'var(--v3-eyebrow-font-weight)', color: 'var(--v3-muted)', letterSpacing: 'var(--v3-eyebrow-letter-spacing)', textTransform: 'uppercase', marginBottom: '16px' }}>
            Not signed in
          </div>
          <h1 style={{ fontSize: 'var(--v3-h2-font-size)', fontWeight: 'var(--v3-h2-font-weight)', color: 'var(--v3-ink-primary)', margin: '0 0 12px' }}>
            Sign back in to view your account.
          </h1>
          <div style={{ fontSize: 'var(--v3-body-sm-font-size)', color: 'var(--v3-muted)', marginBottom: '32px', lineHeight: 'var(--v3-body-sm-line-height)' }}>
            If you completed payment, check your email for next steps.
          </div>
          <Link to="/spaceos" style={{ display: 'inline-block', padding: '10px 20px', background: 'var(--v3-accent)', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: 'var(--v3-body-sm-font-size)', fontWeight: 'var(--v3-font-weight-semibold)' }}>
            Back to Space OS
          </Link>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
      {cardContent}
    </div>
  );
}
