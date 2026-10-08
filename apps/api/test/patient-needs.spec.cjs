/* global require */
/* eslint-disable @typescript-eslint/no-require-imports */

const { describe, it } = require('node:test');

describe('PatientNeed scaffold (TODO(D2))', () => {
  it.todo('creates a need with server-controlled owner and initial status');
  it.todo('lists only the authenticated user’s needs');
  it.todo('retrieves only an owned need');
  it.todo('cancels only an owned pending need');
  it.todo('enforces ownership for retrieval and cancellation');
  it.todo('validates CreatePatientNeedSchema inputs');
  it.todo('does not allow the individual to verify or reject a need');
});
