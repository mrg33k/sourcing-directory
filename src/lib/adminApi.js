// Browser-side client for POST /api/sourcing/admin.
//
// This file exists so the admin panel can keep writing to the database WITHOUT a
// service-role key in the bundle. Every call carries the signed-in user's own
// Supabase JWT; the server verifies it, resolves their tenant reach, and checks the
// table + operation + columns against an allowlist before touching anything.
//
// createAdminApiClient() returns a drop-in shim with the same
// `.from(table).select() / .insert() / .update() / .upsert() / .delete()` surface the
// 14 admin section components already call, so those files migrate later, mechanically,
// without a big-bang rewrite. The builder is lazy and thenable exactly like a
// PostgREST builder: nothing is sent until it is awaited, and the resolved shape is
// `{ data, error, count }` — it resolves with an error object rather than throwing,
// which is what every existing call site expects.
//
// Known gaps vs. the real client (nothing in src/pages/admin/ uses these today):
//   - no embedded selects / joins  (`select('*, other(*)')`)
//   - no .or() / .not() / .filter() / .textSearch() / .rpc()
//   - no .csv() / .explain() / .abortSignal() / .throwOnError()
//   - `.storage` is delegated to the user-session client, so storage RLS now applies
//     where the service key previously bypassed it. See STORAGE note below.

import { supabase } from './supabase.js';

const ENDPOINT = '/api/sourcing/admin';

const FILTER_METHODS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'like', 'ilike', 'contains'];

async function accessToken() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Send one request to the admin endpoint.
 * Always resolves — never rejects — with `{ data, error, count, warnings }`.
 */
export async function adminRequest(payload) {
  const token = await accessToken();
  if (!token) {
    return { data: null, error: { message: 'You are signed out. Sign in again to continue.' }, count: null, warnings: [] };
  }

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { data: null, error: { message: err?.message || 'Network error' }, count: null, warnings: [] };
  }

  let json = {};
  try { json = await res.json(); } catch { json = {}; }

  if (!res.ok) {
    return {
      data: null,
      count: null,
      warnings: [],
      error: {
        message: json.error || `Request failed (HTTP ${res.status})`,
        status: res.status,
        details: json.details ?? null,
      },
    };
  }

  const warnings = Array.isArray(json.warnings) ? json.warnings : [];
  if (warnings.length) {
    // Dropped columns are never silent — they show up in the console with the table.
    console.warn(`[adminApi] ${payload.op} ${payload.table}:`, warnings.join(' | '));
  }

  return { data: json.data ?? null, error: null, count: json.count ?? null, warnings };
}

/**
 * Lazy, thenable query builder mirroring the PostgREST builder shape.
 * Nothing is sent until the builder is awaited (or Promise.all'd).
 */
class AdminQuery {
  constructor(table) {
    this._table = table;
    this._op = null;
    this._columns = null;
    this._returning = undefined;
    this._payload = null;
    this._options = null;
    this._filters = [];
    this._order = [];
    this._limit = null;
    this._range = null;
    this._single = null;
    this._count = null;
    this._head = false;
    this._promise = null;
  }

  select(columns = '*', options) {
    if (!this._op) {
      this._op = 'select';
      this._columns = columns || '*';
      if (options?.count) this._count = options.count;
      if (options?.head) this._head = true;
    } else {
      // `.insert(...).select()` / `.update(...).select('id')` — returning clause.
      this._returning = columns || '*';
    }
    return this;
  }

  insert(values, options) { this._op = 'insert'; this._payload = values; this._options = options || null; return this; }
  upsert(values, options) { this._op = 'upsert'; this._payload = values; this._options = options || null; return this; }
  update(values) { this._op = 'update'; this._payload = values; return this; }
  delete() { this._op = 'delete'; return this; }

  order(column, options) {
    this._order.push({
      column,
      ascending: options?.ascending !== false,
      nullsFirst: !!options?.nullsFirst,
    });
    return this;
  }

  limit(n) { this._limit = n; return this; }
  range(from, to) { this._range = [from, to]; return this; }
  single() { this._single = 'one'; return this; }
  maybeSingle() { this._single = 'maybe'; return this; }

  match(criteria) {
    Object.entries(criteria || {}).forEach(([column, value]) => {
      this._filters.push({ type: 'eq', column, value });
    });
    return this;
  }

  _body() {
    const body = { table: this._table, op: this._op };
    if (this._op === 'select') {
      body.columns = this._columns || '*';
      if (this._count) body.count = this._count;
      if (this._head) body.head = true;
    }
    if (this._returning !== undefined) body.returning = this._returning;
    if (this._payload !== null) body.payload = this._payload;
    if (this._options) body.options = this._options;
    if (this._filters.length) body.filters = this._filters;
    if (this._order.length) body.order = this._order;
    if (this._limit != null) body.limit = this._limit;
    if (this._range) body.range = this._range;
    if (this._single) body.single = this._single;
    return body;
  }

  _run() {
    if (!this._promise) {
      if (!this._op) {
        this._promise = Promise.resolve({
          data: null,
          error: { message: `No operation requested on ${this._table}` },
          count: null,
        });
      } else {
        this._promise = adminRequest(this._body());
      }
    }
    return this._promise;
  }

  then(onFulfilled, onRejected) { return this._run().then(onFulfilled, onRejected); }
  catch(onRejected) { return this._run().catch(onRejected); }
  finally(onFinally) { return this._run().finally(onFinally); }
}

for (const method of FILTER_METHODS) {
  AdminQuery.prototype[method] = function filter(column, value) {
    this._filters.push({ type: method, column, value });
    return this;
  };
}

/**
 * Drop-in replacement for the old browser-side service-role Supabase client.
 *
 * Returns null when Supabase is not configured at all, preserving the existing
 * "Supabase not configured" branch in SourcingAdmin.jsx.
 */
export function createAdminApiClient() {
  if (!supabase) return null;
  return {
    __adminApiShim: true,

    from(table) { return new AdminQuery(table); },

    // STORAGE: uploads keep going straight to Supabase Storage, but now as the
    // signed-in user instead of service_role. Storage RLS is therefore enforced
    // where it previously was not. Buckets in play: `company-logos`, `sourcing-reports`.
    get storage() { return supabase.storage; },

    // A few components read the session off the client they were handed.
    get auth() { return supabase.auth; },
  };
}

export default createAdminApiClient;
