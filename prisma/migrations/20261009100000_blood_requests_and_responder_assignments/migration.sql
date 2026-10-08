-- CreateEnum
CREATE TYPE "BloodRequestStatus" AS ENUM (
    'OPEN',
    'RESPONSES_RECEIVED',
    'COVERED',
    'COORDINATING',
    'BACKUP_REQUIRED',
    'FULFILLMENT_PENDING',
    'FULFILLMENT_CONFIRMED',
    'FULFILLED',
    'CANCELLED'
);

-- CreateEnum
CREATE TYPE "ResponderAssignmentState" AS ENUM ('SELECTED', 'STANDBY', 'RELEASED');

-- CreateTable
CREATE TABLE "BloodRequest" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "patientNeedId" UUID NOT NULL,
    "bloodGroup" "PatientNeedBloodGroup" NOT NULL,
    "component" "PatientNeedComponent" NOT NULL,
    "unitsRequired" INTEGER NOT NULL,
    "urgency" "PatientNeedUrgency" NOT NULL,
    "requiredBy" TIMESTAMPTZ(6) NOT NULL,
    "status" "BloodRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BloodRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponderAssignment" (
    "id" UUID NOT NULL,
    "bloodRequestId" UUID NOT NULL,
    "donorResponseId" UUID,
    "organizationResponseId" UUID,
    "state" "ResponderAssignmentState" NOT NULL,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ResponderAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResponderAssignment_response_xor_check"
        CHECK (("donorResponseId" IS NOT NULL) <> ("organizationResponseId" IS NOT NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "BloodRequest_patientNeedId_key" ON "BloodRequest"("patientNeedId");
CREATE INDEX "BloodRequest_hospitalId_createdAt_idx" ON "BloodRequest"("hospitalId", "createdAt");
CREATE INDEX "BloodRequest_hospitalId_status_idx" ON "BloodRequest"("hospitalId", "status");
CREATE INDEX "ResponderAssignment_bloodRequestId_state_idx" ON "ResponderAssignment"("bloodRequestId", "state");
CREATE INDEX "ResponderAssignment_donorResponseId_idx" ON "ResponderAssignment"("donorResponseId");
CREATE INDEX "ResponderAssignment_organizationResponseId_idx" ON "ResponderAssignment"("organizationResponseId");

-- AddForeignKey
ALTER TABLE "BloodRequest"
    ADD CONSTRAINT "BloodRequest_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BloodRequest"
    ADD CONSTRAINT "BloodRequest_patientNeedId_fkey"
    FOREIGN KEY ("patientNeedId") REFERENCES "PatientNeed"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResponderAssignment"
    ADD CONSTRAINT "ResponderAssignment_bloodRequestId_fkey"
    FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- donorResponseId and organizationResponseId intentionally have no foreign keys
-- until D4 owns and integrates those response models. The XOR check protects
-- the D3 assignment's one-responder-type invariant in the meantime.
