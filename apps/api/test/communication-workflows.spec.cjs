/* global require */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * OWNER: D4
 * PURPOSE: Verify server-side authorization and terminal-state behavior for
 * organization and PatientNeed conversations.
 * INPUT: Service calls with controlled Prisma delegate results.
 * OUTPUT: Verified membership/submitter scoping and message write boundaries.
 * AUTHORIZATION: Active hospital/blood-centre membership, or PatientNeed
 * submitter / assigned hospital membership as defined by the services.
 * DEPENDENCIES: Compiled communication services and NestJS exceptions.
 * STATE CHANGES: In-memory Prisma delegate fakes only.
 * NON-RESPONSIBILITIES: Database engine behavior or client presentation.
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  OrganizationCommunicationService,
} = require('../dist/communication/organization-communication.service');
const {
  PatientNeedCommunicationService,
} = require('../dist/communication/patient-need-communication.service');

test('hospital-to-blood-centre chat opens only for an active member and canonicalizes participants', async () => {
  const prisma = organizationPrisma({
    membershipUserId: 'member-1',
    membershipOrganizationIds: ['hospital-1', 'centre-1'],
  });
  const service = new OrganizationCommunicationService(prisma);

  const detail = await service.openForOrganizations(
    'member-1',
    'centre-1',
    'hospital-1',
  );

  assert.deepEqual(prisma.upsertInput.create, {
    participantAOrganizationId: 'centre-1',
    participantBOrganizationId: 'hospital-1',
    status: 'OPEN',
  });
  assert.equal(detail.id, 'conversation-1');
  assert.deepEqual(prisma.upsertInput.where, {
    participantAOrganizationId_participantBOrganizationId: {
      participantAOrganizationId: 'centre-1',
      participantBOrganizationId: 'hospital-1',
    },
  });
});

test('organization conversations are hidden from users without active participant membership', async () => {
  const prisma = organizationPrisma({ membershipOrganizationIds: [] });
  const service = new OrganizationCommunicationService(prisma);

  await assert.rejects(
    service.getForUser('unrelated-user', 'conversation-1'),
    (error) => error.getStatus() === 404,
  );
});

test('PatientNeed conversations reject unrelated users and keep the hospital thread private', async () => {
  const prisma = patientNeedPrisma({
    need: { submittedByUserId: 'submitter-1' },
    membershipUserId: 'hospital-member-1',
  });
  const service = new PatientNeedCommunicationService(prisma);

  await assert.rejects(
    service.getForPatientNeed('unrelated-user', 'need-1'),
    (error) => error.getStatus() === 404,
  );
  assert.equal(prisma.conversationUpsertCount, 0);
});

test('PatientNeed conversation opens for its submitter after verification', async () => {
  const prisma = patientNeedPrisma({
    need: { submittedByUserId: 'submitter-1' },
  });
  const service = new PatientNeedCommunicationService(prisma);

  const detail = await service.getForPatientNeed('submitter-1', 'need-1');

  assert.equal(detail.patientNeedId, 'need-1');
  assert.equal(detail.hospitalName, 'City Hospital');
  assert.equal(detail.status, 'OPEN');
  assert.equal(prisma.conversationUpsertCount, 1);
});

test('terminal BloodRequest closes the PatientNeed thread and blocks message writes', async () => {
  const prisma = patientNeedPrisma({
    need: {
      submittedByUserId: 'submitter-1',
      bloodRequest: { status: 'FULFILLED' },
    },
  });
  const service = new PatientNeedCommunicationService(prisma);

  await assert.rejects(
    service.createMessage('submitter-1', 'need-1', { content: 'Hello' }),
    (error) => error.getStatus() === 409,
  );
  assert.equal(prisma.createdMessageCount, 0);
  assert.equal(prisma.updatedConversationStatus, 'CLOSED');
});

function organizationPrisma({
  membershipUserId,
  membershipOrganizationIds = [],
}) {
  const organizations = new Map([
    [
      'hospital-1',
      {
        id: 'hospital-1',
        name: 'City Hospital',
        type: 'HOSPITAL',
        status: 'ACTIVE',
      },
    ],
    [
      'centre-1',
      {
        id: 'centre-1',
        name: 'River Blood Centre',
        type: 'BLOOD_CENTRE',
        status: 'ACTIVE',
      },
    ],
  ]);
  const row = {
    id: 'conversation-1',
    participantAOrganizationId: 'centre-1',
    participantBOrganizationId: 'hospital-1',
    participantA: {
      id: 'centre-1',
      name: 'River Blood Centre',
      type: 'BLOOD_CENTRE',
    },
    participantB: {
      id: 'hospital-1',
      name: 'City Hospital',
      type: 'HOSPITAL',
    },
    status: 'OPEN',
    createdAt: new Date('2026-10-26T00:00:00Z'),
    updatedAt: new Date('2026-10-26T00:00:00Z'),
    messages: [],
  };
  const prisma = {
    organization: {
      findUnique: async ({ where }) => organizations.get(where.id) ?? null,
    },
    organizationMembership: {
      findFirst: async ({ where }) => {
        if (where.userId !== membershipUserId) return null;
        const allowed = where.organizationId.in ?? [where.organizationId];
        return allowed.some((id) => membershipOrganizationIds.includes(id))
          ? { id: 'membership-1' }
          : null;
      },
    },
    organizationConversation: {
      findUnique: async () => row,
      upsert: async (input) => {
        prisma.upsertInput = input;
        return row;
      },
    },
    upsertInput: undefined,
  };
  return prisma;
}

function patientNeedPrisma({ need: overrides = {}, membershipUserId }) {
  const need = {
    id: 'need-1',
    submittedByUserId: 'submitter-1',
    hospitalId: 'hospital-1',
    status: 'VERIFIED',
    hospital: {
      id: 'hospital-1',
      name: 'City Hospital',
      type: 'HOSPITAL',
      status: 'ACTIVE',
    },
    bloodRequest: { status: 'OPEN' },
    ...overrides,
  };
  const conversation = {
    id: 'patient-conversation-1',
    patientNeedId: 'need-1',
    status: 'OPEN',
    createdAt: new Date('2026-10-26T00:00:00Z'),
    updatedAt: new Date('2026-10-26T00:00:00Z'),
  };
  const prisma = {
    patientNeed: {
      findUnique: async () => need,
    },
    organizationMembership: {
      findFirst: async ({ where }) =>
        where.userId === membershipUserId ? { id: 'membership-1' } : null,
    },
    patientNeedConversation: {
      upsert: async ({ create }) => {
        prisma.conversationUpsertCount += 1;
        if (
          !['FULFILLMENT_CONFIRMED', 'FULFILLED', 'CANCELLED'].includes(
            need.bloodRequest?.status,
          )
        ) {
          conversation.status = create.status;
        }
        return conversation;
      },
      update: async ({ data }) => {
        conversation.status = data.status;
        prisma.updatedConversationStatus = data.status;
        return conversation;
      },
    },
    patientNeedConversationMessage: {
      findMany: async () => [],
      create: async () => {
        prisma.createdMessageCount += 1;
        return { id: 'message-1' };
      },
    },
    conversationUpsertCount: 0,
    createdMessageCount: 0,
    updatedConversationStatus: undefined,
  };
  return prisma;
}
