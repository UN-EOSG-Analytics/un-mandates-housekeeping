-- Housekeeping tables for mandate entries (decisions + additions)
-- Run this in your PostgreSQL database

CREATE SCHEMA IF NOT EXISTS mandates_housekeeping;

-- Combined table for decisions on existing mandates AND user-added entries
CREATE TABLE IF NOT EXISTS mandates_housekeeping.mandate_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_symbol TEXT NOT NULL,
  entity TEXT NOT NULL,
  subprogramme TEXT,

  -- If user-added (null = existing from PPB data)
  added_by TEXT,
  added_at TIMESTAMPTZ,

  -- Focal point decision
  focal_decision TEXT CHECK (focal_decision IN ('retain', 'remove', 'update')),
  focal_new_symbol TEXT,
  focal_decided_by TEXT,
  focal_decided_at TIMESTAMPTZ,

  -- PPBD staff decision
  ppbd_decision TEXT CHECK (ppbd_decision IN ('retain', 'remove', 'update')),
  ppbd_new_symbol TEXT,
  ppbd_decided_by TEXT,
  ppbd_decided_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mandate_entries_unique 
  ON mandates_housekeeping.mandate_entries (document_symbol, entity, COALESCE(subprogramme, ''));
