-- Toggle david.pomerenke@un.org as PPBD reviewer (add if missing, remove if present)
WITH deleted AS (
  DELETE FROM mandates_housekeeping.ppbd_reviewers 
  WHERE email = 'david.pomerenke@un.org'
  RETURNING email
)
INSERT INTO mandates_housekeeping.ppbd_reviewers (email)
SELECT 'david.pomerenke@un.org'
WHERE NOT EXISTS (SELECT 1 FROM deleted)
RETURNING 'now ppbd' AS status;

-- Check current status:
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM mandates_housekeeping.ppbd_reviewers WHERE email = 'david.pomerenke@un.org'
) THEN 'ppbd' ELSE 'focal' END AS current_role;

