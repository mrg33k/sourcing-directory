-- Backfill: free signups created directory_companies rows with tenant_id=null.
-- The signup endpoint only resolved a tenant for the member row, not the company,
-- so these companies were 'active' but invisible in the tenant-scoped public
-- directory (which filters by tenant_id). The endpoint is fixed going forward
-- (api/sourcing/signup.js, 2026-06-05); this repairs the rows already created.
--
-- Each null-tenant company's tenant is taken from its linked member row, which
-- already resolved the correct tenant via the member-insert fallback.
UPDATE directory_companies c
SET tenant_id = m.tenant_id
FROM directory_members m
WHERE c.id = m.company_id
  AND c.tenant_id IS NULL
  AND m.tenant_id IS NOT NULL;
