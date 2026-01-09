-- Toggle david.pomerenke@un.org entity between PPBD and DGACM
UPDATE mandates_housekeeping.users 
SET entity = CASE 
  WHEN entity = 'PPBD' THEN 'DGACM' 
  ELSE 'PPBD' 
END
WHERE email = 'david.pomerenke@un.org'
RETURNING email, entity AS new_entity;

-- Also toggle PPBD reviewer status to match
DELETE FROM mandates_housekeeping.ppbd_reviewers WHERE email = 'david.pomerenke@un.org';
INSERT INTO mandates_housekeeping.ppbd_reviewers (email)
SELECT 'david.pomerenke@un.org'
WHERE (SELECT entity FROM mandates_housekeeping.users WHERE email = 'david.pomerenke@un.org') = 'PPBD'
ON CONFLICT DO NOTHING;

-- Check current status:
SELECT u.email, u.entity, 
       CASE WHEN p.email IS NOT NULL THEN 'ppbd reviewer' ELSE 'focal point' END AS role
FROM mandates_housekeeping.users u
LEFT JOIN mandates_housekeeping.ppbd_reviewers p ON u.email = p.email
WHERE u.email = 'david.pomerenke@un.org';
