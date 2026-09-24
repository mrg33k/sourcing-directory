// Read-only stand-in for Supabase/PostgREST, answering from a JSON snapshot.
//
// Supabase was shut off 2026-09-23. The OS still asks its questions in supabase-js
// shape (from/select/eq/order/...); src/lib/supabase.js serializes each question
// and POSTs it to /api/os-db, which runs it here against data/os-snapshot/db.json.
//
// Covers what src/ uses: embedded selects (alias:rel(cols), fk-column hints,
// !inner), eq/neq/gt/gte/lt/lte/like/ilike/is/in/cs/cd/ov, not(), or() incl.
// nested and(), filter(), match(), textSearch (approximated as ilike), order,
// limit, range, single/maybeSingle, count + head, and the RPCs the pages call.

import fs from 'node:fs';
import path from 'node:path';

let DB = null;
export function loadDb() {
  if (!DB) {
    const file = path.join(process.cwd(), 'data', 'os-snapshot', 'db.json');
    DB = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return DB;
}

// ---------- select parsing ----------

function splitTop(str, sep = ',') {
  const out = []; let depth = 0; let cur = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

function parseSelect(sel) {
  const items = [];
  for (const raw of splitTop((sel || '*').replace(/\s+/g, ''))) {
    const paren = raw.indexOf('(');
    if (paren > -1 && raw.endsWith(')')) {
      let head = raw.slice(0, paren);
      const inner = raw.slice(paren + 1, -1);
      let alias = null;
      if (head.includes(':')) [alias, head] = head.split(':');
      const [rel, ...hints] = head.split('!');
      items.push({ kind: 'embed', alias: alias || rel, rel, inner: hints.includes('inner'), hint: hints.find((h) => h !== 'inner' && h !== 'left'), sub: parseSelect(inner) });
    } else if (raw === '*') {
      items.push({ kind: 'star' });
    } else {
      let col = raw.split('::')[0]; let alias = null;
      if (col.includes(':')) [alias, col] = col.split(':');
      if (col.includes('->')) { const base = col.split('->')[0]; items.push({ kind: 'col', alias: alias || base, col: base }); continue; }
      items.push({ kind: 'col', alias: alias || col, col });
    }
  }
  return items;
}

function resolveEmbed(db, from, item) {
  const fks = db.fks;
  const { rel, hint } = item;
  // fk column on the parent, e.g. company:company_id(...)
  let fk = fks.find((f) => f.table === from && f.column === rel);
  if (fk) return { type: 'one', table: fk.ref, local: fk.column, remote: fk.refcol };
  if (db.tables[rel] === undefined && !fks.some((f) => f.table === rel || f.ref === rel)) return null;
  // parent points at rel (many-to-one)
  fk = fks.find((f) => f.table === from && f.ref === rel && (!hint || f.column === hint));
  if (fk) return { type: 'one', table: rel, local: fk.column, remote: fk.refcol };
  // rel points at parent (one-to-many)
  fk = fks.find((f) => f.table === rel && f.ref === from && (!hint || f.column === hint));
  if (fk) return { type: 'many', table: rel, local: fk.refcol, remote: fk.column };
  return null;
}

function project(db, table, row, items) {
  const out = {};
  for (const it of items) {
    if (it.kind === 'star') Object.assign(out, row);
    else if (it.kind === 'col') out[it.alias] = row[it.col] ?? null;
  }
  for (const it of items) {
    if (it.kind !== 'embed') continue;
    const r = resolveEmbed(db, table, it);
    if (!r) { out[it.alias] = null; continue; }
    const rows = db.tables[r.table] || [];
    if (r.type === 'one') {
      const hit = row[r.local] == null ? null : rows.find((x) => x[r.remote] === row[r.local]);
      out[it.alias] = hit ? project(db, r.table, hit, it.sub) : null;
    } else {
      out[it.alias] = rows.filter((x) => x[r.remote] === row[r.local]).map((x) => project(db, r.table, x, it.sub));
    }
  }
  return out;
}

function innerOk(db, table, projected, items) {
  for (const it of items) {
    if (it.kind !== 'embed' || !it.inner) continue;
    const v = projected[it.alias];
    if (v == null || (Array.isArray(v) && v.length === 0)) return false;
  }
  return true;
}

// ---------- filters ----------

const isDateish = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

function cmp(a, b) {
  if (a == null || b == null) return null;
  if (isDateish(a) && isDateish(b)) return Date.parse(a) - Date.parse(b);
  const na = Number(a); const nb = Number(b);
  if (typeof a === 'number' || typeof b === 'number') {
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a) === String(b) ? 0 : 1;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function likeRe(pat, flags) {
  const esc = String(pat).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${esc}$`, flags);
}

function toArr(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.startsWith('[')) { try { return JSON.parse(s); } catch { /* fall through */ } }
    if (s.startsWith('{') && s.endsWith('}')) return s.slice(1, -1).split(',').map((x) => x.replace(/^"|"$/g, '')).filter(Boolean);
    return [s];
  }
  return v == null ? [] : [v];
}

function getPath(row, col) {
  if (col.includes('->')) {
    const parts = col.split(/->>?/);
    let v = row[parts[0]];
    for (const p of parts.slice(1)) v = v == null ? null : v[p.replace(/'/g, '')];
    return v;
  }
  if (col.includes('.')) {
    const [a, b] = col.split('.');
    const v = row[a];
    if (Array.isArray(v)) return v.map((x) => x?.[b]);
    return v == null ? undefined : v[b];
  }
  return row[col];
}

function test(row, col, op, val) {
  let v = getPath(row, col);
  if (Array.isArray(v) && col.includes('.') && !['cs', 'cd', 'ov'].includes(op)) return v.some((x) => test({ x }, 'x', op, val));
  switch (op) {
    case 'eq': return v != null && cmp(v, val) === 0;
    case 'neq': return v != null && cmp(v, val) !== 0;
    case 'gt': return v != null && cmp(v, val) > 0;
    case 'gte': return v != null && cmp(v, val) >= 0;
    case 'lt': return v != null && cmp(v, val) < 0;
    case 'lte': return v != null && cmp(v, val) <= 0;
    case 'like': return v != null && likeRe(val, '').test(String(v));
    case 'ilike': return v != null && likeRe(val, 'i').test(String(v));
    case 'is': {
      const s = String(val).toLowerCase();
      if (s === 'null') return v == null;
      if (s === 'true') return v === true;
      if (s === 'false') return v === false;
      return v == null;
    }
    case 'in': return v != null && toArr(val).some((x) => cmp(v, x) === 0);
    case 'cs': case 'contains': {
      if (v && typeof v === 'object' && !Array.isArray(v) && val && typeof val === 'object' && !Array.isArray(val)) {
        return Object.entries(val).every(([k, x]) => JSON.stringify(v[k]) === JSON.stringify(x));
      }
      const have = toArr(v).map(String); return toArr(val).every((x) => have.includes(String(x)));
    }
    case 'cd': case 'containedBy': { const want = toArr(val).map(String); return toArr(v).every((x) => want.includes(String(x))); }
    case 'ov': case 'overlaps': { const have = toArr(v).map(String); return toArr(val).some((x) => have.includes(String(x))); }
    case 'fts': case 'plfts': case 'wfts': case 'phfts': case 'textSearch': {
      const words = String(val).replace(/['&|!():]/g, ' ').split(/\s+/).filter(Boolean);
      const hay = String(v ?? '').toLowerCase();
      return words.every((w) => hay.includes(w.toLowerCase()));
    }
    default: return true;
  }
}

function parseInList(s) {
  // "(a,b,"c d")"
  const inner = s.replace(/^\(|\)$/g, '');
  return splitTop(inner).map((x) => x.replace(/^"|"$/g, ''));
}

function parseOr(str) {
  // returns a predicate from "a.eq.1,b.ilike.%x%,and(c.eq.2,d.is.null)"
  const parts = splitTop(str);
  const preds = parts.map((p) => {
    const m = p.match(/^(not\.)?(and|or)\((.*)\)$/);
    if (m) {
      const subs = splitTop(m[3]).map((s) => parseOr(s));
      const f = m[2] === 'and' ? (r) => subs.every((g) => g(r)) : (r) => subs.some((g) => g(r));
      return m[1] ? (r) => !f(r) : f;
    }
    const segs = p.split('.');
    const col = segs[0];
    let i = 1; let neg = false;
    if (segs[i] === 'not') { neg = true; i++; }
    const op = segs[i];
    let val = segs.slice(i + 1).join('.');
    if (op === 'in') val = parseInList(val);
    else if (['cs', 'cd', 'ov'].includes(op)) val = val.startsWith('{') ? parseInList(val.replace(/^\{|\}$/g, '')) : val;
    val = typeof val === 'string' ? val.replace(/^"|"$/g, '') : val;
    const f = (r) => test(r, col, op, val);
    return neg ? (r) => !f(r) : f;
  });
  return (r) => preds.some((g) => g(r));
}

function applyFilter(rows, f) {
  switch (f.type) {
    case 'op': return rows.filter((r) => test(r, f.col, f.op, f.val));
    case 'not': {
      let val = f.val;
      if (f.op === 'in' && typeof val === 'string') val = parseInList(val);
      return rows.filter((r) => !test(r, f.col, f.op, val));
    }
    case 'filter': {
      let { op, val } = f;
      let neg = false;
      if (op.startsWith('not.')) { neg = true; op = op.slice(4); }
      if (op === 'in' && typeof val === 'string') val = parseInList(val);
      return rows.filter((r) => neg !== test(r, f.col, op, val));
    }
    case 'or': { const p = parseOr(f.expr); return rows.filter(p); }
    case 'match': return rows.filter((r) => Object.entries(f.obj).every(([k, v]) => test(r, k, 'eq', v)));
    default: return rows;
  }
}

// ---------- query ----------

export function runQuery(q) {
  const db = loadDb();
  if (q.rpc) return runRpc(db, q.rpc, q.args || {});
  const base = db.tables[q.table];
  if (base === undefined) {
    return { data: q.single ? null : [], error: q.single ? { code: 'PGRST116', message: 'No rows' } : null, count: 0 };
  }
  const items = parseSelect(q.select);
  // Filters that point into embedded tables (e.g. "company.status") run after projection.
  const topFilters = []; const embedFilters = [];
  for (const f of q.filters || []) {
    const col = f.col || '';
    if (f.type !== 'or' && col.includes('.') && !col.includes('->')) embedFilters.push(f); else topFilters.push(f);
  }
  let rows = base;
  for (const f of topFilters) rows = applyFilter(rows, f);
  let out = rows.map((r) => project(db, q.table, r, items)).filter((r) => innerOk(db, q.table, r, items));
  for (const f of embedFilters) out = applyFilter(out, f);

  for (const o of [...(q.order || [])].reverse()) {
    if (o.foreignTable) {
      out.forEach((r) => { if (Array.isArray(r[o.foreignTable])) r[o.foreignTable].sort(sorter(o)); });
      continue;
    }
    out = [...out].sort(sorter(o));
  }
  const count = out.length;
  if (q.range) out = out.slice(q.range[0], q.range[1] + 1);
  if (q.limit != null) out = out.slice(0, q.limit);
  if (q.head) return { data: null, error: null, count };
  if (q.single || q.maybeSingle) {
    if (out.length === 1) return { data: out[0], error: null, count };
    if (out.length === 0 && q.maybeSingle) return { data: null, error: null, count };
    return { data: null, error: { code: 'PGRST116', message: out.length ? 'Multiple rows returned' : 'No rows returned', details: `The result contains ${out.length} rows` }, count };
  }
  return { data: out, error: null, count };
}

function sorter(o) {
  const asc = o.ascending !== false;
  const nullsFirst = o.nullsFirst ?? !asc;
  return (a, b) => {
    const va = a[o.col]; const vb = b[o.col];
    if (va == null && vb == null) return 0;
    if (va == null) return nullsFirst ? -1 : 1;
    if (vb == null) return nullsFirst ? 1 : -1;
    const c = cmp(va, vb);
    return asc ? c : -c;
  };
}

function runRpc(db, name, args) {
  const snap = db.rpc?.[name];
  switch (name) {
    case 'get_company_profile':
    case 'get_person_profile':
      return { data: snap?.[args.p_slug] ?? null, error: null };
    case 'get_ecosystem_activity': {
      const n = Number(args.p_limit ?? 8);
      const keys = Object.keys(snap || {}).map(Number).sort((a, b) => a - b);
      const k = keys.find((x) => x >= n) ?? keys[keys.length - 1];
      return { data: (snap?.[String(k)] || []).slice(0, n), error: null };
    }
    case 'congress_event_stats':
      return { data: snap?.[args.p_event_id] ?? null, error: null };
    default:
      return { data: null, error: { code: '42883', message: `Function ${name} is not available right now` } };
  }
}

// Server-side supabase-js lookalike for API routes that only read.
export function createSnapshotClient() {
  const build = (table) => {
    const q = { table, select: '*', filters: [], order: [] };
    const b = {
      select(cols = '*', opts = {}) { q.select = cols; if (opts.head) q.head = true; return b; },
      eq(col, val) { q.filters.push({ type: 'op', op: 'eq', col, val }); return b; },
      neq(col, val) { q.filters.push({ type: 'op', op: 'neq', col, val }); return b; },
      in(col, val) { q.filters.push({ type: 'op', op: 'in', col, val }); return b; },
      order(col, opts = {}) { q.order.push({ col, ascending: opts.ascending !== false }); return b; },
      limit(n) { q.limit = n; return b; },
      single() { q.single = true; return b; },
      maybeSingle() { q.maybeSingle = true; return b; },
      then(res, rej) { return Promise.resolve(runQuery(q)).then(res, rej); },
    };
    return b;
  };
  return { from: build };
}
