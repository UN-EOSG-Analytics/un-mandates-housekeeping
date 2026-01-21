-- Auth tables for magic link login
-- Run this in your PostgreSQL database
-- All timestamps default to New York timezone

CREATE SCHEMA IF NOT EXISTS mandates_housekeeping;

-- Users table: stores authenticated users
-- Note: Role/reviewer status is determined dynamically by checking allowed_reviewers table
CREATE TABLE IF NOT EXISTS mandates_housekeeping.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  entity TEXT,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/New_York'),
  last_login_at TIMESTAMPTZ
);

-- Magic tokens for passwordless login
CREATE TABLE IF NOT EXISTS mandates_housekeeping.magic_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_magic_tokens_expires ON mandates_housekeeping.magic_tokens (expires_at);

-- Allowlist of emails that have reviewer privileges
-- Reviewer status is checked dynamically at runtime by joining with this table
-- Only users with emails in this table AND logged in as DMSPC can review any entity
CREATE TABLE IF NOT EXISTS mandates_housekeeping.allowed_reviewers (
    email TEXT PRIMARY KEY
);

COMMENT ON TABLE mandates_housekeeping.allowed_reviewers IS 
  'Allowlist of email addresses that can have the reviewer role. Only users with emails in this table will be assigned reviewer status.';

