-- Migration: Add docx_uploads table for tracking reviewer DOCX submissions
-- Run this in your PostgreSQL database

-- Table for tracking DOCX file uploads by reviewers
CREATE TABLE IF NOT EXISTS mandates_housekeeping.docx_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- File info
    filename TEXT NOT NULL,
    blob_url TEXT NOT NULL,
    blob_name TEXT NOT NULL,  -- Azure blob path/name for deletion
    content_type TEXT DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size_bytes BIGINT,
    
    -- Context: which entity page was this uploaded from
    entity TEXT NOT NULL,
    subprogramme TEXT,  -- optional, if uploaded from a specific subprogramme section
    
    -- User info
    user_email TEXT NOT NULL,
    user_entity TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Optional metadata (for any extra info)
    metadata JSONB
);

-- Index for looking up uploads by entity
CREATE INDEX IF NOT EXISTS idx_docx_uploads_entity 
    ON mandates_housekeeping.docx_uploads (entity, created_at DESC);

-- Index for looking up uploads by user
CREATE INDEX IF NOT EXISTS idx_docx_uploads_user 
    ON mandates_housekeeping.docx_uploads (user_email, created_at DESC);

COMMENT ON TABLE mandates_housekeeping.docx_uploads IS 'Tracks DOCX file submissions uploaded by reviewers';
COMMENT ON COLUMN mandates_housekeeping.docx_uploads.blob_url IS 'Full Azure Blob Storage URL for the file';
COMMENT ON COLUMN mandates_housekeeping.docx_uploads.blob_name IS 'Azure blob path/name for management operations';
