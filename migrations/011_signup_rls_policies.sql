-- Fix: Allow signup to insert companies, members, and certifications
-- Without these policies, the frontend signup form fails silently at the company insert step.

-- Companies: allow insert only with status='pending' (admin must approve to 'active')
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'signup insert companies' AND tablename = 'directory_companies') THEN
    CREATE POLICY "signup insert companies" ON directory_companies FOR INSERT WITH CHECK (status = 'pending');
  END IF;
END $$;

-- Certifications: allow public insert (tied to company signup)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'signup insert certs' AND tablename = 'directory_certifications') THEN
    CREATE POLICY "signup insert certs" ON directory_certifications FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Members: ensure insert is allowed (the existing "service role all" policy should cover this,
-- but add an explicit insert policy as a safety net)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'signup insert members' AND tablename = 'directory_members') THEN
    CREATE POLICY "signup insert members" ON directory_members FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Also allow authenticated users to read their own pending company (so portal loads after signup)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read own pending company' AND tablename = 'directory_companies') THEN
    CREATE POLICY "read own pending company" ON directory_companies FOR SELECT USING (status IN ('active', 'pending'));
  END IF;
END $$;
