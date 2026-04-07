-- Hide Biotech and Defense directories from the site (not launching these yet)
-- Data is preserved, just set to inactive so they don't appear in tenant listings

UPDATE directory_tenants SET status = 'inactive' WHERE slug IN ('az-biotech', 'az-defense');
