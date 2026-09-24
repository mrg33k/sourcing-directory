// Database client for Sourcing Directory / Space OS.
//
// 2026-09-23: the Supabase project is gone. Until the Convex move lands, this is a
// read-only stand-in with the same surface the pages already call
// (from/select/eq/order/.../rpc/auth/storage). Every read is serialized and
// answered by /api/os-db from the 2026-09-14 snapshot (data/os-snapshot/db.json).
// Writes, sign-in and uploads resolve with a friendly error instead of throwing.

const ENDPOINT = '/api/os-db'
const READ_ONLY = { message: 'Space OS is in read-only mode right now. Changes are paused.', code: 'READ_ONLY' }

async function post(body) {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    return { data: json.data ?? null, error: json.error ?? null, count: json.count ?? null, status: res.status }
  } catch (err) {
    return { data: null, error: { message: err?.message || 'Network error' }, count: null }
  }
}

class Query {
  constructor(table) {
    this.q = { table, select: '*', filters: [], order: [] }
    this.write = false
  }

  select(cols = '*', opts = {}) {
    if (!this.write) {
      this.q.select = cols
      if (opts.count) this.q.count = opts.count
      if (opts.head) this.q.head = true
    }
    return this
  }

  insert() { this.write = true; return this }
  update() { this.write = true; return this }
  upsert() { this.write = true; return this }
  delete() { this.write = true; return this }

  _op(op, col, val) { this.q.filters.push({ type: 'op', op, col, val }); return this }
  eq(c, v) { return this._op('eq', c, v) }
  neq(c, v) { return this._op('neq', c, v) }
  gt(c, v) { return this._op('gt', c, v) }
  gte(c, v) { return this._op('gte', c, v) }
  lt(c, v) { return this._op('lt', c, v) }
  lte(c, v) { return this._op('lte', c, v) }
  like(c, v) { return this._op('like', c, v) }
  ilike(c, v) { return this._op('ilike', c, v) }
  is(c, v) { return this._op('is', c, v === null ? 'null' : v) }
  in(c, v) { return this._op('in', c, v) }
  contains(c, v) { return this._op('cs', c, v) }
  containedBy(c, v) { return this._op('cd', c, v) }
  overlaps(c, v) { return this._op('ov', c, v) }
  textSearch(c, v) { return this._op('fts', c, v) }
  not(col, op, val) { this.q.filters.push({ type: 'not', col, op, val: val === null ? 'null' : val }); return this }
  filter(col, op, val) { this.q.filters.push({ type: 'filter', col, op, val }); return this }
  or(expr) { this.q.filters.push({ type: 'or', expr }); return this }
  match(obj) { this.q.filters.push({ type: 'match', obj }); return this }

  order(col, opts = {}) {
    this.q.order.push({ col, ascending: opts.ascending !== false, nullsFirst: opts.nullsFirst, foreignTable: opts.foreignTable || opts.referencedTable })
    return this
  }
  limit(n) { this.q.limit = n; return this }
  range(a, b) { this.q.range = [a, b]; return this }
  single() { this.q.single = true; return this }
  maybeSingle() { this.q.maybeSingle = true; return this }
  abortSignal() { return this }
  returns() { return this }
  throwOnError() { return this }

  then(resolve, reject) {
    const p = this.write ? Promise.resolve({ data: null, error: READ_ONLY, count: null }) : post(this.q)
    return p.then(resolve, reject)
  }
  catch(fn) { return this.then(undefined, fn) }
  finally(fn) { return this.then((v) => { fn?.(); return v }, (e) => { fn?.(); throw e }) }
}

const listeners = new Set()

const auth = {
  async getSession() { return { data: { session: null }, error: null } },
  async getUser() { return { data: { user: null }, error: null } },
  onAuthStateChange(cb) {
    listeners.add(cb)
    setTimeout(() => { try { cb('INITIAL_SESSION', null) } catch { /* ignore */ } }, 0)
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
  },
  async signInWithPassword() { return { data: { user: null, session: null }, error: { message: 'Sign-in is paused while Space OS moves to its new home. Browsing still works.' } } },
  async signUp() { return { data: { user: null, session: null }, error: READ_ONLY } },
  async signOut() { return { error: null } },
  async updateUser() { return { data: { user: null }, error: READ_ONLY } },
  async resetPasswordForEmail() { return { data: null, error: READ_ONLY } },
  async refreshSession() { return { data: { session: null }, error: null } },
  async setSession() { return { data: { session: null }, error: null } },
}

const storage = {
  from() {
    return {
      async upload() { return { data: null, error: READ_ONLY } },
      async uploadToSignedUrl() { return { data: null, error: READ_ONLY } },
      async createSignedUploadUrl() { return { data: null, error: READ_ONLY } },
      async remove() { return { data: null, error: READ_ONLY } },
      async download() { return { data: null, error: READ_ONLY } },
      async createSignedUrl() { return { data: null, error: READ_ONLY } },
      async list() { return { data: [], error: null } },
      getPublicUrl(p) { return { data: { publicUrl: p } } },
    }
  },
}

export const supabase = {
  from: (table) => new Query(table),
  rpc: (fn, args = {}) => {
    const p = post({ rpc: fn, args })
    return { then: (a, b) => p.then(a, b), catch: (f) => p.catch(f), single() { return this }, maybeSingle() { return this } }
  },
  auth,
  storage,
  channel: () => ({ on() { return this }, subscribe() { return this }, unsubscribe() {} }),
  removeChannel() {},
}
