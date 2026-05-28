// POST /api/sourcing/srw-subscribe
// Handles two Space Rising website forms:
//   form_type: 'subscribe' — /srw/sign-up page (full subscriber form)
//   form_type: 'contact'   — home page contact form
//
// Saves to srw_subscribers table, sends welcome email to subscriber (subscribe type),
// and sends an internal notification to info@spacerising.org.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.SRW_FROM_ADDRESS || 'Space Rising <hello@aom-inhouse.com>';
const NOTIFY_EMAIL = process.env.SRW_NOTIFY_EMAIL || 'info@spacerising.org';
const SPACEOS_URL  = process.env.SRW_SPACEOS_URL  || 'https://sourcing.directory/space-rising';

// ─── Email builders ──────────────────────────────────────────────────────────

function buildWelcomeHtml({ first_name, areas_of_interest }) {
  const name = first_name ? `, ${first_name}` : '';
  const interests = Array.isArray(areas_of_interest) && areas_of_interest.length > 0
    ? areas_of_interest.join(' · ')
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Space Rising</title>
</head>
<body style="margin:0;padding:0;background:#0a0b0f;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0b0f;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:36px;" align="center">
              <img
                src="https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/82e43967-ce2d-47fc-9d5d-efe3433d1876/SpaceRising_LOGO-WHT.png?format=500w"
                alt="Space Rising"
                height="40"
                style="display:block;"
              />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#12141a;border:1px solid #1e2230;border-radius:12px;padding:44px 40px;">

              <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#f5f5f5;letter-spacing:-0.01em;line-height:1.25;">
                Welcome${name}.
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#9aa3b8;line-height:1.65;">
                You're now part of the Space Rising community — the connective layer across the evolving space economy.
                ${interests ? `<br/><br/>Your areas of interest: <strong style="color:#e0e0e0;">${interests}</strong>` : ''}
              </p>

              <!-- Divider -->
              <div style="height:1px;background:#1e2230;margin-bottom:28px;"></div>

              <!-- What's next -->
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c0392b;">What's next</p>
              <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:32px;">
                <tr>
                  <td style="padding:7px 0;font-size:14px;color:#9aa3b8;border-bottom:1px solid #1e2230;">
                    <span style="color:#c0392b;margin-right:10px;">01</span>
                    Access SpaceOS™ — the intelligence infrastructure for the space economy
                  </td>
                </tr>
                <tr>
                  <td style="padding:7px 0;font-size:14px;color:#9aa3b8;border-bottom:1px solid #1e2230;">
                    <span style="color:#c0392b;margin-right:10px;">02</span>
                    Connect with companies, opportunities, and partners in your region
                  </td>
                </tr>
                <tr>
                  <td style="padding:7px 0;font-size:14px;color:#9aa3b8;">
                    <span style="color:#c0392b;margin-right:10px;">03</span>
                    Stay in the know on Space Congress™ events and Arizona's space ecosystem
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:6px;background:#c0392b;">
                    <a href="${SPACEOS_URL}" style="display:inline-block;padding:14px 32px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.08em;text-transform:uppercase;">
                      Access SpaceOS™
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;" align="center">
              <p style="margin:0;font-size:12px;color:#3a3f52;line-height:1.7;">
                You received this because you signed up at <a href="https://spacerising.org" style="color:#c0392b;text-decoration:none;">spacerising.org</a>.<br/>
                Questions? Reach us at <a href="mailto:info@spacerising.org" style="color:#c0392b;text-decoration:none;">info@spacerising.org</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildNotifyHtml({ form_type, first_name, last_name, email, organization, areas_of_interest, newsletter_opt_in, message }) {
  const name = [first_name, last_name].filter(Boolean).join(' ') || '(no name)';
  const interests = Array.isArray(areas_of_interest) && areas_of_interest.length > 0
    ? areas_of_interest.join(', ')
    : '—';

  const rows = form_type === 'subscribe'
    ? [
        ['Name', name],
        ['Email', email],
        ['Organization', organization || '—'],
        ['Newsletter opt-in', newsletter_opt_in ? 'Yes' : 'No'],
        ['Areas of interest', interests],
        ['Message', message || '—'],
      ]
    : [
        ['Name', name],
        ['Email', email],
        ['Message', message || '—'],
      ];

  const rowsHtml = rows.map(([label, value]) =>
    `<tr>
       <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#9aa3b8;white-space:nowrap;vertical-align:top;">${label}</td>
       <td style="padding:8px 12px;font-size:13px;color:#e0e0e0;">${value}</td>
     </tr>`
  ).join('');

  const subject = form_type === 'subscribe' ? 'New subscriber' : 'New contact message';

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:32px 20px;background:#0a0b0f;font-family:-apple-system,sans-serif;">
  <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;background:#12141a;border:1px solid #1e2230;border-radius:10px;overflow:hidden;">
    <tr>
      <td style="padding:24px 28px;border-bottom:1px solid #1e2230;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c0392b;">Space Rising</p>
        <h2 style="margin:4px 0 0;font-size:18px;font-weight:700;color:#f5f5f5;">${subject}</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail({ to, subject, html }) {
  if (!RESEND_KEY) {
    console.warn('RESEND_API_KEY not set, skipping email to:', to);
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  const data = await res.json();
  if (!res.ok) console.error('Resend error:', data);
  return data;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const {
    form_type = 'subscribe',
    first_name,
    last_name,
    email,
    organization,
    areas_of_interest,
    newsletter_opt_in = false,
    message,
  } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  // ── Save to Supabase ──
  if (SUPABASE_URL && SERVICE_KEY) {
    try {
      const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await sb.from('srw_subscribers').insert({
        form_type,
        first_name: first_name?.trim() || null,
        last_name:  last_name?.trim()  || null,
        email:      email.trim().toLowerCase(),
        organization: organization?.trim() || null,
        areas_of_interest: Array.isArray(areas_of_interest) ? areas_of_interest : null,
        newsletter_opt_in: !!newsletter_opt_in,
        message:    message?.trim() || null,
      });
      if (error) console.error('Supabase insert error:', error.message);
    } catch (err) {
      console.error('Supabase error:', err.message);
      // Don't fail — still send emails
    }
  } else {
    console.warn('Supabase not configured — submission not persisted.');
  }

  // ── Send welcome email (subscribe form only) ──
  if (form_type === 'subscribe') {
    try {
      await sendEmail({
        to: email.trim(),
        subject: 'Welcome to Space Rising',
        html: buildWelcomeHtml({ first_name, areas_of_interest }),
      });
    } catch (err) {
      console.error('Welcome email error:', err.message);
    }
  }

  // ── Notify Space Rising team ──
  try {
    const subject = form_type === 'subscribe'
      ? `New subscriber — ${[first_name, last_name].filter(Boolean).join(' ') || email}`
      : `New contact message — ${[first_name, last_name].filter(Boolean).join(' ') || email}`;
    await sendEmail({
      to: NOTIFY_EMAIL,
      subject,
      html: buildNotifyHtml({ form_type, first_name, last_name, email, organization, areas_of_interest, newsletter_opt_in, message }),
    });
  } catch (err) {
    console.error('Notify email error:', err.message);
  }

  return res.status(200).json({ ok: true });
}
