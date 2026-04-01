// Supabase client for Sourcing Directory
// Uses VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (client-safe, read-only capable)
// These must be set in Vercel env vars with VITE_ prefix to be exposed to the browser.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Returns null if env vars are missing (localhost without Supabase configured).
// All callers should guard: if (!supabase) { fall back to local API }
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null
