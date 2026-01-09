-- Migration: Drop old tables and create new simplified schema
-- Run this in your PostgreSQL database

-- Drop old tables if they exist
DROP TABLE IF EXISTS mandates_housekeeping.mandate_entries;
DROP TABLE IF EXISTS mandates_housekeeping.mandate_additions;
DROP TABLE IF EXISTS mandates_housekeeping.mandate_decisions;

-- PPBD reviewers (everyone else with @un.org is a focal point)
CREATE TABLE IF NOT EXISTS mandates_housekeeping.ppbd_reviewers (
  email TEXT PRIMARY KEY
);

-- Decision event log (append-only)
CREATE TABLE mandates_housekeeping.mandate_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_symbol TEXT NOT NULL,
  entity TEXT NOT NULL,
  subprogramme TEXT,
  
  decision TEXT NOT NULL CHECK (decision IN ('retain', 'remove', 'add', 'update')),
  new_symbol TEXT,  -- only for 'update' decisions
  
  user_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mandate_decisions_lookup 
  ON mandates_housekeeping.mandate_decisions 
  (entity, document_symbol, COALESCE(subprogramme, ''), created_at DESC);

