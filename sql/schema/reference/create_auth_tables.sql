-- Auth tables for magic link login
-- Run this in your PostgreSQL database
-- All timestamps use UTC (application handles timezone display)
CREATE SCHEMA IF NOT EXISTS mandates_housekeeping;

-- Users table: stores authenticated users
-- Note: Role/reviewer status is determined dynamically by checking allowed_reviewers table
-- Entity references systemchart.entities (the shared canonical entity list)
CREATE TABLE IF NOT EXISTS
    mandates_housekeeping.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        email TEXT UNIQUE NOT NULL,
        entity TEXT REFERENCES systemchart.entities(entity) ON DELETE SET NULL ON UPDATE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
    );

-- Magic tokens for passwordless login
CREATE TABLE IF NOT EXISTS
    mandates_housekeeping.magic_tokens (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ
    );

CREATE INDEX IF NOT EXISTS idx_magic_tokens_expires ON mandates_housekeeping.magic_tokens (expires_at);

-- Index for cleanup queries (expired unused tokens)
CREATE INDEX IF NOT EXISTS idx_magic_tokens_cleanup 
    ON mandates_housekeeping.magic_tokens (expires_at) 
    WHERE used_at IS NULL;

-- Allowlist of emails that have reviewer privileges
-- Reviewer status is checked dynamically at runtime by joining with this table
-- Only users with emails in this table AND logged in as DMSPC can review any entity
CREATE TABLE IF NOT EXISTS
    mandates_housekeeping.allowed_reviewers (email TEXT PRIMARY KEY);

COMMENT ON TABLE mandates_housekeeping.allowed_reviewers IS 'Allowlist of email addresses that can have the reviewer role. Only users with emails in this table will be assigned reviewer status.';

-- Allowed email domains (un.org is always allowed)
CREATE TABLE IF NOT EXISTS
    mandates_housekeeping.allowed_domains (
        entity TEXT NOT NULL,
        domain TEXT NOT NULL,
        PRIMARY KEY (entity, domain)
    );

COMMENT ON TABLE mandates_housekeeping.allowed_domains IS 'Allowed email domains. Entity ''*'' means global (allowed for all entities).';

INSERT INTO
    mandates_housekeeping.allowed_domains (entity, domain)
VALUES
    ('*', 'un.org'),
    ('ICJ', 'icj-cij.org'),
    ('ECLAC', 'cepal.org'),
    ('ITC', 'intracen.org'),
    ('UNCTAD', 'unctad.org'),
    ('UNHCR', 'unhcr.org'),
    ('UNRWA', 'unrwa.org'),
    ('UN Women', 'unwomen.org') ON CONFLICT
DO NOTHING;

