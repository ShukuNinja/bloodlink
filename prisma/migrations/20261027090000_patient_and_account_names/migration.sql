ALTER TABLE "User"
ADD COLUMN "name" VARCHAR(120);

ALTER TABLE "PatientNeed"
ADD COLUMN "patientName" VARCHAR(120);

-- This expression index already exists in the provisioned Supabase database.
-- Recording it here keeps fresh installs consistent with that database.
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_name_unique_ci"
ON "Organization" (lower(trim("name")));
