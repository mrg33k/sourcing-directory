-- Fix RLS policy for directory_reports
-- Original policy checked access = 'free' but the actual access values are 'public'/'members'/'paid'
-- This meant no reports were readable by anonymous users.
DROP POLICY IF EXISTS "public read free reports" ON directory_reports;
CREATE POLICY "public read public reports" ON directory_reports FOR SELECT USING (access = 'public');
