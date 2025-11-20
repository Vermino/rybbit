-- Add cloakedUrl and targetUrl columns to experiments table
-- Run this migration if you get errors about missing columns

ALTER TABLE experiments ADD COLUMN IF NOT EXISTS cloaked_url TEXT;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS target_url TEXT;

-- Update existing experiments.variants jsonb to support new fields
-- (No migration needed - JSONB is schema-less)

COMMENT ON COLUMN experiments.cloaked_url IS 'For URL redirect tests - the URL visitors access';
COMMENT ON COLUMN experiments.target_url IS 'For visual tests - the page to modify';
