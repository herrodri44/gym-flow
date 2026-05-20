-- Migration 0002: convert text boolean columns to real BOOLEAN
-- Apply in Supabase SQL editor

-- members.active
ALTER TABLE members
  ALTER COLUMN active DROP DEFAULT,
  ALTER COLUMN active TYPE boolean USING (active = 'true'),
  ALTER COLUMN active SET DEFAULT true;

-- membership_plans.active
ALTER TABLE membership_plans
  ALTER COLUMN active DROP DEFAULT,
  ALTER COLUMN active TYPE boolean USING (active = 'true'),
  ALTER COLUMN active SET DEFAULT true;

-- enrollments.active
ALTER TABLE enrollments
  ALTER COLUMN active DROP DEFAULT,
  ALTER COLUMN active TYPE boolean USING (active = 'true'),
  ALTER COLUMN active SET DEFAULT true;

-- visits.over_limit
ALTER TABLE visits
  ALTER COLUMN over_limit DROP DEFAULT,
  ALTER COLUMN over_limit TYPE boolean USING (over_limit = 'true'),
  ALTER COLUMN over_limit SET DEFAULT false;
