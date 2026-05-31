// R5i (nat-geo-uplift) — return-from-checkout welcome page.
// R5k (nat-geo-uplift) — swapped from Square to Stripe 2026-05-31.
//
// Stripe redirects the user here after they complete (or cancel) the hosted
// checkout. We give the webhook a few seconds to flip the row, then render
// the welcome state. The user is already signed in (account was created
// before they were redirected to Stripe).

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import '../space-rising-theme-v2.css';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 12000;

export default function SourcingSignupComplete() {
  const [status, setStatus] = useState('polling'); // polling | paid | timeout | guest
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

  return (
    <div className="srsv2-shell" data-tenant="space-rising-v2">
      <div className="srsv2-veil" />
      <div className="srsv2-topbar">
        <Link to="/space-rising-v2" className="srsv2-wordmark">SPACE RISING</Link>
        <div className="srsv2-progress"></div>
        <Link to="/space-rising-v2" className="srsv2-close" aria-label="Close">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </Link>
      </div>

      <div className="srsv2-body">
        <div className="srsv2-step srsv2-step-success">
          {status === 'polling' && (
            <>
              <div className="srsv2-eyebrow">FINALIZING</div>
              <h1 className="srsv2-title srsv2-title-xl">Confirming your payment<span className="srsv2-period">…</span></h1>
              <div className="srsv2-sub">Stripe is sending us the receipt now. This usually takes a few seconds.</div>
            </>
          )}

          {status === 'paid' && (
            <>
              <div className="srsv2-eyebrow">YOU'RE IN</div>
              <h1 className="srsv2-title srsv2-title-xl">Welcome to the room, {firstName}<span className="srsv2-period">.</span></h1>
              <div className="srsv2-sub">
                Payment confirmed. {company?.paid_seats ? `${company.paid_seats} ${company.paid_seats === 1 ? 'seat' : 'seats'} on your account.` : ''}
                {company?.paid_receipt_url && (
                  <> Your receipt is <a href={company.paid_receipt_url} target="_blank" rel="noopener noreferrer">here</a>.</>
                )}
              </div>
              <div className="srsv2-cta-row">
                <Link to={company?.slug ? `/space-rising-v2/${company.slug}` : '/space-rising-v2'} className="srsv2-cta srsv2-cta-solid">
                  Go to your profile
                </Link>
                <Link to="/space-rising-v2" className="srsv2-cta srsv2-cta-line">
                  Browse the directory
                </Link>
              </div>
            </>
          )}

          {status === 'timeout' && (
            <>
              <div className="srsv2-eyebrow">ALMOST THERE</div>
              <h1 className="srsv2-title srsv2-title-xl">Your payment is processing<span className="srsv2-period">.</span></h1>
              <div className="srsv2-sub">
                Stripe is taking a bit longer than usual. Your account is created — we'll email you when the receipt clears, usually within a minute or two. You can refresh this page or head to the directory.
              </div>
              <div className="srsv2-cta-row">
                <button onClick={() => window.location.reload()} className="srsv2-cta srsv2-cta-solid">Refresh</button>
                <Link to="/space-rising-v2" className="srsv2-cta srsv2-cta-line">Browse the directory</Link>
              </div>
            </>
          )}

          {status === 'guest' && (
            <>
              <div className="srsv2-eyebrow">SIGNED OUT</div>
              <h1 className="srsv2-title srsv2-title-xl">Sign back in to see your account<span className="srsv2-period">.</span></h1>
              <div className="srsv2-sub">You're not signed in on this device. If you completed payment, check the email we sent for next steps.</div>
              <div className="srsv2-cta-row">
                <Link to="/space-rising-v2" className="srsv2-cta srsv2-cta-solid">Back to the directory</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
