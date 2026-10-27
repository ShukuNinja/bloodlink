import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMobileNavigationItems } from '../../app/navigation.ts';
import type { AuthUser } from '@bloodlink/contracts';

const individual: AuthUser = {
  id: 'user-1',
  name: 'Asha',
  email: 'asha@example.com',
  status: 'ACTIVE',
  role: 'INDIVIDUAL',
  organizations: [],
};

test('guest navigation offers a clear sign-in route only', () => {
  assert.deepEqual(getMobileNavigationItems(null), [
    { label: 'Sign in', href: '/auth' },
  ]);
});

test('individual navigation contains patient need and hospital actions', () => {
  const hrefs = getMobileNavigationItems(individual).map((item) => item.href);
  assert.ok(hrefs.includes('/hospitals'));
  assert.ok(hrefs.includes('/patient-needs/new'));
  assert.ok(hrefs.includes('/patient-needs'));
  assert.ok(hrefs.includes('/notifications'));
  assert.ok(!hrefs.includes('/conversations'));
});

test('individual organization members get individual and organization pages', () => {
  const user = {
    ...individual,
    organizations: [
      {
        id: 'org-1',
        name: 'City Hospital',
        type: 'HOSPITAL' as const,
        role: 'HOSPITAL_ADMIN' as const,
      },
    ],
  };
  const hrefs = getMobileNavigationItems(user).map((item) => item.href);
  assert.ok(hrefs.includes('/conversations'));
  assert.ok(hrefs.includes('/subscriptions'));
  assert.ok(hrefs.includes('/patient-needs/new'));
});
