-- CreateEnum
CREATE TYPE "OrganizationMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- AlterTable
ALTER TABLE "OrganizationMembership"
ADD COLUMN "status" "OrganizationMembershipStatus" NOT NULL DEFAULT 'ACTIVE';
