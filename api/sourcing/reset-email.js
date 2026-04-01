// POST /api/sourcing/reset-email
// Generates a Supabase password reset link and sends a branded email via Resend.
// Body: { email, org_name?, redirect_to? }

import { createClient } from '@supabase/supabase-js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mcngatprgluexjjcqpkp.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FROM_ADDRESS = 'noreply@aheadofmarket.com';

function buildResetEmailHtml({ org_name, reset_url }) {
  const displayName = org_name || 'AOM Sourcing Directory';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:-apple-system,BlinkMacSystemFont,'Space Grotesk',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#29B6F6;">AOM</span>
              <span style="font-size:13px;color:#4a5568;margin:0 8px;">/</span>
              <span style="font-size:13px;color:#718096;">${displayName}</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:40px 36px;">

              <!-- Lock icon -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td>
                    <div style="width:52px;height:52px;border-radius:50%;background:rgba(41,182,246,0.1);border:2px solid rgba(41,182,246,0.3);display:inline-flex;align-items:center;justify-content:center;font-size:22px;color:#29B6F6;text-align:center;line-height:52px;">
                      &#128274;
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#f1f5f9;letter-spacing:-0.01em;line-height:1.2;">
                Reset your password
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#94a3b8;line-height:1.6;">
                We received a request to reset your password for <strong style="color:#e2e8f0;">${displayName}</strong>. Click the button below to choose a new password.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-radius:8px;background:#29B6F6;">
                    <a href="${reset_url}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <table cellpadding="0" cellspacing="0" style="width:100%;">
                <tr>
                  <td style="background:#0d1526;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
                      <span style="color:#29B6F6;font-weight:700;">Note:</span> This link expires in <strong style="color:#e2e8f0;">1 hour</strong>. If you did not request a password reset, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:24px 0 0;font-size:12px;color:#4a5568;line-height:1.6;">
                If the button above doesn't work, paste this URL into your browser:<br/>
                <a href="${reset_url}" style="color:#29B6F6;text-decoration:none;word-break:break-all;font-size:11px;">${reset_url}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#4a5568;line-height:1.6;">
                This email was sent because a password reset was requested on <a href="https://aheadofmarket.com" style="color:#29B6F6;text-decoration:none;">aheadofmarket.com</a>.<br/>
                Questions? Reach us at <a href="mailto:hello@aheadofmarket.com" style="color:#29B6F6;text-decoration:none;">hello@aheadofmarket.com</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#2d3748;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                AOM &mdash; Ahead of Market
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { email, org_name, redirect_to } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  // Generate the reset link via Supabase admin
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const redirectTo = redirect_to || 'https://aheadofmarket.com/sourcing/admin';

  let reset_url;
  try {
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    if (error) {
      console.error('generateLink error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate reset link' });
    }
    reset_url = data?.properties?.action_link;
    if (!reset_url) {
      return res.status(500).json({ error: 'No action_link returned from Supabase' });
    }
  } catch (err) {
    console.error('generateLink exception:', err);
    return res.status(500).json({ error: err.message });
  }

  // Skip email send if RESEND_API_KEY not set
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, skipping branded email for:', email);
    return res.status(200).json({ ok: true, skipped: true, reason: 'RESEND_API_KEY not configured' });
  }

  const displayName = org_name || 'AOM Sourcing Directory';
  const html = buildResetEmailHtml({ org_name: displayName, reset_url });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        subject: `Reset your password — ${displayName}`,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      return res.status(500).json({ error: data.message || 'Email send failed' });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error('reset-email send error:', err);
    return res.status(500).json({ error: err.message });
  }
}
