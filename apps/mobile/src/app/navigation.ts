import type { AuthUser } from '@bloodlink/contracts';

export type MobileRoute =
  | '/auth'
  | '/profile'
  | '/organizations'
  | '/conversations'
  | '/subscriptions'
  | '/notifications'
  | '/hospitals'
  | '/patient-needs'
  | '/patient-needs/new';

export type MobileNavigationItem = {
  label: string;
  href: MobileRoute;
};

export function getMobileNavigationItems(
  user: AuthUser | null,
): MobileNavigationItem[] {
  if (!user) return [{ label: 'Sign in', href: '/auth' }];

  const items: MobileNavigationItem[] = [
    { label: 'Profile', href: '/profile' },
    { label: 'Organizations', href: '/organizations' },
  ];

  if (user.role === 'INDIVIDUAL') {
    items.push(
      { label: 'Nearby hospitals', href: '/hospitals' },
      { label: 'Submit a patient need', href: '/patient-needs/new' },
      { label: 'My patient needs', href: '/patient-needs' },
      { label: 'Notifications', href: '/notifications' },
    );
  }

  if (user.organizations.length > 0) {
    items.push(
      { label: 'Conversations', href: '/conversations' },
      { label: 'Subscriptions', href: '/subscriptions' },
      ...(user.role === 'ADMIN'
        ? [{ label: 'Notifications', href: '/notifications' } as const]
        : []),
    );
  }

  return items;
}
