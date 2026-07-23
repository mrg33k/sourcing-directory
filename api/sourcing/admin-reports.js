import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://kzzvjtthknsozktmpvak.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VALID_CATEGORIES = ['government', 'acquisition', 'economic', 'quarterly'];
const VALID_ACCESS = ['free', 'member', 'members', 'paid', 'public'];
const UPDATABLE_FIELDS = [
  'title',
  'description',
  'category',
  'access',
  'file_url',
  'cover_image_url',
  'published_at',
  'is_premium',
];

const SELECT_FIELDS =
  'id, tenant_id, title, description, category, access, file_url, cover_image_url, is_premium, published_at, created_at, updated_at, created_by, updated_by';

function jsonError(res, status, error) {
  return res.status(status).json({ error });
}

function normalizeReport(report) {
  return {
    id: report.id,
    tenant_id: report.tenant_id,
    title: report.title,
    description: report.description || null,
    category: report.category || null,
    access: report.access || null,
    file_url: report.file_url || null,
    cover_image_url: report.cover_image_url || null,
    is_premium: report.is_premium != null ? Boolean(report.is_premium) : null,
    published_at: report.published_at || null,
    created_at: report.created_at || null,
    updated_at: report.updated_at || null,
    created_by: report.created_by || null,
    updated_by: report.updated_by || null,
  };
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body;
}

function validateUpdates(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  const keys = Object.keys(body).filter(key => UPDATABLE_FIELDS.includes(key));
  if (keys.length === 0) {
    return { error: `At least one updatable field is required: ${UPDATABLE_FIELDS.join(', ')}` };
  }

  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return { error: 'title must be a non-empty string' };
    }
    updates.title = body.title.trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    if (body.description !== null && typeof body.description !== 'string') {
      return { error: 'description must be a string or null' };
    }
    updates.description = body.description === null ? null : body.description.trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, 'category')) {
    if (body.category !== null && (typeof body.category !== 'string' || !VALID_CATEGORIES.includes(body.category.trim().toLowerCase()))) {
      return { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` };
    }
    updates.category = body.category === null ? null : body.category.trim().toLowerCase();
  }

  if (Object.prototype.hasOwnProperty.call(body, 'access')) {
    if (body.access !== null && (typeof body.access !== 'string' || !VALID_ACCESS.includes(body.access.trim().toLowerCase()))) {
      return { error: `access must be one of: ${VALID_ACCESS.join(', ')}` };
    }
    updates.access = body.access === null ? null : body.access.trim().toLowerCase();
  }

  if (Object.prototype.hasOwnProperty.call(body, 'file_url')) {
    if (body.file_url !== null && (typeof body.file_url !== 'string' || !body.file_url.trim())) {
      return { error: 'file_url must be a non-empty string or null' };
    }
    updates.file_url = body.file_url === null ? null : body.file_url.trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, 'cover_image_url')) {
    if (body.cover_image_url !== null && (typeof body.cover_image_url !== 'string' || !body.cover_image_url.trim())) {
      return { error: 'cover_image_url must be a non-empty string or null' };
    }
    updates.cover_image_url = body.cover_image_url === null ? null : body.cover_image_url.trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, 'published_at')) {
    if (body.published_at !== null) {
      const parsed = new Date(body.published_at);
      if (Number.isNaN(parsed.getTime())) {
        return { error: 'published_at must be a valid ISO date string or null' };
      }
      updates.published_at = parsed.toISOString();
    } else {
      updates.published_at = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'is_premium')) {
    if (typeof body.is_premium !== 'boolean') {
      return { error: 'is_premium must be a boolean' };
    }
    updates.is_premium = body.is_premium;
  }

  return { updates };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, PATCH, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!['GET', 'PUT', 'PATCH', 'POST'].includes(req.method)) {
    return jsonError(res, 405, 'GET, PUT, PATCH, or POST only');
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonError(res, 500, 'Supabase not configured');
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return jsonError(res, 401, 'Missing authorization token');

  // reportId required for GET/PUT/PATCH but NOT for POST
  const reportId = req.query?.id || req.query?.report_id;
  if (req.method !== 'POST') {
    if (!reportId || typeof reportId !== 'string') {
      return jsonError(res, 400, 'id is required');
    }
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: userErr } = await sb.auth.getUser(token);
  const user = authData?.user;
  if (userErr || !user) return jsonError(res, 401, 'Invalid or expired token');
  if (user.app_metadata?.role !== 'admin') return jsonError(res, 403, 'Admin access required');

  const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id;
  if (!tenantId) return jsonError(res, 403, 'Tenant scope missing for admin user');

  try {
    if (req.method === 'GET') {
      const { data: report, error } = await sb
        .from('directory_reports')
        .select(SELECT_FIELDS)
        .eq('id', reportId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      if (!report) return jsonError(res, 404, 'Report not found');

      return res.status(200).json(normalizeReport(report));
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body === null) return jsonError(res, 400, 'Request body must be valid JSON');
      if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
        return jsonError(res, 400, 'title is required');
      }

      const category = body.category ? String(body.category).trim().toLowerCase() : null;
      if (category && !VALID_CATEGORIES.includes(category)) {
        return jsonError(res, 400, `category must be one of: ${VALID_CATEGORIES.join(', ')}`);
      }

      const access = body.access ? String(body.access).trim().toLowerCase() : 'free';
      if (!VALID_ACCESS.includes(access)) {
        return jsonError(res, 400, `access must be one of: ${VALID_ACCESS.join(', ')}`);
      }

      const safeIso = (v) => {
        if (!v) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d.toISOString();
      };

      const insertRow = {
        tenant_id: tenantId,
        title: body.title.trim(),
        description: body.description ? String(body.description).trim() || null : null,
        category: category || null,
        access,
        file_url: body.file_url ? String(body.file_url).trim() || null : null,
        cover_image_url: body.cover_image_url ? String(body.cover_image_url).trim() || null : null,
        is_premium: typeof body.is_premium === 'boolean' ? body.is_premium : false,
        published_at: safeIso(body.published_at),
        created_by: user.id,
        updated_by: user.id,
      };

      const { data: report, error } = await sb
        .from('directory_reports')
        .insert(insertRow)
        .select(SELECT_FIELDS)
        .single();

      if (error) throw error;
      return res.status(201).json(normalizeReport(report));
    }

    // PUT / PATCH
    const body = parseBody(req);
    if (body === null) return jsonError(res, 400, 'Request body must be valid JSON');

    const { updates, error: validationError } = validateUpdates(body);
    if (validationError) return jsonError(res, 400, validationError);

    updates.updated_at = new Date().toISOString();
    updates.updated_by = user.id;

    const { data: report, error } = await sb
      .from('directory_reports')
      .update(updates)
      .eq('id', reportId)
      .eq('tenant_id', tenantId)
      .select(SELECT_FIELDS)
      .maybeSingle();

    if (error) throw error;
    if (!report) return jsonError(res, 404, 'Report not found');

    return res.status(200).json(normalizeReport(report));
  } catch (error) {
    return jsonError(res, 500, error.message || 'Unexpected server error');
  }
}
