-- URGENT: Apply this migration to fix experiments
-- This adds the missing columns that are preventing experiments from being created

-- Connect to your Postgres database and run these commands:

ALTER TABLE experiments ADD COLUMN IF NOT EXISTS cloaked_url TEXT;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS target_url TEXT;

-- Verify the columns were added:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'experiments'
AND column_name IN ('cloaked_url', 'target_url');

-- You should see:
--  column_name  | data_type
-- --------------+-----------
--  cloaked_url  | text
--  target_url   | text
