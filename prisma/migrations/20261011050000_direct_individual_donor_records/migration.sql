-- Bind donor participation and confirmed donations to the Individual account.
-- Existing profile-backed records are preserved by backfilling the owner ID.

ALTER TABLE "DonorResponse" ADD COLUMN "userId" UUID;
UPDATE "DonorResponse" AS response
SET "userId" = profile."userId"
FROM "DonorProfile" AS profile
WHERE response."donorId" = profile."id";
ALTER TABLE "DonorResponse" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "DonorResponse" DROP CONSTRAINT "DonorResponse_donorId_fkey";
DROP INDEX "DonorResponse_bloodRequestId_donorId_key";
DROP INDEX "DonorResponse_donorId_status_idx";
ALTER TABLE "DonorResponse" ADD CONSTRAINT "DonorResponse_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "DonorResponse_bloodRequestId_userId_key"
  ON "DonorResponse"("bloodRequestId", "userId");
CREATE INDEX "DonorResponse_userId_status_idx"
  ON "DonorResponse"("userId", "status");
ALTER TABLE "DonorResponse" DROP COLUMN "donorId";

ALTER TABLE "Conversation" ADD COLUMN "donorUserId" UUID;
UPDATE "Conversation" AS conversation
SET "donorUserId" = profile."userId"
FROM "DonorProfile" AS profile
WHERE conversation."donorId" = profile."id";
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_donorId_fkey";
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_responder_xor_check";
DROP INDEX "Conversation_bloodRequestId_donorId_key";
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_donorUserId_fkey"
  FOREIGN KEY ("donorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_responder_xor_check"
  CHECK (("donorUserId" IS NOT NULL) <> ("organizationId" IS NOT NULL));
CREATE UNIQUE INDEX "Conversation_bloodRequestId_donorUserId_key"
  ON "Conversation"("bloodRequestId", "donorUserId");
ALTER TABLE "Conversation" DROP COLUMN "donorId";

ALTER TABLE "HospitalSubscription" ADD COLUMN "userId" UUID;
UPDATE "HospitalSubscription" AS subscription
SET "userId" = profile."userId"
FROM "DonorProfile" AS profile
WHERE subscription."donorId" = profile."id";
ALTER TABLE "HospitalSubscription" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "HospitalSubscription" DROP CONSTRAINT "HospitalSubscription_donorId_fkey";
DROP INDEX "HospitalSubscription_hospitalId_donorId_key";
DROP INDEX "HospitalSubscription_donorId_status_idx";
ALTER TABLE "HospitalSubscription" ADD CONSTRAINT "HospitalSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "HospitalSubscription_hospitalId_userId_key"
  ON "HospitalSubscription"("hospitalId", "userId");
CREATE INDEX "HospitalSubscription_userId_status_idx"
  ON "HospitalSubscription"("userId", "status");
ALTER TABLE "HospitalSubscription" DROP COLUMN "donorId";

ALTER TABLE "DonationRecord" ADD COLUMN "donorUserId" UUID;
UPDATE "DonationRecord" AS donation
SET "donorUserId" = profile."userId"
FROM "DonorProfile" AS profile
WHERE donation."donorId" = profile."id";
ALTER TABLE "DonationRecord" ALTER COLUMN "donorUserId" SET NOT NULL;
ALTER TABLE "DonationRecord" DROP CONSTRAINT "DonationRecord_donorId_fkey";
DROP INDEX "DonationRecord_donorId_confirmedAt_idx";
ALTER TABLE "DonationRecord" ADD CONSTRAINT "DonationRecord_donorUserId_fkey"
  FOREIGN KEY ("donorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "DonationRecord_donorUserId_confirmedAt_idx"
  ON "DonationRecord"("donorUserId", "confirmedAt");
ALTER TABLE "DonationRecord" DROP COLUMN "donorId";
