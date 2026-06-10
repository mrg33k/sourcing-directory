-- Migration 024: Fix hardcoded event organizer + link placeholder values
--
-- Issue: All event records (category='event') in directory_listings were created
-- with hardcoded placeholder values:
--  - organizer field: "space rising" (should be actual organizer)
--  - virtual_url field: "kinetics aerospace" (should be actual URLs or null)
--
-- Fix: Clear the hardcoded placeholder values to null so users can see actual event data
-- (or delete test events if they were never meant to be live).

-- Option A: Clear placeholders to null (preserves event records, shows missing data)
UPDATE directory_listings
SET
  organizer = NULL,
  virtual_url = NULL
WHERE
  category = 'event'
  AND status = 'active'
  AND (
    (organizer = 'space rising' OR organizer = 'Space Rising')
    OR virtual_url = 'kinetics aerospace'
  );

-- Option B: Delete test events (commented out — use only if these are test/demo events)
-- DELETE FROM directory_listings
-- WHERE
--   category = 'event'
--   AND (organizer = 'space rising' OR organizer = 'Space Rising' OR virtual_url = 'kinetics aerospace');
