// Audit log helper. Records destructive / role actions to directory_audit.
// Must NEVER block or throw into the calling handler — fire-and-forget, swallow errors.
export async function logAudit(adminSupabase, { tenant_id, actor_email, action, entity_type, entity_id, detail } = {}) {
  if (!adminSupabase || !action) return;
  try {
    await adminSupabase.from('directory_audit').insert({
      tenant_id: tenant_id || null,
      actor_email: actor_email || null,
      action,
      entity_type: entity_type || null,
      entity_id: entity_id || null,
      detail: detail || {},
    });
  } catch (_) { /* audit failures never break the action */ }
}
