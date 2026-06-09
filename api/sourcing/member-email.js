// POST /api/sourcing/member-email
// Sends an approved / declined email to a directory member via Resend.
// Body: { email, full_name, status: 'approved'|'rejected', directory_name, base_url }

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || 'Space Rising <noreply@sourcing.directory>';

function buildEmailHtml({ full_name, status, directory_name, portal_url }) {
  const approved = status === 'approved';
  const greeting = full_name ? `Hi ${full_name},` : 'Hi,';
  const heading = approved ? "You're in." : 'Update on your application';
  const body = approved
    ? `Your membership to <strong style="color:#E8E4DA;">${directory_name}</strong> has been approved. You can sign in and manage your listing any time.`
    : `Thanks for your interest in <strong style="color:#E8E4DA;">${directory_name}</strong>. After review, we're not able to approve your listing at this time. Reply to this email if you have questions.`;
  const cta = approved
    ? `<a href="${portal_url}" style="display:inline-block;background:#E8A23A;color:#06060A;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;font-family:'Space Grotesk',Arial,sans-serif;font-size:15px;">Go to your portal</a>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#06060A;padding:32px 0;font-family:'Space Grotesk',Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#0D0D12;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:36px 32px;color:#E8E4DA;">
      <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#E8A23A;font-weight:700;margin-bottom:18px;">${directory_name}</div>
      <h1 style="font-size:26px;margin:0 0 16px;color:#E8E4DA;font-weight:800;">${heading}</h1>
      <p style="font-size:15px;line-height:1.6;color:rgba(232,228,218,0.7);margin:0 0 12px;">${greeting}</p>
      <p style="font-size:15px;line-height:1.6;color:rgba(232,228,218,0.7);margin:0 0 24px;">${body}</p>
      ${cta}
      <div style="margin-top:32px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:rgba(232,228,218,0.35);">
        Sent by ${directory_name}. Questions? Just reply to this email.
      </div>
    </div></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { email, full_name, status, directory_name, base_url } = req.body || {};
  if (!email || !status) return res.status(400).json({ error: 'email and status are required' });
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, skipping member email for:', email);
    return res.status(200).json({ ok: true, skipped: true, reason: 'RESEND_API_KEY not configured' });
  }
  const dir = directory_name || 'Space Rising';
  const origin = base_url || 'https://www.spacerising.org';
  const portal_url = `${origin}/space-rising/portal`;
  const html = buildEmailHtml({ full_name, status, directory_name: dir, portal_url });
  const subject = status === 'approved' ? `You're approved — ${dir}` : `Update on your ${dir} application`;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [email], subject, html }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Resend error (member-email):', data);
      return res.status(200).json({ ok: true, email_skipped: true, reason: data.message });
    }
    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error('member-email send failed:', err);
    return res.status(200).json({ ok: true, email_skipped: true, reason: err.message });
  }
}
