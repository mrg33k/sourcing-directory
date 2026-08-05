// Explicit allowlist for /api/sourcing/admin.
//
// Without this the endpoint is just "hand me the service key over HTTP with a
// login attached" — no better than the browser-side service client it replaces.
// Anything not named here is rejected. There is no wildcard and no fallthrough.
//
// Per table:
//   ops         - operations permitted. Nothing else is executable.
//   columns     - readable / filterable / orderable columns.
//   writable    - columns accepted in an insert / update / upsert payload.
//                 Always a subset of `columns`.
//   tenantKey   - column carrying the tenant id, or null when the table has no
//                 tenant column at all. A non-global admin is force-scoped to their
//                 tenants on this column.
//   primaryKey  - row identity column. Defaults to 'id' (see primaryKeyOf).
//   globalOnly  - true when ONLY a global admin (app_metadata.role === 'admin') may
//                 touch the table at all. See "tenant-less tables" below.
//   parentScope - for a tenant-less child table whose tenant is decided by its PARENT
//                 row: { column, table, parentKey, tenantKey }. A non-global admin
//                 only reaches rows whose parent belongs to one of their tenants.
//
// TENANT-LESS TABLES (the 2026-07-28 fix)
// ---------------------------------------
// `tenantKey: null` used to mean "no scoping applied" — which handed an admin of ANY
// single tenant unscoped global read/write/DELETE on those tables. An admin of one
// small directory could POST
//     {table:'deal_bank_listings', op:'delete', filters:[{type:'neq',column:'id',value:<zero uuid>}]}
// and wipe the entire global Deal Bank. It passed the "must have one filter" rule and
// received no tenant scoping whatsoever.
//
// A table with no tenant column now has to declare which of two things is true:
//   globalOnly  - the data is platform-level and cannot be attributed to a tenant, so
//                 only a global admin may see or change it (the deal_bank_* tables).
//   parentScope - the data belongs to a parent row that DOES carry a tenant, so the
//                 tenant is resolved through that parent (admin_ticket_comments).
// There is no third option. `tenantKey: null` on its own is not a policy.
//
// DESTRUCTIVE BREADTH
// -------------------
// "must have at least one filter" is not a safety property: `neq id <zero uuid>` is one
// filter and selects the whole table. admin.js therefore requires, on top of any filter
// the caller supplies:
//   delete  - an eq (or bounded in) filter on the primary key. Always. Every delete in
//             src/pages/admin/ is already `.delete().eq('id', x)`, so this costs nothing.
//   update  - the same primary-key filter, UNLESS the statement is bounded by the
//             table's tenant key (caller-supplied or server-injected). That exemption
//             exists for exactly one caller: the "move all to space" bulk reclassify in
//             SourcingAdmin.jsx, which is `.update(...).neq('vertical','space').eq('tenant_id', t)`.
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

const SRW_SUBSCRIBER_COLUMNS = [
  'id', 'created_at', 'form_type', 'first_name', 'last_name', 'email',
  'organization', 'areas_of_interest', 'newsletter_opt_in', 'message', 'source',
];

// ── Space Congress column sets ───────────────────────────────────────────────
// Mirrors supabase/migrations/20260805090100_congress_schema.sql +
// 20260805090200_congress_seed_arizona_2026.sql (which adds `summary`).
const CONGRESS_EVENT_COLUMNS = [
  'id', 'tenant_id', 'name', 'slug', 'edition_year', 'starts_on', 'ends_on',
  'venue', 'city', 'state', 'summary', 'description', 'website_url',
  'hero_image_url', 'status', 'created_at', 'updated_at',
];

const CONGRESS_SESSION_COLUMNS = [
  'id', 'tenant_id', 'event_id', 'title', 'description', 'session_date',
  'starts_at', 'ends_at', 'room', 'track', 'is_featured', 'sort_order',
  'status', 'created_at', 'updated_at',
];

const CONGRESS_SPEAKER_COLUMNS = [
  'id', 'tenant_id', 'event_id', 'person_id', 'company_id', 'full_name',
  'title', 'org_name', 'headshot_url', 'bio', 'sort_order',
  'created_at', 'updated_at',
];

const CONGRESS_ORG_COLUMNS = [
  'id', 'tenant_id', 'event_id', 'company_id', 'role', 'sponsor_tier',
  'booth', 'sort_order', 'status', 'created_at', 'updated_at',
];

const CONGRESS_REGISTRATION_COLUMNS = [
  'id', 'tenant_id', 'event_id', 'person_id', 'member_id', 'auth_user_id',
  'full_name', 'email', 'ticket_type', 'status', 'sessions_attending',
  'meetings_scheduled', 'registered_at', 'created_at', 'updated_at',
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

  // ── ARIZONA SPACE ACTION BLUEPRINT ────────────────────────────────────────
  // Backs /blueprint and the Blueprint tab of Admin Tools. Every table carries
  // its own tenant_id, so all of them scope normally — no globalOnly, no
  // parentScope. The page these feed prints a real zero wherever a table is
  // empty, which is only safe if admins can actually fill them, which is what
  // these entries are for.
  blueprint_priorities: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'tag_id', 'name', 'slug', 'theme', 'blurb', 'summary', 'source_note', 'icon', 'sort_order', 'status', 'created_at', 'updated_at'],
    // tag_id stays OFF this list. It is the FK that keeps this page's spelling
    // identical to the Directory's, and repointing it from a form is a silent
    // way to break that. Relinking a priority to a different tag is a migration.
    writable: ['tenant_id', 'name', 'slug', 'theme', 'blurb', 'summary', 'source_note', 'icon', 'sort_order', 'status', 'updated_at'],
  },

  blueprint_goals: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'priority_id', 'code', 'title', 'description', 'owner', 'status', 'progress_pct', 'target_date', 'sort_order', 'created_at', 'updated_at'],
    writable: ['tenant_id', 'priority_id', 'code', 'title', 'description', 'owner', 'status', 'progress_pct', 'target_date', 'sort_order', 'updated_at'],
  },

  blueprint_initiatives: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'priority_id', 'goal_id', 'title', 'description', 'lead_org', 'owner', 'status', 'start_date', 'target_date', 'sort_order', 'created_at', 'updated_at'],
    writable: ['tenant_id', 'priority_id', 'goal_id', 'title', 'description', 'lead_org', 'owner', 'status', 'start_date', 'target_date', 'sort_order', 'updated_at'],
  },

  blueprint_kpis: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'priority_id', 'goal_id', 'name', 'description', 'unit', 'baseline_value', 'current_value', 'target_value', 'as_of', 'source', 'sort_order', 'created_at', 'updated_at'],
    writable: ['tenant_id', 'priority_id', 'goal_id', 'name', 'description', 'unit', 'baseline_value', 'current_value', 'target_value', 'as_of', 'source', 'sort_order', 'updated_at'],
  },

  blueprint_milestones: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'priority_id', 'phase_code', 'title', 'description', 'horizon', 'status', 'target_date', 'sort_order', 'created_at', 'updated_at'],
    writable: ['tenant_id', 'priority_id', 'phase_code', 'title', 'description', 'horizon', 'status', 'target_date', 'sort_order', 'updated_at'],
  },

  blueprint_findings: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'kind', 'code', 'title', 'body', 'source_note', 'sort_order', 'created_at', 'updated_at'],
    writable: ['tenant_id', 'kind', 'code', 'title', 'body', 'source_note', 'sort_order', 'updated_at'],
  },

  blueprint_alignments: {
    ops: ['select', 'insert', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'company_id', 'priority_id', 'note', 'aligned_by', 'created_at'],
    writable: ['tenant_id', 'company_id', 'priority_id', 'note', 'aligned_by'],
  },

  // Append-only, for the same reason directory_audit is: a feed of "what changed
  // on the Blueprint" that can be edited afterwards is not a record of anything.
  blueprint_activity: {
    ops: ['select', 'insert'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'action', 'entity_type', 'entity_id', 'summary', 'actor_email', 'detail', 'created_at'],
    // actor_email is overwritten server-side with the verified caller.
    writable: ['tenant_id', 'action', 'entity_type', 'entity_id', 'summary', 'actor_email', 'detail'],
    actorColumn: 'actor_email',
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

  // No tenant column of its own — admin_ticket_comments.ticket_id is a NOT NULL FK to
  // admin_tickets(id), and admin_tickets.tenant_id is the real owner. So the tenant is
  // resolved through the parent ticket: a tenant admin reads and writes comments on
  // their own tickets and no one else's. Matches TicketsSection.jsx, which always
  // works one ticket at a time (`.eq('ticket_id', ticket.id)` / insert with ticket_id).
  admin_ticket_comments: {
    ops: ['select', 'insert', 'delete'],
    tenantKey: null,
    parentScope: {
      column: 'ticket_id',
      table: 'admin_tickets',
      parentKey: 'id',
      tenantKey: 'tenant_id',
    },
    columns: ['id', 'ticket_id', 'author', 'body', 'is_agent', 'created_at'],
    writable: ['ticket_id', 'author', 'body', 'is_agent'],
    // Overwritten server-side with the verified caller, like directory_audit.actor_email.
    actorColumn: 'author',
  },

  // ── Organization profile ─────────────────────────────────────────────────────
  // Added 2026-08-03 so an admin can correct `org_type`, which /ecosystem/overview
  // now draws a chart from and scripts/backfill-org-type.mjs derives in bulk. A
  // derived value nobody can overrule is a value nobody should trust.
  //
  // Tenant-less: the row is keyed by company_id and carries no tenant column, so the
  // tenant is resolved through the PARENT company exactly as admin_ticket_comments
  // resolves through its ticket. A tenant admin reaches the profiles of their own
  // directory's companies and no others.
  //
  // `writable` is deliberately the org-type columns and nothing else. The rest of
  // this table (verification, verified_by, the six relationship counts, focus_areas)
  // belongs to the verification flow and the profile editor, which are different
  // screens with different rules; widening this list is how a "fix the type" button
  // quietly becomes a way to mark a company verified.
  //
  // No 'delete': removing the row would not clear a type, it would erase the
  // verification state stored beside it.
  directory_company_profile: {
    ops: ['select', 'insert', 'update', 'upsert'],
    tenantKey: null,
    primaryKey: 'company_id',
    parentScope: {
      column: 'company_id',
      table: 'directory_companies',
      parentKey: 'id',
      tenantKey: 'tenant_id',
    },
    columns: [
      'company_id', 'org_type', 'org_type_source', 'org_type_confidence',
      'org_type_evidence', 'org_type_derived_at', 'org_type_reviewed_by',
      'org_type_reviewed_at', 'verification', 'verified_at', 'created_at', 'updated_at',
    ],
    writable: [
      'company_id', 'org_type', 'org_type_source', 'org_type_confidence',
      'org_type_reviewed_by', 'org_type_reviewed_at', 'updated_at',
    ],
  },

  // ── Deal Bank ────────────────────────────────────────────────────────────────
  // One global surface shared by the whole platform, not by any tenant: pending deal
  // submissions, deck URLs, revenue figures, and investor contact_email_internal.
  // There is no tenant column and no honest way to invent one — a row simply does not
  // belong to a directory. Restricted to global admins.
  //
  // Panel impact, stated plainly: the "Deal Bank" tab is currently rendered for every
  // admin (SourcingAdmin.jsx TABS has no isGlobalAdmin gate). A tenant admin who opens
  // it now sees three empty lists instead of the whole platform's deal flow. Nothing
  // crashes — DealBankSection reads `.data || []`. The tab should be hidden for
  // non-global admins; that is a one-line change in SourcingAdmin.jsx.
  deal_bank_listings: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: null,
    globalOnly: true,
    columns: DEAL_LISTING_COLUMNS,
    writable: without(DEAL_LISTING_COLUMNS, ['id', 'created_at']),
  },

  deal_bank_investors: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: null,
    globalOnly: true,
    columns: DEAL_INVESTOR_COLUMNS,
    writable: without(DEAL_INVESTOR_COLUMNS, ['id', 'created_at']),
  },

  deal_bank_completed_rounds: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: null,
    globalOnly: true,
    columns: DEAL_ROUND_COLUMNS,
    writable: without(DEAL_ROUND_COLUMNS, ['id', 'created_at']),
  },

  // Newsletter/contact submissions from the Space Rising site + OS directory
  // (written by /api/sourcing/srw-subscribe with the service key). Read-only
  // here: the Subscribers tab lists and exports; nothing edits a submission.
  srw_subscribers: {
    ops: ['select'],
    tenantKey: null,
    globalOnly: true,
    columns: SRW_SUBSCRIBER_COLUMNS,
    writable: [],
  },

  // ── Space Congress ───────────────────────────────────────────────────────────
  // Backs /congress and the Admin Tools -> Congress tab. Every table here carries
  // its own tenant_id — including the session/speaker join — specifically so all six
  // get the ordinary `tenantKey` treatment and none needs a parentScope rule.
  //
  // These are on the allowlist because the whole point of the Congress page is that
  // the client's admins fill it themselves: an agenda that needs an engineer to add a
  // session is not a maintainable page.
  congress_events: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: CONGRESS_EVENT_COLUMNS,
    writable: without(CONGRESS_EVENT_COLUMNS, ['id', 'created_at']),
  },

  congress_sessions: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: CONGRESS_SESSION_COLUMNS,
    writable: without(CONGRESS_SESSION_COLUMNS, ['id', 'created_at']),
  },

  congress_speakers: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: CONGRESS_SPEAKER_COLUMNS,
    writable: without(CONGRESS_SPEAKER_COLUMNS, ['id', 'created_at']),
  },

  congress_session_speakers: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'session_id', 'speaker_id', 'speaking_role', 'sort_order', 'created_at'],
    writable: ['tenant_id', 'session_id', 'speaker_id', 'speaking_role', 'sort_order'],
  },

  congress_organizations: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: CONGRESS_ORG_COLUMNS,
    writable: without(CONGRESS_ORG_COLUMNS, ['id', 'created_at']),
  },

  // Holds a registrant's name and email. Reachable by a tenant admin (who runs the
  // event and needs the roster) and by nobody else: the table's RLS gives a signed-in
  // member their OWN row only, and the public participant COUNT comes from the
  // security-definer congress_event_stats() rather than from reading rows.
  congress_registrations: {
    ops: ['select', 'insert', 'update', 'delete'],
    tenantKey: 'tenant_id',
    columns: CONGRESS_REGISTRATION_COLUMNS,
    writable: without(CONGRESS_REGISTRATION_COLUMNS, ['id', 'created_at']),
  },

  // Relates existing directory_listings coverage to an event. No content of its own.
  congress_media: {
    ops: ['select', 'insert', 'delete'],
    tenantKey: 'tenant_id',
    columns: ['id', 'tenant_id', 'event_id', 'listing_id', 'sort_order', 'created_at'],
    writable: ['tenant_id', 'event_id', 'listing_id', 'sort_order'],
  },
};

// Fail closed at module load: a tenant-less table that declares neither `globalOnly`
// nor `parentScope` is unscoped for every tenant admin. That is the bug this file was
// edited to remove, and it must not be reintroduced by adding a table.
for (const [name, policy] of Object.entries(TABLE_POLICY)) {
  if (!policy.tenantKey && !policy.globalOnly && !policy.parentScope) {
    throw new Error(
      `[tablePolicy] ${name} has no tenantKey and declares neither globalOnly nor parentScope. ` +
      'A tenant-less table must say how a non-global admin is scoped, or that none may reach it.'
    );
  }
}

/** Look up a table's policy. Returns null for anything not on the allowlist. */
export function getPolicy(table) {
  if (typeof table !== 'string' || !IDENTIFIER.test(table)) return null;
  return Object.prototype.hasOwnProperty.call(TABLE_POLICY, table) ? TABLE_POLICY[table] : null;
}

export function isProtectedColumn(name) {
  return PROTECTED_COLUMNS.some(re => re.test(name));
}

/** Row identity column for a table. Every table on the allowlist uses `id`. */
export function primaryKeyOf(policy) {
  return policy.primaryKey || 'id';
}

/**
 * Largest id list accepted as a "bounded" primary-key filter on a destructive op.
 * Matches MAX_PAYLOAD_ROWS in admin.js: you may not delete more rows in one call
 * than you may write in one call.
 */
export const MAX_KEYED_ROWS = 500;

/**
 * Does this filter list pin `column` to a known, bounded set of values?
 *
 * Only `eq` (one value) and `in` (an explicit, capped list) count. `neq`, `gt`,
 * `like`, `is` and friends are deliberately NOT bounding: `neq id <zero uuid>` names
 * one column and selects every row in the table, which is exactly the shape that got
 * past the old "at least one filter" rule.
 */
export function isBoundedBy(filters, column, max = MAX_KEYED_ROWS) {
  if (!column) return false;
  return filters.some(f => {
    if (f.column !== column) return false;
    if (f.type === 'eq') return f.value !== undefined && f.value !== null;
    if (f.type === 'in') return Array.isArray(f.value) && f.value.length > 0 && f.value.length <= max;
    return false;
  });
}

/**
 * Scoping a destructive op needs more than "the caller sent a filter".
 *
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function checkDestructiveScope(policy, op, filters) {
  if (op !== 'update' && op !== 'delete') return { ok: true };

  const pk = primaryKeyOf(policy);
  if (isBoundedBy(filters, pk)) return { ok: true };

  // An update may instead be bounded by the tenant key — the bulk reclassify path.
  // A delete may not: there is no admin screen that bulk-deletes a whole tenant.
  if (op === 'update' && policy.tenantKey && isBoundedBy(filters, policy.tenantKey, 1000)) {
    return { ok: true };
  }

  return {
    ok: false,
    error: op === 'delete'
      ? `delete requires an exact '${pk}' filter (eq, or in with an explicit list)`
      : `update must be pinned to '${pk}'${policy.tenantKey ? ` or to '${policy.tenantKey}'` : ''} with an eq or in filter`,
  };
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
