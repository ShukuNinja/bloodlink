-- Generalize hospital subscriptions to all active organizations while
-- preserving existing user-to-hospital subscription rows.
ALTER TABLE "HospitalSubscription" RENAME TO "OrganizationSubscription";
ALTER TABLE "OrganizationSubscription" RENAME COLUMN "hospitalId" TO "organizationId";
ALTER TABLE "OrganizationSubscription"
  RENAME CONSTRAINT "HospitalSubscription_pkey" TO "OrganizationSubscription_pkey";
ALTER TABLE "OrganizationSubscription"
  RENAME CONSTRAINT "HospitalSubscription_hospitalId_fkey" TO "OrganizationSubscription_organizationId_fkey";
ALTER TABLE "OrganizationSubscription"
  RENAME CONSTRAINT "HospitalSubscription_userId_fkey" TO "OrganizationSubscription_userId_fkey";
ALTER INDEX "HospitalSubscription_hospitalId_userId_key"
  RENAME TO "OrganizationSubscription_organizationId_userId_key";
ALTER INDEX "HospitalSubscription_userId_status_idx"
  RENAME TO "OrganizationSubscription_userId_status_idx";
CREATE INDEX "OrganizationSubscription_organizationId_status_idx"
  ON "OrganizationSubscription"("organizationId", "status");

-- Direct organization-to-organization conversations are independent of
-- request-scoped hospital/responder conversations.
CREATE TABLE "OrganizationConversation" (
  "id" UUID NOT NULL,
  "participantAOrganizationId" UUID NOT NULL,
  "participantBOrganizationId" UUID NOT NULL,
  "status" "ConversationStatus" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "OrganizationConversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationConversation_distinct_participants_check"
    CHECK ("participantAOrganizationId" <> "participantBOrganizationId")
);
CREATE UNIQUE INDEX "OrganizationConversation_participantAOrganizationId_participantBOrganizationId_key"
  ON "OrganizationConversation"("participantAOrganizationId", "participantBOrganizationId");
CREATE INDEX "OrganizationConversation_participantAOrganizationId_status_idx"
  ON "OrganizationConversation"("participantAOrganizationId", "status");
CREATE INDEX "OrganizationConversation_participantBOrganizationId_status_idx"
  ON "OrganizationConversation"("participantBOrganizationId", "status");

CREATE TABLE "OrganizationConversationMessage" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "senderId" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMPTZ(6),
  CONSTRAINT "OrganizationConversationMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrganizationConversationMessage_conversationId_createdAt_idx"
  ON "OrganizationConversationMessage"("conversationId", "createdAt");

ALTER TABLE "OrganizationConversation"
  ADD CONSTRAINT "OrganizationConversation_participantAOrganizationId_fkey"
  FOREIGN KEY ("participantAOrganizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationConversation"
  ADD CONSTRAINT "OrganizationConversation_participantBOrganizationId_fkey"
  FOREIGN KEY ("participantBOrganizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationConversationMessage"
  ADD CONSTRAINT "OrganizationConversationMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "OrganizationConversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationConversationMessage"
  ADD CONSTRAINT "OrganizationConversationMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- PatientNeed submitters and the assigned hospital coordinate in a separate
-- private thread. It is not shared with the selected donor/blood centre chat.
CREATE TABLE "PatientNeedConversation" (
  "id" UUID NOT NULL,
  "patientNeedId" UUID NOT NULL,
  "status" "ConversationStatus" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "PatientNeedConversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PatientNeedConversation_patientNeedId_key"
  ON "PatientNeedConversation"("patientNeedId");
CREATE TABLE "PatientNeedConversationMessage" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "senderId" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMPTZ(6),
  CONSTRAINT "PatientNeedConversationMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PatientNeedConversationMessage_conversationId_createdAt_idx"
  ON "PatientNeedConversationMessage"("conversationId", "createdAt");
ALTER TABLE "PatientNeedConversation"
  ADD CONSTRAINT "PatientNeedConversation_patientNeedId_fkey"
  FOREIGN KEY ("patientNeedId") REFERENCES "PatientNeed"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientNeedConversationMessage"
  ADD CONSTRAINT "PatientNeedConversationMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "PatientNeedConversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientNeedConversationMessage"
  ADD CONSTRAINT "PatientNeedConversationMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
