// Explicit allowlist for /api/sourcing/admin.
//
// Without this the endpoint is just "hand me the service key over HTTP with a
// login attached" — no better than the browser-side service client it replaces.
// Anything not named here is rejected. There is no wildcard and no fallthrough.
//
// Per table:
//   ops       - operations permitted. Nothing else is executable.
//   columns   - readable / filterable / orderable columns.
//   writable  - columns accepted in an insert / update / upsert payload.
//               Always a subset of `columns`.
//   tenantKey - column carrying the tenant id, or null when the table is global.
//               A non-global admin is force-scoped to their tenants on this column.
//
// PROTECTED_COLUMNS is a second, table-independent gate: billing and payment state
// is NEVER writable through a browser-reachable endpoint, whatever the allowlist
// says. Those keys are stripped from every payload and reported back as warnings.

/** Billing / payment state. Stripped from every write, on every table, always. */
export const PROTECTED_COLUMNS = [/^stripe_/, /^membership_/, /^paid_/, /^pending_checkout_/];

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

/** Filter operators the endpoint knows how to execute. */
export const ALLOWED_FILTERS = new Set([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'like', 'ilike', 'contains',
]);

const COMPANY_COLUMNS = [
  'id', 'tenant_id', 'organization_id', 'name', 'slug', 'description', 'website',
  'phone', 'email', 'city', 'state', 'country', 'vertical', 'employee_count',
  'year_founded', 'logo_url', 'status', 'featured', 'created_at', 'updated_at',
  // Read-only billing state. Present here so the admin panel can SHOW it;
  // deliberately absent from `writable`, and belt-and-braces blocked by
  // PROTECTED_COLUMNS regardless.
  'membership_tier', 'membership_seats', 'membership_paid_at', 'membership_expires_at',
  'paid_stripe_session_id', 'paid_stripe_subscription_id', 'pending_checkout_session_id',
];

const LISTING_COLUMNS = [
  'id', 'tenant_id', 'company_id', 'category', 'title', 'description', 'body',
  'status', 'vertical', 'image_url', 'cover_image_url', 'contact_email',
  'price', 'condition',
  'job_type', 'location', 'remote', 'salary_min', 'salary_max', 'salary_range',
  'employment_type', 'apply_url',
  'event_date', 'event_end_date', 'event_location', 'event_type', 'organizer',
  'virtual_url',
  'author_name', 'deadline', 'grant_agency', 'grant_type',
  'expires_at', 'moderated_at', 'created_at', 'updated_at',
];

const TENANT_COLUMNS = [
  'id', 'name', 'slug', 'nav_label', 'website', 'vertical', 'brand_color',
  'logo_url', 'hero_text', 'description', 'features', 'self_service', 'status',
  'created_at', 'updated_at',
];

const TICKET_COLUMNS = [
  'id', 'tenant_id', 'title', 'description', 'type', 'priority', 'status', 'area',
  'link', 'assigned_to', 'created_by', 'updated_by', 'created_at', 'updated_at',
];

const DEAL_LISTING_COLUMNS = [
  'id', 'company_id', 'round_stage', 'capital_sought', 'deck_url', 'exec_summary',
  'leadership', 'revenue_y1', 'revenue_y2', 'revenue_y3', 'status', 'reviewed_at',
  'reviewed_by', 'submitted_at', 'created_at', 'updated_at',
];

const DEAL_INVESTOR_COLUMNS = [
  'id', 'firm_name', 'website', 'criteria', 'check_size_min', 'check_size_max',
  'deal_types', 'deals_last_18mo', 'linkedin_url', 'contact_email_internal',
  'status', 'reviewed_at', 'reviewed_by', 'submitted_at', 'created_at', 'updated_at',
];

const DEAL_ROUND_COLUMNS = [
  'id', 'company', 'amount_raised', 'round', 'date', 'source_url', 'notes',
  'created_at', 'updated_at',
];

const without = (cols, drop) => cols.filter(c => !drop.includes(c));

export const TABLE_POLICY = {
  directory_companies: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: COMPANY_COLUMNS,
    // membership_* / paid_* / stripe_* / pending_checkout_* intentionally excluded.
    writable: [
      'tenant_id', 'organization_id', 'name', 'slug', 'description', 'website',
      'phone', 'email', 'city', 'state', 'country', 'vertical', 'employee_count',
      'year_founded', 'logo_url', 'status', 'featured', 'updated_at',
    ],
  },

  directory_organizations: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'name', 'slug', 'description', 'website', 'vertical', 'logo_url', 'membership_tiers', 'created_at', 'updated_at'],
    // membership_tiers is org catalogue copy, not billing state, but it still matches
    // /^membership_/ and is stripped by PROTECTED_COLUMNS. See notes in admin.js.
    writable: ['tenant_id', 'name', 'slug', 'description', 'website', 'vertical', 'logo_url', 'membership_tiers', 'updated_at'],
  },

  directory_listings: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: LISTING_COLUMNS,
    writable: without(LISTING_COLUMNS, ['id', 'created_at']),
  },

  directory_certifications: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'company_id', 'cert_name', 'cert_value', 'vertical', 'created_at'],
    writable: ['tenant_id', 'company_id', 'cert_name', 'cert_value', 'vertical'],
  },

  directory_members: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'company_id', 'auth_user_id', 'email', 'full_name', 'role', 'status', 'created_at', 'updated_at'],
    writable: ['tenant_id', 'company_id', 'email', 'full_name', 'role', 'status', 'updated_at'],
  },

  directory_tenants: {
    ops: ['select', 'update'],
    // The tenant table IS the tenant — scope on the primary key.
    tenantKey: 'id',
    columns: TENANT_COLUMNS,
    writable: ['name', 'nav_label', 'website', 'vertical', 'brand_color', 'logo_url', 'hero_text', 'description', 'features', 'status', 'updated_at'],
  },

  directory_reports: {
    // Create / update go through api/sourcing/admin-reports.js, which validates
    // category + access enums. Only listing and deletion run through here.
    ops: ['select', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'title', 'description', 'category', 'access', 'file_url', 'cover_image_url', 'is_premium', 'published_at', 'created_at', 'updated_at', 'created_by', 'updated_by'],
    writable: [],
  },

  directory_contacts: {
    ops: ['select', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'company_id', 'sender_name', 'sender_email', 'sender_phone', 'message', 'type', 'status', 'created_at'],
    writable: ['status'],
  },

  directory_tags: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'name', 'description', 'category', 'parent_tag_id', 'status', 'created_at', 'updated_at'],
    writable: ['tenant_id', 'name', 'description', 'category', 'parent_tag_id', 'status', 'updated_at'],
  },

  // Append-only. No update, no delete — an audit log you can edit is not an audit log.
  directory_audit: {
    ops: ['select', 'insert'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'actor_email', 'action', 'entity_type', 'entity_id', 'detail', 'created_at'],
    // actor_email is overwritten server-side with the verified caller — never trusted
    // from the request body.
    writable: ['tenant_id', 'actor_email', 'action', 'entity_type', 'entity_id', 'detail'],
  },

  // Read-only. Analytics rows are written by the public site, not the admin panel.
  directory_analytics: {
    ops: ['select'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'company_id', 'event_type', 'metadata', 'created_at'],
    writable: [],
  },

  directory_site_content: {
    ops: ['select', 'insert', 'update', 'upsert', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'page_key', 'field_key', 'value', 'updated_at'],
    writable: ['tenant_id', 'page_key', 'field_key', 'value', 'updated_at'],
  },

  admin_tickets: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: TICKET_COLUMNS,
    writable: without(TICKET_COLUMNS, ['id', 'created_at']),
  },

  admin_ticket_comments: {
    ops: ['select', 'insert', 'delete'],
    tenantKey: null, // no tenant column; reachable only via a ticket_id
    columns: ['id', 'ticket_id', 'author', 'body', 'is_agent', 'created_at'],
    writable: ['ticket_id', 'author', 'body', 'is_agent'],
  },

  deal_bank_listings: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: null, // Deal Bank is a global surface; the table has no tenant column
    columns: DEAL_LISTING_COLUMNS,
    writable: without(DEAL_LISTING_COLUMNS, ['id', 'created_at']),
  },

  deal_bank_investors: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: null,
    columns: DEAL_INVESTOR_COLUMNS,
    writable: without(DEAL_INVESTOR_COLUMNS, ['id', 'created_at']),
  },

  deal_bank_completed_rounds: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: null,
    columns: DEAL_ROUND_COLUMNS,
    writable: without(DEAL_ROUND_COLUMNS, ['id', 'created_at']),
  },
};

/** Look up a table's policy. Returns null for anything not on the allowlist. */
export function getPolicy(table) {
  if (typeof table !== 'string' || !IDENTIFIER.test(table)) return null;
  return Object.prototype.hasOwnProperty.call(TABLE_POLICY, table) ? TABLE_POLICY[table] : null;
}

export function isProtectedColumn(name) {
  return PROTECTED_COLUMNS.some(re => re.test(name));
}

/** A column that may appear in a filter / order / select clause. */
export function isReadableColumn(policy, name) {
  return typeof name === 'string' && IDENTIFIER.test(name) && policy.columns.includes(name);
}

/**
 * Validate a PostgREST select string. Plain column lists and `*` only —
 * no embedded resources, no casts, no function calls.
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function sanitizeSelect(policy, raw) {
  const value = (raw == null || raw === '') ? '*' : String(raw);
  if (value.length > 500) return { ok: false, error: 'select clause too long' };
  if (/[()!:;"']/.test(value)) {
    return { ok: false, error: 'select clause may only list plain columns' };
  }
  const parts = value.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: 'select clause is empty' };
  for (const part of parts) {
    if (part === '*') continue;
    if (!isReadableColumn(policy, part)) {
      return { ok: false, error: `column not readable on this table: ${part}` };
    }
  }
  return { ok: true, value: parts.join(',') };
}

/**
 * Strip a write payload down to what policy permits.
 *
 * Unknown and protected columns are DROPPED with a warning rather than 400'd:
 * this endpoint fronts a live admin panel, and a single drifted column name must
 * not take out an admin's ability to save. The security property is identical —
 * a dropped column is a column that was not written. The caller (admin.js) turns
 * a fully-emptied payload into a hard 400 so a total mismatch is never silent.
 *
 * @returns {{ row: object, warnings: string[] }}
 */
export function sanitizeRow(policy, row) {
  const warnings = [];
  const out = {};
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { row: out, warnings: ['payload row must be a JSON object'] };
  }
  for (const [key, value] of Object.entries(row)) {
    if (!IDENTIFIER.test(key)) {
      warnings.push(`dropped malformed column: ${String(key).slice(0, 40)}`);
      continue;
    }
    if (isProtectedColumn(key)) {
      warnings.push(`dropped protected column (billing state is not writable here): ${key}`);
      continue;
    }
    if (!policy.writable.includes(key)) {
      warnings.push(`dropped column not writable on this table: ${key}`);
      continue;
    }
    out[key] = value;
  }
  return { row: out, warnings };
}
