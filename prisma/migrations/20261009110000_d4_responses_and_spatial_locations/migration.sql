-- Preserve the D2 hospital coordinates in canonical PostGIS geography before dropping the old columns.
-- Keep D2's existing hospital-coordinate integrity rule. Fail before any DDL if
-- legacy data violates it; coordinates must come from an authoritative source.
DO $$
DECLARE
    missing_hospital_coordinates BIGINT;
BEGIN
    SELECT COUNT(*) INTO missing_hospital_coordinates
    FROM "Organization"
    WHERE "type" = 'HOSPITAL'
      AND ("latitude" IS NULL OR "longitude" IS NULL);

    IF missing_hospital_coordinates > 0 THEN
        RAISE EXCEPTION
            'D4 location migration stopped: % hospital organization(s) have missing coordinates. Resolve from an authoritative source before retrying.',
            missing_hospital_coordinates;
    END IF;
END $$;
ALTER TABLE "Organization" ADD COLUMN "location" geography(Point,4326);
UPDATE "Organization"
SET "location" = ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography
WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
ALTER TABLE "Organization"
    DROP CONSTRAINT IF EXISTS "Organization_latitude_range_check",
    DROP CONSTRAINT IF EXISTS "Organization_longitude_range_check",
    DROP CONSTRAINT IF EXISTS "Organization_coordinates_pair_check",
    DROP CONSTRAINT IF EXISTS "Organization_hospital_coordinates_check",
    DROP COLUMN "latitude",
    DROP COLUMN "longitude";
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_hospital_location_check"
    CHECK ("type" <> 'HOSPITAL' OR "location" IS NOT NULL);
CREATE INDEX "Organization_location_gist_idx" ON "Organization" USING GIST ("location");

CREATE TYPE "DonorAvailabilityStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE');
CREATE TYPE "DonorNotificationPreference" AS ENUM ('ALL', 'URGENT_ONLY', 'CRITICAL_ONLY', 'NONE');
CREATE TYPE "DonorCoordinationStatus" AS ENUM ('ACTIVE', 'PAUSED');
CREATE TYPE "CoordinationResponseStatus" AS ENUM ('NOTIFIED', 'ACCEPTED', 'WITHDRAWN', 'EXPIRED');
CREATE TYPE "HospitalSubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED');
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "PushPlatform" AS ENUM ('MOBILE_ANDROID', 'MOBILE_IOS', 'WEB');

CREATE TABLE "DonorProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bloodGroup" "PatientNeedBloodGroup" NOT NULL,
    "availabilityStatus" "DonorAvailabilityStatus" NOT NULL,
    "notificationPreference" "DonorNotificationPreference" NOT NULL,
    "location" geography(Point,4326),
    "lastConfirmedDonationAt" TIMESTAMPTZ(6),
    "eligibleFrom" TIMESTAMPTZ(6),
    "coordinationStatus" "DonorCoordinationStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "DonorProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DonorProfile_userId_key" ON "DonorProfile"("userId");
CREATE INDEX "DonorProfile_availabilityStatus_coordinationStatus_idx" ON "DonorProfile"("availabilityStatus", "coordinationStatus");
CREATE INDEX "DonorProfile_location_gist_idx" ON "DonorProfile" USING GIST ("location");

CREATE TABLE "DonorResponse" (
    "id" UUID NOT NULL,
    "bloodRequestId" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "status" "CoordinationResponseStatus" NOT NULL,
    "respondedAt" TIMESTAMPTZ(6),
    "confirmedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "DonorResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DonorResponse_bloodRequestId_donorId_key" ON "DonorResponse"("bloodRequestId", "donorId");
CREATE INDEX "DonorResponse_donorId_status_idx" ON "DonorResponse"("donorId", "status");

CREATE TABLE "OrganizationResponse" (
    "id" UUID NOT NULL,
    "bloodRequestId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "status" "CoordinationResponseStatus" NOT NULL,
    "respondedAt" TIMESTAMPTZ(6),
    "confirmedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "OrganizationResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationResponse_bloodRequestId_organizationId_key" ON "OrganizationResponse"("bloodRequestId", "organizationId");
CREATE INDEX "OrganizationResponse_organizationId_status_idx" ON "OrganizationResponse"("organizationId", "status");

CREATE TABLE "HospitalSubscription" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "status" "HospitalSubscriptionStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "HospitalSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HospitalSubscription_hospitalId_donorId_key" ON "HospitalSubscription"("hospitalId", "donorId");
CREATE INDEX "HospitalSubscription_donorId_status_idx" ON "HospitalSubscription"("donorId", "status");

CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "endpoint" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(6),
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_enabled_idx" ON "PushSubscription"("userId", "enabled");

CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "bloodRequestId" UUID NOT NULL,
    "donorId" UUID,
    "organizationId" UUID,
    "status" "ConversationStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Conversation_responder_xor_check" CHECK (("donorId" IS NOT NULL) <> ("organizationId" IS NOT NULL))
);
CREATE UNIQUE INDEX "Conversation_bloodRequestId_donorId_key" ON "Conversation"("bloodRequestId", "donorId");
CREATE UNIQUE INDEX "Conversation_bloodRequestId_organizationId_key" ON "Conversation"("bloodRequestId", "organizationId");
CREATE INDEX "Conversation_bloodRequestId_status_idx" ON "Conversation"("bloodRequestId", "status");

CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ(6),
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

CREATE TABLE "DonationRecord" (
    "id" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "bloodRequestId" UUID NOT NULL,
    "confirmedAt" TIMESTAMPTZ(6) NOT NULL,
    "confirmedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DonationRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DonationRecord_donorId_confirmedAt_idx" ON "DonationRecord"("donorId", "confirmedAt");
CREATE INDEX "DonationRecord_bloodRequestId_idx" ON "DonationRecord"("bloodRequestId");

ALTER TABLE "DonorProfile" ADD CONSTRAINT "DonorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DonorResponse" ADD CONSTRAINT "DonorResponse_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DonorResponse" ADD CONSTRAINT "DonorResponse_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "DonorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationResponse" ADD CONSTRAINT "OrganizationResponse_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationResponse" ADD CONSTRAINT "OrganizationResponse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HospitalSubscription" ADD CONSTRAINT "HospitalSubscription_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalSubscription" ADD CONSTRAINT "HospitalSubscription_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "DonorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "DonorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DonationRecord" ADD CONSTRAINT "DonationRecord_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "DonorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DonationRecord" ADD CONSTRAINT "DonationRecord_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DonationRecord" ADD CONSTRAINT "DonationRecord_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- D3 owns assignment state; D4 only adds foreign keys to D4 response records.
ALTER TABLE "ResponderAssignment" ADD CONSTRAINT "ResponderAssignment_donorResponseId_fkey" FOREIGN KEY ("donorResponseId") REFERENCES "DonorResponse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResponderAssignment" ADD CONSTRAINT "ResponderAssignment_organizationResponseId_fkey" FOREIGN KEY ("organizationResponseId") REFERENCES "OrganizationResponse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
