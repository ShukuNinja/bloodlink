import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuthUser } from '@bloodlink/contracts';
import {
  canAccessRoute,
  defaultLandingPath,
  safePostAuthPath,
} from './auth-routing.ts';

const user = (
  role: AuthUser['role'],
  type?: AuthUser['organizations'][number]['type'],
): AuthUser => ({
  id: 'user-id',
  name: 'Person',
  email: 'person@example.com',
  status: 'ACTIVE',
  role,
  organizations: type
    ? [
        {
          id: 'organization-id',
          name: 'Example',
          type,
          role: type === 'HOSPITAL' ? 'HOSPITAL_ADMIN' : 'BLOOD_CENTRE_ADMIN',
        },
      ]
    : [],
});

describe('role-specific auth routing', () => {
  it('routes each account type to its matching landing page', () => {
    assert.equal(defaultLandingPath(user('INDIVIDUAL')), '/hospitals');
    assert.equal(
      defaultLandingPath(user('INDIVIDUAL', 'HOSPITAL')),
      '/hospital/patient-needs',
    );
    assert.equal(
      defaultLandingPath(user('INDIVIDUAL', 'BLOOD_CENTRE')),
      '/blood-centre',
    );
    assert.equal(defaultLandingPath(user('ADMIN')), '/admin');
  });

  it('allows only the matching account type into protected web areas', () => {
    assert.equal(canAccessRoute(user('INDIVIDUAL'), '/hospitals'), true);
    assert.equal(canAccessRoute(user('INDIVIDUAL'), '/patient-needs'), true);
    assert.equal(canAccessRoute(user('INDIVIDUAL'), '/donor'), true);
    assert.equal(canAccessRoute(user('INDIVIDUAL'), '/notifications'), true);
    assert.equal(
      canAccessRoute(user('INDIVIDUAL'), '/hospital/patient-needs'),
      false,
    );
    assert.equal(
      canAccessRoute(user('INDIVIDUAL', 'HOSPITAL'), '/hospitals'),
      false,
    );
    assert.equal(
      canAccessRoute(user('INDIVIDUAL', 'HOSPITAL'), '/hospital/patient-needs'),
      true,
    );
    assert.equal(
      canAccessRoute(user('INDIVIDUAL', 'BLOOD_CENTRE'), '/blood-centre'),
      true,
    );
    assert.equal(canAccessRoute(user('ADMIN'), '/admin'), true);
    assert.equal(canAccessRoute(user('INDIVIDUAL'), '/admin'), false);
    assert.equal(canAccessRoute(user('ADMIN'), '/notifications'), true);
    assert.equal(
      canAccessRoute(user('INDIVIDUAL', 'HOSPITAL'), '/notifications'),
      true,
    );
    assert.equal(
      canAccessRoute(user('INDIVIDUAL', 'BLOOD_CENTRE'), '/notifications'),
      true,
    );
    assert.equal(
      canAccessRoute(user('INDIVIDUAL', 'HOSPITAL'), '/donor'),
      false,
    );
  });

  it('uses a valid authorized return path, otherwise the role landing page', () => {
    assert.equal(
      safePostAuthPath(user('INDIVIDUAL'), '/patient-needs'),
      '/patient-needs',
    );
    assert.equal(safePostAuthPath(user('INDIVIDUAL'), '/admin'), '/hospitals');
    assert.equal(safePostAuthPath(user('ADMIN'), '//example.com'), '/admin');
  });
});
