/* global require */
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { Reflector } = require('@nestjs/core');
const { AdminController } = require('../dist/admin/admin.controller');
const { AdminService } = require('../dist/admin/admin.service');
const { RolesGuard } = require('../dist/auth/guards/roles.guard');

describe('admin dashboard', () => {
  it('returns aggregate counts without exposing account or donor details', async () => {
    const countCalls = [];
    const delegate = (name) => ({
      count: async (args = {}) => {
        countCalls.push([name, args.where ?? {}]);
        return countCalls.length;
      },
    });
    const service = new AdminService({
      user: delegate('user'),
      organization: delegate('organization'),
      patientNeed: delegate('patientNeed'),
      bloodRequest: delegate('bloodRequest'),
      donorProfile: delegate('donorProfile'),
      donorResponse: delegate('donorResponse'),
      organizationResponse: delegate('organizationResponse'),
      hospitalSubscription: delegate('hospitalSubscription'),
      donationRecord: delegate('donationRecord'),
    });

    const metrics = await service.getMetrics();

    assert.equal(typeof metrics.generatedAt, 'string');
    assert.deepEqual(metrics.accounts, {
      total: 1,
      individuals: 2,
      admins: 3,
      active: 4,
      suspended: 5,
    });
    assert.deepEqual(metrics.organizations, {
      total: 6,
      hospitals: 7,
      bloodCentres: 8,
      active: 9,
      suspended: 10,
    });
    assert.deepEqual(metrics.workflows, {
      patientNeeds: 11,
      bloodRequests: 12,
      individualResponders: 13,
      donorResponses: 14,
      organizationResponses: 15,
      hospitalSubscriptions: 16,
      donationRecords: 17,
    });
    assert.equal(Object.hasOwn(metrics, 'email'), false);
    assert.equal(countCalls.length, 17);
  });

  it('protects metrics with the Admin role', async () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector, {
      userHasRole: async (user, role) => user.role === role,
    });
    const context = (role) => ({
      getHandler: () => AdminController.prototype.getMetrics,
      getClass: () => AdminController,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u', role } }) }),
    });

    assert.equal(await guard.canActivate(context('ADMIN')), true);
    await assert.rejects(
      guard.canActivate(context('INDIVIDUAL')),
      (error) => error.getStatus() === 403,
    );
  });

  it('lists only safe current account and organization fields with pagination', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    let accountQuery;
    let organizationQuery;
    const service = new AdminService({
      user: {
        findMany: async (query) => {
          accountQuery = query;
          return [
            {
              id: 'account-id',
              email: 'hospital@example.com',
              role: 'INDIVIDUAL',
              status: 'ACTIVE',
              createdAt,
              updatedAt: createdAt,
              memberships: [
                {
                  role: 'HOSPITAL_ADMIN',
                  status: 'ACTIVE',
                  organization: {
                    id: 'organization-id',
                    name: 'City Hospital',
                    type: 'HOSPITAL',
                    status: 'ACTIVE',
                  },
                },
              ],
            },
          ];
        },
        count: async () => 21,
      },
      organization: {
        findMany: async (query) => {
          organizationQuery = query;
          return [
            {
              id: 'organization-id',
              name: 'City Hospital',
              type: 'HOSPITAL',
              status: 'ACTIVE',
              createdAt,
              updatedAt: createdAt,
              _count: { memberships: 1 },
            },
          ];
        },
        count: async () => 1,
      },
    });

    const accounts = await service.listAccounts({ page: 2, pageSize: 10 });
    const organizations = await service.listOrganizations({ page: 1 });

    assert.equal(accountQuery.skip, 10);
    assert.equal(accountQuery.take, 10);
    assert.equal(Object.hasOwn(accountQuery.select, 'passwordHash'), false);
    assert.equal(accounts.meta.totalPages, 3);
    assert.deepEqual(accounts.data[0].organizations[0], {
      id: 'organization-id',
      name: 'City Hospital',
      type: 'HOSPITAL',
      status: 'ACTIVE',
      role: 'HOSPITAL_ADMIN',
      membershipStatus: 'ACTIVE',
    });
    assert.equal(organizationQuery.skip, 0);
    assert.equal(organizations.data[0].memberCount, 1);
  });
});
