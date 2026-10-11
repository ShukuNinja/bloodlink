-- Restore spatial indexes removed by the schema-sync migration.
CREATE INDEX IF NOT EXISTS "Organization_location_gist_idx"
ON "Organization" USING GIST ("location");

CREATE INDEX IF NOT EXISTS "DonorProfile_location_gist_idx"
ON "DonorProfile" USING GIST ("location");
