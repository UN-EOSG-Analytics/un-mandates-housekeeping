-- Add resolution fields to comments table
-- This allows reviewer comments to be marked as resolved

ALTER TABLE mandates_housekeeping.mandate_comments 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resolved_by TEXT;

-- Add index for querying unresolved comments
CREATE INDEX IF NOT EXISTS idx_mandate_comments_unresolved 
  ON mandates_housekeeping.mandate_comments (entity, document_symbol)
  WHERE resolved_at IS NULL;
