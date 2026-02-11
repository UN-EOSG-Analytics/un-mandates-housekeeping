-- Migration: Add review baseline tracking for persistent change indicators
-- This enables tracking of decisions made during reviews vs. outside reviews,
-- and persists change indicators for all users to see.

-- 1. Restructure entity_review_mode to support review history
-- Change from entity-as-primary-key to id-as-primary-key

-- First, add the id column if it doesn't exist
ALTER TABLE mandates_housekeeping.entity_review_mode 
ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Backfill any NULL ids (for existing rows)
UPDATE mandates_housekeeping.entity_review_mode 
SET id = gen_random_uuid() WHERE id IS NULL;

-- Make id NOT NULL
ALTER TABLE mandates_housekeeping.entity_review_mode 
ALTER COLUMN id SET NOT NULL;

-- Drop the old primary key on entity
ALTER TABLE mandates_housekeeping.entity_review_mode 
DROP CONSTRAINT IF EXISTS entity_review_mode_pkey;

-- Add id as the new primary key
ALTER TABLE mandates_housekeeping.entity_review_mode 
ADD PRIMARY KEY (id);

-- Add unique constraint on id for foreign key references (in case migration runs partially)
ALTER TABLE mandates_housekeeping.entity_review_mode 
DROP CONSTRAINT IF EXISTS entity_review_mode_id_unique;

-- Re-add the foreign key to entities table (it was lost when we dropped primary key)
ALTER TABLE mandates_housekeeping.entity_review_mode 
DROP CONSTRAINT IF EXISTS entity_review_mode_entity_fkey;
ALTER TABLE mandates_housekeeping.entity_review_mode 
ADD CONSTRAINT entity_review_mode_entity_fkey 
FOREIGN KEY (entity) REFERENCES mandates_housekeeping.entities(entity) ON DELETE RESTRICT;

-- Create index for finding active reviews efficiently
DROP INDEX IF EXISTS mandates_housekeeping.idx_entity_review_mode_active;
CREATE INDEX idx_entity_review_mode_active 
ON mandates_housekeeping.entity_review_mode(entity, started_at DESC) 
WHERE ended_at IS NULL;

-- Create index for finding recent completed reviews
CREATE INDEX IF NOT EXISTS idx_entity_review_mode_recent 
ON mandates_housekeeping.entity_review_mode(entity, ended_at DESC) 
WHERE ended_at IS NOT NULL;

-- 2. Add review_session_id to mandate_decisions
-- Decisions made during a review will have this set
ALTER TABLE mandates_housekeeping.mandate_decisions 
ADD COLUMN IF NOT EXISTS review_session_id uuid 
REFERENCES mandates_housekeeping.entity_review_mode(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mandate_decisions_review_session 
ON mandates_housekeeping.mandate_decisions(review_session_id) 
WHERE review_session_id IS NOT NULL;

COMMENT ON COLUMN mandates_housekeeping.mandate_decisions.review_session_id IS 
'Links to the review session during which this decision was made. NULL means decision was made outside of review mode.';

-- 3. Create table to track responses to review changes (accept/revert)
CREATE TABLE IF NOT EXISTS mandates_housekeeping.review_change_responses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    entity text NOT NULL REFERENCES mandates_housekeeping.entities(entity) ON DELETE RESTRICT,
    document_symbol text NOT NULL,
    subprogramme text,
    review_session_id uuid NOT NULL REFERENCES mandates_housekeeping.entity_review_mode(id) ON DELETE CASCADE,
    response_type text NOT NULL CHECK (response_type IN ('accept', 'revert')),
    responded_by text NOT NULL REFERENCES mandates_housekeeping.users(email) ON DELETE RESTRICT,
    responded_at timestamp with time zone DEFAULT NOW(),
    -- For revert, store the decision that was created to restore the baseline
    revert_decision_id uuid REFERENCES mandates_housekeeping.mandate_decisions(id) ON DELETE SET NULL,
    comment text, -- Optional comment explaining the response
    created_at timestamp with time zone DEFAULT NOW()
);

-- Unique constraint: one response per document per review session
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_change_responses_unique 
ON mandates_housekeeping.review_change_responses(
    entity, document_symbol, COALESCE(subprogramme, ''), review_session_id
);

-- Index for efficient lookups by review session
CREATE INDEX IF NOT EXISTS idx_review_change_responses_session 
ON mandates_housekeeping.review_change_responses(review_session_id);

COMMENT ON TABLE mandates_housekeeping.review_change_responses IS 
'Tracks user responses to review changes (accept/revert). One response per document per review session.';

-- 4. Add index for efficient baseline lookups
-- Finding decisions before a review started (by created_at)
CREATE INDEX IF NOT EXISTS idx_mandate_decisions_entity_created 
ON mandates_housekeeping.mandate_decisions(entity, created_at DESC);
