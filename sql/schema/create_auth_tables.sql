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

-- Automatically set role based on entity
-- DMSPC users are reviewers, all others are regular users
CREATE OR REPLACE FUNCTION mandates_housekeeping.set_user_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entity IS NOT NULL THEN
    IF UPPER(NEW.entity) = 'DMSPC' THEN
      NEW.role := 'reviewer';
    ELSE
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

