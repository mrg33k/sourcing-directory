// POST /api/sd-signup — onboarding capture while accounts are paused (no database).
// Emails the signup to the team so nobody who onboards is lost. Never receives
// or stores a password; the form keeps that field on the device only.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_ADDRESS || 'Sourcing Directory <noreply@sourcing.directory>';
const TO = (process.env.SD_SIGNUP_TO || 'hello@aom-inhouse.com').split(',').map((s) => s.trim()).filter(Boolean);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const email = String(b.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: 'Enter a valid work email.' });
  const row = {
    name: String(b.name || '').slice(0, 120),
    email: email.slice(0, 160),
    company: String(b.company || '').slice(0, 160),
    role: String(b.role || '').slice(0, 20),
    industries: Array.isArray(b.industries) ? b.industries.slice(0, 12).map(String) : [],
  };
  console.log('[sd-signup]', JSON.stringify(row));
  if (!RESEND_API_KEY) return res.status(200).json({ ok: true, emailed: false });
  try {
    const html = `<h2 style="font-family:sans-serif">New Sourcing Directory signup</h2>
      <table style="font-family:sans-serif;font-size:14px">
      ${Object.entries(row).map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td>${esc(Array.isArray(v) ? v.join(', ') : v)}</td></tr>`).join('')}
      </table>`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: TO, reply_to: row.email, subject: `New signup: ${row.name || row.email}${row.company ? ` (${row.company})` : ''}`, html }),
    });
    return res.status(200).json({ ok: true, emailed: r.ok });
  } catch {
    return res.status(200).json({ ok: true, emailed: false });
  }
}
