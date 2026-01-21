-- Auth tables for magic link login
-- Run this in your PostgreSQL database

CREATE SCHEMA IF NOT EXISTS mandates_housekeeping;

CREATE TABLE IF NOT EXISTS mandates_housekeeping.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  entity TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'reviewer', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mandates_housekeeping.magic_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_magic_tokens_expires ON mandates_housekeeping.magic_tokens (expires_at);

-- Table to store allowed reviewer emails (allowlist)
-- Only users with emails in this table AND logged in as DMSPC can review any entity
CREATE TABLE IF NOT EXISTS mandates_housekeeping.allowed_reviewers (
    email TEXT PRIMARY KEY,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by TEXT,
    notes TEXT
);

-- Automatically set role based on allowed_reviewers table
-- Users must be in the allowlist to get reviewer role
CREATE OR REPLACE FUNCTION mandates_housekeeping.set_user_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user's email is in the allowed_reviewers list
    IF EXISTS (
        SELECT 1 
        FROM mandates_housekeeping.allowed_reviewers 
        WHERE LOWER(email) = LOWER(NEW.email)
    ) THEN
        NEW.role := 'reviewer';
    ELSE
        -- Default to 'user' if not in allowlist
        IF NEW.role IS NULL OR NEW.role = 'reviewer' THEN
            NEW.role := 'user';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_role_trigger ON mandates_housekeeping.users;
CREATE TRIGGER set_user_role_trigger
  BEFORE INSERT OR UPDATE OF entity ON mandates_housekeeping.users
  FOR EACH ROW
  EXECUTE FUNCTION mandates_housekeeping.set_user_role();

