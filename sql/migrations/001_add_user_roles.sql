-- Migration: Add role-based permissions for DMSPC reviewers
-- This migration adds a role column and automatically sets DMSPC users as reviewers

-- Add role column to users table
ALTER TABLE mandates_housekeeping.users 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' 
CHECK (role IN ('user', 'reviewer', 'admin'));

-- Set existing DMSPC users as reviewers
UPDATE mandates_housekeeping.users
SET role = 'reviewer'
WHERE UPPER(entity) = 'DMSPC';

-- Set all other existing users as regular users
UPDATE mandates_housekeeping.users
SET role = 'user'
WHERE role IS NULL AND UPPER(entity) != 'DMSPC';

-- Create function to automatically set role based on entity
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

-- Create trigger to automatically set role on insert or update
DROP TRIGGER IF EXISTS set_user_role_trigger ON mandates_housekeeping.users;
CREATE TRIGGER set_user_role_trigger
  BEFORE INSERT OR UPDATE OF entity ON mandates_housekeeping.users
  FOR EACH ROW
  EXECUTE FUNCTION mandates_housekeeping.set_user_role();

-- Verify the migration
SELECT 
  entity, 
  role, 
  COUNT(*) as user_count 
FROM mandates_housekeeping.users 
GROUP BY entity, role 
ORDER BY entity;
