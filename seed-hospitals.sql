-- BloodLink dev seed: four ACTIVE hospitals in Chennai (approximate real coordinates, demo only).
-- Idempotent: running it more than once will not create duplicates.

BEGIN;

INSERT INTO "Organization" ("id", "name", "type", "status", "createdAt", "updatedAt", "location")
SELECT gen_random_uuid(), 'Rajiv Gandhi Government General Hospital', 'HOSPITAL', 'ACTIVE', now(), now(),
       ST_SetSRID(ST_MakePoint(80.2730, 13.0827), 4326)::geography
WHERE NOT EXISTS (SELECT 1 FROM "Organization" WHERE "name" = 'Rajiv Gandhi Government General Hospital');

INSERT INTO "Organization" ("id", "name", "type", "status", "createdAt", "updatedAt", "location")
SELECT gen_random_uuid(), 'Government Multi Super Speciality Hospital', 'HOSPITAL', 'ACTIVE', now(), now(),
       ST_SetSRID(ST_MakePoint(80.2637, 13.0538), 4326)::geography
WHERE NOT EXISTS (SELECT 1 FROM "Organization" WHERE "name" = 'Government Multi Super Speciality Hospital');

INSERT INTO "Organization" ("id", "name", "type", "status", "createdAt", "updatedAt", "location")
SELECT gen_random_uuid(), 'Government Kilpauk Medical College Hospital', 'HOSPITAL', 'ACTIVE', now(), now(),
       ST_SetSRID(ST_MakePoint(80.2416, 13.0732), 4326)::geography
WHERE NOT EXISTS (SELECT 1 FROM "Organization" WHERE "name" = 'Government Kilpauk Medical College Hospital');

INSERT INTO "Organization" ("id", "name", "type", "status", "createdAt", "updatedAt", "location")
SELECT gen_random_uuid(), 'Government Stanley Medical College Hospital', 'HOSPITAL', 'ACTIVE', now(), now(),
       ST_SetSRID(ST_MakePoint(80.2941, 13.1085), 4326)::geography
WHERE NOT EXISTS (SELECT 1 FROM "Organization" WHERE "name" = 'Government Stanley Medical College Hospital');

COMMIT;

-- Verify: should show 4 hospitals.
SELECT "name", "status", ST_AsText("location"::geometry) AS point
FROM "Organization"
WHERE "type" = 'HOSPITAL'
ORDER BY "name";
