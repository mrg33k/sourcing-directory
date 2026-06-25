// POST /api/sourcing/upload-article-cover
// Handles cover-image upload for community-submitted articles.
//
// Mirrors api/sourcing/upload-deal-bank-deck.js (the proven serverless upload
// pattern). Any signed-in member may post an article, so this requires a valid
// auth token but does NOT gate on company membership (article company is
// optional). Stores the image in the existing public `sourcing-reports` bucket
// under an `article-covers/` prefix and returns the public URL, which the post
// form saves to directory_listings.cover_image_url.
//
// Accepts: FormData with `file` (an image File).
// Returns: { coverUrl: "https://<project>.supabase.co/storage/v1/object/public/sourcing-reports/article-covers/..." }

import fs from 'fs';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kzzvjtthknsozktmpvak.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COVER_BUCKET = 'sourcing-reports';
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // Require auth token (any signed-in member may post an article).
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  const form = formidable({ multiples: false, maxFileSize: MAX_BYTES });

  try {
    const [, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const mime = file.mimetype || '';
    if (!ALLOWED.includes(mime)) {
      return res.status(400).json({ error: 'Cover must be a PNG, JPG, WEBP, or GIF image' });
    }

    const fileData = fs.readFileSync(file.filepath);

    const uuid = crypto.randomUUID();
    const originalName = file.originalFilename || 'cover.png';
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase().slice(0, 100);
    const objectPath = `article-covers/${uuid}-${safeName}`;

    const { error: upErr } = await sb.storage
      .from(COVER_BUCKET)
      .upload(objectPath, fileData, { contentType: mime, upsert: false });
    if (upErr) throw new Error(upErr.message || 'Storage upload failed');

    const { data: pub } = sb.storage.from(COVER_BUCKET).getPublicUrl(objectPath);

    try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }

    return res.status(200).json({ coverUrl: pub.publicUrl });
  } catch (err) {
    console.error('Article cover upload error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

export const config = {
  api: {
    bodyParser: false, // Required for formidable
  },
};
