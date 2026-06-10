// POST /api/sourcing/upload-deal-bank-deck
// Handles deck file upload for deal bank listings.
// Files are saved to ~/Documents/Corner/files/aom/ on the studio disk.
// Returns a rag-tunnel URL (not Supabase Storage).
//
// Accepts:
//   FormData with:
//   - file: File object
//   - company_id: string (for ownership verification)
//
// Returns: { deckUrl: "https://rag.aheadofmarket.com/files/aom/..." }

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kzzvjtthknsozktmpvak.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Studio disk path for deal bank deck files
const DECK_STORAGE_DIR = path.join(os.homedir(), 'Documents', 'Corner', 'files', 'aom');

// Ensure the directory exists
function ensureDeckDir() {
  if (!fs.existsSync(DECK_STORAGE_DIR)) {
    fs.mkdirSync(DECK_STORAGE_DIR, { recursive: true });
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

  // Parse the FormData
  const form = formidable({ multiples: false });

  try {
    const [fields, files] = await form.parse(req);

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const companyId = Array.isArray(fields.company_id) ? fields.company_id[0] : fields.company_id;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!companyId) {
      return res.status(400).json({ error: 'company_id is required' });
    }

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

    // Read the file from disk (formidable saves it temporarily)
    const fileData = fs.readFileSync(file.filepath);

    // Generate a UUID-prefixed filename for uniqueness and safety
    const uuid = crypto.randomUUID();
    const originalName = file.originalFilename || 'deck.pdf';
    // Sanitize filename: remove dangerous characters
    const safeName = originalName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase()
      .slice(0, 100);

    const filename = `${uuid}-${safeName}`;
    const filepath = path.join(DECK_STORAGE_DIR, filename);

    // Ensure directory exists
    ensureDeckDir();

    // Write file to disk
    fs.writeFileSync(filepath, fileData);

    // Build the rag-tunnel URL
    const deckUrl = `https://rag.aheadofmarket.com/files/aom/${filename}`;

    // Clean up temp file
    try {
      fs.unlinkSync(file.filepath);
    } catch {
      // Ignore cleanup errors
    }

    return res.status(200).json({ deckUrl });
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
