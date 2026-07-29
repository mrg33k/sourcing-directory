// POST /api/sourcing/welcome-email
// Sends a welcome email via Resend after a company signs up on the sourcing directory.
// Body: { email, company_name, org_name, company_slug, base_url }

import { resolveBrand, sendViaResend } from './lib/emailBrand.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Space OS variant: matches the v3 shell (light content, navy ink, rust accent).
function buildSpaceOSEmailHtml({ company_name, org_name, profile_url, brand }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ${org_name}</title>
</head>
<body style="margin:0;padding:0;background:#F7F8F9;font-family:'Roboto',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8F9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:28px;">
              <span style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#000C20;">Space Rising</span>
              <span style="font-size:13px;color:#9CA3AF;margin:0 8px;">/</span>
              <span style="font-size:13px;color:#6B7280;">Space OS</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#FFFFFF;border:1px solid #D7DEE2;border-radius:8px;padding:40px 36px;box-shadow:0 1px 2px rgba(1,11,19,0.04),0 8px 24px rgba(1,11,19,0.06);">

              <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6B7280;">
                Submission received
              </p>
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#010B13;letter-spacing:-0.01em;line-height:1.2;">
                You're on the list.
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#2E2E2E;line-height:1.6;">
                <strong style="color:#010B13;">${company_name}</strong> has been submitted to <strong style="color:#010B13;">${org_name}</strong>. Our team will review your listing and you'll be live in the directory shortly.
              </p>

              <!-- What happens next -->
              <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:32px;">
                <tr>
                  <td style="background:#F7F8F9;border:1px solid #D7DEE2;border-radius:6px;padding:20px 24px;">
                    <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#CE4421;">What happens next</p>
                    <table cellpadding="0" cellspacing="0" style="width:100%;">
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#2E2E2E;">
                          <span style="color:#CE4421;font-weight:700;margin-right:8px;">01</span>
                          Our team reviews your listing (usually within 24h)
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#2E2E2E;">
                          <span style="color:#CE4421;font-weight:700;margin-right:8px;">02</span>
                          Your profile goes live in the directory
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#2E2E2E;">
                          <span style="color:#CE4421;font-weight:700;margin-right:8px;">03</span>
                          Procurement teams and partners can find you
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Gradient + shadow degrade to the flat #CE4421 background in
                       clients that strip them (Gmail, Outlook). -->
                  <td style="border-radius:6px;background:#CE4421;background-image:linear-gradient(180deg,#DB4F27 0%,#CE4421 100%);box-shadow:0 2px 4px rgba(206,68,33,0.24);">
                    <a href="${profile_url}" style="display:inline-block;padding:16px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                      View Your Profile
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.6;">
                This email was sent because you signed up on <a href="${brand.siteUrl}" style="color:#2563EB;text-decoration:none;">${brand.siteLabel}</a>.<br/>
                Questions? Reply to this email or reach us at <a href="mailto:${brand.contactEmail}" style="color:#2563EB;text-decoration:none;">${brand.contactEmail}</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#9CA3AF;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                ${brand.footerSign}
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

// Sourcing.directory variant (original dark/cyan template) — unchanged.
function buildEmailHtml({ company_name, org_name, profile_url }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ${org_name}</title>
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
              <span style="font-size:13px;color:#718096;">${org_name}</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:40px 36px;">

              <!-- Check icon -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td>
                    <div style="width:52px;height:52px;border-radius:50%;background:rgba(41,182,246,0.1);border:2px solid rgba(41,182,246,0.3);display:inline-flex;align-items:center;justify-content:center;font-size:24px;color:#29B6F6;text-align:center;line-height:52px;">
                      ✓
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#f1f5f9;letter-spacing:-0.01em;line-height:1.2;">
                You're on the list.
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6;">
                <strong style="color:#e2e8f0;">${company_name}</strong> has been submitted to <strong style="color:#e2e8f0;">${org_name}</strong>. Our team will review your listing and you'll be live in the directory shortly.
              </p>

              <!-- What happens next -->
              <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:32px;">
                <tr>
                  <td style="background:#0d1526;border:1px solid #1e293b;border-radius:8px;padding:20px 22px;">
                    <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#29B6F6;">What happens next</p>
                    <table cellpadding="0" cellspacing="0" style="width:100%;">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#94a3b8;">
                          <span style="color:#29B6F6;margin-right:10px;">01</span>
                          Our team reviews your listing (usually within 24h)
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#94a3b8;">
                          <span style="color:#29B6F6;margin-right:10px;">02</span>
                          Your profile goes live in the directory
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#94a3b8;">
                          <span style="color:#29B6F6;margin-right:10px;">03</span>
                          Procurement teams and partners can find you
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#29B6F6;">
                    <a href="${profile_url}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                      View Your Profile
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#4a5568;line-height:1.6;">
                This email was sent because you signed up on <a href="https://sourcing.directory" style="color:#29B6F6;text-decoration:none;">sourcing.directory</a>.<br/>
                Questions? Reply to this email or reach us at <a href="mailto:hello@sourcing.directory" style="color:#29B6F6;text-decoration:none;">hello@sourcing.directory</a>
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

  const { email, company_name, org_name, company_slug, base_url } = req.body || {};

  if (!email || !company_name) {
    return res.status(400).json({ error: 'email and company_name are required' });
  }

  if (!RESEND_API_KEY) {
    // Key not set yet -- log and return success so signup flow isn't blocked
    console.warn('RESEND_API_KEY not set, skipping welcome email for:', email);
    return res.status(200).json({ ok: true, skipped: true, reason: 'RESEND_API_KEY not configured' });
  }

  const origin = base_url || 'https://sourcing.directory';
  const brand = resolveBrand(origin);
  const directoryName = org_name || brand.defaultOrgName;
  // Space OS company profiles live at /<slug>; the legacy s3c path only
  // exists on sourcing.directory.
  const profile_url = company_slug
    ? (brand.key === 'spaceos' ? `${origin}/${company_slug}` : `${origin}/s3c-semiconductor/${company_slug}`)
    : origin;

  const html = brand.key === 'spaceos'
    ? buildSpaceOSEmailHtml({ company_name, org_name: directoryName, profile_url, brand })
    : buildEmailHtml({ company_name, org_name: directoryName, profile_url });

  try {
    const sent = await sendViaResend({
      apiKey: RESEND_API_KEY,
      brand,
      to: email,
      subject: `${company_name} is on the list — ${directoryName}`,
      html,
    });

    if (!sent.ok) {
      console.error('Resend error (domain may not be verified yet):', sent.data);
      // Return success anyway - signup shouldn't fail because of email
      return res.status(200).json({ ok: true, email_skipped: true, reason: sent.data?.message });
    }

    return res.status(200).json({
      ok: true,
      id: sent.data.id,
      ...(sent.usedFallbackSender ? { sender: 'fallback' } : {}),
    });
  } catch (err) {
    console.error('welcome-email error:', err);
    // Don't fail the signup flow over email
    return res.status(200).json({ ok: true, email_skipped: true, reason: err.message });
  }
}
