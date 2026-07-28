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

import { requireAdmin, actorEmail } from './lib/adminAuth.js';
import {
  getPolicy,
  sanitizeSelect,
  sanitizeRow,
  isReadableColumn,
  ALLOWED_FILTERS,
} from './lib/tablePolicy.js';

const MAX_ROWS = 2000;
const MAX_PAYLOAD_ROWS = 500;
const MUTATIONS = new Set(['insert', 'update', 'upsert', 'delete']);

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
 */
function preparePayload(policy, rawPayload, auth) {
  const rows = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
  if (rows.length === 0) return { ok: false, status: 400, error: 'payload is empty' };
  if (rows.length > MAX_PAYLOAD_ROWS) {
    return { ok: false, status: 400, error: `payload exceeds ${MAX_PAYLOAD_ROWS} rows` };
  }

  const warnings = [];
  const out = [];

  for (const raw of rows) {
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

    if (policy.tenantKey && !auth.isGlobal) {
      const key = policy.tenantKey;
      const given = row[key];
      if (given == null) {
        if (auth.tenantIds.length !== 1) {
          return { ok: false, status: 400, error: `${key} is required (you administer more than one tenant)` };
        }
        row[key] = auth.tenantIds[0];
      } else if (!auth.tenantIds.includes(given)) {
        return { ok: false, status: 403, error: `${key} is outside your admin scope` };
      }
    }

    out.push(row);
  }

  return { ok: true, rows: out, warnings };
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return fail(res, 405, 'POST only');

  const body = parseBody(req);
  if (body === null) return fail(res, 400, 'Request body must be valid JSON');

  const table = body.table;
  const op = String(body.op || '').toLowerCase();

  const policy = getPolicy(table);
  if (!policy) return fail(res, 400, `table not permitted: ${String(table).slice(0, 60)}`);
  if (!policy.ops.includes(op)) {
    return fail(res, 400, `operation '${op}' not permitted on ${table}`, { allowed: policy.ops });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) return fail(res, auth.status, auth.error);
  const { sb } = auth;

  // ── filters ──────────────────────────────────────────────────────────────
  const filterCheck = validateFilters(policy, body.filters, body.id);
  if (!filterCheck.ok) return fail(res, 400, filterCheck.error);
  const filters = scopeFilters(policy, filterCheck.filters, auth);

  // update / delete without a filter would hit the whole table.
  if ((op === 'update' || op === 'delete') && filters.length === 0) {
    return fail(res, 400, `${op} requires at least one filter`);
  }

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

  const single = body.single === 'one' ? 'one' : (body.single === 'maybe' ? 'maybe' : null);

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
    const prepared = preparePayload(policy, rawPayload, auth);
    if (!prepared.ok) return fail(res, prepared.status, prepared.error, prepared.details);
    rows = prepared.rows;
    warnings = prepared.warnings;
  }

  // actor_email on an audit row is whoever the JWT says it is, never the body.
  if (table === 'directory_audit' && rows) {
    for (const row of rows) row.actor_email = actorEmail(auth.user);
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
      if (Array.isArray(body.range) && body.range.length === 2) {
        query = query.range(Number(body.range[0]) || 0, Number(body.range[1]) || 0);
      } else {
        query = query.limit(limit ?? MAX_ROWS);
      }
    } else if (op === 'insert') {
      query = query.insert(rows);
      if (wantsRows) query = query.select(selectClause);
    } else if (op === 'upsert') {
      const opts = {};
      if (typeof body.options?.onConflict === 'string' && /^[a-z_][a-z0-9_,]*$/.test(body.options.onConflict)) {
        opts.onConflict = body.options.onConflict;
      }
      if (typeof body.options?.ignoreDuplicates === 'boolean') {
        opts.ignoreDuplicates = body.options.ignoreDuplicates;
      }
      query = query.upsert(rows, opts);
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
