-- CreateEnum
CREATE TYPE "PatientNeedBloodGroup" AS ENUM (
    'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
    'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'
);

-- CreateEnum
CREATE TYPE "PatientNeedComponent" AS ENUM (
    'WHOLE_BLOOD', 'RED_BLOOD_CELLS', 'PLATELETS', 'PLASMA'
);

-- CreateEnum
CREATE TYPE "PatientNeedUrgency" AS ENUM ('ROUTINE', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PatientNeedStatus" AS ENUM (
    'PENDING_HOSPITAL_REVIEW', 'VERIFIED', 'REJECTED', 'CANCELLED'
);

-- AlterTable
ALTER TABLE "Organization"
    ADD COLUMN "latitude" DECIMAL(9,6),
    ADD COLUMN "longitude" DECIMAL(9,6),
    ADD CONSTRAINT "Organization_latitude_range_check"
        CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
    ADD CONSTRAINT "Organization_longitude_range_check"
        CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
    ADD CONSTRAINT "Organization_coordinates_pair_check"
        CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
    ADD CONSTRAINT "Organization_hospital_coordinates_check"
        CHECK ("type" <> 'HOSPITAL' OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL));

-- CreateTable
CREATE TABLE "PatientNeed" (
    "id" UUID NOT NULL,
    "submittedByUserId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "bloodGroup" "PatientNeedBloodGroup" NOT NULL,
    "component" "PatientNeedComponent" NOT NULL,
    "units" INTEGER NOT NULL,
    "urgency" "PatientNeedUrgency" NOT NULL,
    "requiredBy" TIMESTAMPTZ(6) NOT NULL,
    "additionalNotes" TEXT NOT NULL,
    "status" "PatientNeedStatus" NOT NULL DEFAULT 'PENDING_HOSPITAL_REVIEW',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PatientNeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientNeed_submittedByUserId_createdAt_idx"
    ON "PatientNeed"("submittedByUserId", "createdAt");
CREATE INDEX "PatientNeed_hospitalId_status_idx"
    ON "PatientNeed"("hospitalId", "status");

-- AddForeignKey
ALTER TABLE "PatientNeed"
    ADD CONSTRAINT "PatientNeed_submittedByUserId_fkey"
    FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientNeed"
    ADD CONSTRAINT "PatientNeed_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
