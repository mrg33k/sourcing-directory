-- Allow global admins and tenant-scoped admins to UPDATE directory_companies rows.
-- Without this policy, the Approve / Reject / Unapprove buttons silently no-op for
-- non-service-role callers even when the JWT identifies a tenant admin.
create policy "admins update companies"
  on directory_companies for update
  using (
    (auth.jwt() ->> 'role') = 'admin'
    or exists (
      select 1 from directory_members m
      where m.tenant_id = directory_companies.tenant_id
        and m.auth_user_id = auth.uid()
        and m.role = 'admin'
        and m.status = 'approved'
    )
  )
  with check (
    (auth.jwt() ->> 'role') = 'admin'
    or exists (
      select 1 from directory_members m
      where m.tenant_id = directory_companies.tenant_id
        and m.auth_user_id = auth.uid()
        and m.role = 'admin'
        and m.status = 'approved'
    )
  );
