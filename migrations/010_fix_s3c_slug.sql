-- Fix S3C tenant slug: sc3-semiconductor -> s3c-semiconductor
-- The brand was renamed from SC3 to S3C but the slug was never updated

UPDATE directory_tenants SET slug = 's3c-semiconductor' WHERE slug = 'sc3-semiconductor';
