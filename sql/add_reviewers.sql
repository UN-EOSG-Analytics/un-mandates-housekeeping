-- Add allowed reviewers
INSERT INTO
    mandates_housekeeping.allowed_reviewers (email)
VALUES
    -- ADD HERE
    ON CONFLICT (email)
DO NOTHING;