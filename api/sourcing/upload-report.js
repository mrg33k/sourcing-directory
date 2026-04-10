// POST /api/sourcing/upload-report
// Handles two actions for admin report document uploads:
//
//   { action: 'get-url', report_id, filename, content_type }
//     → creates a signed Supabase Storage upload URL (admin only)
//     → returns { signedUrl, token, path, publicUrl }
//
//   { action: 'save-url', report_id, file_url }
//     → persists the uploaded file's public URL to directory_reports.file_url
//     → returns { ok: true, report_id, file_url }
//
// Requires: Authorization: Bearer <admin_jwt>

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://kzzvjtthknsozktmpvak.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'sourcing-reports';

// Create bucket if it doesn't exist. Safe to call on every request — noop if present.
async function ensureBucket(sb) {
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 52428800, // 50 MB
    allowedMimeTypes: ['application/pdf', 'application/octet-stream'],
  });
  // Ignore 'already exists' — any other error bubbles up
  if (error && !error.message?.toLowerCase().includes('already exist')) {
    throw error;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // Require admin JWT
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the caller is an admin
  const { data: { user }, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user) return res.status(401).json({ error: 'Invalid or expired token' });
  if (user.app_metadata?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { action, report_id, filename, content_type, file_url } = req.body || {};

  if (!action) return res.status(400).json({ error: 'action is required' });

  try {
    // ── Action: get-url ────────────────────────────────────────────────────────
    if (action === 'get-url') {
      if (!report_id || !filename) {
        return res.status(400).json({ error: 'report_id and filename are required' });
      }

      // Verify the report exists in the DB before issuing an upload URL
      const { data: report, error: reportErr } = await sb
        .from('directory_reports')
        .select('id')
        .eq('id', report_id)
        .single();
      if (reportErr || !report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      await ensureBucket(sb);

      // Build a deterministic, filesystem-safe storage path
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
      const path = `${report_id}/${Date.now()}_${safeName}`;

      const { data: signed, error: signErr } = await sb.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);

      if (signErr) throw signErr;

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${signed.path}`;

      return res.status(200).json({
        signedUrl: signed.signedUrl,
        token: signed.token,
        path: signed.path,
        publicUrl,
      });
    }

    // ── Action: save-url ───────────────────────────────────────────────────────
    if (action === 'save-url') {
      if (!report_id || !file_url) {
        return res.status(400).json({ error: 'report_id and file_url are required' });
      }

      // Basic sanity check — only allow URLs pointing to our own storage bucket
      if (!file_url.includes(SUPABASE_URL) && !file_url.includes('supabase.co')) {
        return res.status(400).json({ error: 'Invalid file_url: must be a Supabase Storage URL' });
      }

      const { error: updateErr } = await sb
        .from('directory_reports')
        .update({ file_url })
        .eq('id', report_id);

      if (updateErr) throw updateErr;

      return res.status(200).json({ ok: true, report_id, file_url });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
