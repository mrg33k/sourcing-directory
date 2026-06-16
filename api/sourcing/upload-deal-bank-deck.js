// POST /api/sourcing/upload-deal-bank-deck
// Handles deck file upload for deal bank listings.
//
// Files are stored in the public Supabase Storage bucket `deal-bank-decks`
// (decks are PUBLIC download — see migration 018). Returns the public URL, which
// the client saves to deal_bank_listings.deck_url.
//
// NOTE (2026-06-16): this route previously wrote to ~/Documents/Corner/files/aom
// on local disk and returned a rag-tunnel URL. That only works on the studio Mac;
// on Vercel serverless the home dir is read-only (writes 500) and the instance is
// ephemeral, so the file never reached the tunnel. Switched to Supabase Storage to
// match the company-logos / sourcing-reports pattern used everywhere else.
//
// Accepts:
//   FormData with:
//   - file: File object
//   - company_id: string (for ownership verification)
//
// Returns: { deckUrl: "https://<project>.supabase.co/storage/v1/object/public/deal-bank-decks/..." }

import fs from 'fs';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kzzvjtthknsozktmpvak.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DECK_BUCKET = 'deal-bank-decks';

// Create the public decks bucket on first use (idempotent — ignore "already exists").
async function ensureBucket(sb) {
  const { error } = await sb.storage.createBucket(DECK_BUCKET, {
    public: true,
    fileSizeLimit: '52428800', // 50 MB
  });
  if (error && !/already exists|exists/i.test(error.message || '')) {
    throw new Error(`Could not provision deck storage: ${error.message}`);
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

  // Require auth token
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the caller is authenticated
  const { data: { user }, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  // Parse the FormData (formidable writes the temp file to /tmp, writable on Vercel)
  const form = formidable({ multiples: false });

  try {
    const [fields, files] = await form.parse(req);

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const companyId = Array.isArray(fields.company_id) ? fields.company_id[0] : fields.company_id;

    if (!file) return res.status(400).json({ error: 'No file provided' });
    if (!companyId) return res.status(400).json({ error: 'company_id is required' });

    // Verify ownership: user must be a member of the company
    const { data: member, error: memberErr } = await sb
      .from('directory_members')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (memberErr || !member) {
      return res.status(403).json({ error: 'You do not have permission to upload a deck for this company' });
    }

    // Read the temp file formidable saved
    const fileData = fs.readFileSync(file.filepath);

    // UUID-prefixed, sanitized filename, foldered by company for tidiness
    const uuid = crypto.randomUUID();
    const originalName = file.originalFilename || 'deck.pdf';
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase().slice(0, 100);
    const objectPath = `${companyId}/${uuid}-${safeName}`;

    await ensureBucket(sb);

    const { error: upErr } = await sb.storage
      .from(DECK_BUCKET)
      .upload(objectPath, fileData, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message || 'Storage upload failed');

    const { data: pub } = sb.storage.from(DECK_BUCKET).getPublicUrl(objectPath);

    // Clean up temp file
    try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }

    return res.status(200).json({ deckUrl: pub.publicUrl });
  } catch (err) {
    console.error('Deck upload error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

export const config = {
  api: {
    bodyParser: false, // Required for formidable
  },
};
