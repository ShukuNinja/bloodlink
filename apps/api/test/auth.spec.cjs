/* global require, process, fetch, console */
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, before, describe, it } = require('node:test');
const { Test } = require('@nestjs/testing');
const { ForbiddenException } = require('@nestjs/common');
const { PrismaService } = require('../dist/database/prisma.service');
const { AuthService, hashToken } = require('../dist/auth/auth.service');
const { RolesGuard } = require('../dist/auth/guards/roles.guard');
const {
  OrganizationMembershipGuard,
} = require('../dist/auth/guards/organization-membership.guard');
const { configureApi } = require('../dist/http/configure-api');
const bcrypt = require('bcryptjs');
const { JwtService } = require('@nestjs/jwt');

process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3001';
process.env.DATABASE_URL ??=
  'postgresql://bloodlink_test:bloodlink_test@127.0.0.1:5432/bloodlink_test?schema=public';
process.env.JWT_ACCESS_SECRET ??=
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.JWT_REFRESH_SECRET ??=
  'test-refresh-secret-that-is-also-over-32-characters';
process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';

let app;
let baseUrl;
let store;
let authService;
let jwt;

before(async () => {
  const { AppModule } = require('../dist/app.module');
  store = new MemoryAuthStore();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(store)
    .compile();

  app = moduleRef.createNestApplication({ logger: false });
  configureApi(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
  authService = app.get(AuthService);
  jwt = app.get(JwtService);
});

after(async () => {
  await app?.close();
});

describe('authentication endpoints', () => {
  it('registers normalized email and returns no password hash', async () => {
    const response = await post('/auth/register', {
      email: '  Test.User@Example.COM ',
      password: 'a-safe-test-password',
    });
    const body = await response.json();
    const user = store.users.find(
      (candidate) => candidate.email === 'test.user@example.com',
    );

    assert.equal(response.status, 201);
    assert.deepEqual(body.data.user, {
      id: user.id,
      email: 'test.user@example.com',
      status: 'ACTIVE',
      role: 'INDIVIDUAL',
      organizations: [],
    });
    assert.equal(Object.hasOwn(body.data.user, 'passwordHash'), false);
    assert.notEqual(user.passwordHash, 'a-safe-test-password');
    assert.equal(
      await bcrypt.compare('a-safe-test-password', user.passwordHash),
      true,
    );
    assert.ok(body.data.accessToken);
    assert.ok(body.data.refreshToken);
    assert.equal(body.data.tokenType, 'Bearer');
    assert.deepEqual(Object.keys(jwt.decode(body.data.accessToken)).sort(), [
      'exp',
      'iat',
      'sub',
    ]);
  });

  it('rejects duplicate normalized email addresses', async () => {
    const response = await post('/auth/register', {
      email: 'TEST.USER@example.com',
      password: 'a-safe-test-password',
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'CONFLICT',
        message: 'Conflict',
      },
    });
  });

  it('registers a hospital and creates its administrator membership atomically', async () => {
    const response = await post('/auth/register', {
      email: 'hospital@example.com',
      password: 'a-safe-test-password',
      accountType: 'HOSPITAL',
      organizationName: 'City Hospital',
      location: { latitude: 12.9716, longitude: 77.5946 },
    });
    const body = (await response.json()).data;
    const user = store.users.find(
      (candidate) => candidate.email === 'hospital@example.com',
    );
    const organization = store.organizations.find(
      (candidate) => candidate.name === 'City Hospital',
    );

    assert.equal(response.status, 201);
    assert.equal(user.role, 'INDIVIDUAL');
    assert.deepEqual(body.user.organizations, [
      {
        id: organization.id,
        name: 'City Hospital',
        type: 'HOSPITAL',
        role: 'HOSPITAL_ADMIN',
      },
    ]);
    assert.equal(store.memberships[0].userId, user.id);
    assert.deepEqual(organization.location, {
      latitude: 12.9716,
      longitude: 77.5946,
    });
  });

  it('allows an explicitly selected Admin account at registration', async () => {
    const response = await post('/auth/register', {
      email: 'admin-self-register@example.com',
      password: 'a-safe-test-password',
      accountType: 'ADMIN',
    });
    const body = (await response.json()).data;

    assert.equal(response.status, 201);
    assert.equal(body.user.role, 'ADMIN');
    assert.deepEqual(body.user.organizations, []);
  });

  it('requires an organization name for hospital and blood bank registration', async () => {
    for (const accountType of ['HOSPITAL', 'BLOOD_CENTRE']) {
      const response = await post('/auth/register', {
        email: `${accountType.toLowerCase()}-missing-name@example.com`,
        password: 'a-safe-test-password',
        accountType,
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
    }
  });

  it('requires valid coordinates for organization registration', async () => {
    for (const location of [undefined, { latitude: 91, longitude: 0 }]) {
      const response = await post('/auth/register', {
        email: `organization-location-${randomUUID()}@example.com`,
        password: 'a-safe-test-password',
        accountType: 'BLOOD_CENTRE',
        organizationName: 'North Blood Centre',
        ...(location ? { location } : {}),
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
    }
  });

  it('uses one generic response for unknown email and incorrect password', async () => {
    const unknown = await post('/auth/login', {
      email: 'nobody@example.com',
      password: 'a-safe-test-password',
    });
    const incorrect = await post('/auth/login', {
      email: 'test.user@example.com',
      password: 'incorrect-password',
    });

    assert.equal(unknown.status, 401);
    assert.equal(incorrect.status, 401);
    const unknownBody = await unknown.json();
    const incorrectBody = await incorrect.json();
    assert.deepEqual(unknownBody, incorrectBody);
    assert.equal(incorrectBody.error.message, 'Unauthorized');
  });

  it('does not authenticate a suspended user', async () => {
    const user = store.users.find(
      (candidate) => candidate.email === 'test.user@example.com',
    );
    user.status = 'SUSPENDED';
    const response = await post('/auth/login', {
      email: user.email,
      password: 'a-safe-test-password',
    });
    user.status = 'ACTIVE';

    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.message, 'Unauthorized');
  });

  it('logs in and serves /auth/me only with an active bearer token', async () => {
    const login = await post('/auth/login', {
      email: 'test.user@example.com',
      password: 'a-safe-test-password',
    });
    const tokens = (await login.json()).data;
    const unauthorized = await fetch(`${baseUrl}/api/v1/auth/me`);
    const authenticated = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    assert.equal(login.status, 200);
    assert.equal(unauthorized.status, 401);
    assert.equal((await unauthorized.json()).error.code, 'UNAUTHORIZED');
    assert.equal(authenticated.status, 200);
    assert.deepEqual((await authenticated.json()).data, {
      id: store.users[0].id,
      email: 'test.user@example.com',
      status: 'ACTIVE',
      role: 'INDIVIDUAL',
      organizations: [],
    });
  });

  it('rotates refresh tokens and rejects a used token', async () => {
    const initial = await post('/auth/login', {
      email: 'test.user@example.com',
      password: 'a-safe-test-password',
    });
    const originalToken = (await initial.json()).data.refreshToken;
    const storedOriginal = store.refreshTokens.find(
      (token) => token.tokenHash === hashToken(originalToken),
    );
    assert.ok(storedOriginal);
    assert.notEqual(storedOriginal.tokenHash, originalToken);

    const rotated = await post('/auth/refresh', {
      refreshToken: originalToken,
    });
    const rotatedTokens = (await rotated.json()).data;
    const reused = await post('/auth/refresh', { refreshToken: originalToken });

    assert.equal(rotated.status, 200);
    assert.notEqual(rotatedTokens.refreshToken, originalToken);
    assert.ok(storedOriginal.revokedAt);
    assert.equal(reused.status, 401);
  });

  it('rolls back refresh-token revocation when replacement creation fails', async () => {
    const initial = await post('/auth/login', {
      email: 'test.user@example.com',
      password: 'a-safe-test-password',
    });
    const originalToken = (await initial.json()).data.refreshToken;
    const originalHash = hashToken(originalToken);
    const storedOriginal = store.refreshTokens.find(
      (token) => token.tokenHash === originalHash,
    );
    assert.ok(storedOriginal);
    assert.equal(storedOriginal.revokedAt, null);

    store.failNextRefreshCreate = true;
    const failedRefresh = await post('/auth/refresh', {
      refreshToken: originalToken,
    });

    assert.equal(failedRefresh.status, 500);
    assert.ok(storedOriginal.revokedAt);
    const rolledBackOriginal = store.refreshTokens.find(
      (token) => token.tokenHash === originalHash,
    );
    assert.ok(rolledBackOriginal);
    assert.equal(rolledBackOriginal.revokedAt, null);

    const retry = await post('/auth/refresh', { refreshToken: originalToken });
    assert.equal(retry.status, 200);
  });

  it('revokes the refresh token on logout', async () => {
    const login = await post('/auth/login', {
      email: 'test.user@example.com',
      password: 'a-safe-test-password',
    });
    const refreshToken = (await login.json()).data.refreshToken;
    const logout = await post('/auth/logout', { refreshToken });
    const reuse = await post('/auth/refresh', { refreshToken });

    assert.equal(logout.status, 200);
    assert.deepEqual((await logout.json()).data, { loggedOut: true });
    assert.equal(reuse.status, 401);
  });

  it('rejects client supplied role and organization fields at registration', async () => {
    const response = await post('/auth/register', {
      email: 'role-attack@example.com',
      password: 'a-safe-test-password',
      role: 'ADMIN',
      organizationId: randomUUID(),
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
    assert.equal(
      store.users.some((user) => user.email === 'role-attack@example.com'),
      false,
    );
  });

  it('uses configured secrets and does not log passwords or tokens', async () => {
    const capturedLogs = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    console.log = (...values) => capturedLogs.push(values.join(' '));
    console.warn = (...values) => capturedLogs.push(values.join(' '));
    console.error = (...values) => capturedLogs.push(values.join(' '));
    let response;
    try {
      response = await post('/auth/login', {
        email: 'test.user@example.com',
        password: 'a-safe-test-password',
      });
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
    const authData = (await response.json()).data;
    const user = store.users[0];

    assert.ok(user.passwordHash);
    assert.equal(
      jwt.verify(authData.accessToken, {
        secret: process.env.JWT_ACCESS_SECRET,
      }).sub,
      user.id,
    );
    assert.throws(() =>
      jwt.verify(authData.accessToken, {
        secret: 'a-different-secret-with-over-32-characters',
      }),
    );
    assert.equal(
      store.refreshTokens.every(
        (token) =>
          token.tokenHash.length === 64 &&
          token.tokenHash !== authData.refreshToken,
      ),
      true,
    );
    assert.equal(
      JSON.stringify(authData).includes(process.env.JWT_ACCESS_SECRET),
      false,
    );
    assert.equal(
      capturedLogs.some(
        (line) =>
          line.includes('a-safe-test-password') ||
          line.includes(authData.accessToken) ||
          line.includes(authData.refreshToken),
      ),
      false,
    );
  });
});

describe('authorization primitives', () => {
  it('returns 403 for an authenticated user without a required role', async () => {
    const user = await authService.authenticateAccessToken(
      (
        await (
          await post('/auth/login', {
            email: 'test.user@example.com',
            password: 'a-safe-test-password',
          })
        ).json()
      ).data.accessToken,
    );
    const guard = new RolesGuard(
      { getAllAndOverride: () => ['ADMIN'] },
      authService,
    );

    await assert.rejects(
      guard.canActivate(makeContext({ user })),
      (error) =>
        error instanceof ForbiddenException && error.getStatus() === 403,
    );
  });

  it('allows a matching platform role', async () => {
    const user = await authService.authenticateAccessToken(
      (
        await (
          await post('/auth/login', {
            email: 'test.user@example.com',
            password: 'a-safe-test-password',
          })
        ).json()
      ).data.accessToken,
    );
    const guard = new RolesGuard(
      { getAllAndOverride: () => ['INDIVIDUAL'] },
      authService,
    );

    assert.equal(await guard.canActivate(makeContext({ user })), true);
  });

  it('checks organization membership against the requested organization in the database', async () => {
    const user = await authService.authenticateAccessToken(
      (
        await (
          await post('/auth/login', {
            email: 'test.user@example.com',
            password: 'a-safe-test-password',
          })
        ).json()
      ).data.accessToken,
    );
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    store.organizations.push({
      id: organizationId,
      type: 'HOSPITAL',
      status: 'ACTIVE',
    });
    store.memberships.push({
      id: randomUUID(),
      userId: user.id,
      organizationId,
      role: 'HOSPITAL_STAFF',
      status: 'ACTIVE',
    });
    const guard = new OrganizationMembershipGuard(
      { getAllAndOverride: () => ['HOSPITAL_STAFF'] },
      authService,
    );

    assert.equal(
      await guard.canActivate(
        makeContext({ user, params: { organizationId } }),
      ),
      true,
    );
    const membership = store.memberships.find(
      (item) =>
        item.userId === user.id && item.organizationId === organizationId,
    );
    assert.ok(membership);
    for (const status of ['SUSPENDED', 'REVOKED']) {
      membership.status = status;
      await assert.rejects(
        guard.canActivate(makeContext({ user, params: { organizationId } })),
        (error) =>
          error instanceof ForbiddenException && error.getStatus() === 403,
      );
      assert.equal(await authService.userHasRole(user, 'HOSPITAL'), false);
      assert.equal(
        await authService.userHasRole(user, 'HOSPITAL_STAFF'),
        false,
      );
    }
    membership.status = 'ACTIVE';
    assert.equal(await authService.userHasRole(user, 'HOSPITAL'), true);
    assert.equal(await authService.userHasRole(user, 'HOSPITAL_STAFF'), true);
    await assert.rejects(
      guard.canActivate(
        makeContext({
          user,
          params: { organizationId: otherOrganizationId },
          body: { organizationId },
        }),
      ),
      (error) =>
        error instanceof ForbiddenException && error.getStatus() === 403,
    );
  });
});

function post(path, body) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeContext(request) {
  return {
    getHandler: () => ({}),
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

function MemoryAuthStore() {
  this.users = [];
  this.refreshTokens = [];
  this.organizations = [];
  this.memberships = [];
  this.failNextRefreshCreate = false;

  this.user = {
    findUnique: async ({ where }) =>
      this.users.find(
        (user) => user.id === where.id || user.email === where.email,
      ) ?? null,
    create: async ({ data }) => {
      if (this.users.some((user) => user.email === data.email)) {
        throw { code: 'P2002' };
      }
      const user = {
        id: randomUUID(),
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.users.push(user);
      return user;
    },
  };

  this.refreshToken = {
    create: async ({ data }) => {
      if (this.failNextRefreshCreate) {
        this.failNextRefreshCreate = false;
        throw new Error('Simulated replacement token creation failure');
      }
      const token = {
        id: randomUUID(),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.refreshTokens.push(token);
      return token;
    },
    findUnique: async ({ where, include }) => {
      const token = this.refreshTokens.find(
        (item) => item.tokenHash === where.tokenHash,
      );
      if (!token) return null;
      return include?.user
        ? {
            ...token,
            user: this.users.find((user) => user.id === token.userId),
          }
        : token;
    },
    updateMany: async ({ where, data }) => {
      const token = this.refreshTokens.find(
        (item) =>
          item.id === where.id &&
          (!Object.hasOwn(where, 'revokedAt') ||
            item.revokedAt === where.revokedAt) &&
          (!where.expiresAt?.gt || item.expiresAt > where.expiresAt.gt),
      );
      if (!token) return { count: 0 };
      Object.assign(token, data);
      return { count: 1 };
    },
    deleteMany: async ({ where }) => {
      const originalCount = this.refreshTokens.length;
      this.refreshTokens = this.refreshTokens.filter(
        (item) =>
          !(where.OR ?? []).some(
            (condition) =>
              (condition.revokedAt?.not === null && item.revokedAt !== null) ||
              (condition.expiresAt?.lte &&
                item.expiresAt <= condition.expiresAt.lte),
          ),
      );
      return { count: originalCount - this.refreshTokens.length };
    },
  };

  this.organizationMembership = {
    findMany: async ({ where }) =>
      this.memberships
        .filter((item) => {
          const org = this.organizations.find(
            (organization) => organization.id === item.organizationId,
          );
          return (
            item.userId === where.userId &&
            item.status === where.status &&
            org?.status === where.organization.status
          );
        })
        .map((item) => {
          const organization = this.organizations.find(
            (org) => org.id === item.organizationId,
          );
          return {
            role: item.role,
            organization: {
              id: organization.id,
              name: organization.name,
              type: organization.type,
            },
          };
        }),
    findFirst: async ({ where, include, select }) => {
      const member = this.memberships.find((item) => {
        const org = this.organizations.find(
          (organization) => organization.id === item.organizationId,
        );
        return (
          item.userId === where.userId &&
          (!where.status || item.status === where.status) &&
          (!where.organizationId ||
            item.organizationId === where.organizationId) &&
          matchesRole(item.role, where.role) &&
          (!where.organization?.status ||
            org?.status === where.organization.status) &&
          (!where.organization?.type || org?.type === where.organization.type)
        );
      });
      if (!member) return null;
      if (select) return { id: member.id };
      if (include?.organization) {
        return {
          ...member,
          organization: this.organizations.find(
            (org) => org.id === member.organizationId,
          ),
        };
      }
      return member;
    },
  };

  this.organization = {
    create: async ({ data }) => {
      const organization = {
        id: randomUUID(),
        status: 'ACTIVE',
        ...data,
      };
      this.organizations.push(organization);
      return organization;
    },
  };

  this.$executeRaw = async (
    _query,
    organizationId,
    name,
    type,
    longitude,
    latitude,
  ) => {
    this.organizations.push({
      id: organizationId,
      name,
      type,
      status: 'ACTIVE',
      location: { latitude, longitude },
    });
    return 1;
  };

  this.organizationMembership.create = async ({ data }) => {
    const membership = {
      id: randomUUID(),
      status: 'ACTIVE',
      ...data,
    };
    this.memberships.push(membership);
    return membership;
  };

  this.verifyConnection = async () => {};
  this.$transaction = async (callback) => {
    const snapshot = {
      users: this.users.map((item) => ({ ...item })),
      refreshTokens: this.refreshTokens.map((item) => ({ ...item })),
      organizations: this.organizations.map((item) => ({ ...item })),
      memberships: this.memberships.map((item) => ({ ...item })),
    };
    try {
      return await callback(this);
    } catch (error) {
      this.users = snapshot.users;
      this.refreshTokens = snapshot.refreshTokens;
      this.organizations = snapshot.organizations;
      this.memberships = snapshot.memberships;
      throw error;
    }
  };
}

function matchesRole(actual, filter) {
  if (!filter) return true;
  if (typeof filter === 'string') return actual === filter;
  return filter.in?.includes(actual) ?? true;
}
