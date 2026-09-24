// POST /api/os-db — answers the OS's read queries from the Supabase snapshot.
// Body: one serialized supabase-js query (see src/lib/supabase.js). Read-only.

import { runQuery } from './_lib/snapshot-engine.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'POST only' } });
  try {
    const q = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const result = runQuery(q || {});
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ data: null, error: { message: err?.message || 'Query failed' }, count: null });
  }
}
