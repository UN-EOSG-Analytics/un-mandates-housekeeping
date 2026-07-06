-- Migration: Create a dedicated database role for the app
--
-- The app currently connects with the server admin account via DATABASE_URL.
-- This creates mandates_housekeeping_app, a least-privilege login role scoped
-- to what the app actually queries (see src/lib/db/db.ts and the API routes):
--
--   mandates_housekeeping  read/write (app's own schema)
--   ppb2026                read-only  (budget documents, citations)
--   systemchart.entities   read-only  (canonical entity list)
--   public.documents       read-only
--   public.issuing_bodies  read-only
--
-- The role has no DDL rights anywhere; migrations keep running as the
-- admin/owner role. Default privileges make future tables created by the
-- migration-running role visible to the app automatically.
--
-- The password is not stored in this file. Run the migration with:
--   psql -v app_password='<secret>' -f sql/migrations/005_create_app_role.sql
--
-- Afterwards, update the app's DATABASE_URL (Vercel env var) to connect as
-- mandates_housekeeping_app.

BEGIN;

CREATE ROLE mandates_housekeeping_app LOGIN PASSWORD :'app_password';

COMMENT ON ROLE mandates_housekeeping_app IS 'Application role for the mandates-housekeeping app (read/write on mandates_housekeeping, read-only elsewhere). No DDL rights.';

-- Schema access
GRANT USAGE ON SCHEMA mandates_housekeeping TO mandates_housekeeping_app;
GRANT USAGE ON SCHEMA ppb2026 TO mandates_housekeeping_app;
GRANT USAGE ON SCHEMA systemchart TO mandates_housekeeping_app;
GRANT USAGE ON SCHEMA public TO mandates_housekeeping_app;

-- App's own schema: full DML
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mandates_housekeeping
  TO mandates_housekeeping_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA mandates_housekeeping
  TO mandates_housekeeping_app;

-- Read-only dependencies
GRANT SELECT ON ALL TABLES IN SCHEMA ppb2026 TO mandates_housekeeping_app;
GRANT SELECT ON systemchart.entities TO mandates_housekeeping_app;
GRANT SELECT ON public.documents TO mandates_housekeeping_app;
GRANT SELECT ON public.issuing_bodies TO mandates_housekeeping_app;

-- Grants for future objects created by the role running this migration,
-- so tables added by later migrations don't silently break for the app.
ALTER DEFAULT PRIVILEGES IN SCHEMA mandates_housekeeping
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mandates_housekeeping_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA mandates_housekeeping
  GRANT USAGE, SELECT ON SEQUENCES TO mandates_housekeeping_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA ppb2026
  GRANT SELECT ON TABLES TO mandates_housekeeping_app;

COMMIT;
