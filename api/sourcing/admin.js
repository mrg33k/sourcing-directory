// POST /api/sourcing/admin
//
// The single authenticated write path for the admin panel. Replaces the
// service-role Supabase client that used to be built in the BROWSER from
// VITE_SOURCING_ADMIN_KEY and shipped to every visitor who loaded the /admin chunk.
//
// The service key now exists only inside this function. The browser sends its own
// Supabase session JWT; this endpoint verifies it, resolves the caller's tenant
// reach, checks the requested table + operation + columns against an explicit
// allowlist, records an audit row, and only then touches the database.
//
// Request body:
//   {
//     table:    string                                  (must be on the allowlist)
//     op:       'select' | 'insert' | 'update' | 'upsert' | 'delete'
//     columns?: string        select clause, plain column list or '*'
//     payload?: object|array  insert / upsert / update values ('patch' also accepted)
//     id?:      string        sugar for filters: [{ type:'eq', column:'id', value:id }]
//     filters?: [{ type, column, value }]
//     order?:   [{ column, ascending, nullsFirst }]
//     limit?:   number
//     range?:   [from, to]
//     single?:  'one' | 'maybe'
//     returning?: string      select clause applied to insert/update/upsert results
//     count?:   'exact' | 'planned' | 'estimated'
//     head?:    boolean
//     options?: object        upsert options (onConflict, ignoreDuplicates)
//   }
//
// Response: 200 { data, count, warnings } | non-2xx { error, details? }
// Errors are returned as HTTP status codes with a message; nothing is swallowed.
//
// ORDER OF OPERATIONS IS PART OF THE SECURITY MODEL
// -------------------------------------------------
// requireAdmin() runs FIRST, before the body is parsed and before the table or the
// operation is looked at. It used to run after the allowlist check, which turned the
// endpoint into an enumeration oracle: an unauthenticated POST got 400 "table not
// permitted: x" for a table off the list and 401 for one on it, so anyone could walk
// the whole allowlist — table names, permitted ops, column names in the error text —
// without a token. Nothing about the request is now reflected to an unauthenticated
// caller. Only the method check precedes authentication.

import { requireAdmin, actorEmail } from './lib/adminAuth.js';
import {
  getPolicy,
  sanitizeSelect,
  sanitizeRow,
  isReadableColumn,
  checkDestructiveScope,
  ALLOWED_FILTERS,
} from './lib/tablePolicy.js';

const MAX_ROWS = 2000;
const MAX_PAYLOAD_ROWS = 500;
/**
 * Ceiling on how many parent rows a parentScope lookup will resolve in one request.
 * Kept low on purpose: the resolved ids go into an `in(...)` filter, which PostgREST
 * carries in the QUERY STRING, so a few hundred uuids is already a multi-kilobyte URL.
 * The admin panel never hits this path — TicketsSection always names a ticket_id — so
 * the cap only bounds the fallback, and it fails with an instruction rather than a
 * truncated (and therefore under-scoped) result.
 */
const MAX_PARENT_IDS = 200;
const MUTATIONS = new Set(['insert', 'update', 'upsert', 'delete']);

// ── CORS ────────────────────────────────────────────────────────────────────
// This endpoint is Bearer-authenticated and is called by the admin panel through the
// RELATIVE url '/api/sourcing/admin' (src/lib/adminApi.js), i.e. always same-origin —
// and a same-origin request needs no Access-Control-Allow-Origin header at all. The
// old wildcard therefore bought nothing and handed every other origin on the internet
// the ability to READ this endpoint's responses with a borrowed or leaked token.
// Now: echo the origin only when it is one we know, and send no ACAO otherwise.
const STATIC_ORIGINS = ['https://spacerising.org', 'https://www.spacerising.org'];

let _allowedOrigins = null;
function allowedOrigins() {
  if (_allowedOrigins) return _allowedOrigins;
  const set = new Set();
  const add = (value) => {
    if (typeof value !== 'string') return;
    const v = value.trim().replace(/\/+$/, '');
    if (v) set.add(v);
  };

  STATIC_ORIGINS.forEach(add);
  add(process.env.PUBLIC_BASE_URL);
  // Extra origins for a deployment that is not on spacerising.org.
  String(process.env.ADMIN_ALLOWED_ORIGINS || '').split(',').forEach(add);
  // The deployment's own hostnames, supplied by Vercel at runtime.
  [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ].forEach(host => { if (host) add(`https://${host}`); });

  if (process.env.NODE_ENV !== 'production') {
    ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'].forEach(add);
  }

  _allowedOrigins = set;
  return set;
}

function applyCors(req, res) {
  res.setHeader('Vary', 'Origin');
  const raw = req?.headers?.origin;
  if (typeof raw !== 'string' || !raw) return;
  const origin = raw.trim().replace(/\/+$/, '');
  if (!allowedOrigins().has(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
}

function fail(res, status, error, details) {
  const body = details ? { error, details } : { error };
  return res.status(status).json(body);
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return req.body;
}

/** Apply a validated filter list to a PostgREST builder. */
function applyFilters(query, filters) {
  for (const f of filters) {
    switch (f.type) {
      case 'in':       query = query.in(f.column, f.value); break;
      case 'is':       query = query.is(f.column, f.value); break;
      case 'contains': query = query.contains(f.column, f.value); break;
      default:         query = query[f.type](f.column, f.value); break;
    }
  }
  return query;
}

/**
 * Validate the requested filters against the table policy.
 * @returns {{ ok: true, filters: object[] } | { ok: false, error: string }}
 */
function validateFilters(policy, raw, id) {
  const filters = [];

  if (id !== undefined && id !== null) {
    if (typeof id !== 'string' && typeof id !== 'number') {
      return { ok: false, error: 'id must be a string or number' };
    }
    filters.push({ type: 'eq', column: 'id', value: id });
  }

  if (raw === undefined || raw === null) return { ok: true, filters };
  if (!Array.isArray(raw)) return { ok: false, error: 'filters must be an array' };
  if (raw.length > 25) return { ok: false, error: 'too many filters' };

  for (const f of raw) {
    if (!f || typeof f !== 'object') return { ok: false, error: 'each filter must be an object' };
    const type = String(f.type || 'eq');
    if (!ALLOWED_FILTERS.has(type)) return { ok: false, error: `unsupported filter: ${type}` };
    if (!isReadableColumn(policy, f.column)) {
      return { ok: false, error: `column not filterable on this table: ${String(f.column).slice(0, 40)}` };
    }
    if (type === 'in') {
      if (!Array.isArray(f.value)) return { ok: false, error: `'in' filter needs an array value` };
      if (f.value.length > 1000) return { ok: false, error: `'in' filter list too long` };
    }
    filters.push({ type, column: f.column, value: f.value });
  }

  return { ok: true, filters };
}

/**
 * Force a non-global admin's request inside their own tenants.
 * Global admins (app_metadata.role === 'admin') are not scoped.
 */
function scopeFilters(policy, filters, auth) {
  if (auth.isGlobal || !policy.tenantKey) return filters;
  return [...filters, { type: 'in', column: policy.tenantKey, value: auth.tenantIds }];
}

/**
 * Normalise a write payload: array-or-object in, validated array out.
 * Also enforces tenant ownership on every row for non-global admins.
 *
 * TENANT RESOLUTION, PER OPERATION (the 2026-07-28 fix)
 * -----------------------------------------------------
 * The previous version demanded `policy.tenantKey` in the BODY whenever the caller
 * administered more than one tenant, and injected it after sanitisation otherwise.
 * Both halves were wrong:
 *
 *   - directory_tenants scopes on `id`, and `id` is deliberately not writable, so
 *     sanitizeRow always stripped it. An admin of two or more tenants got a hard
 *     400 "id is required" on every Settings save and could never update settings
 *     at all — SettingsSection.jsx sends `.update(row).eq('id', tenant.id)` with no
 *     `id` inside `row`, by design.
 *   - For a single-tenant admin the injection put `id` INTO the SET clause of an
 *     UPDATE, i.e. it wrote the primary key on every settings save.
 *
 * An UPDATE does not need the tenant in its payload: which rows it touches is decided
 * by the filters, and scopeFilters() has already appended `in(tenantKey, tenantIds)`.
 * So the tenant is now resolved from the authenticated context:
 *
 *   insert / upsert - the row is NEW and must be planted in a tenant. Inject when the
 *                     caller administers exactly one; otherwise the caller must name it.
 *   update          - never injected. Never required. Bounded by the scoping filter.
 *   any op          - if the caller DID name a tenant, it must be one of theirs (403),
 *                     checked against the raw payload so a non-writable tenant key
 *                     (directory_tenants.id) cannot be laundered through the strip.
 */
function preparePayload(policy, rawPayload, auth, op) {
  const rows = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
  if (rows.length === 0) return { ok: false, status: 400, error: 'payload is empty' };
  if (rows.length > MAX_PAYLOAD_ROWS) {
    return { ok: false, status: 400, error: `payload exceeds ${MAX_PAYLOAD_ROWS} rows` };
  }

  const warnings = [];
  const out = [];
  const creating = op === 'insert' || op === 'upsert';

  for (const raw of rows) {
    const key = policy.tenantKey;
    // Read the tenant key off the RAW row: sanitizeRow drops columns that are not
    // writable, and on directory_tenants the tenant key IS the non-writable `id`.
    const claimed = (key && raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw[key] : undefined;

    const { row, warnings: rowWarnings } = sanitizeRow(policy, raw);
    for (const w of rowWarnings) if (!warnings.includes(w)) warnings.push(w);

    // A payload where nothing survived means the caller and the policy disagree
    // completely. That is loud, not silent.
    if (Object.keys(row).length === 0) {
      return {
        ok: false,
        status: 400,
        error: 'no writable columns in payload for this table',
        details: rowWarnings,
      };
    }

    if (key && !auth.isGlobal) {
      const given = row[key] !== undefined && row[key] !== null ? row[key] : claimed;
      if (given != null) {
        if (!auth.tenantIds.includes(given)) {
          return { ok: false, status: 403, error: `${key} is outside your admin scope` };
        }
      } else if (creating) {
        if (!policy.writable.includes(key)) {
          return { ok: false, status: 400, error: `rows cannot be created on this table through the admin API` };
        }
        if (auth.tenantIds.length !== 1) {
          return { ok: false, status: 400, error: `${key} is required (you administer more than one tenant)` };
        }
        row[key] = auth.tenantIds[0];
      }
      // update: intentionally nothing. scopeFilters() bounds the statement.
    }

    // A child row must name its parent, or there is nothing to scope it by.
    if (policy.parentScope && !auth.isGlobal) {
      const pc = policy.parentScope;
      if (row[pc.column] == null) {
        return { ok: false, status: 400, error: `${pc.column} is required on this table` };
      }
    }

    out.push(row);
  }

  return { ok: true, rows: out, warnings };
}

/** Parent ids a request explicitly pins, via eq / in filters or the write payload. */
function referencedParentIds(parentScope, filters, rows) {
  const ids = new Set();
  for (const f of filters) {
    if (f.column !== parentScope.column) continue;
    if (f.type === 'eq' && f.value != null) ids.add(f.value);
    else if (f.type === 'in' && Array.isArray(f.value)) f.value.forEach(v => { if (v != null) ids.add(v); });
  }
  if (rows) for (const row of rows) if (row[parentScope.column] != null) ids.add(row[parentScope.column]);
  return [...ids];
}

/**
 * Resolve a tenant-less child table's scope through its parent row.
 *
 * admin_ticket_comments has no tenant column, so it used to be reachable in full by
 * any tenant admin. Its ticket_id is a NOT NULL FK to admin_tickets, which does carry
 * tenant_id — so the parent decides the tenant, exactly like the RLS policy would.
 *
 * Two shapes:
 *   caller pinned a parent  -> verify EVERY pinned parent is in the caller's tenants.
 *   caller pinned none      -> inject `in(parentColumn, <their parents>)` so a bare
 *                              select or an id-keyed delete still cannot leave scope.
 *
 * @returns {Promise<{ ok: true, filters: object[], empty?: boolean } | { ok: false, status: number, error: string }>}
 */
async function applyParentScope(sb, policy, filters, rows, auth) {
  const pc = policy.parentScope;
  if (!pc || auth.isGlobal) return { ok: true, filters };

  const pinned = referencedParentIds(pc, filters, rows);

  if (pinned.length > 0) {
    if (pinned.length > MAX_PARENT_IDS) {
      return { ok: false, status: 400, error: `too many ${pc.column} values in one request` };
    }
    const { data, error } = await sb
      .from(pc.table)
      .select(pc.parentKey)
      .in(pc.parentKey, pinned)
      .in(pc.tenantKey, auth.tenantIds);
    if (error) {
      return { ok: false, status: 500, error: `Could not resolve ${pc.column} scope: ${error.message}` };
    }
    const allowed = new Set((data || []).map(r => r[pc.parentKey]));
    const rejected = pinned.filter(id => !allowed.has(id));
    if (rejected.length > 0) {
      return { ok: false, status: 403, error: `${pc.column} is outside your admin scope` };
    }
    return { ok: true, filters };
  }

  // Nothing pinned: bound the statement to every parent the caller owns.
  const { data, error } = await sb
    .from(pc.table)
    .select(pc.parentKey)
    .in(pc.tenantKey, auth.tenantIds)
    .limit(MAX_PARENT_IDS + 1);
  if (error) {
    return { ok: false, status: 500, error: `Could not resolve ${pc.column} scope: ${error.message}` };
  }
  const ids = (data || []).map(r => r[pc.parentKey]);
  if (ids.length > MAX_PARENT_IDS) {
    return { ok: false, status: 400, error: `too many records in scope — narrow the request with a ${pc.column} filter` };
  }
  // `in` with an empty list is not a query we want to hand to PostgREST; an empty
  // scope simply means there is nothing to act on.
  if (ids.length === 0) return { ok: true, filters, empty: true };
  return { ok: true, filters: [...filters, { type: 'in', column: pc.column, value: ids }] };
}

/**
 * Record the intent of a mutation BEFORE it runs.
 *
 * Deliberately not modelled on src/pages/admin/audit.js, which wraps its insert in
 * `catch (_) {}` — an audit log that silently stops recording is worse than none,
 * because it still looks like a log. Here, a mutation that cannot be audited does
 * not happen: the caller gets 503 and the database is untouched.
 */
async function writeAudit(sb, { auth, table, op, filters, rowCount }) {
  const tenantId = (!auth.isGlobal && auth.tenantIds.length === 1) ? auth.tenantIds[0] : null;
  const filterSummary = filters
    .filter(f => f.column !== 'tenant_id' || auth.isGlobal)
    .map(f => `${f.column} ${f.type} ${Array.isArray(f.value) ? `[${f.value.length}]` : String(f.value).slice(0, 60)}`);

  const { error } = await sb.from('directory_audit').insert({
    tenant_id: tenantId,
    actor_email: actorEmail(auth.user),
    action: `api.${table}.${op}`,
    entity_type: table,
    entity_id: null,
    detail: {
      op,
      table,
      rows: rowCount,
      filters: filterSummary,
      actor_id: auth.user?.id || null,
      global_admin: auth.isGlobal,
    },
  });

  return error || null;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return fail(res, 405, 'POST only');

  // ── authenticate FIRST ───────────────────────────────────────────────────
  // Before the body is read, before the table is named. An unauthenticated caller
  // learns exactly one thing from this endpoint: that they are not signed in.
  const auth = await requireAdmin(req);
  if (!auth.ok) return fail(res, auth.status, auth.error);
  const { sb } = auth;

  const body = parseBody(req);
  if (body === null) return fail(res, 400, 'Request body must be valid JSON');

  const table = body.table;
  const op = String(body.op || '').toLowerCase();

  const policy = getPolicy(table);
  if (!policy) return fail(res, 400, `table not permitted: ${String(table).slice(0, 60)}`);
  if (!policy.ops.includes(op)) {
    return fail(res, 400, `operation '${op}' not permitted on ${table}`, { allowed: policy.ops });
  }
  // Platform-level tables with no tenant of their own (the Deal Bank).
  if (policy.globalOnly && !auth.isGlobal) {
    return fail(res, 403, `${table} is managed platform-wide and is not part of a tenant admin's scope`);
  }

  // ── filters ──────────────────────────────────────────────────────────────
  const filterCheck = validateFilters(policy, body.filters, body.id);
  if (!filterCheck.ok) return fail(res, 400, filterCheck.error);
  let filters = scopeFilters(policy, filterCheck.filters, auth);

  // update / delete need more than "the caller sent a filter" — `neq id <zero uuid>`
  // is one filter and selects the whole table. See checkDestructiveScope.
  if ((op === 'update' || op === 'delete') && filters.length === 0) {
    return fail(res, 400, `${op} requires at least one filter`);
  }
  const scopeCheck = checkDestructiveScope(policy, op, filters);
  if (!scopeCheck.ok) return fail(res, 400, scopeCheck.error);

  // ── select clause ────────────────────────────────────────────────────────
  const wantsRows = op === 'select' || body.returning !== undefined || body.single;
  const selectSource = op === 'select' ? body.columns : body.returning;
  let selectClause = '*';
  if (wantsRows) {
    const sel = sanitizeSelect(policy, selectSource);
    if (!sel.ok) return fail(res, 400, sel.error);
    selectClause = sel.value;
  }

  // ── ordering / paging ────────────────────────────────────────────────────
  const order = [];
  if (body.order !== undefined && body.order !== null) {
    if (!Array.isArray(body.order)) return fail(res, 400, 'order must be an array');
    for (const o of body.order) {
      if (!o || !isReadableColumn(policy, o.column)) {
        return fail(res, 400, `column not orderable on this table: ${String(o?.column).slice(0, 40)}`);
      }
      order.push({ column: o.column, ascending: o.ascending !== false, nullsFirst: !!o.nullsFirst });
    }
  }

  let limit = null;
  if (body.limit !== undefined && body.limit !== null) {
    const n = Number(body.limit);
    if (!Number.isInteger(n) || n < 1) return fail(res, 400, 'limit must be a positive integer');
    limit = Math.min(n, MAX_ROWS);
  }

  // `range` used to be passed straight through — `Number(x) || 0`, no validation and
  // no ceiling — so `range: [0, 5000000]` walked clean past the MAX_ROWS cap that the
  // `limit` path enforces. Same ceiling on both paths now.
  let range = null;
  if (body.range !== undefined && body.range !== null) {
    if (!Array.isArray(body.range) || body.range.length !== 2) {
      return fail(res, 400, 'range must be [from, to]');
    }
    const from = Number(body.range[0]);
    const to = Number(body.range[1]);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) {
      return fail(res, 400, 'range must be two integers with 0 <= from <= to');
    }
    range = [from, Math.min(to, from + (limit ?? MAX_ROWS) - 1)];
  }

  const single = body.single === 'one' ? 'one' : (body.single === 'maybe' ? 'maybe' : null);

  // ── upsert options ───────────────────────────────────────────────────────
  // onConflict names columns and is interpolated into the PostgREST query string. It
  // was checked against an identifier regex only — never against this table's columns —
  // so any well-formed identifier reached the database. Validate it against the
  // allowlist like every other column reference in this file.
  const upsertOptions = {};
  const rawOnConflict = body.options?.onConflict;
  if (rawOnConflict !== undefined && rawOnConflict !== null) {
    if (typeof rawOnConflict !== 'string') return fail(res, 400, 'onConflict must be a string');
    const cols = rawOnConflict.split(',').map(s => s.trim()).filter(Boolean);
    if (cols.length === 0 || cols.length > 10) return fail(res, 400, 'onConflict must name 1-10 columns');
    for (const c of cols) {
      if (!isReadableColumn(policy, c)) {
        return fail(res, 400, `onConflict column not permitted on this table: ${String(c).slice(0, 40)}`);
      }
    }
    upsertOptions.onConflict = cols.join(',');
  }
  if (typeof body.options?.ignoreDuplicates === 'boolean') {
    upsertOptions.ignoreDuplicates = body.options.ignoreDuplicates;
  }

  // ── write payload ────────────────────────────────────────────────────────
  let rows = null;
  let warnings = [];
  if (op === 'insert' || op === 'upsert' || op === 'update') {
    const rawPayload = body.payload !== undefined ? body.payload : body.patch;
    if (rawPayload === undefined || rawPayload === null) {
      return fail(res, 400, `${op} requires a payload`);
    }
    if (op === 'update' && Array.isArray(rawPayload)) {
      return fail(res, 400, 'update payload must be a single object');
    }
    const prepared = preparePayload(policy, rawPayload, auth, op);
    if (!prepared.ok) return fail(res, prepared.status, prepared.error, prepared.details);
    rows = prepared.rows;
    warnings = prepared.warnings;
  }

  // actor_email on an audit row is whoever the JWT says it is, never the body.
  if (table === 'directory_audit' && rows) {
    for (const row of rows) row.actor_email = actorEmail(auth.user);
  }
  // Same rule for any table that records who acted (admin_ticket_comments.author):
  // attribution comes from the verified token, not from a field the caller controls.
  if (policy.actorColumn && rows) {
    for (const row of rows) row[policy.actorColumn] = actorEmail(auth.user);
  }

  // ── parent scoping for tenant-less child tables ──────────────────────────
  // Runs after the payload is prepared, because an insert names its parent in the row
  // rather than in a filter. Runs before the audit write, because a request that is
  // out of scope never happens and must not be recorded as if it did.
  const parentScoped = await applyParentScope(sb, policy, filters, rows, auth);
  if (!parentScoped.ok) return fail(res, parentScoped.status, parentScoped.error);
  filters = parentScoped.filters;
  if (parentScoped.empty) {
    // The caller administers no parent rows at all, so this request has an empty
    // universe. A read returns nothing; a write has nothing it is allowed to touch.
    if (op === 'select') return res.status(200).json({ data: single ? null : [], count: 0, warnings });
    return fail(res, 403, 'nothing in scope for this request');
  }

  // ── audit before acting ──────────────────────────────────────────────────
  // Skipped for directory_audit itself (the row IS the record — auditing an audit
  // write would recurse) and for reads.
  if (MUTATIONS.has(op) && table !== 'directory_audit') {
    const auditErr = await writeAudit(sb, {
      auth, table, op, filters, rowCount: rows ? rows.length : null,
    });
    if (auditErr) {
      console.error('[api/sourcing/admin] audit write failed, refusing mutation:', auditErr.message);
      return fail(res, 503, 'Could not record this action in the audit log, so it was not performed.', auditErr.message);
    }
  }

  // ── execute ──────────────────────────────────────────────────────────────
  try {
    let query = sb.from(table);

    if (op === 'select') {
      const selectOpts = {};
      if (body.count) selectOpts.count = body.count;
      if (body.head) selectOpts.head = true;
      query = query.select(selectClause, Object.keys(selectOpts).length ? selectOpts : undefined);
      query = applyFilters(query, filters);
      for (const o of order) query = query.order(o.column, { ascending: o.ascending, nullsFirst: o.nullsFirst });
      if (range) {
        query = query.range(range[0], range[1]);
      } else {
        query = query.limit(limit ?? MAX_ROWS);
      }
    } else if (op === 'insert') {
      query = query.insert(rows);
      if (wantsRows) query = query.select(selectClause);
    } else if (op === 'upsert') {
      query = query.upsert(rows, upsertOptions);
      if (wantsRows) query = query.select(selectClause);
    } else if (op === 'update') {
      query = query.update(rows[0]);
      query = applyFilters(query, filters);
      if (wantsRows) query = query.select(selectClause);
    } else if (op === 'delete') {
      query = query.delete();
      query = applyFilters(query, filters);
      if (wantsRows) query = query.select(selectClause);
    }

    if (single === 'one') query = query.single();
    else if (single === 'maybe') query = query.maybeSingle();

    const { data, error, count } = await query;
    if (error) {
      return fail(res, 400, error.message || 'Database error', {
        code: error.code || null,
        hint: error.hint || null,
      });
    }

    return res.status(200).json({
      data: data ?? null,
      count: count ?? null,
      warnings,
    });
  } catch (err) {
    console.error('[api/sourcing/admin] unexpected error:', err);
    return fail(res, 500, err?.message || 'Unexpected server error');
  }
}
