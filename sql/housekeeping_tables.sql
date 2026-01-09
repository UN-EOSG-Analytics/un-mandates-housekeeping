-- Housekeeping tables for mandate decisions
-- Run this in your PostgreSQL database

CREATE SCHEMA IF NOT EXISTS mandates_housekeeping;

-- PPBD reviewers (everyone else with @un.org is a focal point)
CREATE TABLE IF NOT EXISTS mandates_housekeeping.ppbd_reviewers (
  email TEXT PRIMARY KEY
);

-- Decision event log (append-only)
CREATE TABLE IF NOT EXISTS mandates_housekeeping.mandate_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_symbol TEXT NOT NULL,
  entity TEXT NOT NULL,
  subprogramme TEXT,
  
  decision TEXT NOT NULL CHECK (decision IN ('retain', 'remove', 'add', 'update')),
  new_symbol TEXT,  -- only for 'update' decisions
  
  user_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mandate_decisions_lookup 
  ON mandates_housekeeping.mandate_decisions 
  (entity, document_symbol, COALESCE(subprogramme, ''), created_at DESC);

-- Comments (anyone can comment)
CREATE TABLE IF NOT EXISTS mandates_housekeeping.mandate_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_symbol TEXT NOT NULL,
  entity TEXT NOT NULL,
  subprogramme TEXT,
  
  comment TEXT NOT NULL,
  user_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mandate_comments_lookup 
  ON mandates_housekeeping.mandate_comments 
  (entity, document_symbol, COALESCE(subprogramme, ''), created_at DESC);
