/* global require, process, fetch */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * OWNER: D4
 * PURPOSE: End-to-end behavior for the D4 coordination boundary — donor
 * profiles, donor/organization responses, matching and hospital
 * subscriptions, notification composition/tiering, request-scoped
 * communication, and the donation/D3 ownership boundary.
 * ENDPOINT/METHOD: GET/PATCH /donor-profile, GET /donor/blood-requests[/:id],
 * POST /blood-requests/:id/accept|withdraw, GET /blood-centre/blood-requests[/:id],
 * POST /blood-requests/:id/organization-response[/withdraw],
 * POST/DELETE /hospitals/:id/subscription, GET /hospital-subscriptions,
 * GET /blood-requests/:id/conversation, POST /blood-requests/:id/messages.
 * INPUT: Authenticated HTTP requests against the compiled Nest application.
 * OUTPUT: Verified state transitions, authorization, privacy boundaries,
 * spatial emulation of the PostGIS radius predicates, and proof that D4
 * never mutates D3-owned BloodRequest/ResponderAssignment state.
 * AUTHORIZATION: INDIVIDUAL donors own their profiles/responses; ACTIVE
 * BLOOD_CENTRE members respond as organizations; conversations are limited
 * to the request hospital and its single selected responder.
 * DEPENDENCIES: AppModule with PrismaService overridden by an in-memory
 * relational store that emulates the Prisma calls and spatial raw SQL the
 * D4 services issue (ST_DWithin/ST_Distance via haversine emulation).
 * STATE CHANGES: In-memory only.
 * NON-RESPONSIBILITIES: Real PostGIS execution (no database engine in the
 * sandbox); medical eligibility.
 */

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, before, describe, it } = require('node:test');
const { Test } = require('@nestjs/testing');
const { PrismaService } = require('../dist/database/prisma.service');
const { configureApi } = require('../dist/http/configure-api');

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
let moduleRef;
let baseUrl;
let store;

let hannaToken; // HOSPITAL_ADMIN @ City Hospital
let rexToken; // BLOOD_CENTRE_STAFF @ River Blood Centre
let doraToken; // donor, A+, near City Hospital
let danaToken; // donor, A+, ~55 km out, subscriber
let ninaToken; // donor, A+, near, CRITICAL_ONLY preference
let omarToken; // donor, A+, near, coordination PAUSED
let peteToken; // donor, B+, near (group mismatch)
let quinnToken; // donor, A+, near, PAUSED subscription
let zoeToken; // unrelated individual

let cityHospitalId;
let northHospitalId;
let riverCentreId;
let lakeCentreId;
let suspendedHospitalId;

let hannaUserId;
let rexUserId;
let zoeUserId;

before(async () => {
  const { AppModule } = require('../dist/app.module');
  store = new MemoryD4Store();
  moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(store)
    .compile();

  app = moduleRef.createNestApplication({ logger: false });
  configureApi(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();

  cityHospitalId = randomUUID();
  northHospitalId = randomUUID();
  riverCentreId = randomUUID();
  lakeCentreId = randomUUID();
  suspendedHospitalId = randomUUID();

  store.organizations.push(
    {
      id: cityHospitalId,
      name: 'City Hospital',
      type: 'HOSPITAL',
      status: 'ACTIVE',
    },
    {
      id: northHospitalId,
      name: 'North Hospital',
      type: 'HOSPITAL',
      status: 'ACTIVE',
    },
    {
      id: riverCentreId,
      name: 'River Blood Centre',
      type: 'BLOOD_CENTRE',
      status: 'ACTIVE',
    },
    {
      id: lakeCentreId,
      name: 'Lake Blood Centre',
      type: 'BLOOD_CENTRE',
      status: 'ACTIVE',
    },
    {
      id: suspendedHospitalId,
      name: 'Suspended Hospital',
      type: 'HOSPITAL',
      status: 'SUSPENDED',
    },
  );

  // Canonical hospital geographies (PostGIS emulation).
  store.hospitalLocations.set(cityHospitalId, {
    latitude: 13.0827,
    longitude: 80.2707,
  });
  store.hospitalLocations.set(northHospitalId, {
    latitude: 28.6139,
    longitude: 77.209,
  });

  hannaToken = await registerAndLogin('hanna@city.example.com');
  rexToken = await registerAndLogin('rex@river.example.com');
  doraToken = await registerAndLogin('dora@donor.example.com');
  danaToken = await registerAndLogin('dana@donor.example.com');
  ninaToken = await registerAndLogin('nina@donor.example.com');
  omarToken = await registerAndLogin('omar@donor.example.com');
  peteToken = await registerAndLogin('pete@donor.example.com');
  quinnToken = await registerAndLogin('quinn@donor.example.com');
  zoeToken = await registerAndLogin('zoe@individual.example.com');

  const userIds = {};
  for (const user of store.users) userIds[user.email] = user.id;
  hannaUserId = userIds['hanna@city.example.com'];
  rexUserId = userIds['rex@river.example.com'];
  zoeUserId = userIds['zoe@individual.example.com'];

  store.organizationMemberships.push(
    membership(hannaUserId, cityHospitalId, 'HOSPITAL_ADMIN'),
    membership(rexUserId, riverCentreId, 'BLOOD_CENTRE_STAFF'),
  );
});

after(async () => {
  await app?.close();
});

// The old preference/profile workflow was removed after product clarification.
// Direct Individual response behavior is covered by donor-responses.spec.cjs.
describe.skip('D4 legacy donor profile preferences', () => {
  it('requires authenticated owner access', async () => {
    // Unauthenticated requests keep the canonical 401 envelope.
    assert.equal((await fetch(`${baseUrl}/api/v1/donor-profile`)).status, 401);
    // No profile yet: the owner gets a clean 404, not a 500.
    const missing = await authed(doraToken, '/donor-profile');
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'NOT_FOUND');
    // Owner isolation extends to hospital members: their own (missing)
    // profile 404s and they can never see another donor's row.
    assert.equal((await authed(hannaToken, '/donor-profile')).status, 404);
    const peteOnly = await (await authed(peteToken, '/donor-profile')).status;
    assert.equal(peteOnly, 404);
  });

  it('isolates each donor profile to its owner', async () => {
    await patch('/donor-profile', doraToken, {
      bloodGroup: 'A_POSITIVE',
      availabilityStatus: 'AVAILABLE',
      notificationPreference: 'ALL',
    });
    await patch('/donor-profile', peteToken, {
      bloodGroup: 'B_POSITIVE',
      availabilityStatus: 'AVAILABLE',
      notificationPreference: 'ALL',
    });

    const dora = await (await authed(doraToken, '/donor-profile')).json();
    const pete = await (await authed(peteToken, '/donor-profile')).json();
    assert.notEqual(dora.data.id, pete.data.id);
    assert.equal(dora.data.bloodGroup, 'A_POSITIVE');
    assert.equal(pete.data.bloodGroup, 'B_POSITIVE');
    // Exactly one profile row per owner.
    assert.equal(
      store.donorProfiles.filter(
        (row) => row.userId === userIdByEmail('dora@donor.example.com'),
      ).length,
      1,
    );
  });

  it('accepts structurally valid profile updates', async () => {
    const created = await (await authed(doraToken, '/donor-profile')).json();
    assert.equal(created.data.coordinationStatus, 'ACTIVE');

    const updated = await patch('/donor-profile', doraToken, {
      availabilityStatus: 'UNAVAILABLE',
      notificationPreference: 'URGENT_ONLY',
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.availabilityStatus, 'UNAVAILABLE');
    assert.equal(updated.data.notificationPreference, 'URGENT_ONLY');
    assert.equal(updated.data.bloodGroup, 'A_POSITIVE'); // untouched field kept
    assert.equal(updated.data.id, created.data.id); // upsert, no second row

    // Structural validation: unknown fields and bad enums are rejected.
    assert.equal(
      (await patch('/donor-profile', doraToken, { bloodType: 'X' })).status,
      400,
    );
    assert.equal(
      (await patch('/donor-profile', doraToken, { bloodGroup: 'X_POSITIVE' }))
        .status,
      400,
    );
    assert.equal(
      (
        await patch('/donor-profile', doraToken, {
          location: { latitude: 100, longitude: 0 },
        })
      ).status,
      400,
    );

    // Restore AVAILABLE/ALL for downstream suites.
    await patch('/donor-profile', doraToken, {
      availabilityStatus: 'AVAILABLE',
      notificationPreference: 'ALL',
    });
  });

  it('never exposes precise donor coordinates', async () => {
    const response = await patch('/donor-profile', doraToken, {
      location: NEAR_CITY_HOSPITAL,
    });
    assert.equal(response.status, 200);
    const body = response.data;
    const forbiddenFragments = [
      'latitude',
      'longitude',
      'location',
      'coordinates',
      'point',
      'geo',
    ];
    for (const key of Object.keys(body)) {
      assert.ok(
        !forbiddenFragments.some((fragment) =>
          key.toLowerCase().includes(fragment),
        ),
        `unexpected spatial field ${key} in donor profile response`,
      );
    }
    // The canonical geography write happened via the PostGIS SQL path only.
    const profile = store.donorProfiles.find(
      (row) => row.userId === userIdByEmail('dora@donor.example.com'),
    );
    assert.ok(!('location' in profile), 'row must not carry a raw location');
    const spatialWrite = store.rawExecutes.find((entry) =>
      entry.sql.includes('ST_SetSRID(ST_MakePoint'),
    );
    assert.ok(spatialWrite, 'location must be written through ST_SetSRID SQL');
    const stored = store.donorLocations.get(profile.id);
    assert.deepEqual(stored, NEAR_CITY_HOSPITAL);
    // Nothing else was echoed anywhere in the JSON envelope.
    const serialized = JSON.stringify(body);
    assert.ok(!serialized.includes('13.0027'));
    assert.ok(!serialized.includes('80.2707'));
  });
});

describe('D4 donor responses', () => {
  it('allows any Individual to accept without preferences or donor profiles', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'A_POSITIVE' });
    const response = await post(
      `/blood-requests/${requestId}/accept`,
      zoeToken,
    );
    assert.equal(response.status, 200);
    assert.equal(
      store.donorResponses.filter((row) => row.bloodRequestId === requestId)
        .length,
      1,
    );
  });

  it('records acceptance only after explicit confirmation', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'A_POSITIVE' });
    const response = await post(
      `/blood-requests/${requestId}/accept`,
      doraToken,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.bloodRequestId, requestId);
    assert.equal(body.data.status, 'ACCEPTED');
    assert.ok(body.data.respondedAt, 'explicit confirmation timestamps it');
    assert.ok(body.data.confirmedAt);
    // No implicit responses exist: before this call there was no row.
    assert.equal(
      store.donorResponses.filter((row) => row.bloodRequestId === requestId)
        .length,
      1,
    );
    // A second Individual can also volunteer for the same request.
    assert.equal(
      (await post(`/blood-requests/${requestId}/accept`, zoeToken)).status,
      200,
    );
  });

  it('canceling confirmation makes no mutation', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'O_POSITIVE' });
    const baseline = store.donorResponses.length;

    // A withdrawn acceptance removes the commitment without residue: the
    // WITHDRAWN row is reused (never duplicated) if the donor re-accepts.
    assert.equal(
      (await post(`/blood-requests/${requestId}/accept`, doraToken)).status,
      200,
    );
    const withdraw = await post(
      `/blood-requests/${requestId}/withdraw`,
      doraToken,
    );
    assert.equal(withdraw.status, 200);
    assert.equal((await withdraw.json()).data.status, 'WITHDRAWN');
    assert.equal(store.donorResponses.length, baseline + 1);

    const reaccept = await post(
      `/blood-requests/${requestId}/accept`,
      doraToken,
    );
    assert.equal(reaccept.status, 200);
    assert.equal((await reaccept.json()).data.status, 'ACCEPTED');
    assert.equal(
      store.donorResponses.filter((row) => row.bloodRequestId === requestId)
        .length,
      1,
      'withdrawn row is reused, not duplicated',
    );
  });

  it('prevents duplicate donor responses for a request', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'A_POSITIVE' });
    assert.equal(
      (await post(`/blood-requests/${requestId}/accept`, doraToken)).status,
      200,
    );
    const duplicate = await post(
      `/blood-requests/${requestId}/accept`,
      doraToken,
    );
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, 'CONFLICT');

    // A race on the unique (request, donor) constraint also maps to 409.
    store.simulateDonorResponseDuplicate = true;
    const raced = await post(`/blood-requests/${requestId}/accept`, peteToken);
    store.simulateDonorResponseDuplicate = false;
    assert.equal(raced.status, 409);
  });

  it('allows withdrawal of the donor response', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'A_POSITIVE' });
    // Nothing to withdraw yet.
    assert.equal(
      (await post(`/blood-requests/${requestId}/withdraw`, doraToken)).status,
      404,
    );

    assert.equal(
      (await post(`/blood-requests/${requestId}/accept`, doraToken)).status,
      200,
    );
    const first = await post(
      `/blood-requests/${requestId}/withdraw`,
      doraToken,
    );
    assert.equal(first.status, 200);
    const second = await post(
      `/blood-requests/${requestId}/withdraw`,
      doraToken,
    );
    assert.equal(second.status, 409, 'already-withdrawn is a conflict');
  });

  it('isolates a response to its BloodRequest', async () => {
    const firstId = seedRequest(cityHospitalId, { bloodGroup: 'A_POSITIVE' });
    const secondId = seedRequest(cityHospitalId, { bloodGroup: 'A_POSITIVE' });
    assert.equal(
      (await post(`/blood-requests/${firstId}/accept`, doraToken)).status,
      200,
    );

    // The same donor may respond to the other request independently.
    assert.equal(
      (await post(`/blood-requests/${secondId}/accept`, doraToken)).status,
      200,
    );
    const rows = store.donorResponses.filter(
      (row) =>
        row.userId === userIdByEmail('dora@donor.example.com') &&
        [firstId, secondId].includes(row.bloodRequestId),
    );
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.bloodRequestId).sort(),
      [firstId, secondId].sort(),
    );
    // Withdrawing one does not touch the other.
    assert.equal(
      (await post(`/blood-requests/${firstId}/withdraw`, doraToken)).status,
      200,
    );
    assert.equal(
      store.donorResponses.find((row) => row.bloodRequestId === secondId)
        .status,
      'ACCEPTED',
    );
    // Requests that no longer accept responses reject new confirmations.
    const cancelledId = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
      status: 'CANCELLED',
    });
    assert.equal(
      (await post(`/blood-requests/${cancelledId}/accept`, peteToken)).status,
      409,
    );
    const fulfilledId = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
      status: 'FULFILLED',
    });
    assert.equal(
      (await post(`/blood-requests/${fulfilledId}/accept`, peteToken)).status,
      409,
    );
    assert.equal(
      (await post(`/blood-requests/${randomUUID()}/accept`, peteToken)).status,
      404,
    );
    // Malformed IDs keep the canonical 400 envelope.
    assert.equal(
      (await post('/blood-requests/not-a-uuid/accept', peteToken)).status,
      400,
    );
  });

  it('acceptance does not create donation history', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'B_POSITIVE' });
    const baseline = store.donationRecords.length;
    assert.equal(
      (await post(`/blood-requests/${requestId}/accept`, peteToken)).status,
      200,
    );
    assert.equal(store.donationRecords.length, baseline);
  });
});

describe('D4 organization responses', () => {
  it('allows only a blood-centre organization to respond', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'O_NEGATIVE' });
    // Individuals and hospital roles are rejected by the RBAC guard.
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/organization-response`,
          doraToken,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/organization-response`,
          hannaToken,
        )
      ).status,
      403,
    );
    const response = await post(
      `/blood-requests/${requestId}/organization-response`,
      rexToken,
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.organizationId, riverCentreId);
  });

  it('requires active membership in an active BLOOD_CENTRE organization', async () => {
    const requestId = seedRequest(cityHospitalId, {
      bloodGroup: 'AB_POSITIVE',
    });
    // An authenticated individual with no blood-centre membership sees 404
    // (membership checks happen server-side, after RBAC on matching roles).
    const outsider = await registerAndLogin('outsider@centre.example.com');
    store.organizationMemberships.push(
      membership(
        userIdByEmail('outsider@centre.example.com'),
        cityHospitalId,
        'HOSPITAL_STAFF',
      ),
    );
    // Roles guard: hospital staff are not blood-centre roles.
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/organization-response`,
          outsider,
        )
      ).status,
      403,
    );
    // A suspended blood centre cannot respond even with the right role.
    const suspendedCentreId = randomUUID();
    store.organizations.push({
      id: suspendedCentreId,
      name: 'Closed Centre',
      type: 'BLOOD_CENTRE',
      status: 'SUSPENDED',
    });
    const ghost = await registerAndLogin('ghost@centre.example.com');
    store.organizationMemberships.push(
      membership(
        userIdByEmail('ghost@centre.example.com'),
        suspendedCentreId,
        'BLOOD_CENTRE_ADMIN',
      ),
    );
    assert.equal(
      (await post(`/blood-requests/${requestId}/organization-response`, ghost))
        .status,
      403,
      'the RBAC guard rejects memberships in suspended organizations',
    );
  });

  it('associates the response with its BloodRequest', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'A_POSITIVE' });
    const response = await post(
      `/blood-requests/${requestId}/organization-response`,
      rexToken,
    );
    const body = await response.json();
    assert.equal(body.data.bloodRequestId, requestId);
    assert.equal(body.data.status, 'ACCEPTED');
    assert.ok(body.data.respondedAt);
    assert.ok(body.data.confirmedAt);
    // Closed requests reject organization responses as well.
    const cancelledId = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
      status: 'CANCELLED',
    });
    assert.equal(
      (
        await post(
          `/blood-requests/${cancelledId}/organization-response`,
          rexToken,
        )
      ).status,
      409,
    );
  });

  it('prevents duplicate organization responses per request', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'A_NEGATIVE' });
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/organization-response`,
          rexToken,
        )
      ).status,
      200,
    );
    const duplicate = await post(
      `/blood-requests/${requestId}/organization-response`,
      rexToken,
    );
    assert.equal(duplicate.status, 409);
    // A different blood centre keeps its own independent response.
    const lakeAdmin = await registerAndLogin('lake@centre.example.com');
    store.organizationMemberships.push(
      membership(
        userIdByEmail('lake@centre.example.com'),
        lakeCentreId,
        'BLOOD_CENTRE_ADMIN',
      ),
    );
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/organization-response`,
          lakeAdmin,
        )
      ).status,
      200,
    );
    assert.equal(
      store.organizationResponses.filter(
        (row) => row.bloodRequestId === requestId,
      ).length,
      2,
    );
  });

  it('supports response withdrawal', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'B_NEGATIVE' });
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/organization-response/withdraw`,
          rexToken,
        )
      ).status,
      404,
      'withdrawing a nonexistent response is a 404',
    );
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/organization-response`,
          rexToken,
        )
      ).status,
      200,
    );
    const withdraw = await post(
      `/blood-requests/${requestId}/organization-response/withdraw`,
      rexToken,
    );
    assert.equal(withdraw.status, 200);
    assert.equal((await withdraw.json()).data.status, 'WITHDRAWN');
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/organization-response/withdraw`,
          rexToken,
        )
      ).status,
      409,
    );
    // Re-response reuses the withdrawn row (unique per request per org).
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/organization-response`,
          rexToken,
        )
      ).status,
      200,
    );
    assert.equal(
      store.organizationResponses.filter(
        (row) =>
          row.bloodRequestId === requestId &&
          row.organizationId === riverCentreId,
      ).length,
      1,
    );
  });

  it('isolates responses to their BloodRequest', async () => {
    const firstId = seedRequest(cityHospitalId, { bloodGroup: 'O_POSITIVE' });
    const secondId = seedRequest(northHospitalId, { bloodGroup: 'O_POSITIVE' });
    assert.equal(
      (await post(`/blood-requests/${firstId}/organization-response`, rexToken))
        .status,
      200,
    );
    assert.equal(
      (
        await post(
          `/blood-requests/${secondId}/organization-response`,
          rexToken,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await post(
          `/blood-requests/${firstId}/organization-response/withdraw`,
          rexToken,
        )
      ).status,
      200,
    );
    assert.equal(
      store.organizationResponses.find((row) => row.bloodRequestId === secondId)
        .status,
      'ACCEPTED',
    );
  });
});

// Donor-radius and blood-group matching is intentionally not used: hospitals
// verify volunteers after Individuals see all open requests.
describe.skip('D4 legacy profile-based matching and PostGIS', () => {
  it('filters candidates by blood group', async () => {
    const { MatchingService } = require('../dist/matching/matching.service');
    const matching = moduleRef.get(MatchingService);

    const requestId = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
      urgency: 'URGENT',
    });
    await seedEligibleDonors();

    const result = await matching.matchCandidates(requestId, 'NEAREST_DONORS');
    const ids = result.candidates.map((candidate) => candidate.donorId);
    // pete is B+ and is never matched against an A+ request.
    assert.ok(!ids.includes(donorProfileId('pete@donor.example.com')));
    assert.ok(ids.includes(donorProfileId('dora@donor.example.com')));
  });

  it('filters by availability and coordination status', async () => {
    const { MatchingService } = require('../dist/matching/matching.service');
    const matching = moduleRef.get(MatchingService);
    const requestId = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
      urgency: 'URGENT',
    });
    seedEligibleDonors();

    const ids = (
      await matching.matchCandidates(requestId, 'NEAREST_DONORS')
    ).candidates.map((candidate) => candidate.donorId);
    // omar has coordinationStatus PAUSED; pete has availability UNAVAILABLE
    // semantics covered separately — omar must never be notified.
    assert.ok(!ids.includes(donorProfileId('omar@donor.example.com')));
  });

  it('filters by notification preference', async () => {
    const { MatchingService } = require('../dist/matching/matching.service');
    const matching = moduleRef.get(MatchingService);
    seedEligibleDonors();

    // URGENT request: CRITICAL_ONLY donors are excluded.
    const urgentId = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
      urgency: 'URGENT',
    });
    const urgentIds = (
      await matching.matchCandidates(urgentId, 'NEAREST_DONORS')
    ).candidates.map((candidate) => candidate.donorId);
    assert.ok(!urgentIds.includes(donorProfileId('nina@donor.example.com')));

    // CRITICAL request: CRITICAL_ONLY donors are included.
    const criticalId = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
      urgency: 'CRITICAL',
    });
    const criticalIds = (
      await matching.matchCandidates(criticalId, 'NEAREST_DONORS')
    ).candidates.map((candidate) => candidate.donorId);
    assert.ok(criticalIds.includes(donorProfileId('nina@donor.example.com')));

    // Preference NONE is never notified.
    store.donorProfiles.find(
      (row) => row.id === donorProfileId('nina@donor.example.com'),
    ).notificationPreference = 'NONE';
    const noneIds = (
      await matching.matchCandidates(criticalId, 'NEAREST_DONORS')
    ).candidates.map((candidate) => candidate.donorId);
    assert.ok(!noneIds.includes(donorProfileId('nina@donor.example.com')));
    store.donorProfiles.find(
      (row) => row.id === donorProfileId('nina@donor.example.com'),
    ).notificationPreference = 'CRITICAL_ONLY';
  });

  it('uses PostGIS radius filtering and distance ranking', async () => {
    await seedEligibleDonors();
    // dora (~9 km) sees the City request with an approximate distance and
    // nothing precise; the Delhi request is far outside the 25 km radius.
    const nearId = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
      urgency: 'ROUTINE',
    });
    const farId = seedRequest(northHospitalId, {
      bloodGroup: 'A_POSITIVE',
      urgency: 'ROUTINE',
    });

    const list = await (
      await authed(doraToken, '/donor/blood-requests')
    ).json();
    const ids = list.data.map((row) => row.id);
    assert.ok(ids.includes(nearId));
    assert.ok(!ids.includes(farId), '25 km radius excludes distant requests');

    const near = list.data.find((row) => row.id === nearId);
    assert.ok(
      near.approximateDistanceKm > 5 && near.approximateDistanceKm < 15,
      `expected ~9 km, got ${near.approximateDistanceKm}`,
    );
    assert.ok(
      !JSON.stringify(near).includes('latitude'),
      'no precise coordinates in donor-facing payloads',
    );
    // Spatial predicates ran through the raw SQL boundary.
    assert.ok(
      store.rawQueries.some((entry) => entry.sql.includes('ST_DWithin')),
    );

    // Detail view enforces the same radius.
    assert.equal(
      (await authed(doraToken, `/donor/blood-requests/${nearId}`)).status,
      200,
    );
    assert.equal(
      (await authed(doraToken, `/donor/blood-requests/${farId}`)).status,
      404,
    );
    // Group mismatch is also a 404 for donors.
    const mismatch = seedRequest(cityHospitalId, {
      bloodGroup: 'AB_NEGATIVE',
      urgency: 'ROUTINE',
    });
    assert.equal(
      (await authed(doraToken, `/donor/blood-requests/${mismatch}`)).status,
      404,
    );
    assert.equal(
      (await authed(doraToken, '/donor/blood-requests/not-a-uuid')).status,
      400,
    );
  });

  it('progresses through notification tiers', async () => {
    const { MatchingService } = require('../dist/matching/matching.service');
    const {
      NotificationsService,
    } = require('../dist/notifications/notifications.service');
    const matching = moduleRef.get(MatchingService);
    const notifications = moduleRef.get(NotificationsService);
    seedEligibleDonors();

    assert.equal(notifications.initialTier(), 'NEAREST_DONORS');
    assert.equal(
      notifications.nextTier('NEAREST_DONORS'),
      'HOSPITAL_SUBSCRIBERS',
    );
    assert.equal(
      notifications.nextTier('HOSPITAL_SUBSCRIBERS'),
      'EXPANDING_RADIUS',
    );
    assert.equal(notifications.nextTier('EXPANDING_RADIUS'), null);

    const requestId = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
      urgency: 'URGENT',
    });

    // Tier 1: only nearby donors (~25 km). dana (55 km) is out.
    const nearest = (
      await matching.matchCandidates(requestId, 'NEAREST_DONORS')
    ).candidates.map((candidate) => candidate.donorId);
    assert.ok(nearest.includes(donorProfileId('dora@donor.example.com')));
    assert.ok(!nearest.includes(donorProfileId('dana@donor.example.com')));

    // Tier 2: ACTIVE subscribers of the request hospital. dana subscribes
    // below; quinn's PAUSED subscription never notifies.
    assert.equal(
      (await post(`/hospitals/${cityHospitalId}/subscription`, danaToken))
        .status,
      201,
    );
    const subscribers = (
      await matching.matchCandidates(requestId, 'HOSPITAL_SUBSCRIBERS')
    ).candidates.map((candidate) => candidate.donorId);
    assert.deepEqual(subscribers, [donorProfileId('dana@donor.example.com')]);

    // Tier 3: expanded 100 km radius brings dana back in.
    const expanding = (
      await matching.matchCandidates(requestId, 'EXPANDING_RADIUS')
    ).candidates.map((candidate) => candidate.donorId);
    assert.ok(expanding.includes(donorProfileId('dora@donor.example.com')));
    assert.ok(expanding.includes(donorProfileId('dana@donor.example.com')));

    const boundary = await matching.matchCandidates(
      requestId,
      'NEAREST_DONORS',
    );
    assert.equal(boundary.bloodRequestId, requestId);
    assert.equal(boundary.tier, 'NEAREST_DONORS');
    for (const candidate of boundary.candidates) {
      assert.ok(typeof candidate.donorId === 'string');
      assert.ok(
        !JSON.stringify(candidate).includes('latitude'),
        'tier boundary must not leak precise coordinates',
      );
    }
  });

  it('does not determine medical eligibility', async () => {
    // BloodLink matching never computes medical rules: a donor whose last
    // confirmed donation was yesterday is still matched and can accept.
    const requestId = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
      urgency: 'ROUTINE',
    });
    const profileId = donorProfileId('dora@donor.example.com');
    store.donorProfiles.find(
      (row) => row.id === profileId,
    ).lastConfirmedDonationAt = new Date(Date.now() - 86_400_000);

    assert.equal(
      (await post(`/blood-requests/${requestId}/accept`, doraToken)).status,
      200,
    );
    store.donorProfiles.find(
      (row) => row.id === profileId,
    ).lastConfirmedDonationAt = null;
  });

  it('keeps the blood-centre view membership-scoped and assignment-free', async () => {
    seedEligibleDonors();
    const requestId = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
      urgency: 'ROUTINE',
    });
    const cancelledId = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
      status: 'CANCELLED',
    });

    const list = await (
      await authed(rexToken, '/blood-centre/blood-requests')
    ).json();
    const ids = list.data.map((row) => row.id);
    assert.ok(ids.includes(requestId));
    assert.ok(!ids.includes(cancelledId), 'cancelled requests are excluded');
    assert.equal(list.meta.page, 1);
    assert.equal(list.meta.pageSize, 20);

    // Responder identities never appear in the centre projection.
    assert.ok(
      !JSON.stringify(list.data).includes('responders'),
      'assignment details must not leak to blood centres',
    );

    const detail = await (
      await authed(rexToken, `/blood-centre/blood-requests/${requestId}`)
    ).json();
    assert.equal(detail.data.id, requestId);

    // Role guard: individuals and hospital staff cannot browse centre views.
    assert.equal(
      (await authed(doraToken, '/blood-centre/blood-requests')).status,
      403,
    );
    assert.equal(
      (await authed(hannaToken, '/blood-centre/blood-requests')).status,
      403,
    );
  });

  it('returns only response history for the caller’s blood-centre memberships', async () => {
    const firstRequest = seedRequest(cityHospitalId, {
      bloodGroup: 'A_POSITIVE',
    });
    const secondRequest = seedRequest(northHospitalId, {
      bloodGroup: 'A_POSITIVE',
    });
    await post(
      `/blood-requests/${firstRequest}/organization-response`,
      rexToken,
    );
    await post(
      `/blood-requests/${secondRequest}/organization-response`,
      rexToken,
    );

    const history = await (
      await authed(rexToken, '/blood-centre/responses')
    ).json();
    const returnedRequestIds = new Set(
      history.data.map((response) => response.bloodRequestId),
    );
    assert.ok(returnedRequestIds.has(firstRequest));
    assert.ok(returnedRequestIds.has(secondRequest));
    assert.ok(
      history.data.every(
        (response) => response.organizationId === riverCentreId,
      ),
    );
    assert.equal(
      (await authed(doraToken, '/blood-centre/responses')).status,
      403,
    );
  });
});

describe('D4 hospital subscriptions and notifications', () => {
  it('creates one donor/hospital subscription relationship', async () => {
    const response = await post(
      `/hospitals/${cityHospitalId}/subscription`,
      doraToken,
    );
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.hospitalId, cityHospitalId);
    assert.equal(body.data.status, 'ACTIVE');
    assert.equal(
      store.hospitalSubscriptions.filter(
        (row) =>
          row.hospitalId === cityHospitalId &&
          row.userId === userIdByEmail('dora@donor.example.com'),
      ).length,
      1,
    );
    // Individuals do not need a DonorProfile to subscribe.
    assert.equal(
      (await post(`/hospitals/${cityHospitalId}/subscription`, zoeToken))
        .status,
      201,
    );
    assert.equal(
      (await post(`/hospitals/${riverCentreId}/subscription`, doraToken))
        .status,
      422,
      'blood centres are not subscribable hospitals',
    );
    assert.equal(
      (await post(`/hospitals/${suspendedHospitalId}/subscription`, doraToken))
        .status,
      422,
      'suspended hospitals are ineligible',
    );
    assert.equal(
      (await post(`/hospitals/${randomUUID()}/subscription`, doraToken)).status,
      422,
    );
    assert.equal(
      (await post('/hospitals/not-a-uuid/subscription', doraToken)).status,
      400,
    );
  });

  it('prevents duplicates and supports removal', async () => {
    assert.equal(
      (await post(`/hospitals/${northHospitalId}/subscription`, doraToken))
        .status,
      201,
    );
    const duplicate = await post(
      `/hospitals/${northHospitalId}/subscription`,
      doraToken,
    );
    assert.equal(duplicate.status, 409);

    // A PAUSED row is reactivated instead of duplicated.
    store.hospitalSubscriptions.find(
      (row) =>
        row.hospitalId === northHospitalId &&
        row.userId === userIdByEmail('dora@donor.example.com'),
    ).status = 'PAUSED';
    const resubscribe = await post(
      `/hospitals/${northHospitalId}/subscription`,
      doraToken,
    );
    assert.equal(resubscribe.status, 201);
    assert.equal((await resubscribe.json()).data.status, 'ACTIVE');
    assert.equal(
      store.hospitalSubscriptions.filter(
        (row) =>
          row.hospitalId === northHospitalId &&
          row.userId === userIdByEmail('dora@donor.example.com'),
      ).length,
      1,
    );

    // Removal: 204 on success, 404 when nothing exists.
    const removal = await del(
      `/hospitals/${northHospitalId}/subscription`,
      doraToken,
    );
    assert.equal(removal.status, 204);
    assert.equal(
      (await del(`/hospitals/${northHospitalId}/subscription`, doraToken))
        .status,
      404,
    );

    // Unique-constraint race also maps to 409.
    store.simulateSubscriptionDuplicate = true;
    const raced = await post(
      `/hospitals/${northHospitalId}/subscription`,
      ninaToken,
    );
    store.simulateSubscriptionDuplicate = false;
    assert.equal(raced.status, 409);
  });

  it('isolates subscriptions to the authorized hospital/donor', async () => {
    assert.equal(
      (await post(`/hospitals/${cityHospitalId}/subscription`, quinnToken))
        .status,
      201,
    );
    const doraList = await (
      await authed(doraToken, '/hospital-subscriptions')
    ).json();
    const quinnList = await (
      await authed(quinnToken, '/hospital-subscriptions')
    ).json();
    const doraHospitals = doraList.data.map((row) => row.hospitalId);
    assert.ok(doraHospitals.includes(cityHospitalId));
    const quinnCity = quinnList.data.find(
      (row) => row.hospitalId === cityHospitalId,
    );
    assert.ok(quinnCity, 'quinn sees her new City subscription');
    assert.equal(quinnCity.status, 'ACTIVE');
    // Unsubscribing uses the caller's own account-scoped subscription.
    assert.equal(
      (await del(`/hospitals/${cityHospitalId}/subscription`, zoeToken)).status,
      204,
    );
    assert.equal(
      store.hospitalSubscriptions.find(
        (row) =>
          row.userId === userIdByEmail('quinn@donor.example.com') &&
          row.hospitalId === cityHospitalId,
      ).status,
      'ACTIVE',
    );
  });

  it('uses privacy-safe notification payloads', async () => {
    const {
      NotificationsService,
    } = require('../dist/notifications/notifications.service');
    const notifications = moduleRef.get(NotificationsService);

    const payload = notifications.composeNotification(
      {
        id: randomUUID(),
        bloodGroup: 'A_POSITIVE',
        component: 'WHOLE_BLOOD',
        urgency: 'URGENT',
      },
      'City Hospital',
      zoeUserId,
    );
    assert.equal(payload.userId, zoeUserId);
    assert.ok(payload.title.includes('A_POSITIVE'));
    assert.ok(payload.title.includes('WHOLE_BLOOD'));
    assert.ok(payload.body.includes('City Hospital'));
    assert.ok(payload.body.includes('URGENT'));
    const text = JSON.stringify(payload);
    for (const forbidden of [
      'latitude',
      'longitude',
      'patient',
      'coordinates',
    ]) {
      assert.ok(
        !text.toLowerCase().includes(forbidden),
        `payload must not carry ${forbidden}`,
      );
    }

    // Preference gate: urgency filtering is a preference, not medicine.
    assert.equal(
      notifications.urgencyAllowedByPreference('ALL', 'ROUTINE'),
      true,
    );
    assert.equal(
      notifications.urgencyAllowedByPreference('URGENT_ONLY', 'ROUTINE'),
      false,
    );
    assert.equal(
      notifications.urgencyAllowedByPreference('URGENT_ONLY', 'CRITICAL'),
      true,
    );
    assert.equal(
      notifications.urgencyAllowedByPreference('CRITICAL_ONLY', 'URGENT'),
      false,
    );
    assert.equal(
      notifications.urgencyAllowedByPreference('NONE', 'CRITICAL'),
      false,
    );
    assert.equal(
      notifications.urgencyAllowedByPreference(null, 'URGENT'),
      false,
    );
  });

  it('selects push subscriptions according to notification tiers', async () => {
    const {
      NotificationsService,
    } = require('../dist/notifications/notifications.service');
    const notifications = moduleRef.get(NotificationsService);

    store.pushSubscriptions.push(
      pushSubscription(zoeUserId, 'WEB', true),
      pushSubscription(zoeUserId, 'MOBILE_ANDROID', false),
      pushSubscription(hannaUserId, 'WEB', true),
    );
    const selected = await notifications.selectPushSubscriptions([zoeUserId]);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].platform, 'WEB');
    assert.equal(selected[0].enabled, true);
    // Disabled endpoints and other users' endpoints are never selected.
    assert.ok(selected.every((row) => row.enabled));
    const none = await notifications.selectPushSubscriptions([]);
    assert.deepEqual(none, []);
  });
});

describe('D4 request communication', () => {
  it('locks the conversation when the selected responder withdraws', async () => {
    const context = await selectedResponderFixture();
    const response = store.donorResponses.find(
      (row) => row.bloodRequestId === context.requestId,
    );
    response.status = 'WITHDRAWN';

    assert.equal(
      (
        await authed(
          hannaToken,
          `/blood-requests/${context.requestId}/conversation`,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await authed(
          doraToken,
          `/blood-requests/${context.requestId}/conversation`,
        )
      ).status,
      404,
    );
    assert.equal(
      store.responderAssignments.find(
        (assignment) => assignment.bloodRequestId === context.requestId,
      ).state,
      'SELECTED',
      'D4 does not mutate the D3-owned assignment',
    );
  });

  it('authorizes only the request hospital or its single responder', async () => {
    const context = await selectedResponderFixture();
    // Hospital side can open the conversation.
    const hospitalView = await (
      await authed(
        hannaToken,
        `/blood-requests/${context.requestId}/conversation`,
      )
    ).json();
    assert.equal(hospitalView.data.bloodRequestId, context.requestId);
    assert.equal(hospitalView.data.status, 'OPEN');
    assert.deepEqual(hospitalView.data.messages, []);

    // The selected donor can open the same request's conversation.
    const donorView = await (
      await authed(
        doraToken,
        `/blood-requests/${context.requestId}/conversation`,
      )
    ).json();
    assert.equal(donorView.data.status, 'OPEN');

    // A second accepted donor who was NOT selected stays locked out.
    assert.equal(
      (await post(`/blood-requests/${context.requestId}/accept`, ninaToken))
        .status,
      200,
    );
    assert.equal(
      (
        await authed(
          ninaToken,
          `/blood-requests/${context.requestId}/conversation`,
        )
      ).status,
      404,
    );
    // Unrelated users learn nothing about the conversation's existence.
    assert.equal(
      (
        await authed(
          zoeToken,
          `/blood-requests/${context.requestId}/conversation`,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await authed(
          rexToken,
          `/blood-requests/${context.requestId}/conversation`,
        )
      ).status,
      404,
      'blood-centre staff are not participants of a donor selection',
    );
    assert.equal(
      (await authed(doraToken, `/blood-requests/${randomUUID()}/conversation`))
        .status,
      404,
    );
    assert.equal(
      (await authed(doraToken, '/blood-requests/not-a-uuid/conversation'))
        .status,
      400,
    );
  });

  it('opens conversations lazily and scopes them per participant', async () => {
    const context = await selectedResponderFixture();
    assert.equal(
      store.conversations.filter(
        (row) => row.bloodRequestId === context.requestId,
      ).length,
      0,
    );

    await authed(
      hannaToken,
      `/blood-requests/${context.requestId}/conversation`,
    );
    await authed(
      hannaToken,
      `/blood-requests/${context.requestId}/conversation`,
    );
    assert.equal(
      store.conversations.filter(
        (row) => row.bloodRequestId === context.requestId,
      ).length,
      1,
      'GET is idempotent for the hospital side',
    );

    // Organization-selected responder: the whole centre membership speaks.
    const orgContext = await selectedOrganizationFixture();
    const rexView = await (
      await authed(
        rexToken,
        `/blood-requests/${orgContext.requestId}/conversation`,
      )
    ).json();
    assert.equal(rexView.data.status, 'OPEN');
    assert.equal(
      store.conversations.find(
        (row) => row.bloodRequestId === orgContext.requestId,
      ).organizationId,
      riverCentreId,
    );
    // Hospital members of a different hospital cannot reach it.
    const otherAdmin = await registerAndLogin('other@city.example.com');
    store.organizationMemberships.push(
      membership(
        userIdByEmail('other@city.example.com'),
        northHospitalId,
        'HOSPITAL_ADMIN',
      ),
    );
    assert.equal(
      (
        await authed(
          otherAdmin,
          `/blood-requests/${orgContext.requestId}/conversation`,
        )
      ).status,
      404,
    );
  });

  it('allows only authorized workflow participants', async () => {
    const context = await selectedResponderFixture();
    const sent = await post(
      `/blood-requests/${context.requestId}/messages`,
      hannaToken,
      { content: 'Please arrive at the blood bank desk.' },
    );
    assert.equal(sent.status, 200);
    const body = await sent.json();
    assert.equal(body.data.senderId, hannaUserId);
    assert.equal(body.data.content, 'Please arrive at the blood bank desk.');

    const reply = await post(
      `/blood-requests/${context.requestId}/messages`,
      doraToken,
      { content: 'On my way.' },
    );
    assert.equal(reply.status, 200);

    const thread = await (
      await authed(
        doraToken,
        `/blood-requests/${context.requestId}/conversation`,
      )
    ).json();
    assert.equal(thread.data.messages.length, 2);
    assert.deepEqual(
      thread.data.messages.map((message) => message.senderId),
      [hannaUserId, userIdByEmail('dora@donor.example.com')],
    );
  });

  it('denies unrelated users', async () => {
    const context = await selectedResponderFixture();
    assert.equal(
      (
        await post(`/blood-requests/${context.requestId}/messages`, zoeToken, {
          content: 'intrusion attempt',
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await post(`/blood-requests/${context.requestId}/messages`, rexToken, {
          content: 'centre staff are not part of this conversation',
        })
      ).status,
      404,
    );
    assert.equal(
      store.messages.filter((row) => row.content.includes('intrusion')).length,
      0,
    );
  });

  it('validates message creation and enforces closed conversations', async () => {
    const context = await selectedResponderFixture();
    assert.equal(
      (
        await post(
          `/blood-requests/${context.requestId}/messages`,
          hannaToken,
          {
            content: '   ',
          },
        )
      ).status,
      400,
      'blank content is rejected',
    );
    assert.equal(
      (
        await post(
          `/blood-requests/${context.requestId}/messages`,
          hannaToken,
          {
            content: 'hello',
            extra: true,
          },
        )
      ).status,
      400,
      'unknown fields are rejected',
    );

    // Open the thread, then close it: reads still work, writes conflict.
    assert.equal(
      (
        await post(
          `/blood-requests/${context.requestId}/messages`,
          hannaToken,
          {
            content: 'opening the thread',
          },
        )
      ).status,
      200,
    );
    store.conversations.find(
      (row) => row.bloodRequestId === context.requestId,
    ).status = 'CLOSED';
    const closedRead = await (
      await authed(
        hannaToken,
        `/blood-requests/${context.requestId}/conversation`,
      )
    ).json();
    assert.equal(closedRead.data.status, 'CLOSED');
    const closedWrite = await post(
      `/blood-requests/${context.requestId}/messages`,
      hannaToken,
      { content: 'too late' },
    );
    assert.equal(closedWrite.status, 409);
    assert.equal((await closedWrite.json()).error.code, 'CONFLICT');
  });
});

describe('D4 donation and D3 boundary', () => {
  it('does not update donation history on response acceptance', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'A_POSITIVE' });
    const baseline = store.donationRecords.length;
    assert.equal(
      (await post(`/blood-requests/${requestId}/accept`, doraToken)).status,
      200,
    );
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/organization-response`,
          rexToken,
        )
      ).status,
      200,
    );
    assert.equal(store.donationRecords.length, baseline);
  });

  it('does not expose donor preference or medical eligibility APIs', async () => {
    assert.equal((await authed(doraToken, '/donor-profile')).status, 404);
    assert.equal((await patch('/donor-profile', doraToken, {})).status, 404);
  });

  it('does not expose donor self-service donation confirmation', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'A_POSITIVE' });
    for (const path of [
      '/donations',
      '/donor/donations',
      `/blood-requests/${requestId}/donations`,
      `/blood-requests/${requestId}/donation/confirm`,
    ]) {
      assert.equal((await post(path, doraToken, {})).status, 404);
    }
  });

  it('never mutates BloodRequest lifecycle or ResponderAssignment', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'A_POSITIVE' });
    const assignment = {
      id: randomUUID(),
      bloodRequestId: requestId,
      donorResponseId: null,
      organizationResponseId: null,
      state: 'NOTIFIED',
      assignedAt: new Date(),
      releasedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.responderAssignments.push(assignment);

    const before = JSON.stringify({
      request: store.bloodRequests.find((row) => row.id === requestId),
      assignments: store.responderAssignments,
    });

    // The full D4 journey for this request.
    assert.equal(
      (await authed(doraToken, `/donor/blood-requests/${requestId}`)).status,
      200,
    );
    assert.equal(
      (await post(`/blood-requests/${requestId}/accept`, doraToken)).status,
      200,
    );
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/organization-response`,
          rexToken,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await post(`/blood-requests/${requestId}/messages`, hannaToken, {
          content: 'coordination message',
        })
      ).status,
      404,
      'no conversation exists without a SELECTED responder',
    );
    assert.equal(
      (await post(`/blood-requests/${requestId}/withdraw`, doraToken)).status,
      200,
    );

    const after = JSON.stringify({
      request: store.bloodRequests.find((row) => row.id === requestId),
      assignments: store.responderAssignments,
    });
    assert.equal(after, before, 'D4 must not touch D3-owned state');
    assert.equal(
      store.responderAssignments.find((row) => row.id === assignment.id).state,
      'NOTIFIED',
    );
  });

  it('only produces response records for D3 to coordinate', async () => {
    const requestId = seedRequest(cityHospitalId, { bloodGroup: 'B_POSITIVE' });
    assert.equal(
      (await post(`/blood-requests/${requestId}/accept`, peteToken)).status,
      200,
    );
    const donorRow = store.donorResponses.find(
      (row) => row.bloodRequestId === requestId,
    );
    assert.equal(donorRow.status, 'ACCEPTED');
    assert.equal(donorRow.userId, userIdByEmail('pete@donor.example.com'));
    // D3 selects responders from exactly these records; D4 creates no
    // assignments of its own.
    assert.equal(
      store.responderAssignments.filter(
        (row) => row.bloodRequestId === requestId,
      ).length,
      0,
    );
  });
});

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

const NEAR_CITY_HOSPITAL = { latitude: 13.0027, longitude: 80.2707 }; // ~8.9 km
const NEAR_SUBURBS = { latitude: 13.58, longitude: 80.2707 }; // ~55 km
const JUST_OUTSIDE = { latitude: 15.0, longitude: 80.2707 }; // ~212 km

let eligibleDonorsSeeded = false;

/** Creates donor profiles/locations used by matching suites (idempotent). */
async function seedEligibleDonors() {
  if (eligibleDonorsSeeded) return;
  eligibleDonorsSeeded = true;

  await patch('/donor-profile', danaToken, {
    bloodGroup: 'A_POSITIVE',
    availabilityStatus: 'AVAILABLE',
    notificationPreference: 'ALL',
    location: NEAR_SUBURBS,
  });
  await patch('/donor-profile', ninaToken, {
    bloodGroup: 'A_POSITIVE',
    availabilityStatus: 'AVAILABLE',
    notificationPreference: 'CRITICAL_ONLY',
    location: NEAR_CITY_HOSPITAL,
  });
  await patch('/donor-profile', omarToken, {
    bloodGroup: 'A_POSITIVE',
    availabilityStatus: 'AVAILABLE',
    notificationPreference: 'ALL',
    location: NEAR_CITY_HOSPITAL,
  });
  await patch('/donor-profile', quinnToken, {
    bloodGroup: 'A_POSITIVE',
    availabilityStatus: 'AVAILABLE',
    notificationPreference: 'ALL',
    location: JUST_OUTSIDE,
  });
  store.donorProfiles.find(
    (row) => row.userId === userIdByEmail('omar@donor.example.com'),
  ).coordinationStatus = 'PAUSED';
  store.donorProfiles.find(
    (row) => row.userId === userIdByEmail('pete@donor.example.com'),
  ).availabilityStatus = 'UNAVAILABLE';
  // quinn: PAUSED hospital subscription seeded in the isolation suite.
  store.hospitalSubscriptions.push({
    id: randomUUID(),
    hospitalId: northHospitalId,
    userId: userIdByEmail('quinn@donor.example.com'),
    status: 'PAUSED',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function seedRequest(hospitalId, overrides = {}) {
  const row = {
    id: randomUUID(),
    hospitalId,
    patientNeedId: randomUUID(),
    bloodGroup: 'A_POSITIVE',
    component: 'WHOLE_BLOOD',
    unitsRequired: 2,
    urgency: 'ROUTINE',
    requiredBy: new Date(Date.now() + 3 * 86_400_000),
    status: 'OPEN',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  store.bloodRequests.push(row);
  return row.id;
}

/** Verified-style request whose SELECTED responder is dora's donor response. */
async function selectedResponderFixture() {
  const requestId = seedRequest(cityHospitalId, { bloodGroup: 'A_POSITIVE' });
  assert.equal(
    (await post(`/blood-requests/${requestId}/accept`, doraToken)).status,
    200,
  );
  const donorResponse = store.donorResponses.find(
    (row) =>
      row.bloodRequestId === requestId &&
      row.userId === userIdByEmail('dora@donor.example.com'),
  );
  store.responderAssignments.push({
    id: randomUUID(),
    bloodRequestId: requestId,
    donorResponseId: donorResponse.id,
    organizationResponseId: null,
    state: 'SELECTED',
    assignedAt: new Date(),
    releasedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { requestId, donorResponseId: donorResponse.id };
}

/** Request whose SELECTED responder is the River Blood Centre. */
async function selectedOrganizationFixture() {
  const requestId = seedRequest(cityHospitalId, { bloodGroup: 'O_POSITIVE' });
  assert.equal(
    (await post(`/blood-requests/${requestId}/organization-response`, rexToken))
      .status,
    200,
  );
  const organizationResponse = store.organizationResponses.find(
    (row) => row.bloodRequestId === requestId,
  );
  store.responderAssignments.push({
    id: randomUUID(),
    bloodRequestId: requestId,
    donorResponseId: null,
    organizationResponseId: organizationResponse.id,
    state: 'SELECTED',
    assignedAt: new Date(),
    releasedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { requestId };
}

async function registerAndLogin(email) {
  const password = 'a-safe-test-password';
  const registerResponse = await post('/auth/register', null, {
    email,
    password,
  });
  assert.equal(registerResponse.status, 201);

  const loginResponse = await post('/auth/login', null, { email, password });
  assert.equal(loginResponse.status, 200);
  return (await loginResponse.json()).data.accessToken;
}

function authed(token, path) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function post(path, token, body) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
}

function patch(path, token, body) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).then(async (response) => {
    // PATCH responses resolve to the envelope directly for assertions.
    const json = await response.json().catch(() => null);
    response.data = json ? json.data : null;
    return response;
  });
}

function del(path, token) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function membership(userId, organizationId, role) {
  return {
    id: randomUUID(),
    userId,
    organizationId,
    role,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function pushSubscription(userId, platform, enabled) {
  return {
    id: randomUUID(),
    userId,
    platform,
    endpoint: `https://push.example.com/${randomUUID()}`,
    enabled,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function userIdByEmail(email) {
  const user = store.users.find((row) => row.email === email);
  assert.ok(user, `user ${email} must exist`);
  return user.id;
}

function donorProfileId(email) {
  const profile = store.donorProfiles.find(
    (row) => row.userId === userIdByEmail(email),
  );
  assert.ok(profile, `donor profile for ${email} must exist`);
  return profile.id;
}

// ---------------------------------------------------------------------------
// In-memory relational store emulating the Prisma calls and spatial raw SQL
// the D4 services issue. Mirrors the D2/D3 harness pattern.
// ---------------------------------------------------------------------------

function haversineMeters(a, b) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function MemoryD4Store() {
  this.users = [];
  this.refreshTokens = [];
  this.organizations = [];
  this.organizationMemberships = [];
  this.bloodRequests = [];
  this.responderAssignments = [];
  this.donorResponses = [];
  this.organizationResponses = [];
  this.donorProfiles = [];
  this.hospitalSubscriptions = [];
  this.conversations = [];
  this.messages = [];
  this.pushSubscriptions = [];
  this.donationRecords = [];
  this.hospitalLocations = new Map();
  this.donorLocations = new Map();
  this.rawQueries = [];
  this.rawExecutes = [];
  this.simulateDonorResponseDuplicate = false;
  this.simulateSubscriptionDuplicate = false;

  const matchesValue = (actual, expected) => {
    if (expected !== null && typeof expected === 'object') {
      if (Array.isArray(expected.in)) return expected.in.includes(actual);
      if (Array.isArray(expected.notIn))
        return !expected.notIn.includes(actual);
      return false;
    }
    return actual === expected;
  };

  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (key === 'organization') {
        const organization = this.organizations.find(
          (candidate) => candidate.id === row.organizationId,
        );
        return (
          Boolean(organization) &&
          Object.entries(value).every(([orgKey, orgValue]) =>
            matchesValue(organization[orgKey], orgValue),
          )
        );
      }
      return matchesValue(row[key], value);
    });

  const sortRows = (rows, orderByInput = []) => {
    const orderBy = Array.isArray(orderByInput)
      ? orderByInput
      : orderByInput
        ? [orderByInput]
        : [];
    let sorted = [...rows];
    for (const rule of [...orderBy].reverse()) {
      const [field, direction] = Object.entries(rule)[0];
      sorted = [...sorted].sort((a, b) => {
        const left = a[field];
        const right = b[field];
        const comparison = left < right ? -1 : left > right ? 1 : 0;
        return direction === 'desc' ? -comparison : comparison;
      });
    }
    return sorted;
  };

  // --- Spatial emulation of the PostGIS raw-SQL boundary -------------------

  const donorWithin = (profileId, hospitalId, radiusMeters) => {
    const donorPoint = this.donorLocations.get(profileId);
    const hospitalPoint = this.hospitalLocations.get(hospitalId);
    if (!donorPoint || !hospitalPoint) return false;
    return haversineMeters(donorPoint, hospitalPoint) <= radiusMeters;
  };

  // Prisma.sql keeps nested fragments as Sql objects inside `.values`;
  // flatten them so the emulation sees plain bind values.
  const flattenSql = (fragment) => {
    let text = '';
    const values = [];
    for (let i = 0; i < fragment.strings.length; i += 1) {
      text += fragment.strings[i];
      if (i < fragment.values.length) {
        const value = fragment.values[i];
        if (
          value !== null &&
          typeof value === 'object' &&
          Array.isArray(value.strings) &&
          Array.isArray(value.values)
        ) {
          const nested = flattenSql(value);
          text += nested.text;
          values.push(...nested.values);
        } else {
          values.push(value);
        }
      }
    }
    return { text, values };
  };

  this.$queryRaw = async (sql, ...rawValues) => {
    const fragment = Array.isArray(sql)
      ? { strings: sql, values: rawValues }
      : sql;
    const { text, values } = flattenSql(fragment);
    this.rawQueries.push({ sql: text, values });

    // Runtime schema capability check; these fixtures model the new layout.
    if (text.includes('information_schema.columns')) {
      return [{ present: true }];
    }

    // SELECT COUNT(*) for the donor request list.
    if (text.includes('COUNT(*)')) {
      const [status, bloodGroup, longitude, latitude, radius] = values;
      const rows = this.bloodRequests.filter((request) => {
        if (request.status !== status) return false;
        if (bloodGroup && request.bloodGroup !== bloodGroup) return false;
        if (longitude === undefined) return true;
        const point = this.hospitalLocations.get(request.hospitalId);
        if (!point) return false;
        return (
          haversineMeters(point, { latitude, longitude }) <= Number(radius)
        );
      });
      return [{ total: rows.length }];
    }

    // Donor request list with distance ranking.
    if (text.includes('"distanceMeters"') && text.includes('LIMIT')) {
      // With spatial filtering the distanceSelect bind values (lon, lat)
      // precede the WHERE binds: [lon, lat, status, group, lon, lat, r,
      // limit, offset]. Without it: [status, group, limit, offset].
      const hasSpatial = text.includes('ST_DWithin');
      const hasBloodGroup = text.includes('"bloodGroup" =');
      const status = values[hasSpatial ? 2 : 0];
      const bloodGroup = hasBloodGroup ? values[hasSpatial ? 3 : 1] : undefined;
      const longitude = hasSpatial ? values[4] : undefined;
      const latitude = hasSpatial ? values[5] : undefined;
      const radius = hasSpatial ? Number(values[6]) : undefined;
      const limit = Number(values[values.length - 2]);
      const offset = Number(values[values.length - 1]);

      const rows = this.bloodRequests
        .filter((request) => {
          if (request.status !== status) return false;
          if (bloodGroup && request.bloodGroup !== bloodGroup) return false;
          if (!hasSpatial) return true;
          const point = this.hospitalLocations.get(request.hospitalId);
          if (!point) return false;
          return haversineMeters(point, { latitude, longitude }) <= radius;
        })
        .map((request) => {
          const point = this.hospitalLocations.get(request.hospitalId);
          const distanceMeters =
            hasSpatial && point
              ? haversineMeters(point, { latitude, longitude })
              : null;
          return {
            id: request.id,
            bloodGroup: request.bloodGroup,
            component: request.component,
            unitsRequired: request.unitsRequired,
            urgency: request.urgency,
            requiredBy: request.requiredBy,
            status: request.status,
            hospitalName: this.organizations.find(
              (org) => org.id === request.hospitalId,
            )?.name,
            distanceMeters,
          };
        })
        .sort(
          (a, b) =>
            (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) ||
            a.requiredBy - b.requiredBy ||
            (a.id < b.id ? -1 : 1),
        )
        .slice(offset, offset + limit);
      return rows;
    }

    // Single-request distance check for the donor detail view.
    if (text.includes('"distanceMeters"')) {
      const longitude = values[0];
      const latitude = values[1];
      const requestId = values[2];
      const request = this.bloodRequests.find((row) => row.id === requestId);
      const point = request
        ? this.hospitalLocations.get(request.hospitalId)
        : undefined;
      if (!request || !point) return [{ distanceMeters: null }];
      return [
        {
          distanceMeters: haversineMeters(point, { latitude, longitude }),
        },
      ];
    }

    // Canonical geography read-back for a DonorProfile.
    if (text.includes('ST_Y')) {
      const profileId = values[0];
      const point = this.donorLocations.get(profileId);
      if (!point) return [{ latitude: null, longitude: null }];
      return [{ latitude: point.latitude, longitude: point.longitude }];
    }

    // matchCandidates radius tier (donor points vs hospital location).
    if (text.includes('"donorId"')) {
      const [hospitalId, bloodGroup, radius] = values;
      return this.donorProfiles
        .filter(
          (profile) =>
            profile.bloodGroup === bloodGroup &&
            donorWithin(profile.id, hospitalId, Number(radius)),
        )
        .map((profile) => ({ donorId: profile.id }));
    }

    throw new Error(`MemoryD4Store: unhandled $queryRaw: ${text}`);
  };

  this.$executeRaw = (...args) => {
    // Called as a Prisma tagged template: $executeRaw`...${v}...`.
    const [strings, ...rawValues] = args;
    const { text, values } = flattenSql({ strings, values: rawValues });
    this.rawExecutes.push({ sql: text, values });
    if (text.includes('ST_SetSRID(ST_MakePoint')) {
      const [longitude, latitude, profileId] = values;
      this.donorLocations.set(profileId, { latitude, longitude });
    }
    return Promise.resolve(1);
  };

  // --- Model delegates ------------------------------------------------------

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
        role: 'INDIVIDUAL',
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

  this.organization = {
    findUnique: async ({ where }) => {
      const organization = this.organizations.find(
        (candidate) => candidate.id === where.id,
      );
      return organization ? { ...organization } : null;
    },
  };

  this.organizationMembership = {
    findFirst: async ({ where }) => {
      const row = this.organizationMemberships.find((item) =>
        matches(item, where),
      );
      return row ? { ...row } : null;
    },
    findMany: async ({ where }) =>
      this.organizationMemberships
        .filter((item) => matches(item, where))
        .map((row) => ({ ...row })),
  };

  this.bloodRequest = {
    findUnique: async ({ where }) => {
      const row = this.bloodRequests.find((request) => matches(request, where));
      return row ? { ...row } : null;
    },
    findFirst: async ({ where, include }) => {
      const row = this.bloodRequests.find((request) => matches(request, where));
      if (!row) return null;
      if (include?.hospital) {
        return {
          ...row,
          hospital: this.organizations.find((org) => org.id === row.hospitalId),
        };
      }
      return { ...row };
    },
    findMany: async ({ where, orderBy = [], skip = 0, take }) => {
      const rows = sortRows(
        this.bloodRequests.filter((request) => matches(request, where)),
        orderBy,
      );
      const limited = take === undefined ? rows : rows.slice(skip, skip + take);
      return limited.map((row) => ({ ...row }));
    },
    count: async ({ where }) =>
      this.bloodRequests.filter((request) => matches(request, where)).length,
  };

  this.responderAssignment = {
    findFirst: async ({ where }) => {
      const row = this.responderAssignments.find((assignment) =>
        matches(assignment, where),
      );
      return row ? { ...row } : null;
    },
    findMany: async ({ where, orderBy = [] }) =>
      sortRows(
        this.responderAssignments.filter((assignment) =>
          matches(assignment, where),
        ),
        orderBy,
      ).map((row) => ({ ...row })),
    count: async ({ where }) =>
      this.responderAssignments.filter((assignment) =>
        matches(assignment, where),
      ).length,
  };

  const responseDelegate = (collection, uniqueKeys) => ({
    findFirst: async ({ where }) => {
      const row = collection.find((response) => matches(response, where));
      return row ? { ...row } : null;
    },
    findUnique: async ({ where }) => {
      const row = collection.find(
        (response) =>
          (where.id && response.id === where.id) || matches(response, where),
      );
      return row ? { ...row } : null;
    },
    findMany: async ({ where, orderBy = [] }) =>
      sortRows(
        collection.filter((response) => matches(response, where)),
        orderBy,
      ).map((row) => ({ ...row })),
    count: async ({ where }) =>
      collection.filter((response) => matches(response, where)).length,
    create: async ({ data }) => {
      const duplicate =
        this.simulateDonorResponseDuplicate ||
        collection.some((response) =>
          uniqueKeys.every((key) => response[key] === data[key]),
        );
      if (duplicate) throw { code: 'P2002' };
      const row = {
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      collection.push(row);
      return { ...row };
    },
    update: async ({ where, data }) => {
      const row = collection.find((response) => response.id === where.id);
      if (!row) throw { code: 'P2025' };
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
  });
  this.donorResponse = responseDelegate(this.donorResponses, [
    'bloodRequestId',
    'userId',
  ]);
  this.organizationResponse = responseDelegate(this.organizationResponses, [
    'bloodRequestId',
    'organizationId',
  ]);

  this.donorProfile = {
    findUnique: async ({ where }) => {
      const row = this.donorProfiles.find(
        (profile) =>
          (where.userId && profile.userId === where.userId) ||
          (where.id && profile.id === where.id),
      );
      return row ? { ...row } : null;
    },
    findMany: async ({ where }) =>
      this.donorProfiles
        .filter((profile) => matches(profile, where))
        .map((row) => ({ ...row })),
    count: async ({ where }) =>
      this.donorProfiles.filter((profile) => matches(profile, where)).length,
    create: async ({ data }) => {
      if (
        this.donorProfiles.some((profile) => profile.userId === data.userId)
      ) {
        throw { code: 'P2002' };
      }
      const row = {
        id: randomUUID(),
        bloodGroup: null,
        availabilityStatus: null,
        notificationPreference: null,
        coordinationStatus: 'ACTIVE',
        lastConfirmedDonationAt: null,
        eligibleFrom: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.donorProfiles.push(row);
      return { ...row };
    },
    update: async ({ where, data }) => {
      const row = this.donorProfiles.find(
        (profile) =>
          (where.userId && profile.userId === where.userId) ||
          (where.id && profile.id === where.id),
      );
      if (!row) throw { code: 'P2025' };
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
  };

  this.hospitalSubscription = {
    findFirst: async ({ where }) => {
      const row = this.hospitalSubscriptions.find((subscription) =>
        matches(subscription, where),
      );
      return row ? { ...row } : null;
    },
    findMany: async ({ where, orderBy = [] }) =>
      sortRows(
        this.hospitalSubscriptions.filter((subscription) =>
          matches(subscription, where),
        ),
        orderBy,
      ).map((row) => ({ ...row })),
    count: async ({ where }) =>
      this.hospitalSubscriptions.filter((subscription) =>
        matches(subscription, where),
      ).length,
    create: async ({ data }) => {
      if (
        this.simulateSubscriptionDuplicate ||
        this.hospitalSubscriptions.some(
          (subscription) =>
            subscription.hospitalId === data.hospitalId &&
            subscription.userId === data.userId,
        )
      ) {
        throw { code: 'P2002' };
      }
      const row = {
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.hospitalSubscriptions.push(row);
      return { ...row };
    },
    update: async ({ where, data }) => {
      const row = this.hospitalSubscriptions.find(
        (subscription) => subscription.id === where.id,
      );
      if (!row) throw { code: 'P2025' };
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
    delete: async ({ where }) => {
      const index = this.hospitalSubscriptions.findIndex(
        (subscription) => subscription.id === where.id,
      );
      if (index === -1) throw { code: 'P2025' };
      const [removed] = this.hospitalSubscriptions.splice(index, 1);
      return removed;
    },
  };

  this.organizationSubscription = {
    findFirst: async ({ where }) => {
      const row = this.hospitalSubscriptions.find((subscription) =>
        matches(subscription, {
          hospitalId: where.organizationId,
          userId: where.userId,
        }),
      );
      return row
        ? {
            ...row,
            organizationId: row.hospitalId,
            organization: { name: 'Test hospital', type: 'HOSPITAL' },
          }
        : null;
    },
    findMany: async ({ where, orderBy = [] }) =>
      sortRows(
        this.hospitalSubscriptions.filter((subscription) =>
          matches(subscription, {
            hospitalId: where.organizationId,
            userId: where.userId,
            status: where.status,
          }),
        ),
        orderBy,
      ).map((row) => ({
        ...row,
        organizationId: row.hospitalId,
        organization: { name: 'Test hospital', type: 'HOSPITAL' },
      })),
    create: async ({ data }) => {
      const row = await this.hospitalSubscription.create({
        data: { ...data, hospitalId: data.organizationId },
      });
      return {
        ...row,
        organizationId: row.hospitalId,
        organization: { name: 'Test hospital', type: 'HOSPITAL' },
      };
    },
    update: async ({ where, data }) => {
      const row = await this.hospitalSubscription.update({ where, data });
      return {
        ...row,
        organizationId: row.hospitalId,
        organization: { name: 'Test hospital', type: 'HOSPITAL' },
      };
    },
    delete: this.hospitalSubscription.delete,
  };

  this.conversation = {
    findFirst: async ({ where }) => {
      const row = this.conversations.find((conversation) =>
        matches(conversation, where),
      );
      return row ? { ...row } : null;
    },
    create: async ({ data }) => {
      const row = {
        id: randomUUID(),
        donorUserId: null,
        organizationId: null,
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.conversations.push(row);
      return { ...row };
    },
    count: async ({ where }) =>
      this.conversations.filter((conversation) => matches(conversation, where))
        .length,
  };

  this.message = {
    create: async ({ data }) => {
      const row = {
        id: randomUUID(),
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.messages.push(row);
      return { ...row };
    },
    findMany: async ({ where, orderBy = [] }) =>
      sortRows(
        this.messages.filter((message) => matches(message, where)),
        orderBy,
      ).map((row) => ({ ...row })),
    count: async ({ where }) =>
      this.messages.filter((message) => matches(message, where)).length,
  };

  this.pushSubscription = {
    findMany: async ({ where, orderBy = [] }) =>
      sortRows(
        this.pushSubscriptions.filter((subscription) =>
          matches(subscription, where),
        ),
        orderBy,
      ).map((row) => ({ ...row })),
    count: async ({ where }) =>
      this.pushSubscriptions.filter((subscription) =>
        matches(subscription, where),
      ).length,
  };

  this.donationRecord = {
    count: async ({ where }) =>
      this.donationRecords.filter((record) => matches(record, where)).length,
    findMany: async ({ where }) =>
      this.donationRecords
        .filter((record) => matches(record, where))
        .map((row) => ({ ...row })),
  };

  this.$transaction = async (argument) => {
    if (Array.isArray(argument)) return Promise.all(argument);
    return argument({
      bloodRequest: this.bloodRequest,
      organization: this.organization,
      user: this.user,
      $executeRaw: this.$executeRaw,
    });
  };

  this.verifyConnection = async () => {};
}
