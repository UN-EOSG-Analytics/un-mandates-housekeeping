-- Housekeeping tables for mandate decisions
-- Run this in your PostgreSQL database
-- All timestamps use UTC

CREATE SCHEMA IF NOT EXISTS mandates_housekeeping;

-- Decision event log (append-only)
-- Note: Changing a decision's reason creates a NEW record (not an UPDATE)
-- This preserves full history including "other_reason" freetext
CREATE TABLE IF NOT EXISTS mandates_housekeeping.mandate_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_symbol TEXT NOT NULL,
  entity TEXT NOT NULL REFERENCES systemchart.entities(entity) ON DELETE RESTRICT ON UPDATE CASCADE,
  subprogramme TEXT,
  
  decision TEXT NOT NULL CHECK (decision IN ('retain', 'remove', 'add', 'update', 'cancel')),
  new_symbol TEXT,  -- only for 'update' decisions
  manual_metadata JSONB,  -- for manual 'add': {title, body, year, link}
  decision_reason TEXT,  -- primary reason for the decision
  other_reason TEXT,  -- freetext explanation when reason is "other"
  
  user_email TEXT NOT NULL REFERENCES mandates_housekeeping.users(email) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  approved_by TEXT REFERENCES mandates_housekeeping.users(email) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mandate_decisions_lookup 
  ON mandates_housekeeping.mandate_decisions 
  (entity, document_symbol, COALESCE(subprogramme, ''), created_at DESC);

-- Index optimized for real-time polling: WHERE entity = $1 AND created_at > $2
CREATE INDEX IF NOT EXISTS idx_mandate_decisions_polling 
  ON mandates_housekeeping.mandate_decisions (entity, created_at DESC);

-- Index for document symbol lookup across all entities
CREATE INDEX IF NOT EXISTS idx_mandate_decisions_symbol 
  ON mandates_housekeeping.mandate_decisions (document_symbol);

COMMENT ON COLUMN mandates_housekeeping.mandate_decisions.manual_metadata IS 
  'For manual add decisions: {title, body, year, link}';
COMMENT ON COLUMN mandates_housekeeping.mandate_decisions.decision_reason IS 
  'Primary reason for the decision (from predefined list)';
COMMENT ON COLUMN mandates_housekeeping.mandate_decisions.other_reason IS 
  'Freetext explanation when reason is "other"';

-- Comments (anyone can comment)
CREATE TABLE IF NOT EXISTS mandates_housekeeping.mandate_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_symbol TEXT NOT NULL,
  entity TEXT NOT NULL REFERENCES systemchart.entities(entity) ON DELETE RESTRICT ON UPDATE CASCADE,
  subprogramme TEXT,
  
  comment TEXT NOT NULL,
  user_email TEXT NOT NULL REFERENCES mandates_housekeeping.users(email) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT REFERENCES mandates_housekeeping.users(email) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_mandate_comments_lookup 
  ON mandates_housekeeping.mandate_comments 
  (entity, document_symbol, COALESCE(subprogramme, ''), created_at DESC);

-- Index optimized for real-time polling: WHERE entity = $1 AND created_at > $2
CREATE INDEX IF NOT EXISTS idx_mandate_comments_polling 
  ON mandates_housekeeping.mandate_comments (entity, created_at DESC);

-- Partial index for unresolved comments lookup
CREATE INDEX IF NOT EXISTS idx_mandate_comments_unresolved
  ON mandates_housekeeping.mandate_comments (entity, document_symbol)
  WHERE resolved_at IS NULL;

-- DOCX uploads tracking
CREATE TABLE IF NOT EXISTS mandates_housekeeping.docx_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- File info
    filename TEXT NOT NULL,
    blob_url TEXT NOT NULL,
    blob_name TEXT NOT NULL,
    content_type TEXT DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size_bytes BIGINT,
    
    -- Context: which entity page was this uploaded from
    entity TEXT NOT NULL REFERENCES systemchart.entities(entity) ON DELETE RESTRICT ON UPDATE CASCADE,
    subprogramme TEXT,

    -- User info
    user_email TEXT NOT NULL REFERENCES mandates_housekeeping.users(email) ON DELETE RESTRICT,
    
    -- Timestamps (UTC)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Optional metadata
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_docx_uploads_entity 
    ON mandates_housekeeping.docx_uploads (entity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docx_uploads_user 
    ON mandates_housekeeping.docx_uploads (user_email, created_at DESC);

COMMENT ON TABLE mandates_housekeeping.docx_uploads IS 
  'Tracks DOCX file submissions uploaded by reviewers';
COMMENT ON COLUMN mandates_housekeeping.docx_uploads.blob_url IS 
  'Full Azure Blob Storage URL for the file';
COMMENT ON COLUMN mandates_housekeeping.docx_uploads.blob_name IS 
  'Azure blob path/name for management operations';

-- Entity review mode (locks entity for review)
CREATE TABLE IF NOT EXISTS mandates_housekeeping.entity_review_mode (
  entity TEXT PRIMARY KEY REFERENCES systemchart.entities(entity) ON DELETE RESTRICT ON UPDATE CASCADE,
  started_by TEXT NOT NULL REFERENCES mandates_housekeeping.users(email) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ended_by TEXT REFERENCES mandates_housekeeping.users(email) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_entity_review_mode_active 
  ON mandates_housekeeping.entity_review_mode (entity) 
  WHERE ended_at IS NULL;

COMMENT ON TABLE mandates_housekeeping.entity_review_mode IS 
  'Tracks when entities are under review. When started_at is set and ended_at is NULL, the entity is locked for review.';