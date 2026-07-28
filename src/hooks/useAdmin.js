/**
 * useAdmin — resolves whether the signed-in user may see the admin panel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS DEFENCE IN DEPTH. IT IS NOT SECURITY.
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything here runs in the browser, on data the browser is free to lie about.
 * Anyone can open devtools, flip `isAdmin` to true, and render the panel. The
 * only reason that is not a catastrophe is the SERVER-SIDE check that guards the
 * actual reads and writes.
 *
 * What this hook fixes: before it existed, SourcingAdmin.jsx did
 * `setAuthed(!!session)`, so any signed-in account — including one created ten
 * seconds ago and still `status='pending'` — rendered the full admin panel and
 * every row it loads. That is an accidental data exposure, and this hook closes
 * it for honest users.
 *
 * What this hook does NOT fix: an attacker who bypasses the client check, or who
 * simply uses the leaked `VITE_SOURCING_ADMIN_KEY` service-role token straight
 * from the public JS bundle. The real fix is the server-side authorization
 * endpoint (Agent B) plus rotating the leaked key
 * (see `docs/security/key-rotation-runbook.md`).
 *
 * DO NOT let this file be the reason someone closes the server-side ticket.
 *
 * ── Admin is two things ──────────────────────────────────────────────────────
 *   (a) GLOBAL admin — `user.app_metadata.role === 'admin'`. `app_metadata` is
 *       writable only with the service role, so it is trustworthy at the source
 *       (it is signed into the JWT); it is still read here in the browser.
 *   (b) TENANT admin — a `directory_members` row for this user with
 *       `role = 'admin'` AND `status = 'approved'`. `status` is what keeps a
 *       pending signup out.
 *
 * This mirrors the tenant-scoping logic already in SourcingAdmin.jsx, with one
 * deliberate difference: it queries through the ANON client using the user's own
 * session, so RLS ("members read own": `auth.uid() = auth_user_id`) enforces the
 * scoping in Postgres. It never touches the service-role client — a guard that
 * asks a god-mode key whether you are allowed in is not a guard.
 *
 * @returns {{
 *   isAdmin: boolean,        // global admin OR admin of >= 1 tenant
 *   isGlobalAdmin: boolean,  // app_metadata.role === 'admin'
 *   tenantIds: string[],     // tenant UUIDs where this user is an approved admin
 *   loading: boolean,        // true until the first resolution completes
 *   signedIn: boolean        // additive: lets callers say "sign in" vs "no access"
 * }}
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

// Stable identity so `tenantIds` does not change reference on every render.
const NO_TENANTS = []

export function useAdmin() {
  // `undefined` = we have not heard from Supabase Auth yet.
  // `null`      = resolved, and nobody is signed in.
  const [session, setSession] = useState(undefined)
  const [tenantIds, setTenantIds] = useState(NO_TENANTS)
  const [membershipLoading, setMembershipLoading] = useState(true)

  // ── 1. Track the session ───────────────────────────────────────────────────
  // The auth listener only ever calls setState. It must not await a Supabase
  // query: in supabase-js v2 the onAuthStateChange callback runs while the auth
  // lock is held, and any `.from()` call inside it can deadlock waiting for that
  // same lock. The DB read lives in effect 2, outside the callback.
  useEffect(() => {
    if (!supabase) {
      // Env vars missing (local dev without Supabase). Nobody is an admin.
      setSession(null)
      setMembershipLoading(false)
      return
    }

    let cancelled = false

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setSession(data?.session || null)
      })
      .catch(() => {
        if (!cancelled) setSession(null)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!cancelled) setSession(nextSession || null)
    })

    return () => {
      cancelled = true
      data?.subscription?.unsubscribe()
    }
  }, [])

  const user = session?.user || null
  const userId = user?.id || null
  const isGlobalAdmin = user?.app_metadata?.role === 'admin'

  // ── 2. Resolve tenant-scoped admin memberships ─────────────────────────────
  useEffect(() => {
    // Still waiting on the session.
    if (session === undefined) return

    if (!supabase || !userId) {
      setTenantIds(NO_TENANTS)
      setMembershipLoading(false)
      return
    }

    let cancelled = false
    setMembershipLoading(true)

    supabase
      .from('directory_members')
      .select('tenant_id')
      .eq('auth_user_id', userId)
      .eq('role', 'admin')
      .eq('status', 'approved')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // Fail CLOSED. A query that errored is not evidence of admin rights.
          setTenantIds(NO_TENANTS)
        } else {
          const ids = [...new Set((data || []).map(r => r.tenant_id).filter(Boolean))]
          setTenantIds(ids.length ? ids : NO_TENANTS)
        }
        setMembershipLoading(false)
      })

    return () => { cancelled = true }
  }, [session, userId])

  const loading = session === undefined || membershipLoading

  return {
    isAdmin: !loading && (isGlobalAdmin || tenantIds.length > 0),
    isGlobalAdmin: !loading && isGlobalAdmin,
    tenantIds,
    loading,
    signedIn: !!userId,
  }
}

export default useAdmin
