-- Auth tables for magic link login
-- Run this in your PostgreSQL database

CREATE SCHEMA IF NOT EXISTS mandates_housekeeping;

CREATE TABLE IF NOT EXISTS mandates_housekeeping.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  entity TEXT,
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

