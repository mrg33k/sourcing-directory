// POST /api/sourcing/upload-admin-asset
//
// The one authenticated write path into Supabase Storage for the admin panel.
//
// WHY THIS EXISTS
// ---------------
// Until the security round the browser held the service_role key, which carries
// BYPASSRLS, so admin uploads went straight to storage and worked. The key is gone.
// `storage.objects` has RLS enabled and ZERO policies (verified against the live
// database — see docs/security/upload-verification.md), which is default-deny, so
// every browser-side upload now fails. Three admin controls broke with it:
//
//   src/pages/admin/AdminUI.jsx        company logo
//   src/pages/admin/SettingsSection.jsx directory (tenant) logo
//   src/pages/admin/ReportsSection.jsx  report PDF, and the delete of a superseded PDF
//
// The fix is NOT blanket storage policies. It is the pattern the member-facing flows
// already use: the caller's JWT is verified here, server-side, the caller's tenant
// reach is resolved from the database, and only then does the service key act. The
// browser never receives a credential — it receives a SIGNED UPLOAD URL scoped to one
// object path that this function chose, valid for two hours, for one PUT.
//
// The client never names the storage path. It names WHAT it is uploading (a logo for
// company X, the logo for directory Y, a PDF for report Z) and this function derives
// the path. A client-supplied path is a client-supplied authorization decision.
//
// ── Actions ──────────────────────────────────────────────────────────────────
//
//   { action: 'sign-upload', kind: 'company-logo', company_id, content_type }
//   { action: 'sign-upload', kind: 'tenant-logo',  tenant_id,  content_type }
//   { action: 'sign-upload', kind: 'report-file',  filename, content_type, report_id? }
//     -> 200 { bucket, path, token, signedUrl, publicUrl }
//     `report-file` is gated to EXACTLY what api/sourcing/admin-reports.js will accept
//     on the save — never looser. `sourcing-reports` is a public bucket, so a token
//     issued for a file the save would refuse leaves a public orphan behind a
//     success message. See the gate-parity note in the handler.
//     The browser then calls
//       supabase.storage.from(bucket).uploadToSignedUrl(path, token, file, { contentType })
//     which needs no storage RLS permission of its own — the token is the authorization.
//
//   { action: 'remove-report-file', report_id }
//     -> 200 { ok: true, removed: <path|null> }
//     Removes the object currently referenced by directory_reports.file_url. The path
//     is read off the DB row, never off the request.
//
// Requires: Authorization: Bearer <supabase access token> for an admin.

import { requireAdmin } from './lib/adminAuth.js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://kzzvjtthknsozktmpvak.supabase.co';

const LOGO_BUCKET = 'company-logos';
const REPORT_BUCKET = 'sourcing-reports';

// Deliberately narrower than the bucket's own allowlist, which still permits
// image/svg+xml. An SVG is executable markup served from a public origin; nothing in
// this product needs SVG logos. See docs/security/upload-verification.md §9.
//
// Honest limit: content_type here decides the object PATH and is checked before a
// token is issued, but the actual bytes are PUT by the browser. The hard MIME and
// size ceilings are the bucket's (`company-logos` 5 MB, `sourcing-reports` 50 MB),
// enforced by the storage service on the PUT itself. This check exists so a wrong
// file type is rejected before an upload starts, not as the only gate.
const IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const PDF_TYPES = new Set(['application/pdf']);

function fail(res, status, error) {
  return res.status(status).json({ error });
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  if (typeof req.body !== 'object' || Array.isArray(req.body)) return null;
  return req.body;
}

/** Same sanitiser as api/sourcing/upload-report.js, so filenames stay consistent. */
function safeFileName(raw, fallback) {
  let name = String(raw || '')
    .replace(/\s+/g, '-')
    .replace(/[#?&%]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .toLowerCase()
    .slice(0, 100);
  if (!name) name = fallback;
  return name;
}

function isUuidish(value) {
  return typeof value === 'string' && /^[0-9a-fA-F-]{8,64}$/.test(value);
}

/** Public object URL for a bucket + path, built the same way upload-report.js builds it. */
function publicUrlFor(bucket, path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

/**
 * The tenant scope api/sourcing/admin-reports.js resolves for a caller.
 *
 * Copied from that file on purpose (it reads exactly this, at the top of its handler),
 * because admin-reports.js is the ONLY code in the product that can persist
 * directory_reports.file_url. If this expression drifts there, it must move here in the
 * same commit — see the gate-parity note in the 'report-file' branch below.
 */
function reportsSaveTenantId(user) {
  return user?.user_metadata?.tenant_id || user?.app_metadata?.tenant_id || null;
}

/** Object key inside REPORT_BUCKET for a stored file_url, or null if it is not ours. */
function reportObjectPath(fileUrl) {
  if (typeof fileUrl !== 'string' || !fileUrl) return null;
  let url;
  try { url = new URL(fileUrl); } catch { return null; }
  const marker = `/object/public/${REPORT_BUCKET}/`;
  const at = url.pathname.indexOf(marker);
  if (at === -1) return null;
  const encoded = url.pathname.slice(at + marker.length);
  if (!encoded) return null;
  try { return decodeURIComponent(encoded); } catch { return encoded; }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return fail(res, 405, 'POST only');

  // Authenticate before the body is looked at, for the same reason api/sourcing/admin.js
  // does: an unauthenticated caller learns nothing about what this endpoint accepts.
  const auth = await requireAdmin(req);
  if (!auth.ok) return fail(res, auth.status, auth.error);
  const { sb, user, isGlobal, tenantIds } = auth;

  const body = parseBody(req);
  if (body === null) return fail(res, 400, 'Request body must be a JSON object');

  const action = String(body.action || '');
  const inScope = (tenantId) => isGlobal || (tenantId != null && tenantIds.includes(tenantId));

  try {
    // ── remove-report-file ────────────────────────────────────────────────────
    if (action === 'remove-report-file') {
      const reportId = body.report_id;
      if (!isUuidish(reportId)) return fail(res, 400, 'report_id is required');

      const { data: report, error: reportErr } = await sb
        .from('directory_reports')
        .select('id, tenant_id, file_url')
        .eq('id', reportId)
        .maybeSingle();
      if (reportErr) return fail(res, 500, `Could not load the report: ${reportErr.message}`);
      if (!report) return fail(res, 404, 'Report not found');
      if (!inScope(report.tenant_id)) {
        return fail(res, 403, 'That report is outside your admin scope');
      }

      const path = reportObjectPath(report.file_url);
      // Nothing of ours to remove: no file, or the row points at an external URL.
      if (!path) return res.status(200).json({ ok: true, removed: null });

      const { data: removed, error: removeErr } = await sb.storage
        .from(REPORT_BUCKET)
        .remove([path]);
      if (removeErr) {
        return fail(res, 502, `Could not delete the stored file: ${removeErr.message}`);
      }
      // remove() resolves with the objects it actually deleted. An empty list means the
      // object was already gone, which is the same end state and not an error.
      return res.status(200).json({
        ok: true,
        removed: Array.isArray(removed) && removed.length > 0 ? path : null,
        already_absent: !Array.isArray(removed) || removed.length === 0,
      });
    }

    // ── sign-upload ───────────────────────────────────────────────────────────
    if (action !== 'sign-upload') {
      return fail(res, 400, `Unknown action: ${String(action).slice(0, 40) || '(none)'}`);
    }

    const kind = String(body.kind || '');
    const contentType = String(body.content_type || '').toLowerCase().split(';')[0].trim();

    let bucket;
    let path;

    if (kind === 'company-logo' || kind === 'tenant-logo') {
      const ext = IMAGE_TYPES[contentType];
      if (!ext) {
        return fail(res, 400, 'Logo must be a PNG, JPG, WEBP or GIF image');
      }
      bucket = LOGO_BUCKET;

      if (kind === 'company-logo') {
        const companyId = body.company_id;
        if (!isUuidish(companyId)) return fail(res, 400, 'company_id is required');
        const { data: company, error: companyErr } = await sb
          .from('directory_companies')
          .select('id, tenant_id')
          .eq('id', companyId)
          .maybeSingle();
        if (companyErr) return fail(res, 500, `Could not load the company: ${companyErr.message}`);
        if (!company) return fail(res, 404, 'Company not found');
        if (!inScope(company.tenant_id)) {
          return fail(res, 403, 'That company is outside your admin scope');
        }
        // Same key format the browser used before, so nothing downstream changes.
        path = `${company.id}-${Date.now()}.${ext}`;
      } else {
        const tenantId = body.tenant_id;
        if (!isUuidish(tenantId)) return fail(res, 400, 'tenant_id is required');
        const { data: tenant, error: tenantErr } = await sb
          .from('directory_tenants')
          .select('id')
          .eq('id', tenantId)
          .maybeSingle();
        if (tenantErr) return fail(res, 500, `Could not load the directory: ${tenantErr.message}`);
        if (!tenant) return fail(res, 404, 'Directory not found');
        if (!inScope(tenant.id)) {
          return fail(res, 403, 'That directory is outside your admin scope');
        }
        path = `directory-logos/${tenant.id}-${Date.now()}.${ext}`;
      }
    } else if (kind === 'report-file') {
      if (!PDF_TYPES.has(contentType)) {
        return fail(res, 400, 'Report file must be a PDF');
      }
      // ── GATE PARITY WITH THE SAVE ────────────────────────────────────────────
      // The bucket this writes to is PUBLIC, and the only code that can attach an
      // uploaded PDF to anything is api/sourcing/admin-reports.js. That endpoint admits
      // a caller only when BOTH of these hold:
      //
      //   1. app_metadata.role === 'admin'                      (requireAdmin -> isGlobal)
      //   2. user_metadata.tenant_id || app_metadata.tenant_id  (its tenant scope, and it
      //      403s "Tenant scope missing for admin user" without one)
      //
      // Gating uploads on (1) alone was strictly looser than the save. Every admin on
      // the live system satisfies (1) and none satisfies (2) — verified against the
      // production auth users, 5 of 5 role=admin accounts carry no tenant_id in either
      // metadata bag — so the upload succeeded, dropped a PDF into the public bucket,
      // and the save that followed 403'd. The file stayed there referenced by nothing
      // and the admin was told the upload worked.
      //
      // So: never looser than the save. If the save would refuse it, no token is issued
      // and no byte is written. The message below is what the admin reads (AdminUI's
      // adminAssetRequest rethrows the server's `error` string and ReportsSection prints
      // it), so it has to explain the situation, not just deny.
      if (!isGlobal) {
        return fail(res, 403, 'Reports are managed platform-wide. Ask a platform admin to upload this file.');
      }
      const saveTenantId = reportsSaveTenantId(user);
      if (!saveTenantId) {
        return fail(
          res,
          403,
          'Report files cannot be uploaded from this account. Saving a report requires your admin login to be attached to a directory, and this one is not attached to any, so the file could never be saved to the report. Nothing was uploaded. Ask a platform administrator to attach your login to a directory first.',
        );
      }
      if (body.report_id !== undefined && body.report_id !== null && body.report_id !== '') {
        if (!isUuidish(body.report_id)) return fail(res, 400, 'report_id is malformed');
        const { data: report, error: reportErr } = await sb
          .from('directory_reports')
          .select('id, tenant_id')
          .eq('id', body.report_id)
          .maybeSingle();
        if (reportErr) return fail(res, 500, `Could not load the report: ${reportErr.message}`);
        if (!report) return fail(res, 404, 'Report not found');
        // admin-reports.js scopes its PUT with `.eq('tenant_id', tenantId)` and answers
        // 404 when the row belongs to someone else. Same answer here, before the upload,
        // for the same reason: the save would not take this file.
        if (report.tenant_id !== saveTenantId) {
          return fail(
            res,
            404,
            'That report belongs to a different directory than your admin login, so this file could not be saved to it. Nothing was uploaded.',
          );
        }
      }
      bucket = REPORT_BUCKET;
      let name = safeFileName(body.filename, 'report-file.pdf');
      if (!name.endsWith('.pdf')) name = `${name}.pdf`;
      path = `${Date.now()}_${name}`;
    } else {
      return fail(res, 400, `Unknown kind: ${String(kind).slice(0, 40) || '(none)'}`);
    }

    const { data: signed, error: signErr } = await sb.storage
      .from(bucket)
      .createSignedUploadUrl(path);
    if (signErr) {
      return fail(res, 502, `Could not start the upload: ${signErr.message}`);
    }

    return res.status(200).json({
      bucket,
      path: signed.path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      publicUrl: publicUrlFor(bucket, signed.path),
    });
  } catch (err) {
    console.error('[api/sourcing/upload-admin-asset]', err);
    return fail(res, 500, err?.message || 'Unexpected server error');
  }
}
