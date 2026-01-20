-- Add decision reason tracking to mandate_decisions
-- Stores the primary reason for retain/update/remove decisions

ALTER TABLE mandates_housekeeping.mandate_decisions
ADD COLUMN IF NOT EXISTS decision_reason TEXT,
ADD COLUMN IF NOT EXISTS other_reason TEXT;  -- For "Other" category with freetext

COMMENT ON COLUMN mandates_housekeeping.mandate_decisions.decision_reason IS 'Primary reason for the decision (from predefined list)';
COMMENT ON COLUMN mandates_housekeeping.mandate_decisions.other_reason IS 'Freetext explanation when reason is "other"';

