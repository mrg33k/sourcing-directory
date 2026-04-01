// POST /api/sourcing/agent
// Scout Agent -- directory manager (admin) + search agent (scout)
// Streams SSE: tool_call events for pills, text deltas, done
// Multi-tenant aware: accepts tenantId to scope operations

import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mcngatprgluexjjcqpkp.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'mrg33k';
const GITHUB_REPO = 'aom-studio';

function getClient(isAdmin) {
  const key = isAdmin ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key);
}

// ─── Path whitelist for code editing ──────────────────────────────────────────
const ALLOWED_PATH_PATTERNS = [
  /^src\/pages\/Sourcing[^/]*\.jsx$/,
  /^src\/pages\/SourcingTheme\.jsx$/,
  /^api\/sourcing\/.+$/,
  /^migrations\/.*sourcing.*$/,
];

function isPathAllowed(filePath) {
  const clean = filePath.replace(/^\/+/, '');
  return ALLOWED_PATH_PATTERNS.some(p => p.test(clean));
}

// ─── GitHub API helpers ───────────────────────────────────────────────────────
async function githubGetFile(path) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GitHub GET ${path}: ${res.status}`);
  }
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { content, sha: data.sha };
}

async function githubPutFile(path, content, message, sha) {
  const body = {
    message: message || `scout: update ${path}`,
    content: Buffer.from(content).toString('base64'),
  };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT ${path}: ${res.status} ${err}`);
  }
  return await res.json();
}

// ─── Helper: resolve tenant by id or slug ─────────────────────────────────────
async function resolveTenant(sb, idOrSlug) {
  if (!idOrSlug) return null;
  // Try UUID first
  if (idOrSlug.length === 36 && idOrSlug.includes('-')) {
    const { data } = await sb.from('directory_tenants').select('*').eq('id', idOrSlug).single();
    if (data) return data;
  }
  // Try slug
  const { data } = await sb.from('directory_tenants').select('*').eq('slug', idOrSlug).single();
  return data || null;
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const ADMIN_TOOLS = [
  // --- Tenant management tools ---
  {
    name: 'create_tenant',
    description: 'Create a new isolated directory/tenant. Returns tenant id, slug, and URL.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name e.g. "ACA Semiconductor"' },
        slug: { type: 'string', description: 'URL slug (auto-generated if omitted)' },
        vertical: { type: 'string', description: 'Primary vertical' },
        description: { type: 'string' },
        brand_color: { type: 'string', description: 'Hex color e.g. "#1565C0"' },
        website: { type: 'string' },
        hero_text: { type: 'string', description: 'Custom tagline for tenant landing page' },
      },
      required: ['name', 'vertical'],
    },
  },
  {
    name: 'delete_tenant',
    description: 'Delete a tenant and ALL its data (orgs, companies, certs, listings). IRREVERSIBLE. Only call after user confirms.',
    input_schema: {
      type: 'object',
      properties: {
        tenant_id_or_slug: { type: 'string', description: 'Tenant UUID or slug' },
      },
      required: ['tenant_id_or_slug'],
    },
  },
  {
    name: 'merge_tenants',
    description: 'Merge source tenant into target. All companies/orgs/listings move to target. Source tenant is deleted.',
    input_schema: {
      type: 'object',
      properties: {
        source_tenant: { type: 'string', description: 'Source tenant id or slug' },
        target_tenant: { type: 'string', description: 'Target tenant id or slug' },
      },
      required: ['source_tenant', 'target_tenant'],
    },
  },
  {
    name: 'move_company',
    description: 'Move a company (and its certs + listings) from one tenant to another.',
    input_schema: {
      type: 'object',
      properties: {
        company_id_or_slug: { type: 'string' },
        target_tenant: { type: 'string', description: 'Target tenant id or slug' },
      },
      required: ['company_id_or_slug', 'target_tenant'],
    },
  },
  {
    name: 'list_tenants',
    description: 'List all tenants/directories with company counts and status.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'update_tenant',
    description: 'Update tenant config: colors, features, branding, hero text.',
    input_schema: {
      type: 'object',
      properties: {
        tenant_id_or_slug: { type: 'string' },
        brand_color: { type: 'string' },
        logo_url: { type: 'string' },
        hero_text: { type: 'string' },
        nav_label: { type: 'string' },
        features: { type: 'object', description: 'JSON object of enabled pages e.g. {"jobs":false}' },
        description: { type: 'string' },
        website: { type: 'string' },
        name: { type: 'string' },
        status: { type: 'string', enum: ['active', 'archived'] },
      },
      required: ['tenant_id_or_slug'],
    },
  },
  // --- Code editing tools ---
  {
    name: 'read_file',
    description: 'Read a sourcing file from the repo via GitHub. Allowed: src/pages/Sourcing*.jsx, api/sourcing/**, migrations/*sourcing*',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Relative path e.g. src/pages/SourcingDirectory.jsx' },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write/overwrite a sourcing file via GitHub API (auto-deploys via Vercel).',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string' },
        content: { type: 'string', description: 'Full file content' },
        commit_message: { type: 'string', description: 'Commit message (auto-generated if omitted)' },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Find and replace within a sourcing file via GitHub API.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string' },
        old_string: { type: 'string', description: 'Exact text to find' },
        new_string: { type: 'string', description: 'Replacement text' },
        commit_message: { type: 'string' },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  },
  // --- Existing admin tools (now with optional tenant_id) ---
  {
    name: 'create_org',
    description: 'Create a new organization within a directory.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name' },
        slug: { type: 'string', description: 'URL slug (auto-generated if omitted)' },
        description: { type: 'string' },
        vertical: { type: 'string' },
        website: { type: 'string' },
        tenant_id: { type: 'string', description: 'Tenant UUID to scope to (uses context tenant if omitted)' },
      },
      required: ['name', 'vertical'],
    },
  },
  {
    name: 'delete_org',
    description: 'Delete an org and ALL its companies + listings. IRREVERSIBLE.',
    input_schema: {
      type: 'object',
      properties: {
        org_id_or_slug: { type: 'string', description: 'Organization UUID or slug' },
      },
      required: ['org_id_or_slug'],
    },
  },
  {
    name: 'add_company',
    description: 'Add a single company to the directory.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        slug: { type: 'string', description: 'URL slug (auto-generated if omitted)' },
        description: { type: 'string' },
        vertical: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        website: { type: 'string' },
        employee_count: { type: 'string', description: 'Range e.g. 51-200' },
        membership_tier: { type: 'string', enum: ['free', 'basic', 'pro', 'enterprise'] },
        org_id: { type: 'string', description: 'Organization UUID to associate with' },
        tenant_id: { type: 'string', description: 'Tenant UUID (uses context tenant if omitted)' },
      },
      required: ['name', 'vertical'],
    },
  },
  {
    name: 'bulk_seed_companies',
    description: 'Insert multiple companies at once. Use your knowledge to generate real AZ companies with realistic details.',
    input_schema: {
      type: 'object',
      properties: {
        companies: {
          type: 'array',
          description: 'Array of company objects',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              slug: { type: 'string' },
              description: { type: 'string' },
              vertical: { type: 'string' },
              city: { type: 'string' },
              website: { type: 'string' },
              employee_count: { type: 'string' },
              year_founded: { type: 'integer' },
              phone: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['name', 'vertical'],
          },
        },
        org_id: { type: 'string', description: 'Org UUID to associate all companies with' },
        tenant_id: { type: 'string', description: 'Tenant UUID (uses context tenant if omitted)' },
      },
      required: ['companies'],
    },
  },
  {
    name: 'remove_company',
    description: 'Delete a company, all its certifications, and all its listings.',
    input_schema: {
      type: 'object',
      properties: {
        company_id_or_slug: { type: 'string' },
      },
      required: ['company_id_or_slug'],
    },
  },
  {
    name: 'create_listing',
    description: 'Create a job, equipment listing, event, or article.',
    input_schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        category: { type: 'string', enum: ['jobs', 'equipment', 'events', 'articles'] },
        title: { type: 'string' },
        description: { type: 'string' },
        location: { type: 'string' },
        salary_range: { type: 'string' },
        employment_type: { type: 'string' },
        org_id: { type: 'string' },
        tenant_id: { type: 'string', description: 'Tenant UUID (uses context tenant if omitted)' },
      },
      required: ['company_id', 'category', 'title', 'description'],
    },
  },
  {
    name: 'delete_listing',
    description: 'Delete a listing by ID.',
    input_schema: {
      type: 'object',
      properties: { listing_id: { type: 'string' } },
      required: ['listing_id'],
    },
  },
  {
    name: 'get_stats',
    description: 'Get directory stats: total companies, orgs, listings by type. Scoped to tenant if one is active.',
    input_schema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'Tenant UUID to scope stats to' },
      },
    },
  },
  {
    name: 'list_orgs',
    description: 'List all organizations with company counts. Scoped to tenant if one is active.',
    input_schema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'Tenant UUID to scope to' },
      },
    },
  },
];

const SCOUT_TOOLS = [
  {
    name: 'search_companies',
    description: 'Search for companies by query text, vertical, certification, employee size, or city. Scoped to tenant if one is active.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text search against name and description' },
        vertical: { type: 'string' },
        certification: { type: 'string', description: 'Required cert e.g. "ITAR Registered"' },
        employee_range: { type: 'string', description: 'Range e.g. "51-200"' },
        city: { type: 'string' },
        limit: { type: 'integer', description: 'Max results (default 20)' },
        tenant_id: { type: 'string', description: 'Tenant UUID to scope search to' },
      },
    },
  },
  {
    name: 'get_company',
    description: 'Get full company profile including certifications.',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        tenant_id: { type: 'string' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'get_listings',
    description: 'Get jobs, equipment listings, events, or articles. Scoped to tenant if one is active.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['jobs', 'equipment', 'events', 'articles'] },
        vertical: { type: 'string' },
        org_id: { type: 'string' },
        limit: { type: 'integer' },
        tenant_id: { type: 'string', description: 'Tenant UUID to scope to' },
      },
    },
  },
  {
    name: 'list_orgs',
    description: 'List all organizations with their verticals. Scoped to tenant if one is active.',
    input_schema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
      },
    },
  },
];

// ─── System Prompts ───────────────────────────────────────────────────────────

function getAdminSystemPrompt(tenantName) {
  const tenantContext = tenantName
    ? `You are currently managing the "${tenantName}" directory. All operations are scoped to this directory unless you explicitly use a different tenant_id. When confirming actions, mention the directory name.`
    : `You are the global admin managing ALL directories. You can create, merge, delete, and manage tenants. When working with companies or listings, specify which tenant/directory they belong to.`;

  return `You are Scout, the directory manager for sourcing.directory. You help Ben manage his industrial supplier directories.

${tenantContext}

You can:
- Create, delete, merge directories (tenants)
- Move companies between directories
- Update directory branding (colors, logos, hero text, feature flags)
- Add individual companies or bulk-seed an entire vertical
- Create job posts, equipment listings, events, articles
- Read, write, and edit sourcing code files (auto-deploys via Vercel)
- Report stats on the current state

When asked to create something, do it immediately. Don't ask for confirmation unless it's destructive (delete/merge).
When bulk seeding, use real AZ companies you know. Include realistic details.
Keep responses short. Confirm what you did, give the URL, move on.

Code editing: You can read and modify sourcing page files. Only files matching: src/pages/Sourcing*.jsx, api/sourcing/**, migrations/*sourcing*. After writing, changes auto-deploy via Vercel in ~60 seconds.`;
}

function getScoutSystemPrompt(tenantName) {
  const tenantContext = tenantName
    ? `You are searching within the "${tenantName}" directory. Results are scoped to this directory only.`
    : `You are searching across all directories in the sourcing platform.`;

  return `You are Scout, the search agent for sourcing.directory -- a multi-tenant industrial supplier platform for Arizona.

${tenantContext}

Help the user find suppliers, understand what's in the directory, and connect with the right companies.
Search based on their needs, not just keywords. If they say "ITAR certified space companies" -- search for that.
Keep responses short and direct. If you find matches, list them with a one-line description.`;
}

// ─── Tool Executors ───────────────────────────────────────────────────────────

function makeSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function executeAdminTool(name, args, contextTenantId) {
  const sb = getClient(true);
  if (!sb) throw new Error('Admin client unavailable (check SUPABASE_SERVICE_ROLE_KEY)');

  // For tools that accept tenant_id, use: explicit arg > context > null
  const effectiveTenantId = args.tenant_id || contextTenantId || null;

  switch (name) {
    // ─── Tenant management ────────────────────────────────────────────
    case 'create_tenant': {
      const slug = args.slug || makeSlug(args.name);
      const { data, error } = await sb.from('directory_tenants').insert({
        name: args.name,
        slug,
        vertical: args.vertical,
        description: args.description || null,
        brand_color: args.brand_color || '#1B5E20',
        website: args.website || null,
        hero_text: args.hero_text || null,
        status: 'active',
      }).select().single();
      if (error) throw new Error(error.message);
      return { success: true, tenant: { id: data.id, name: data.name, slug: data.slug }, url: `/sourcing/${slug}` };
    }

    case 'delete_tenant': {
      const tenant = await resolveTenant(sb, args.tenant_id_or_slug);
      if (!tenant) throw new Error(`Tenant not found: ${args.tenant_id_or_slug}`);
      // Cascade happens via FK ON DELETE CASCADE, but let's count first
      const { data: companies } = await sb.from('directory_companies').select('id').eq('tenant_id', tenant.id);
      const count = (companies || []).length;
      await sb.from('directory_tenants').delete().eq('id', tenant.id);
      return { success: true, deleted_tenant: tenant.name, companies_deleted: count };
    }

    case 'merge_tenants': {
      const source = await resolveTenant(sb, args.source_tenant);
      const target = await resolveTenant(sb, args.target_tenant);
      if (!source) throw new Error(`Source tenant not found: ${args.source_tenant}`);
      if (!target) throw new Error(`Target tenant not found: ${args.target_tenant}`);
      // Move all data from source to target
      await sb.from('directory_companies').update({ tenant_id: target.id }).eq('tenant_id', source.id);
      await sb.from('directory_organizations').update({ tenant_id: target.id }).eq('tenant_id', source.id);
      await sb.from('directory_certifications').update({ tenant_id: target.id }).eq('tenant_id', source.id);
      await sb.from('directory_listings').update({ tenant_id: target.id }).eq('tenant_id', source.id);
      // Delete source tenant
      await sb.from('directory_tenants').delete().eq('id', source.id);
      return { success: true, merged: `${source.name} -> ${target.name}`, target_url: `/sourcing/${target.slug}` };
    }

    case 'move_company': {
      const target = await resolveTenant(sb, args.target_tenant);
      if (!target) throw new Error(`Target tenant not found: ${args.target_tenant}`);
      let companyId = args.company_id_or_slug;
      if (companyId.length < 36) {
        const { data: co } = await sb.from('directory_companies').select('id').eq('slug', companyId).single();
        if (co) companyId = co.id;
        else throw new Error(`Company not found: ${args.company_id_or_slug}`);
      }
      await sb.from('directory_companies').update({ tenant_id: target.id }).eq('id', companyId);
      await sb.from('directory_certifications').update({ tenant_id: target.id }).eq('company_id', companyId);
      await sb.from('directory_listings').update({ tenant_id: target.id }).eq('company_id', companyId);
      return { success: true, moved_to: target.name };
    }

    case 'list_tenants': {
      const { data: tenants } = await sb.from('directory_tenants')
        .select('id, name, slug, vertical, status, brand_color, features, created_at')
        .order('name');
      // Get company counts per tenant
      const results = [];
      for (const t of (tenants || [])) {
        const { count } = await sb.from('directory_companies').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id);
        results.push({ ...t, company_count: count || 0, url: `/sourcing/${t.slug}` });
      }
      return results;
    }

    case 'update_tenant': {
      const tenant = await resolveTenant(sb, args.tenant_id_or_slug);
      if (!tenant) throw new Error(`Tenant not found: ${args.tenant_id_or_slug}`);
      const updates = {};
      if (args.brand_color) updates.brand_color = args.brand_color;
      if (args.logo_url) updates.logo_url = args.logo_url;
      if (args.hero_text) updates.hero_text = args.hero_text;
      if (args.nav_label) updates.nav_label = args.nav_label;
      if (args.description) updates.description = args.description;
      if (args.website) updates.website = args.website;
      if (args.name) updates.name = args.name;
      if (args.status) updates.status = args.status;
      if (args.features) {
        // Merge features with existing
        updates.features = { ...tenant.features, ...args.features };
      }
      if (Object.keys(updates).length === 0) return { success: true, message: 'No changes' };
      const { error } = await sb.from('directory_tenants').update(updates).eq('id', tenant.id);
      if (error) throw new Error(error.message);
      return { success: true, updated: Object.keys(updates), tenant: tenant.name };
    }

    // ─── Code editing tools ────────────────────────────────────────────
    case 'read_file': {
      if (!isPathAllowed(args.file_path)) throw new Error('Access denied: Scout can only edit sourcing files.');
      if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not configured');
      const file = await githubGetFile(args.file_path);
      if (!file) throw new Error(`File not found: ${args.file_path}`);
      return { content: file.content, path: args.file_path };
    }

    case 'write_file': {
      if (!isPathAllowed(args.file_path)) throw new Error('Access denied: Scout can only edit sourcing files.');
      if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not configured');
      const existing = await githubGetFile(args.file_path);
      await githubPutFile(args.file_path, args.content, args.commit_message || `scout: update ${args.file_path}`, existing?.sha || null);
      return { success: true, path: args.file_path, message: 'Written and deploying via Vercel (~60s)' };
    }

    case 'edit_file': {
      if (!isPathAllowed(args.file_path)) throw new Error('Access denied: Scout can only edit sourcing files.');
      if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not configured');
      const file = await githubGetFile(args.file_path);
      if (!file) throw new Error(`File not found: ${args.file_path}`);
      if (!file.content.includes(args.old_string)) throw new Error(`old_string not found in ${args.file_path}`);
      const newContent = file.content.replace(args.old_string, args.new_string);
      await githubPutFile(args.file_path, newContent, args.commit_message || `scout: edit ${args.file_path}`, file.sha);
      return { success: true, path: args.file_path, message: 'Edited and deploying via Vercel (~60s)' };
    }

    // ─── Existing admin tools (tenant-aware) ──────────────────────────
    case 'create_org': {
      const slug = args.slug || makeSlug(args.name);
      const insertData = {
        name: args.name, slug,
        description: args.description || null,
        vertical: args.vertical,
        website: args.website || null,
        status: 'active',
      };
      if (effectiveTenantId) insertData.tenant_id = effectiveTenantId;
      const { data, error } = await sb.from('directory_organizations').insert(insertData).select().single();
      if (error) throw new Error(error.message);
      return { success: true, org: { id: data.id, name: data.name, slug: data.slug }, url: `/sourcing/org/${slug}` };
    }

    case 'delete_org': {
      let orgId = args.org_id_or_slug;
      if (orgId.length < 36) {
        const { data: org } = await sb.from('directory_organizations').select('id').eq('slug', orgId).single();
        if (org) orgId = org.id;
      }
      const { data: orgCompanies } = await sb.from('directory_companies').select('id').eq('organization_id', orgId);
      const companyIds = (orgCompanies || []).map(c => c.id);
      if (companyIds.length > 0) {
        await sb.from('directory_certifications').delete().in('company_id', companyIds);
        await sb.from('directory_listings').delete().in('company_id', companyIds);
        await sb.from('directory_companies').delete().in('id', companyIds);
      }
      await sb.from('directory_listings').delete().eq('org_id', orgId);
      await sb.from('directory_organizations').delete().eq('id', orgId);
      return { success: true, deleted: { companies: companyIds.length } };
    }

    case 'add_company': {
      const slug = args.slug || makeSlug(args.name);
      const insertData = {
        name: args.name, slug,
        description: args.description || null,
        vertical: args.vertical,
        city: args.city || 'Phoenix',
        state: args.state || 'AZ',
        country: 'US',
        website: args.website || null,
        employee_count: args.employee_count || null,
        membership_tier: args.membership_tier || 'free',
        organization_id: args.org_id || null,
        status: 'active',
      };
      if (effectiveTenantId) insertData.tenant_id = effectiveTenantId;
      const { data, error } = await sb.from('directory_companies').insert(insertData).select().single();
      if (error) throw new Error(error.message);
      return { success: true, company: { id: data.id, name: data.name }, url: `/sourcing/${slug}` };
    }

    case 'bulk_seed_companies': {
      const rows = args.companies.map(c => {
        const row = {
          name: c.name,
          slug: c.slug || makeSlug(c.name),
          description: c.description || null,
          vertical: c.vertical || 'semiconductor',
          city: c.city || 'Phoenix',
          state: 'AZ', country: 'US',
          website: c.website || null,
          employee_count: c.employee_count || null,
          year_founded: c.year_founded || null,
          phone: c.phone || null,
          email: c.email || null,
          membership_tier: 'free',
          organization_id: args.org_id || null,
          status: 'active',
        };
        if (effectiveTenantId) row.tenant_id = effectiveTenantId;
        return row;
      });
      const { data, error } = await sb.from('directory_companies').insert(rows).select('name');
      if (error) throw new Error(error.message);
      return { success: true, added: data.length, companies: data.map(c => c.name) };
    }

    case 'remove_company': {
      let companyId = args.company_id_or_slug;
      if (companyId.length < 36) {
        const { data: co } = await sb.from('directory_companies').select('id').eq('slug', companyId).single();
        if (co) companyId = co.id;
      }
      await sb.from('directory_certifications').delete().eq('company_id', companyId);
      await sb.from('directory_listings').delete().eq('company_id', companyId);
      await sb.from('directory_companies').delete().eq('id', companyId);
      return { success: true };
    }

    case 'create_listing': {
      const insertData = {
        company_id: args.company_id,
        category: args.category,
        title: args.title,
        description: args.description,
        location: args.location || null,
        salary_range: args.salary_range || null,
        employment_type: args.employment_type || null,
        org_id: args.org_id || null,
        status: 'active',
      };
      if (effectiveTenantId) insertData.tenant_id = effectiveTenantId;
      const { data, error } = await sb.from('directory_listings').insert(insertData).select().single();
      if (error) throw new Error(error.message);
      return { success: true, listing: { id: data.id, title: data.title } };
    }

    case 'delete_listing': {
      await sb.from('directory_listings').delete().eq('id', args.listing_id);
      return { success: true };
    }

    case 'get_stats': {
      const tid = args.tenant_id || effectiveTenantId;
      let compQ = sb.from('directory_companies').select('id, vertical, status');
      let orgsQ = sb.from('directory_organizations').select('id');
      let listQ = sb.from('directory_listings').select('id, category, status');
      if (tid) {
        compQ = compQ.eq('tenant_id', tid);
        orgsQ = orgsQ.eq('tenant_id', tid);
        listQ = listQ.eq('tenant_id', tid);
      }
      const [compRes, orgsRes, listingsRes] = await Promise.all([compQ, orgsQ, listQ]);
      const byVertical = {};
      (compRes.data || []).forEach(c => { byVertical[c.vertical] = (byVertical[c.vertical] || 0) + 1; });
      const byCategory = {};
      (listingsRes.data || []).forEach(l => { byCategory[l.category] = (byCategory[l.category] || 0) + 1; });
      return {
        companies: {
          total: (compRes.data || []).length,
          active: (compRes.data || []).filter(c => c.status === 'active').length,
          by_vertical: byVertical,
        },
        orgs: { total: (orgsRes.data || []).length },
        listings: { total: (listingsRes.data || []).length, by_category: byCategory },
        scoped_to_tenant: !!tid,
      };
    }

    case 'list_orgs': {
      const tid = args.tenant_id || effectiveTenantId;
      let q = sb.from('directory_organizations')
        .select('id, name, slug, vertical, directory_companies(id)')
        .order('name');
      if (tid) q = q.eq('tenant_id', tid);
      const { data } = await q;
      return (data || []).map(o => ({
        id: o.id, name: o.name, slug: o.slug, vertical: o.vertical,
        company_count: (o.directory_companies || []).length,
        url: `/sourcing/org/${o.slug}`,
      }));
    }

    default:
      throw new Error(`Unknown admin tool: ${name}`);
  }
}

async function executeScoutTool(name, args, contextTenantId) {
  const sb = getClient(false);
  if (!sb) throw new Error('Scout client unavailable');

  const effectiveTenantId = args.tenant_id || contextTenantId || null;

  switch (name) {
    case 'search_companies': {
      let q = sb.from('directory_companies')
        .select('id, name, slug, description, vertical, city, state, website, employee_count, tenant_id, directory_certifications(cert_name)')
        .eq('status', 'active')
        .order('featured', { ascending: false })
        .limit(args.limit || 20);
      if (effectiveTenantId) q = q.eq('tenant_id', effectiveTenantId);
      if (args.vertical) q = q.eq('vertical', args.vertical);
      if (args.city) q = q.ilike('city', `%${args.city}%`);
      if (args.employee_range) q = q.eq('employee_count', args.employee_range);
      if (args.query) q = q.or(`name.ilike.%${args.query}%,description.ilike.%${args.query}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let results = data || [];
      if (args.certification) {
        const certLower = args.certification.toLowerCase();
        results = results.filter(c =>
          (c.directory_certifications || []).some(cert =>
            cert.cert_name.toLowerCase().includes(certLower)
          )
        );
      }
      return results.map(c => ({
        name: c.name, slug: c.slug, description: c.description,
        vertical: c.vertical, city: c.city, website: c.website,
        certifications: (c.directory_certifications || []).map(cert => cert.cert_name),
        url: `/sourcing/${c.slug}`,
      }));
    }

    case 'get_company': {
      let q = sb.from('directory_companies')
        .select('*, directory_certifications(*)')
        .eq('slug', args.slug);
      if (effectiveTenantId) q = q.eq('tenant_id', effectiveTenantId);
      const { data, error } = await q.single();
      if (error) throw new Error(error.message);
      return data;
    }

    case 'get_listings': {
      let q = sb.from('directory_listings')
        .select('id, title, category, description, location, status, directory_companies(name, slug)')
        .eq('status', 'active')
        .limit(args.limit || 20);
      if (effectiveTenantId) q = q.eq('tenant_id', effectiveTenantId);
      if (args.category) q = q.eq('category', args.category);
      if (args.org_id) q = q.eq('org_id', args.org_id);
      const { data } = await q;
      return data || [];
    }

    case 'list_orgs': {
      let q = sb.from('directory_organizations')
        .select('id, name, slug, vertical')
        .order('name');
      if (effectiveTenantId) q = q.eq('tenant_id', effectiveTenantId);
      const { data } = await q;
      return data || [];
    }

    default:
      throw new Error(`Unknown scout tool: ${name}`);
  }
}

// ─── SSE Helper ───────────────────────────────────────────────────────────────

function sse(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { message, mode = 'scout', tenantId = null } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });

  const isAdmin = mode === 'admin';
  const tools = isAdmin ? ADMIN_TOOLS : SCOUT_TOOLS;

  // Resolve tenant name for system prompt context
  let tenantName = null;
  if (tenantId) {
    const sb = getClient(true) || getClient(false);
    if (sb) {
      const tenant = await resolveTenant(sb, tenantId);
      if (tenant) tenantName = tenant.name;
    }
  }

  const systemPrompt = isAdmin ? getAdminSystemPrompt(tenantName) : getScoutSystemPrompt(tenantName);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!ANTHROPIC_API_KEY) {
    sse(res, { type: 'text', text: 'Scout is not yet configured (ANTHROPIC_API_KEY missing).' });
    sse(res, { type: 'done' });
    return res.end();
  }

  const messages = [{ role: 'user', content: message }];
  const MAX_LOOPS = 5;

  try {
    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: systemPrompt,
          tools,
          messages,
          stream: true,
        }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        sse(res, { type: 'error', error: errText });
        break;
      }

      // Stream + collect content blocks
      const reader = anthropicRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const contentBlocks = [];
      let currentBlock = null;
      let stopReason = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const event = JSON.parse(raw);
            switch (event.type) {
              case 'content_block_start':
                currentBlock = { ...event.content_block, text: '', input_json: '' };
                break;
              case 'content_block_delta':
                if (!currentBlock) break;
                if (event.delta.type === 'text_delta') {
                  currentBlock.text += event.delta.text;
                  sse(res, { type: 'text', text: event.delta.text });
                } else if (event.delta.type === 'input_json_delta') {
                  currentBlock.input_json += event.delta.partial_json;
                }
                break;
              case 'content_block_stop':
                if (currentBlock) {
                  if (currentBlock.type === 'tool_use') {
                    try { currentBlock.input = JSON.parse(currentBlock.input_json || '{}'); }
                    catch { currentBlock.input = {}; }
                  }
                  contentBlocks.push(currentBlock);
                  currentBlock = null;
                }
                break;
              case 'message_delta':
                if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
                break;
            }
          } catch { /* skip malformed */ }
        }
      }

      const toolUseBlocks = contentBlocks.filter(b => b.type === 'tool_use');
      if (toolUseBlocks.length === 0 || stopReason === 'end_turn') break;

      // Add assistant message, execute tools, add results
      messages.push({
        role: 'assistant',
        content: contentBlocks.map(b =>
          b.type === 'tool_use'
            ? { type: 'tool_use', id: b.id, name: b.name, input: b.input }
            : { type: 'text', text: b.text }
        ),
      });

      const toolResults = [];
      for (const block of toolUseBlocks) {
        sse(res, { type: 'tool_call', name: block.name, args: block.input });
        try {
          const result = isAdmin
            ? await executeAdminTool(block.name, block.input, tenantId)
            : await executeScoutTool(block.name, block.input, tenantId);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
        } catch (err) {
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ error: err.message }), is_error: true });
        }
      }
      messages.push({ role: 'user', content: toolResults });
    }

    sse(res, { type: 'done' });
    res.end();
  } catch (err) {
    console.error('Scout agent error:', err);
    try {
      sse(res, { type: 'error', error: err.message });
      sse(res, { type: 'done' });
      res.end();
    } catch { /* already closed */ }
  }
}

export const config = { maxDuration: 60 };
