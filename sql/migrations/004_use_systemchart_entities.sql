-- Migration: Replace mandates_housekeeping.entities with systemchart.entities
--
-- mandates_housekeeping.entities was a local copy of systemchart.entities,
-- synced manually via a one-shot INSERT...ON CONFLICT. This caused a naming
-- drift: the local copy had "UN-Women" while systemchart (and ppb2026
-- citations) used "UN Women", silently breaking data entry for that entity.
--
-- Since the app already depends on ppb2026 (which FKs to systemchart),
-- the local copy adds no isolation benefit. Removing it eliminates the
-- sync problem entirely. All FKs now use ON UPDATE CASCADE so entity
-- renames in systemchart propagate automatically.

BEGIN;

-- 1. Fix the allowed_domains entry before we drop the local entities table
UPDATE mandates_housekeeping.allowed_domains
SET entity = 'UN Women'
WHERE entity = 'UN-Women';

-- 2. Drop all FKs pointing to mandates_housekeeping.entities
ALTER TABLE mandates_housekeeping.users
  DROP CONSTRAINT users_entity_fkey;

ALTER TABLE mandates_housekeeping.mandate_decisions
  DROP CONSTRAINT mandate_decisions_entity_fkey;

ALTER TABLE mandates_housekeeping.mandate_comments
  DROP CONSTRAINT mandate_comments_entity_fkey;

ALTER TABLE mandates_housekeeping.docx_uploads
  DROP CONSTRAINT docx_uploads_entity_fkey;

ALTER TABLE mandates_housekeeping.entity_review_mode
  DROP CONSTRAINT entity_review_mode_entity_fkey;

ALTER TABLE mandates_housekeeping.review_change_responses
  DROP CONSTRAINT review_change_responses_entity_fkey;

-- 3. Drop the local entities table
DROP TABLE mandates_housekeeping.entities;

-- 4. Re-create FKs pointing to systemchart.entities, with ON UPDATE CASCADE
ALTER TABLE mandates_housekeeping.users
  ADD CONSTRAINT users_entity_fkey
  FOREIGN KEY (entity) REFERENCES systemchart.entities(entity)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE mandates_housekeeping.mandate_decisions
  ADD CONSTRAINT mandate_decisions_entity_fkey
  FOREIGN KEY (entity) REFERENCES systemchart.entities(entity)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE mandates_housekeeping.mandate_comments
  ADD CONSTRAINT mandate_comments_entity_fkey
  FOREIGN KEY (entity) REFERENCES systemchart.entities(entity)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE mandates_housekeeping.docx_uploads
  ADD CONSTRAINT docx_uploads_entity_fkey
  FOREIGN KEY (entity) REFERENCES systemchart.entities(entity)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE mandates_housekeeping.entity_review_mode
  ADD CONSTRAINT entity_review_mode_entity_fkey
  FOREIGN KEY (entity) REFERENCES systemchart.entities(entity)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE mandates_housekeeping.review_change_responses
  ADD CONSTRAINT review_change_responses_entity_fkey
  FOREIGN KEY (entity) REFERENCES systemchart.entities(entity)
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
